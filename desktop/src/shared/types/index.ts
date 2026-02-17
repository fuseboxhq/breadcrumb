// ─── IPC Channels ───────────────────────────────────────────────────────────

export const IPC_CHANNELS = {
  // Settings channels
  SETTINGS_GET: "settings:get",
  SETTINGS_GET_ALL: "settings:get-all",
  SETTINGS_SET: "settings:set",
  SETTINGS_RESET: "settings:reset",
  SETTINGS_CHANGED: "settings:changed",

  // File dialog
  DIALOG_SELECT_DIRECTORY: "dialog:select-directory",

  // System
  SYSTEM_GET_WORKING_DIR: "system:get-working-dir",
  SYSTEM_READ_FILE: "system:read-file",

  // Terminal channels (PTY-based interactive terminals)
  TERMINAL_CREATE: "terminal:create",
  TERMINAL_WRITE: "terminal:write",
  TERMINAL_RESIZE: "terminal:resize",
  TERMINAL_TERMINATE: "terminal:terminate",
  TERMINAL_DATA: "terminal:data",
  TERMINAL_EXIT: "terminal:exit",
  TERMINAL_PROCESS_CHANGE: "terminal:process-change",

  // Git channels
  GIT_INFO: "git:info",
  GIT_LOG: "git:log",
  GIT_DIFF: "git:diff",
  GIT_COMMIT_STATS: "git:commit-stats",

  // Project channels
  PROJECT_GET_RECENT: "project:get-recent",
  PROJECT_ADD_RECENT: "project:add-recent",
  PROJECT_REMOVE_RECENT: "project:remove-recent",

  // Planning channels
  PLANNING_GET_CAPABILITIES: "planning:get-capabilities",
  PLANNING_GET_PHASES: "planning:get-phases",
  PLANNING_GET_PHASE_DETAIL: "planning:get-phase-detail",
  PLANNING_GET_BEADS_TASKS: "planning:get-beads-tasks",
  PLANNING_UPDATE_TASK_DETAIL: "planning:update-task-detail",

  // Extension channels
  EXTENSIONS_LIST: "extensions:list",
  EXTENSIONS_ACTIVATE: "extensions:activate",
  EXTENSIONS_DEACTIVATE: "extensions:deactivate",
  EXTENSIONS_COMMANDS: "extensions:commands",
  EXTENSIONS_EXECUTE_COMMAND: "extensions:execute-command",
  EXTENSIONS_STATUS_CHANGED: "extensions:status-changed",
  EXTENSIONS_TERMINAL_CREATED: "extensions:terminal-created",

  // Browser channels (embedded WebContentsView browser)
  BROWSER_CREATE: "browser:create",
  BROWSER_NAVIGATE: "browser:navigate",
  BROWSER_GO_BACK: "browser:go-back",
  BROWSER_GO_FORWARD: "browser:go-forward",
  BROWSER_RELOAD: "browser:reload",
  BROWSER_SET_BOUNDS: "browser:set-bounds",
  BROWSER_DESTROY: "browser:destroy",
  BROWSER_OPEN_DEVTOOLS: "browser:open-devtools",
  BROWSER_CLOSE_DEVTOOLS: "browser:close-devtools",
  BROWSER_SET_DEVTOOLS_BOUNDS: "browser:set-devtools-bounds",
  BROWSER_OPEN_EXTERNAL: "browser:open-external",

  // Browser events (main → renderer)
  BROWSER_NAVIGATE_EVENT: "browser:navigate-event",
  BROWSER_LOADING_CHANGE: "browser:loading-change",
  BROWSER_TITLE_CHANGE: "browser:title-change",
  BROWSER_ERROR: "browser:error",
} as const;

// ─── Types ──────────────────────────────────────────────────────────────────

// Recent project information
export interface RecentProject {
  path: string;
  name: string;
  lastOpened: number;
}

// Browser types
export interface BrowserBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BrowserNavigateEvent {
  browserId: string;
  url: string;
  canGoBack: boolean;
  canGoForward: boolean;
}

export interface BrowserLoadingChangeEvent {
  browserId: string;
  isLoading: boolean;
}

export interface BrowserTitleChangeEvent {
  browserId: string;
  title: string;
}

export interface BrowserErrorEvent {
  browserId: string;
  errorCode: number;
  errorDescription: string;
  validatedURL: string;
}
