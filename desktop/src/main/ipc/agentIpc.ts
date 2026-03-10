import { BrowserWindow, ipcMain } from "electron";
import { IPC_CHANNELS } from "../../shared/types";
import {
  agentService,
  type AgentApprovalRequest,
} from "../agent/AgentService";
import type { SDKMessage, PermissionMode } from "@anthropic-ai/claude-agent-sdk";

let handlersRegistered = false;

export function registerAgentIPCHandlers(
  mainWindow: BrowserWindow
): () => void {
  if (handlersRegistered) return () => {};
  handlersRegistered = true;

  // ── Request-response handlers ────────────────────────────────────────

  ipcMain.handle(
    IPC_CHANNELS.AGENT_START,
    async (
      _,
      config: {
        sessionId: string;
        prompt: string;
        cwd: string;
        permissionMode?: PermissionMode;
        resume?: string;
        model?: string;
      }
    ) => {
      try {
        const ok = await agentService.startSession(config);
        return { success: ok, error: ok ? undefined : "Failed to start session" };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.AGENT_SEND,
    async (
      _,
      payload: {
        sessionId: string;
        prompt: string;
        permissionMode?: PermissionMode;
      }
    ) => {
      try {
        const ok = await agentService.sendMessage(
          payload.sessionId,
          payload.prompt,
          payload.permissionMode
        );
        return { success: ok };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.AGENT_INTERRUPT,
    async (_, sessionId: string) => {
      try {
        const ok = await agentService.interrupt(sessionId);
        return { success: ok };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.AGENT_TERMINATE,
    async (_, sessionId: string) => {
      try {
        const ok = agentService.terminate(sessionId);
        return { success: ok };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.AGENT_APPROVE,
    async (
      _,
      payload: {
        toolUseID: string;
        decision: "allow" | "deny";
        message?: string;
        alwaysAllow?: boolean;
      }
    ) => {
      console.log("[agentIpc] AGENT_APPROVE received:", payload);
      try {
        const ok = agentService.resolveApproval(
          payload.toolUseID,
          payload.decision,
          { message: payload.message, alwaysAllow: payload.alwaysAllow }
        );
        console.log("[agentIpc] AGENT_APPROVE result:", { ok, toolUseID: payload.toolUseID });
        return { success: ok };
      } catch (error) {
        console.error("[agentIpc] AGENT_APPROVE error:", error);
        return { success: false, error: String(error) };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.AGENT_SET_PERMISSION_MODE,
    async (_, payload: { sessionId: string; mode: PermissionMode }) => {
      try {
        const ok = await agentService.setPermissionMode(
          payload.sessionId,
          payload.mode
        );
        return { success: ok };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.AGENT_LIST_SESSIONS,
    async (_, payload: { cwd: string; limit?: number }) => {
      try {
        const sessions = await agentService.listSessions(
          payload.cwd,
          payload.limit
        );
        return { success: true, sessions };
      } catch (error) {
        return { success: false, error: String(error), sessions: [] };
      }
    }
  );

  // ── Event forwarding (main → renderer) ──────────────────────────────

  const messageHandler = (data: {
    sessionId: string;
    message: SDKMessage;
  }) => {
    mainWindow.webContents.send(IPC_CHANNELS.AGENT_MESSAGE, data);
  };

  const approvalHandler = (data: AgentApprovalRequest) => {
    mainWindow.webContents.send(IPC_CHANNELS.AGENT_APPROVAL_REQUEST, data);
  };

  const errorHandler = (data: { sessionId: string; error: string }) => {
    mainWindow.webContents.send(IPC_CHANNELS.AGENT_ERROR, data);
  };

  const doneHandler = (data: { sessionId: string }) => {
    mainWindow.webContents.send(IPC_CHANNELS.AGENT_DONE, data);
  };

  const terminatedHandler = (data: { sessionId: string }) => {
    mainWindow.webContents.send(IPC_CHANNELS.AGENT_TERMINATED, data);
  };

  agentService.on("message", messageHandler);
  agentService.on("approvalRequest", approvalHandler);
  agentService.on("error", errorHandler);
  agentService.on("done", doneHandler);
  agentService.on("terminated", terminatedHandler);

  // ── Cleanup ─────────────────────────────────────────────────────────

  return () => {
    agentService.off("message", messageHandler);
    agentService.off("approvalRequest", approvalHandler);
    agentService.off("error", errorHandler);
    agentService.off("done", doneHandler);
    agentService.off("terminated", terminatedHandler);

    ipcMain.removeHandler(IPC_CHANNELS.AGENT_START);
    ipcMain.removeHandler(IPC_CHANNELS.AGENT_SEND);
    ipcMain.removeHandler(IPC_CHANNELS.AGENT_INTERRUPT);
    ipcMain.removeHandler(IPC_CHANNELS.AGENT_TERMINATE);
    ipcMain.removeHandler(IPC_CHANNELS.AGENT_APPROVE);
    ipcMain.removeHandler(IPC_CHANNELS.AGENT_SET_PERMISSION_MODE);
    ipcMain.removeHandler(IPC_CHANNELS.AGENT_LIST_SESSIONS);

    agentService.terminateAll();
    handlersRegistered = false;
  };
}
