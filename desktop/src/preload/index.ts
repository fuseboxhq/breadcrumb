import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS } from "../shared/types";

// Terminal API types
export interface TerminalDataEvent {
  sessionId: string;
  data: string;
}

export interface TerminalExitEvent {
  sessionId: string;
  exitCode: number;
  signal?: number;
}

export interface BreadcrumbAPI {
  // System
  getWorkingDirectory: () => Promise<string>;

  // File operations
  selectDirectory: () => Promise<string | null>;

  // Terminal operations
  createTerminal: (config: {
    id: string;
    name: string;
    workingDirectory: string;
  }) => Promise<{ success: boolean; sessionId?: string; error?: string }>;
  writeTerminal: (sessionId: string, data: string) => Promise<{ success: boolean; error?: string }>;
  resizeTerminal: (sessionId: string, cols: number, rows: number) => Promise<{ success: boolean; error?: string }>;
  terminateTerminal: (sessionId: string) => Promise<{ success: boolean; error?: string }>;
  onTerminalData: (callback: (data: TerminalDataEvent) => void) => () => void;
  onTerminalExit: (callback: (data: TerminalExitEvent) => void) => () => void;

  // Git operations
  getGitInfo: (workingDirectory: string) => Promise<{
    success: boolean;
    gitInfo?: { isGitRepo: boolean; branch: string; remote: string; repoName: string };
    error?: string;
  }>;
}

const api: BreadcrumbAPI = {
  // System
  getWorkingDirectory: () => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_GET_WORKING_DIR),

  // File operations
  selectDirectory: () => ipcRenderer.invoke(IPC_CHANNELS.DIALOG_SELECT_DIRECTORY),

  // Terminal operations
  createTerminal: (config) =>
    ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_CREATE, config),

  writeTerminal: (sessionId, data) =>
    ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_WRITE, { sessionId, data }),

  resizeTerminal: (sessionId, cols, rows) =>
    ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_RESIZE, { sessionId, cols, rows }),

  terminateTerminal: (sessionId) =>
    ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_TERMINATE, sessionId),

  onTerminalData: (callback) => {
    const handler = (_: Electron.IpcRendererEvent, data: TerminalDataEvent) =>
      callback(data);
    ipcRenderer.on(IPC_CHANNELS.TERMINAL_DATA, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.TERMINAL_DATA, handler);
  },

  onTerminalExit: (callback) => {
    const handler = (_: Electron.IpcRendererEvent, data: TerminalExitEvent) =>
      callback(data);
    ipcRenderer.on(IPC_CHANNELS.TERMINAL_EXIT, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.TERMINAL_EXIT, handler);
  },

  // Git operations
  getGitInfo: (workingDirectory) =>
    ipcRenderer.invoke(IPC_CHANNELS.GIT_INFO, { workingDirectory }),
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld("breadcrumbAPI", api);

// Type declaration for renderer access
declare global {
  interface Window {
    breadcrumbAPI: BreadcrumbAPI;
  }
}
