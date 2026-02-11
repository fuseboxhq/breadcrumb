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
  readFile: (filePath: string) => Promise<{ success: boolean; content: string | null }>;

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

  // Extension operations
  getExtensions: () => Promise<ExtensionInfoForRenderer[]>;
  activateExtension: (id: string) => Promise<{ success: boolean; error?: string }>;
  deactivateExtension: (id: string) => Promise<{ success: boolean; error?: string }>;
  getExtensionCommands: () => Promise<string[]>;
  executeExtensionCommand: (commandId: string, ...args: unknown[]) => Promise<{ success: boolean; result?: unknown; error?: string }>;
  onExtensionsChanged: (callback: (extensions: ExtensionInfoForRenderer[]) => void) => () => void;
}

export interface ExtensionInfoForRenderer {
  id: string;
  displayName: string;
  version: string;
  description: string;
  status: string;
  publisher: string;
  capabilities: Record<string, unknown>;
  commands: Array<{ command: string; title: string; category?: string }>;
}

const api: BreadcrumbAPI = {
  // System
  getWorkingDirectory: () => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_GET_WORKING_DIR),
  readFile: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_READ_FILE, filePath),

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

  // Extension operations
  getExtensions: () => ipcRenderer.invoke(IPC_CHANNELS.EXTENSIONS_LIST),

  activateExtension: (id) =>
    ipcRenderer.invoke(IPC_CHANNELS.EXTENSIONS_ACTIVATE, id),

  deactivateExtension: (id) =>
    ipcRenderer.invoke(IPC_CHANNELS.EXTENSIONS_DEACTIVATE, id),

  getExtensionCommands: () =>
    ipcRenderer.invoke(IPC_CHANNELS.EXTENSIONS_COMMANDS),

  executeExtensionCommand: (commandId, ...args) =>
    ipcRenderer.invoke(IPC_CHANNELS.EXTENSIONS_EXECUTE_COMMAND, commandId, ...args),

  onExtensionsChanged: (callback) => {
    const handler = (_: Electron.IpcRendererEvent, data: ExtensionInfoForRenderer[]) =>
      callback(data);
    ipcRenderer.on(IPC_CHANNELS.EXTENSIONS_STATUS_CHANGED, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.EXTENSIONS_STATUS_CHANGED, handler);
  },
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld("breadcrumbAPI", api);

// Type declaration for renderer access
declare global {
  interface Window {
    breadcrumbAPI: BreadcrumbAPI;
  }
}
