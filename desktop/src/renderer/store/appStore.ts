import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

// Sidebar navigation views
export type SidebarView = "explorer" | "terminals" | "breadcrumb" | "browser" | "extensions" | "settings";

// Workspace tab types
export type TabType = "terminal" | "browser" | "breadcrumb" | "welcome";

export interface WorkspaceTab {
  id: string;
  type: TabType;
  title: string;
  icon?: string;
  // Browser-specific
  url?: string;
  // Terminal-specific
  terminalSessionId?: string;
  // Project-scoped
  projectId?: string;
}

// Terminal pane state (shared between TerminalPanel and sidebar)
export interface TerminalPane {
  id: string;
  sessionId: string;
  cwd: string;
  lastActivity?: number;
  /** Raw process name from pty.process (e.g., "node", "vim") */
  processName?: string;
  /** Friendly display name (e.g., "Node.js", "Vim") */
  processLabel?: string;
  /** User-set custom label — overrides auto-detection */
  customLabel?: string;
  /** Instance number for Claude Code sessions (Claude #1, #2, etc.) */
  claudeInstanceNumber?: number;
}

/** Extract folder name from an absolute path */
function folderFromCwd(cwd: string): string {
  const parts = cwd.replace(/\/+$/, "").split("/");
  return parts[parts.length - 1] || cwd;
}

/** Resolve the display label for a pane: customLabel > processLabel > "shell - folder" > shell > folder > "Pane N" */
export function resolveLabel(pane: TerminalPane, index: number): string {
  if (pane.customLabel) return pane.customLabel;
  if (pane.processLabel) return pane.processLabel;
  // Shell with CWD → "zsh - foldername"
  if (pane.processName && pane.cwd) {
    return `${pane.processName} — ${folderFromCwd(pane.cwd)}`;
  }
  if (pane.processName) return pane.processName;
  if (pane.cwd) return folderFromCwd(pane.cwd);
  return `Pane ${index + 1}`;
}

export interface TabPaneState {
  panes: TerminalPane[];
  activePane: string;
  splitDirection: "horizontal" | "vertical";
}

export interface AppState {
  // Sidebar
  sidebarView: SidebarView;
  sidebarCollapsed: boolean;

  // Tabs
  tabs: WorkspaceTab[];
  activeTabId: string | null;

  // Terminal panes (keyed by tabId)
  terminalPanes: Record<string, TabPaneState>;

  // Zoom state — temporarily maximize a single pane
  zoomedPane: { tabId: string; paneId: string } | null;

  // Project
  currentProjectPath: string | null;

  // Theme
  theme: "dark" | "light";
}

export interface AppActions {
  // Sidebar
  setSidebarView: (view: SidebarView) => void;
  toggleSidebar: () => void;

  // Tabs
  addTab: (tab: WorkspaceTab) => void;
  removeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTab: (id: string, updates: Partial<WorkspaceTab>) => void;

  // Terminal pane management
  initializeTabPanes: (tabId: string, workingDirectory?: string) => void;
  addPane: (tabId: string, direction?: "horizontal" | "vertical") => void;
  removePane: (tabId: string, paneId: string) => void;
  setActivePane: (tabId: string, paneId: string) => void;
  toggleSplitDirection: (tabId: string) => void;
  updatePaneCwd: (tabId: string, paneId: string, cwd: string) => void;
  updatePaneProcess: (tabId: string, paneId: string, processName: string, processLabel: string) => void;
  setPaneCustomLabel: (tabId: string, paneId: string, label: string | null) => void;
  clearTabPanes: (tabId: string) => void;

  // Zoom
  togglePaneZoom: (tabId: string, paneId: string) => void;
  clearPaneZoom: () => void;

  // Project
  setCurrentProjectPath: (path: string | null) => void;

  // Theme
  setTheme: (theme: AppState["theme"]) => void;
}

export type AppStore = AppState & AppActions;

const initialState: AppState = {
  sidebarView: "explorer",
  sidebarCollapsed: false,
  tabs: [
    {
      id: "welcome",
      type: "welcome",
      title: "Welcome",
    },
  ],
  activeTabId: "welcome",
  terminalPanes: {},
  zoomedPane: null,
  currentProjectPath: null,
  theme: "dark",
};

export const useAppStore = create<AppStore>()(
  immer((set) => ({
    ...initialState,

    // Sidebar
    setSidebarView: (view) =>
      set((state) => {
        if (state.sidebarView === view) {
          state.sidebarCollapsed = !state.sidebarCollapsed;
        } else {
          state.sidebarView = view;
          state.sidebarCollapsed = false;
        }
      }),

    toggleSidebar: () =>
      set((state) => {
        state.sidebarCollapsed = !state.sidebarCollapsed;
      }),

    // Tabs
    addTab: (tab) =>
      set((state) => {
        state.tabs.push(tab);
        state.activeTabId = tab.id;
      }),

    removeTab: (id) =>
      set((state) => {
        const newTabs = state.tabs.filter((t) => t.id !== id);
        const newActiveId =
          state.activeTabId === id
            ? newTabs[newTabs.length - 1]?.id || null
            : state.activeTabId;
        state.tabs = newTabs;
        state.activeTabId = newActiveId;
        // Clean up pane state when removing terminal tab
        delete state.terminalPanes[id];
        // Clear zoom if this tab was zoomed
        if (state.zoomedPane?.tabId === id) {
          state.zoomedPane = null;
        }
      }),

    setActiveTab: (id) =>
      set((state) => {
        state.activeTabId = id;
      }),

    updateTab: (id, updates) =>
      set((state) => {
        const tab = state.tabs.find((t) => t.id === id);
        if (tab) {
          Object.assign(tab, updates);
        }
      }),

    // Terminal pane management
    initializeTabPanes: (tabId, workingDirectory) =>
      set((state) => {
        if (!state.terminalPanes[tabId]) {
          state.terminalPanes[tabId] = {
            panes: [
              {
                id: "pane-1",
                sessionId: `${tabId}-1`,
                cwd: workingDirectory || "",
                lastActivity: Date.now(),
              },
            ],
            activePane: "pane-1",
            splitDirection: "horizontal",
          };
        }
      }),

    addPane: (tabId, direction) =>
      set((state) => {
        const tabState = state.terminalPanes[tabId];
        if (!tabState) return;

        if (direction) {
          tabState.splitDirection = direction;
        }

        // Inherit CWD from the currently active pane so the new pane
        // immediately shows a useful label instead of "Pane N"
        const activeP = tabState.panes.find((p) => p.id === tabState.activePane);
        const inheritCwd = activeP?.cwd || "";

        const id = `pane-${Date.now()}`;
        const sessionId = `${tabId}-${Date.now()}`;

        tabState.panes.push({
          id,
          sessionId,
          cwd: inheritCwd,
          lastActivity: Date.now(),
        });
        tabState.activePane = id;
      }),

    removePane: (tabId, paneId) =>
      set((state) => {
        const tabState = state.terminalPanes[tabId];
        if (!tabState) return;

        const newPanes = tabState.panes.filter((p) => p.id !== paneId);
        if (newPanes.length === 0) return; // Don't remove last pane

        tabState.panes = newPanes;
        if (tabState.activePane === paneId) {
          tabState.activePane = newPanes[newPanes.length - 1].id;
        }
        // Clear zoom if zoomed pane was removed
        if (state.zoomedPane?.tabId === tabId && state.zoomedPane?.paneId === paneId) {
          state.zoomedPane = null;
        }
      }),

    setActivePane: (tabId, paneId) =>
      set((state) => {
        const tabState = state.terminalPanes[tabId];
        if (!tabState) return;
        tabState.activePane = paneId;
      }),

    toggleSplitDirection: (tabId) =>
      set((state) => {
        const tabState = state.terminalPanes[tabId];
        if (!tabState) return;
        tabState.splitDirection =
          tabState.splitDirection === "horizontal" ? "vertical" : "horizontal";
      }),

    updatePaneCwd: (tabId, paneId, cwd) =>
      set((state) => {
        const tabState = state.terminalPanes[tabId];
        if (!tabState) return;

        const pane = tabState.panes.find((p) => p.id === paneId);
        if (pane) {
          pane.cwd = cwd;
          pane.lastActivity = Date.now();
        }
      }),

    updatePaneProcess: (tabId, paneId, processName, processLabel) =>
      set((state) => {
        const pane = state.terminalPanes[tabId]?.panes.find((p) => p.id === paneId);
        if (!pane) return;

        const wasClaude = pane.processName === "claude";
        const isClaude = processName === "claude";

        pane.processName = processName || undefined;

        if (isClaude) {
          // Assign a Claude instance number if this pane doesn't already have one
          if (!pane.claudeInstanceNumber) {
            // Collect all existing Claude instance numbers across all tabs
            const usedNumbers = new Set<number>();
            for (const tabState of Object.values(state.terminalPanes)) {
              for (const p of tabState.panes) {
                if (p.claudeInstanceNumber && p.id !== pane.id) {
                  usedNumbers.add(p.claudeInstanceNumber);
                }
              }
            }
            // Find lowest available number
            let num = 1;
            while (usedNumbers.has(num)) num++;
            pane.claudeInstanceNumber = num;
          }
          pane.processLabel = `Claude #${pane.claudeInstanceNumber}`;
        } else {
          // Clear Claude instance number when no longer running Claude
          if (wasClaude) {
            pane.claudeInstanceNumber = undefined;
          }
          // Normalize empty string to undefined so resolveLabel falls through
          pane.processLabel = processLabel || undefined;
        }
      }),

    setPaneCustomLabel: (tabId, paneId, label) =>
      set((state) => {
        const pane = state.terminalPanes[tabId]?.panes.find((p) => p.id === paneId);
        if (pane) {
          pane.customLabel = label || undefined;
        }
      }),

    clearTabPanes: (tabId) =>
      set((state) => {
        delete state.terminalPanes[tabId];
      }),

    // Zoom
    togglePaneZoom: (tabId, paneId) =>
      set((state) => {
        if (state.zoomedPane?.tabId === tabId && state.zoomedPane?.paneId === paneId) {
          state.zoomedPane = null;
        } else {
          state.zoomedPane = { tabId, paneId };
        }
      }),

    clearPaneZoom: () =>
      set((state) => {
        state.zoomedPane = null;
      }),

    // Project
    setCurrentProjectPath: (path) =>
      set((state) => {
        state.currentProjectPath = path;
      }),

    // Theme
    setTheme: (theme) =>
      set((state) => {
        state.theme = theme;
      }),
  }))
);

// Selector hooks
export const useSidebarView = () => useAppStore((s) => s.sidebarView);
export const useSidebarCollapsed = () => useAppStore((s) => s.sidebarCollapsed);
export const useTabs = () => useAppStore((s) => s.tabs);
export const useActiveTabId = () => useAppStore((s) => s.activeTabId);
export const useActiveTab = () =>
  useAppStore((s) => s.tabs.find((t) => t.id === s.activeTabId));
export const useCurrentProjectPath = () => useAppStore((s) => s.currentProjectPath);

// Pane selector hooks
export const useTabPanes = (tabId: string) =>
  useAppStore((s) => s.terminalPanes[tabId]);
export const useTabPanesList = (tabId: string) =>
  useAppStore((s) => s.terminalPanes[tabId]?.panes || []);
export const useActivePane = (tabId: string) =>
  useAppStore((s) => s.terminalPanes[tabId]?.activePane);
export const useSplitDirection = (tabId: string) =>
  useAppStore((s) => s.terminalPanes[tabId]?.splitDirection || "horizontal");
export const useZoomedPane = () => useAppStore((s) => s.zoomedPane);
