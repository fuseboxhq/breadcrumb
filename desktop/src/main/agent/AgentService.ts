import { EventEmitter } from "events";
import {
  query,
  listSessions,
  type Query,
  type Options,
  type SDKMessage,
  type PermissionMode,
  type PermissionResult,
  type SDKSessionInfo,
} from "@anthropic-ai/claude-agent-sdk";

// ── Types ──────────────────────────────────────────────────────────────

export interface AgentStartConfig {
  sessionId: string;
  prompt: string;
  cwd: string;
  permissionMode?: PermissionMode;
  resume?: string;
  model?: string;
}

export interface AgentApprovalRequest {
  sessionId: string;
  toolUseID: string;
  toolName: string;
  input: Record<string, unknown>;
  decisionReason?: string;
}

interface ActiveSession {
  id: string;
  query: Query;
  cwd: string;
  sdkSessionId?: string; // Claude Code's internal session ID
}

type PendingApproval = {
  resolve: (result: PermissionResult) => void;
  request: AgentApprovalRequest;
};

// ── Service ────────────────────────────────────────────────────────────

export class AgentService extends EventEmitter {
  private sessions: Map<string, ActiveSession> = new Map();
  private pendingApprovals: Map<string, PendingApproval> = new Map();

  /**
   * Start a new agent session. The SDK spawns a Claude Code subprocess
   * and streams typed events back via the async generator.
   */
  async startSession(config: AgentStartConfig): Promise<boolean> {
    if (this.sessions.has(config.sessionId)) {
      this.emit("error", {
        sessionId: config.sessionId,
        error: "Session already exists",
      });
      return false;
    }

    const options: Options = {
      cwd: config.cwd,
      includePartialMessages: true,
      permissionMode: config.permissionMode ?? "default",
      model: config.model,
      settingSources: ["user", "project"],
      systemPrompt: { type: "preset", preset: "claude_code" },
      env: {
        ...process.env,
        // Electron GUI apps may not inherit shell PATH
        PATH: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH ?? ""}`,
        // Prevent "cannot launch inside another Claude Code session"
        CLAUDECODE: undefined,
        CLAUDE_AGENT_SDK_CLIENT_APP: "breadcrumb-desktop/0.1.0",
      },
      canUseTool: (toolName, input, opts) =>
        this.handleToolApproval(config.sessionId, toolName, input, opts),
    };

    if (config.resume) {
      options.resume = config.resume;
    }

    try {
      const session = query({ prompt: config.prompt, options });

      this.sessions.set(config.sessionId, {
        id: config.sessionId,
        query: session,
        cwd: config.cwd,
      });

      // Iterate the async generator in the background
      this.consumeStream(config.sessionId, session);
      return true;
    } catch (error) {
      this.emit("error", {
        sessionId: config.sessionId,
        error: String(error),
      });
      return false;
    }
  }

  /**
   * Send a follow-up message to an existing session by resuming it
   * with a new prompt. The previous query must have finished.
   */
  async sendMessage(
    sessionId: string,
    prompt: string,
    permissionMode?: PermissionMode
  ): Promise<boolean> {
    const existing = this.sessions.get(sessionId);
    if (!existing?.sdkSessionId) {
      this.emit("error", {
        sessionId,
        error: existing
          ? "Session not yet initialized (no SDK session ID)"
          : "Session not found",
      });
      return false;
    }

    const sdkSessionId = existing.sdkSessionId;
    const cwd = existing.cwd;

    // Clean up old query
    try {
      existing.query.close();
    } catch {
      // Already done
    }
    this.sessions.delete(sessionId);

    // Start a new query that resumes the previous session
    return this.startSession({
      sessionId,
      prompt,
      cwd,
      permissionMode,
      resume: sdkSessionId,
    });
  }

  /**
   * Interrupt the current turn (graceful stop).
   */
  async interrupt(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    try {
      await session.query.interrupt();
      return true;
    } catch (error) {
      this.emit("error", { sessionId, error: String(error) });
      return false;
    }
  }

  /**
   * Respond to a pending tool approval request.
   */
  resolveApproval(
    toolUseID: string,
    decision: "allow" | "deny",
    message?: string
  ): boolean {
    const pending = this.pendingApprovals.get(toolUseID);
    if (!pending) return false;

    this.pendingApprovals.delete(toolUseID);

    if (decision === "allow") {
      pending.resolve({ behavior: "allow" });
    } else {
      pending.resolve({ behavior: "deny", message: message ?? "User denied" });
    }
    return true;
  }

  /**
   * Change the permission mode for an active session.
   */
  async setPermissionMode(
    sessionId: string,
    mode: PermissionMode
  ): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    try {
      await session.query.setPermissionMode(mode);
      return true;
    } catch (error) {
      this.emit("error", { sessionId, error: String(error) });
      return false;
    }
  }

  /**
   * List previous sessions for a project directory.
   */
  async listSessions(
    cwd: string,
    limit = 10
  ): Promise<SDKSessionInfo[]> {
    try {
      return await listSessions({ dir: cwd, limit });
    } catch {
      return [];
    }
  }

  /**
   * Force-close a session and terminate the subprocess.
   */
  terminate(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    // Reject any pending approvals
    for (const [id, pending] of this.pendingApprovals) {
      if (pending.request.sessionId === sessionId) {
        pending.resolve({ behavior: "deny", message: "Session terminated" });
        this.pendingApprovals.delete(id);
      }
    }

    try {
      session.query.close();
    } catch {
      // Already closed
    }

    this.sessions.delete(sessionId);
    this.emit("terminated", { sessionId });
    return true;
  }

  /**
   * Terminate all active sessions.
   */
  terminateAll(): void {
    for (const sessionId of this.sessions.keys()) {
      this.terminate(sessionId);
    }
  }

  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  getSessionIds(): string[] {
    return Array.from(this.sessions.keys());
  }

  // ── Private ────────────────────────────────────────────────────────

  /**
   * Consume the SDK's async generator and emit events for each message.
   */
  private async consumeStream(
    sessionId: string,
    session: Query
  ): Promise<void> {
    try {
      for await (const message of session) {
        // Capture the SDK session ID from the init message
        if (message.type === "system" && "subtype" in message && message.subtype === "init") {
          const active = this.sessions.get(sessionId);
          if (active) {
            active.sdkSessionId = (message as SDKMessage & { session_id?: string }).session_id;
          }
        }

        this.emit("message", { sessionId, message });
      }
    } catch (error) {
      this.emit("error", { sessionId, error: String(error) });
    } finally {
      this.sessions.delete(sessionId);
      this.emit("done", { sessionId });
    }
  }

  /**
   * Handle a tool approval request by forwarding it to the renderer
   * and waiting for the user's decision.
   */
  private handleToolApproval(
    sessionId: string,
    toolName: string,
    input: Record<string, unknown>,
    opts: {
      signal: AbortSignal;
      toolUseID: string;
      decisionReason?: string;
    }
  ): Promise<PermissionResult> {
    return new Promise<PermissionResult>((resolve) => {
      const request: AgentApprovalRequest = {
        sessionId,
        toolUseID: opts.toolUseID,
        toolName,
        input,
        decisionReason: opts.decisionReason,
      };

      this.pendingApprovals.set(opts.toolUseID, { resolve, request });
      this.emit("approvalRequest", request);

      // If the signal aborts, auto-deny
      opts.signal.addEventListener(
        "abort",
        () => {
          if (this.pendingApprovals.has(opts.toolUseID)) {
            this.pendingApprovals.delete(opts.toolUseID);
            resolve({ behavior: "deny", message: "Operation aborted" });
          }
        },
        { once: true }
      );
    });
  }
}

export const agentService = new AgentService();
