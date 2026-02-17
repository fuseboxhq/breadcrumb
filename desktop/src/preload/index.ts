import { contextBridge, ipcRenderer } from "electron";
import {
  IPC_CHANNELS,
  BrowserBounds,
  BrowserNavigateEvent,
  BrowserLoadingChangeEvent,
  BrowserTitleChangeEvent,
  BrowserErrorEvent,
} from "../shared/types";
import type { AppSettings } from "../main/settings/SettingsStore";
import type { ExtensionInfoForRenderer } from "../main/extensions/types";

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

export interface TerminalProcessChangeEvent {
  sessionId: string;
  processName: string;
  processLabel: string;
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
    cols?: number;
    rows?: number;
  }) => Promise<{ success: boolean; sessionId?: string; error?: string }>;
  writeTerminal: (sessionId: string, data: string) => Promise<{ success: boolean; error?: string }>;
  resizeTerminal: (sessionId: string, cols: number, rows: number) => Promise<{ success: boolean; error?: string }>;
  terminateTerminal: (sessionId: string) => Promise<{ success: boolean; error?: string }>;
  onTerminalData: (callback: (data: TerminalDataEvent) => void) => () => void;
  onTerminalExit: (callback: (data: TerminalExitEvent) => void) => () => void;
  onTerminalProcessChange: (callback: (data: TerminalProcessChangeEvent) => void) => () => void;

  // Project operations
  getRecentProjects: () => Promise<{ success: boolean; projects: Array<{ path: string; name: string; lastOpened: number }>; error?: string }>;
  addRecentProject: (project: { path: string; name: string }) => Promise<{ success: boolean; error?: string }>;
  removeRecentProject: (projectPath: string) => Promise<{ success: boolean; error?: string }>;

  // Git operations
  getGitInfo: (workingDirectory: string) => Promise<{
    success: boolean;
    gitInfo?: { isGitRepo: boolean; branch: string; remote: string; repoName: string };
    error?: string;
  }>;
  getGitLog: (
    projectPath: string,
    options?: { maxCount?: number; skip?: number; grep?: string }
  ) => Promise<{ success: boolean; data?: { commits: Array<Record<string, unknown>>; hasMore: boolean }; error?: string }>;
  getGitDiff: (
    projectPath: string,
    hash: string
  ) => Promise<{ success: boolean; data?: Record<string, unknown> | null; error?: string }>;
  getGitCommitStats: (
    projectPath: string,
    hash: string
  ) => Promise<{ success: boolean; data?: Record<string, unknown> | null; error?: string }>;

  // Settings operations
  getSettings: () => Promise<AppSettings>;
  setSetting: (key: string, value: unknown) => Promise<{ success: boolean; error?: string }>;
  resetSettings: () => Promise<{ success: boolean }>;
  onSettingsChanged: (callback: (settings: AppSettings) => void) => () => void;

  // Planning operations
  getPlanningCapabilities: (projectPath: string) => Promise<{ success: boolean; data?: { hasPlanning: boolean; hasBeads: boolean }; error?: string }>;
  getPlanningPhases: (projectPath: string) => Promise<{ success: boolean; data?: Array<{ id: string; title: string; status: string; taskCount: number; completedCount: number; isActive: boolean }>; error?: string }>;
  getPlanningPhaseDetail: (projectPath: string, phaseId: string) => Promise<{ success: boolean; data?: Record<string, unknown> | null; error?: string }>;
  getPlanningBeadsTasks: (projectPath: string, epicId: string) => Promise<{ success: boolean; data?: Array<Record<string, unknown>>; error?: string }>;
  updatePlanningTaskDetail: (projectPath: string, phaseId: string, taskId: string, content: string) => Promise<{ success: boolean; error?: string }>;

  // Extension operations
  getExtensions: () => Promise<ExtensionInfoForRenderer[]>;
  activateExtension: (id: string) => Promise<{ success: boolean; error?: string }>;
  deactivateExtension: (id: string) => Promise<{ success: boolean; error?: string }>;
  getExtensionCommands: () => Promise<string[]>;
  executeExtensionCommand: (commandId: string, ...args: unknown[]) => Promise<{ success: boolean; result?: unknown; error?: string }>;
  onExtensionsChanged: (callback: (extensions: ExtensionInfoForRenderer[]) => void) => () => void;

  // Browser operations (embedded WebContentsView)
  browser: {
    create: (browserId: string) => Promise<{ success: boolean; error?: string }>;
    navigate: (browserId: string, url: string) => Promise<{ success: boolean; error?: string }>;
    goBack: (browserId: string) => Promise<{ success: boolean; error?: string }>;
    goForward: (browserId: string) => Promise<{ success: boolean; error?: string }>;
    reload: (browserId: string) => Promise<{ success: boolean; error?: string }>;
    setBounds: (browserId: string, bounds: BrowserBounds) => Promise<{ success: boolean; error?: string }>;
    destroy: (browserId: string) => Promise<{ success: boolean; error?: string }>;
    openDevTools: (browserId: string) => Promise<{ success: boolean; error?: string }>;
    closeDevTools: (browserId: string) => Promise<{ success: boolean; error?: string }>;
    setDevToolsBounds: (browserId: string, bounds: BrowserBounds) => Promise<{ success: boolean; error?: string }>;
    openExternal: (url: string) => Promise<{ success: boolean; error?: string }>;
    onNavigate: (browserId: string, callback: (data: BrowserNavigateEvent) => void) => () => void;
    onLoadingChange: (browserId: string, callback: (data: BrowserLoadingChangeEvent) => void) => () => void;
    onTitleChange: (browserId: string, callback: (data: BrowserTitleChangeEvent) => void) => () => void;
    onError: (browserId: string, callback: (data: BrowserErrorEvent) => void) => () => void;
  };
}

// ExtensionInfoForRenderer imported from ../main/extensions/types

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

  onTerminalProcessChange: (callback) => {
    const handler = (_: Electron.IpcRendererEvent, data: TerminalProcessChangeEvent) =>
      callback(data);
    ipcRenderer.on(IPC_CHANNELS.TERMINAL_PROCESS_CHANGE, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.TERMINAL_PROCESS_CHANGE, handler);
  },

  // Project operations
  getRecentProjects: () =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECT_GET_RECENT),

  addRecentProject: (project) =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECT_ADD_RECENT, project),

  removeRecentProject: (projectPath) =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECT_REMOVE_RECENT, projectPath),

  // Git operations
  getGitInfo: (workingDirectory) =>
    ipcRenderer.invoke(IPC_CHANNELS.GIT_INFO, { workingDirectory }),

  getGitLog: (projectPath, options) =>
    ipcRenderer.invoke(IPC_CHANNELS.GIT_LOG, { projectPath, options }),

  getGitDiff: (projectPath, hash) =>
    ipcRenderer.invoke(IPC_CHANNELS.GIT_DIFF, { projectPath, hash }),

  getGitCommitStats: (projectPath, hash) =>
    ipcRenderer.invoke(IPC_CHANNELS.GIT_COMMIT_STATS, { projectPath, hash }),

  // Settings operations
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET_ALL),

  setSetting: (key: string, value: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET, key, value),

  resetSettings: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_RESET),

  onSettingsChanged: (callback) => {
    const handler = (_: Electron.IpcRendererEvent, data: AppSettings) =>
      callback(data);
    ipcRenderer.on(IPC_CHANNELS.SETTINGS_CHANGED, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.SETTINGS_CHANGED, handler);
  },

  // Planning operations
  getPlanningCapabilities: (projectPath) =>
    ipcRenderer.invoke(IPC_CHANNELS.PLANNING_GET_CAPABILITIES, { projectPath }),

  getPlanningPhases: (projectPath) =>
    ipcRenderer.invoke(IPC_CHANNELS.PLANNING_GET_PHASES, { projectPath }),

  getPlanningPhaseDetail: (projectPath, phaseId) =>
    ipcRenderer.invoke(IPC_CHANNELS.PLANNING_GET_PHASE_DETAIL, { projectPath, phaseId }),

  getPlanningBeadsTasks: (projectPath, epicId) =>
    ipcRenderer.invoke(IPC_CHANNELS.PLANNING_GET_BEADS_TASKS, { projectPath, epicId }),

  updatePlanningTaskDetail: (projectPath, phaseId, taskId, content) =>
    ipcRenderer.invoke(IPC_CHANNELS.PLANNING_UPDATE_TASK_DETAIL, { projectPath, phaseId, taskId, content }),

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

  // Browser operations
  browser: {
    create: (browserId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.BROWSER_CREATE, browserId),

    navigate: (browserId: string, url: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.BROWSER_NAVIGATE, browserId, url),

    goBack: (browserId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.BROWSER_GO_BACK, browserId),

    goForward: (browserId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.BROWSER_GO_FORWARD, browserId),

    reload: (browserId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.BROWSER_RELOAD, browserId),

    setBounds: (browserId: string, bounds: BrowserBounds) =>
      ipcRenderer.invoke(IPC_CHANNELS.BROWSER_SET_BOUNDS, browserId, bounds),

    destroy: (browserId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.BROWSER_DESTROY, browserId),

    openDevTools: (browserId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.BROWSER_OPEN_DEVTOOLS, browserId),

    closeDevTools: (browserId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.BROWSER_CLOSE_DEVTOOLS, browserId),

    setDevToolsBounds: (browserId: string, bounds: BrowserBounds) =>
      ipcRenderer.invoke(IPC_CHANNELS.BROWSER_SET_DEVTOOLS_BOUNDS, browserId, bounds),

    openExternal: (url: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.BROWSER_OPEN_EXTERNAL, url),

    onNavigate: (browserId: string, callback) => {
      const handler = (_: Electron.IpcRendererEvent, data: BrowserNavigateEvent) => {
        if (data.browserId === browserId) callback(data);
      };
      ipcRenderer.on(IPC_CHANNELS.BROWSER_NAVIGATE_EVENT, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.BROWSER_NAVIGATE_EVENT, handler);
    },

    onLoadingChange: (browserId: string, callback) => {
      const handler = (_: Electron.IpcRendererEvent, data: BrowserLoadingChangeEvent) => {
        if (data.browserId === browserId) callback(data);
      };
      ipcRenderer.on(IPC_CHANNELS.BROWSER_LOADING_CHANGE, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.BROWSER_LOADING_CHANGE, handler);
    },

    onTitleChange: (browserId: string, callback) => {
      const handler = (_: Electron.IpcRendererEvent, data: BrowserTitleChangeEvent) => {
        if (data.browserId === browserId) callback(data);
      };
      ipcRenderer.on(IPC_CHANNELS.BROWSER_TITLE_CHANGE, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.BROWSER_TITLE_CHANGE, handler);
    },

    onError: (browserId: string, callback) => {
      const handler = (_: Electron.IpcRendererEvent, data: BrowserErrorEvent) => {
        if (data.browserId === browserId) callback(data);
      };
      ipcRenderer.on(IPC_CHANNELS.BROWSER_ERROR, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.BROWSER_ERROR, handler);
    },
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
