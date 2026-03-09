import { EventEmitter } from "events";

// ── Lazy-loaded SDK ───────────────────────────────────────────────────
// The SDK ships as ESM-only (.mjs). Electron's main process is CJS, so
// a static import gets compiled to require() which fails. Dynamic
// import() works in both CJS and ESM contexts.

let _sdk: typeof import("@anthropic-ai/claude-agent-sdk") | null = null;

async function getSDK() {
  if (!_sdk) {
    _sdk = await import("@anthropic-ai/claude-agent-sdk");
  }
  return _sdk;
}

// ── Types ──────────────────────────────────────────────────────────────

// Re-declare the types we need so consumers don't import from the SDK directly
export type PermissionMode = "default" | "acceptEdits" | "bypassPermissions" | "plan" | "dontAsk";
export type PermissionResult = { behavior: "allow" } | { behavior: "deny"; message?: string };

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
  query: { close(): void; interrupt(): Promise<void>; setPermissionMode(mode: PermissionMode): Promise<void>; [Symbol.asyncIterator](): AsyncIterator<unknown> };
  cwd: string;
  sdkSessionId?: string;
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

    try {
      const sdk = await getSDK();

      const options: Record<string, unknown> = {
        cwd: config.cwd,
        includePartialMessages: true,
        permissionMode: config.permissionMode ?? "default",
        model: config.model,
        settingSources: ["user", "project"],
        systemPrompt: { type: "preset", preset: "claude_code" },
        env: {
          ...process.env,
          PATH: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH ?? ""}`,
          CLAUDECODE: undefined,
          CLAUDE_AGENT_SDK_CLIENT_APP: "breadcrumb-desktop/0.1.0",
        },
        canUseTool: (toolName: string, input: Record<string, unknown>, opts: { signal: AbortSignal; toolUseID: string; decisionReason?: string }) =>
          this.handleToolApproval(config.sessionId, toolName, input, opts),
      };

      if (config.resume) {
        options.resume = config.resume;
      }

      const session = sdk.query({ prompt: config.prompt, options });

      this.sessions.set(config.sessionId, {
        id: config.sessionId,
        query: session as ActiveSession["query"],
        cwd: config.cwd,
      });

      this.consumeStream(config.sessionId, session as ActiveSession["query"]);
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
   * Send a follow-up message to an existing session by resuming it.
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

    try {
      existing.query.close();
    } catch {
      // Already done
    }
    this.sessions.delete(sessionId);

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
  ): Promise<unknown[]> {
    try {
      const sdk = await getSDK();
      return await sdk.listSessions({ dir: cwd, limit });
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

  private async consumeStream(
    sessionId: string,
    session: ActiveSession["query"]
  ): Promise<void> {
    try {
      for await (const message of session) {
        const msg = message as Record<string, unknown>;
        if (msg.type === "system" && msg.subtype === "init") {
          const active = this.sessions.get(sessionId);
          if (active) {
            active.sdkSessionId = msg.session_id as string | undefined;
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
