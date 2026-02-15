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

// Right panel pane types
export type RightPanelPaneType = "browser" | "planning";

export interface RightPanelPane {
  id: string;
  type: RightPanelPaneType;
}

export interface LayoutState {
  rightPanel: {
    isOpen: boolean;
    panes: RightPanelPane[];
  };
  panelSizes: {
    sidebar: number;
    center: number;
    rightPanel: number;
  };
  devToolsDockOpen: boolean;
}

export const DEFAULT_LAYOUT: LayoutState = {
  rightPanel: {
    isOpen: false,
    panes: [],
  },
  panelSizes: {
    sidebar: 18,
    center: 82,
    rightPanel: 0,
  },
  devToolsDockOpen: false,
};

// --- Workspace persistence types (serialization-safe, no functions/transient fields) ---

export interface SerializedPane {
  id: string;
  cwd: string;
  customLabel?: string;
}

export interface SerializedTabPaneState {
  panes: SerializedPane[];
  activePane: string;
  splitDirection: "horizontal" | "vertical";
}

export interface SerializedTab {
  id: string;
  type: TabType;
  title: string;
  url?: string;
  projectId?: string;
}

export interface WorkspaceSnapshot {
  tabs: SerializedTab[];
  activeTabId: string | null;
  terminalPanes: Record<string, SerializedTabPaneState>;
  activeProjectId: string | null;
  /** Maps projectId → projectPath for resolving tab associations on restore */
  projectPaths?: Record<string, string>;
}

// --- App state ---

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

  // Layout — 3-column panel system
  layout: LayoutState;

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

  // Layout — right panel
  setRightPanelOpen: (isOpen: boolean) => void;
  toggleRightPanel: () => void;
  addRightPanelPane: (type: RightPanelPaneType) => void;
  removeRightPanelPane: (paneId: string) => void;
  setPanelSizes: (sizes: { sidebar: number; center: number; rightPanel: number }) => void;
  restoreLayout: (layout: LayoutState) => void;
  toggleDevToolsDock: () => void;

  // Project
  setCurrentProjectPath: (path: string | null) => void;

  // Theme
  setTheme: (theme: AppState["theme"]) => void;

  // Workspace restore
  restoreWorkspace: (snapshot: WorkspaceSnapshot) => void;
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
  layout: DEFAULT_LAYOUT,
  currentProjectPath: null,
  theme: "dark",
};

// Debounced workspace persistence — writes to electron-store via IPC
let persistWorkspaceTimeout: ReturnType<typeof setTimeout> | null = null;

function buildWorkspaceSnapshot(): WorkspaceSnapshot {
  const state = useAppStore.getState();
  // Import projectsStore lazily to avoid circular dep at module init time
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useProjectsStore } = require("./projectsStore") as typeof import("./projectsStore");
  const projectsState = useProjectsStore.getState();

  // Build a projectId → path map for resolving associations on restore
  const projectPaths: Record<string, string> = {};
  for (const p of projectsState.projects) {
    projectPaths[p.id] = p.path;
  }

  return {
    tabs: state.tabs.map((t) => ({
      id: t.id,
      type: t.type,
      title: t.title,
      url: t.url,
      projectId: t.projectId,
    })),
    activeTabId: state.activeTabId,
    terminalPanes: Object.fromEntries(
      Object.entries(state.terminalPanes).map(([tabId, tabState]) => [
        tabId,
        {
          panes: tabState.panes.map((p) => ({
            id: p.id,
            cwd: p.cwd,
            customLabel: p.customLabel,
          })),
          activePane: tabState.activePane,
          splitDirection: tabState.splitDirection,
        },
      ])
    ),
    activeProjectId: projectsState.activeProjectId,
    projectPaths,
  };
}

export function persistWorkspace(): void {
  if (persistWorkspaceTimeout) clearTimeout(persistWorkspaceTimeout);
  persistWorkspaceTimeout = setTimeout(() => {
    const snapshot = buildWorkspaceSnapshot();
    window.breadcrumbAPI?.setSetting("workspace", snapshot);
    persistWorkspaceTimeout = null;
  }, 300);
}

/** Flush any pending workspace write immediately (call before quit). */
export function flushWorkspacePersist(): void {
  if (persistWorkspaceTimeout) {
    clearTimeout(persistWorkspaceTimeout);
    persistWorkspaceTimeout = null;
    const snapshot = buildWorkspaceSnapshot();
    window.breadcrumbAPI?.setSetting("workspace", snapshot);
  }
}

// Debounced layout persistence — writes to electron-store via IPC
let persistLayoutTimeout: ReturnType<typeof setTimeout> | null = null;

function persistLayout(getLayout: () => LayoutState) {
  if (persistLayoutTimeout) clearTimeout(persistLayoutTimeout);
  persistLayoutTimeout = setTimeout(() => {
    const layout = getLayout();
    const settingsPayload = {
      rightPanel: {
        isOpen: layout.rightPanel.isOpen,
        panes: layout.rightPanel.panes.map((p) => ({ id: p.id, type: p.type, size: 50 })),
      },
      panelSizes: layout.panelSizes,
    };
    window.breadcrumbAPI?.setSetting("layout", settingsPayload);
    persistLayoutTimeout = null;
  }, 300);
}

export const useAppStore = create<AppStore>()(
  immer((set, get) => ({
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
    addTab: (tab) => {
      set((state) => {
        state.tabs.push(tab);
        state.activeTabId = tab.id;
      });
      persistWorkspace();
    },

    removeTab: (id) => {
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
      });
      persistWorkspace();
    },

    setActiveTab: (id) => {
      set((state) => {
        state.activeTabId = id;
      });
      persistWorkspace();
    },

    updateTab: (id, updates) => {
      set((state) => {
        const tab = state.tabs.find((t) => t.id === id);
        if (tab) {
          Object.assign(tab, updates);
        }
      });
      persistWorkspace();
    },

    // Terminal pane management
    initializeTabPanes: (tabId, workingDirectory) => {
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
      });
      persistWorkspace();
    },

    addPane: (tabId, direction) => {
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
      });
      persistWorkspace();
    },

    removePane: (tabId, paneId) => {
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
      });
      persistWorkspace();
    },

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

    updatePaneCwd: (tabId, paneId, cwd) => {
      set((state) => {
        const tabState = state.terminalPanes[tabId];
        if (!tabState) return;

        const pane = tabState.panes.find((p) => p.id === paneId);
        if (pane) {
          pane.cwd = cwd;
          pane.lastActivity = Date.now();
        }
      });
      persistWorkspace();
    },

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

    setPaneCustomLabel: (tabId, paneId, label) => {
      set((state) => {
        const pane = state.terminalPanes[tabId]?.panes.find((p) => p.id === paneId);
        if (pane) {
          pane.customLabel = label || undefined;
        }
      });
      persistWorkspace();
    },

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

    // Layout — right panel
    setRightPanelOpen: (isOpen) =>
      set((state) => {
        state.layout.rightPanel.isOpen = isOpen;
        if (isOpen && state.layout.panelSizes.rightPanel === 0) {
          // Expand to default size (~2x sidebar)
          state.layout.panelSizes = { sidebar: 18, center: 46, rightPanel: 36 };
        } else if (!isOpen) {
          // Collapse: give right panel space back to center
          state.layout.panelSizes.center += state.layout.panelSizes.rightPanel;
          state.layout.panelSizes.rightPanel = 0;
        }
        persistLayout(() => get().layout);
      }),

    toggleRightPanel: () =>
      set((state) => {
        const wasOpen = state.layout.rightPanel.isOpen;
        state.layout.rightPanel.isOpen = !wasOpen;
        if (!wasOpen && state.layout.panelSizes.rightPanel === 0) {
          state.layout.panelSizes = { sidebar: 18, center: 46, rightPanel: 36 };
        } else if (wasOpen) {
          state.layout.panelSizes.center += state.layout.panelSizes.rightPanel;
          state.layout.panelSizes.rightPanel = 0;
        }
        persistLayout(() => get().layout);
      }),

    addRightPanelPane: (type) =>
      set((state) => {
        // Don't add duplicate pane types
        if (state.layout.rightPanel.panes.some((p) => p.type === type)) return;
        const id = `rp-${type}-${Date.now()}`;
        state.layout.rightPanel.panes.push({ id, type });
        state.layout.rightPanel.isOpen = true;
        if (state.layout.panelSizes.rightPanel === 0) {
          state.layout.panelSizes = { sidebar: 18, center: 46, rightPanel: 36 };
        }
        persistLayout(() => get().layout);
      }),

    removeRightPanelPane: (paneId) =>
      set((state) => {
        state.layout.rightPanel.panes = state.layout.rightPanel.panes.filter((p) => p.id !== paneId);
        // Auto-collapse when last pane removed
        if (state.layout.rightPanel.panes.length === 0) {
          state.layout.rightPanel.isOpen = false;
          state.layout.panelSizes.center += state.layout.panelSizes.rightPanel;
          state.layout.panelSizes.rightPanel = 0;
        }
        persistLayout(() => get().layout);
      }),

    setPanelSizes: (sizes) =>
      set((state) => {
        state.layout.panelSizes = sizes;
        persistLayout(() => get().layout);
      }),

    restoreLayout: (layout) =>
      set((state) => {
        state.layout = layout;
      }),

    toggleDevToolsDock: () =>
      set((state) => {
        state.layout.devToolsDockOpen = !state.layout.devToolsDockOpen;
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

    // Workspace restore — rebuild tabs/panes from a saved snapshot
    restoreWorkspace: (snapshot) =>
      set((state) => {
        if (!snapshot.tabs || snapshot.tabs.length === 0) return;

        // Build reverse map: old projectId → path, then path → current projectId
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { useProjectsStore } = require("./projectsStore") as typeof import("./projectsStore");
        const currentProjects = useProjectsStore.getState().projects;
        const savedPaths = snapshot.projectPaths || {};

        // Map: savedProjectId → currentProjectId (by matching paths)
        const projectIdMap = new Map<string, string>();
        for (const [savedId, savedPath] of Object.entries(savedPaths)) {
          const currentProject = currentProjects.find((p) => p.path === savedPath);
          if (currentProject) {
            projectIdMap.set(savedId, currentProject.id);
          }
        }

        // Restore tabs with their saved metadata, remapping projectIds
        state.tabs = snapshot.tabs.map((t) => ({
          id: t.id,
          type: t.type as TabType,
          title: t.title,
          url: t.url,
          projectId: t.projectId ? (projectIdMap.get(t.projectId) || t.projectId) : undefined,
        }));

        // Restore active tab (fall back to first tab if saved tab no longer exists)
        const savedActiveExists = state.tabs.some((t) => t.id === snapshot.activeTabId);
        state.activeTabId = savedActiveExists
          ? snapshot.activeTabId
          : state.tabs[0]?.id || null;

        // Restore terminal pane structure with fresh sessionIds
        state.terminalPanes = {};
        for (const [tabId, savedPaneState] of Object.entries(snapshot.terminalPanes || {})) {
          // Only restore pane state if the tab still exists
          if (!state.tabs.some((t) => t.id === tabId)) continue;

          state.terminalPanes[tabId] = {
            panes: savedPaneState.panes.map((p, i) => ({
              id: p.id,
              // Generate fresh sessionId — old PTY sessions don't survive restart
              sessionId: `${tabId}-${Date.now()}-${i}`,
              cwd: p.cwd || "",
              customLabel: p.customLabel,
              lastActivity: Date.now(),
            })),
            activePane: savedPaneState.activePane,
            splitDirection: savedPaneState.splitDirection,
          };
        }

        // Reset transient state
        state.zoomedPane = null;
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

// Layout selector hooks
export const useLayout = () => useAppStore((s) => s.layout);
export const useRightPanelOpen = () => useAppStore((s) => s.layout.rightPanel.isOpen);
export const useRightPanelPanes = () => useAppStore((s) => s.layout.rightPanel.panes);
export const usePanelSizes = () => useAppStore((s) => s.layout.panelSizes);
export const useDevToolsDockOpen = () => useAppStore((s) => s.layout.devToolsDockOpen);
