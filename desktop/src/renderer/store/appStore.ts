import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
// NOTE: Circular import with projectsStore (it also imports from us).
// Safe because all cross-references are inside functions, not top-level code.
// ESM live bindings resolve by the time any store action executes.
import { useProjectsStore } from "./projectsStore";
import {
  type SplitNode,
  flattenPanes,
  findPaneNode,
  insertSplit,
  removePaneFromTree,
  treeFromFlat,
  getRootDirection,
  create2x2Grid,
  updateSizes,
} from "./splitTree";

// Sidebar navigation views
export type SidebarView = "explorer" | "terminals" | "breadcrumb" | "browser" | "extensions" | "settings";

// Workspace tab types
export type TabType = "terminal" | "welcome" | "diff" | "browser";

export interface WorkspaceTab {
  id: string;
  type: TabType;
  title: string;
  // Terminal-specific
  terminalSessionId?: string;
  // Project-scoped
  projectId?: string;
  // Diff-specific
  diffHash?: string;
  diffProjectPath?: string;
  /** Unpinned diff tabs get replaced when opening a new diff */
  pinned?: boolean;
  /** Command to run once after the terminal shell starts (e.g. "claude\n") */
  initialCommand?: string;
  /** User-assigned custom title for this tab (e.g. "Dev Servers") */
  customTitle?: string;
  // Browser-specific
  browserId?: string;
  initialUrl?: string;
}

// ─── Content Pane Types (discriminated union) ────────────────────────────────

export interface TerminalPaneData {
  type: "terminal";
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
  /** Command to run once after the shell starts (e.g. "claude\n") */
  initialCommand?: string;
}

export interface BrowserPaneData {
  type: "browser";
  id: string;
  browserId: string;
  url: string;
}

export interface DiffPaneData {
  type: "diff";
  id: string;
  diffHash: string;
  diffProjectPath: string;
  pinned?: boolean;
}

export type ContentPane = TerminalPaneData | BrowserPaneData | DiffPaneData;

/** Backwards-compatible alias */
export type TerminalPane = TerminalPaneData;

/** Extract folder name from an absolute path */
function folderFromCwd(cwd: string): string {
  const parts = cwd.replace(/\/+$/, "").split("/");
  return parts[parts.length - 1] || cwd;
}

/** Resolve the display label for any content pane */
export function resolveLabel(pane: ContentPane, index: number): string {
  if (pane.type === "terminal") {
    if (pane.customLabel) return pane.customLabel;
    if (pane.processLabel) return pane.processLabel;
    if (pane.processName && pane.cwd) {
      return `${pane.processName} — ${folderFromCwd(pane.cwd)}`;
    }
    if (pane.processName) return pane.processName;
    if (pane.cwd) return folderFromCwd(pane.cwd);
    return `Pane ${index + 1}`;
  }
  if (pane.type === "browser") {
    try {
      return new URL(pane.url).hostname || pane.url;
    } catch {
      return pane.url || "Browser";
    }
  }
  if (pane.type === "diff") {
    return `Diff ${pane.diffHash.slice(0, 7)}`;
  }
  return `Pane ${index + 1}`;
}

/** Type guard: narrows ContentPane to TerminalPaneData */
export function isTerminalPane(pane: ContentPane): pane is TerminalPaneData {
  return pane.type === "terminal";
}

export interface TabPaneState {
  splitTree: SplitNode;
  activePane: string;
}

// Re-export splitTree types and helpers for consumers
export type { SplitNode, PaneNode, SplitContainerNode } from "./splitTree";
export { flattenPanes, getRootDirection, create2x2Grid, insertSplit, removePaneFromTree, treeFromFlat, findPaneNode } from "./splitTree";

// Right panel pane types
export type RightPanelPaneType = "browser" | "planning";

export interface RightPanelPane {
  id: string;
  type: RightPanelPaneType;
}

// Right panel browser tabs
export interface RightPanelBrowserTab {
  id: string;
  browserId: string;
  url: string;
  title: string;
}

export interface LayoutState {
  rightPanel: {
    isOpen: boolean;
    panes: RightPanelPane[];
    browserTabs: RightPanelBrowserTab[];
    activeBrowserTabId: string | null;
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
    browserTabs: [],
    activeBrowserTabId: null,
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
  diffHash?: string;
  diffProjectPath?: string;
  pinned?: boolean;
  browserId?: string;
  initialUrl?: string;
  customTitle?: string;
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
  closeTabs: (ids: string[]) => void;
  setActiveTab: (id: string) => void;
  updateTab: (id: string, updates: Partial<WorkspaceTab>) => void;

  // Diff tabs — preview behavior
  openDiffTab: (projectPath: string, hash: string, commitSubject?: string) => void;
  pinDiffTab: (tabId: string) => void;

  // Browser tab in center workspace
  openBrowserTab: (url?: string) => void;

  // Tab renaming
  setTabCustomTitle: (tabId: string, title: string | null) => void;

  // Tab merging (drag-and-drop)
  mergeTabInto: (sourceTabId: string, targetTabId: string) => void;

  // Pane management
  initializeTabPanes: (tabId: string, workingDirectory?: string) => void;
  addPane: (tabId: string, direction?: "horizontal" | "vertical", initialCommand?: string) => void;
  addContentPane: (tabId: string, pane: ContentPane, direction?: "horizontal" | "vertical") => void;
  removePane: (tabId: string, paneId: string) => void;
  setActivePane: (tabId: string, paneId: string) => void;
  toggleSplitDirection: (tabId: string) => void;
  updatePaneCwd: (tabId: string, paneId: string, cwd: string) => void;
  updatePaneProcess: (tabId: string, paneId: string, processName: string, processLabel: string) => void;
  setPaneCustomLabel: (tabId: string, paneId: string, label: string | null) => void;
  clearTabPanes: (tabId: string) => void;
  /** Replace the current layout with a 2×2 grid (creates new panes as needed) */
  create2x2GridLayout: (tabId: string) => void;
  /** Update flex sizes for a PanelGroup (called from onLayout callback) */
  updateSplitTreeSizes: (tabId: string, panelIds: string[], sizes: number[]) => void;

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

  // Right panel browser tabs
  addBrowserTab: (url?: string) => string;
  removeBrowserTab: (tabId: string) => void;
  setActiveBrowserTab: (tabId: string) => void;
  updateBrowserTab: (tabId: string, updates: Partial<Pick<RightPanelBrowserTab, "url" | "title">>) => void;

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
  const projectsState = useProjectsStore.getState();

  // Build a projectId → path map for resolving associations on restore
  const projectPaths: Record<string, string> = {};
  for (const p of projectsState.projects) {
    projectPaths[p.id] = p.path;
  }

  return {
    tabs: state.tabs
      .filter((t) => t.type !== "diff") // Don't persist diff tabs across restarts
      .map((t) => ({
        id: t.id,
        type: t.type,
        title: t.title,
        projectId: t.projectId,
        customTitle: t.customTitle,
        // Persist browser tab fields
        ...(t.type === "browser" ? { browserId: t.browserId, initialUrl: t.initialUrl } : {}),
      })),
    activeTabId: state.activeTabId,
    terminalPanes: Object.fromEntries(
      Object.entries(state.terminalPanes).map(([tabId, tabState]) => [
        tabId,
        {
          panes: flattenPanes(tabState.splitTree)
            .filter((p): p is TerminalPaneData => p.type === "terminal")
            .map((p) => ({
              id: p.id,
              cwd: p.cwd,
              customLabel: p.customLabel,
            })),
          activePane: tabState.activePane,
          splitDirection: getRootDirection(tabState.splitTree),
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
        browserTabs: layout.rightPanel.browserTabs.map((t) => ({
          id: t.id,
          browserId: t.browserId,
          url: t.url,
          title: t.title,
        })),
        activeBrowserTabId: layout.rightPanel.activeBrowserTabId,
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

    closeTabs: (ids) => {
      if (ids.length === 0) return;
      const idsSet = new Set(ids);
      set((state) => {
        state.tabs = state.tabs.filter((t) => !idsSet.has(t.id));
        if (state.activeTabId && idsSet.has(state.activeTabId)) {
          state.activeTabId = state.tabs[state.tabs.length - 1]?.id || null;
        }
        for (const id of ids) {
          delete state.terminalPanes[id];
          if (state.zoomedPane?.tabId === id) {
            state.zoomedPane = null;
          }
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

    // Tab renaming
    setTabCustomTitle: (tabId, title) => {
      set((state) => {
        const tab = state.tabs.find((t) => t.id === tabId);
        if (tab) {
          tab.customTitle = title || undefined;
        }
      });
      persistWorkspace();
    },

    // Diff tabs — preview behavior: reuse unpinned diff tab, or create new
    openDiffTab: (projectPath, hash, commitSubject) => {
      set((state) => {
        // Find an existing unpinned diff tab
        const unpinned = state.tabs.find(
          (t) => t.type === "diff" && !t.pinned
        );

        if (unpinned) {
          // Reuse it — update with new diff data
          unpinned.diffHash = hash;
          unpinned.diffProjectPath = projectPath;
          unpinned.title = commitSubject
            ? `${hash.slice(0, 7)} ${commitSubject}`
            : `Diff ${hash.slice(0, 7)}`;
          state.activeTabId = unpinned.id;
        } else {
          // No unpinned diff tab — create a new one
          const tab: WorkspaceTab = {
            id: `diff-${Date.now()}`,
            type: "diff",
            title: commitSubject
              ? `${hash.slice(0, 7)} ${commitSubject}`
              : `Diff ${hash.slice(0, 7)}`,
            diffHash: hash,
            diffProjectPath: projectPath,
            pinned: false,
          };
          state.tabs.push(tab);
          state.activeTabId = tab.id;
        }
      });
      persistWorkspace();
    },

    pinDiffTab: (tabId) => {
      set((state) => {
        const tab = state.tabs.find((t) => t.id === tabId);
        if (tab && tab.type === "diff") {
          tab.pinned = true;
        }
      });
      persistWorkspace();
    },

    // Browser tab in center workspace
    openBrowserTab: (url) => {
      const id = `browser-${Date.now()}`;
      const browserId = `center-${id}`;
      set((state) => {
        state.tabs.push({
          id,
          type: "browser",
          title: url ? new URL(url).hostname : "Browser",
          browserId,
          initialUrl: url || "http://localhost:3000",
        });
        state.activeTabId = id;
      });
      persistWorkspace();
    },

    // Tab merging — drag one terminal tab onto another to combine panes
    mergeTabInto: (sourceTabId, targetTabId) => {
      if (sourceTabId === targetTabId) return;

      const state = get();
      const sourceTab = state.tabs.find((t) => t.id === sourceTabId);
      const targetTab = state.tabs.find((t) => t.id === targetTabId);
      if (!sourceTab || !targetTab) return;
      if (sourceTab.type !== "terminal" || targetTab.type !== "terminal") return;

      const sourcePaneState = state.terminalPanes[sourceTabId];
      const targetPaneState = state.terminalPanes[targetTabId];
      if (!sourcePaneState || !targetPaneState) return;

      set((draft) => {
        const draftTarget = draft.terminalPanes[targetTabId];
        const draftSource = draft.terminalPanes[sourceTabId];
        if (!draftTarget || !draftSource) return;

        // Extract all panes from source tree
        const sourcePanes = flattenPanes(draftSource.splitTree);
        const existingIds = new Set(flattenPanes(draftTarget.splitTree).map((p) => p.id));

        // Re-ID to avoid duplicates (every tab starts with "pane-1")
        for (const pane of sourcePanes) {
          if (existingIds.has(pane.id)) {
            pane.id = `pane-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          }
        }

        // Merge: combine target tree and source panes into a horizontal split
        const allPanes = [...flattenPanes(draftTarget.splitTree), ...sourcePanes];
        draftTarget.splitTree = treeFromFlat(allPanes, getRootDirection(draftTarget.splitTree));

        // Remove source tab
        draft.tabs = draft.tabs.filter((t) => t.id !== sourceTabId);
        delete draft.terminalPanes[sourceTabId];

        // Activate target if source was active
        if (draft.activeTabId === sourceTabId) {
          draft.activeTabId = targetTabId;
        }

        // Clear zoom if it was on the source tab
        if (draft.zoomedPane?.tabId === sourceTabId) {
          draft.zoomedPane = null;
        }

        // Re-number Claude instances per project to avoid duplicates after merge
        const projectGroups = new Map<string | undefined, Array<TerminalPaneData>>();
        for (const [tid, ts] of Object.entries(draft.terminalPanes)) {
          const tab = draft.tabs.find((t) => t.id === tid);
          for (const pane of flattenPanes(ts.splitTree)) {
            if (pane.type === "terminal" && pane.claudeInstanceNumber) {
              const pid = tab?.projectId;
              if (!projectGroups.has(pid)) projectGroups.set(pid, []);
              projectGroups.get(pid)!.push(pane);
            }
          }
        }
        for (const panes of projectGroups.values()) {
          // Sort by existing number to preserve relative order
          panes.sort((a, b) => (a.claudeInstanceNumber || 0) - (b.claudeInstanceNumber || 0));
          for (let i = 0; i < panes.length; i++) {
            panes[i].claudeInstanceNumber = i + 1;
            panes[i].processLabel = `Claude #${i + 1}`;
          }
        }
      });
      persistWorkspace();
    },

    // Terminal pane management
    initializeTabPanes: (tabId, workingDirectory) => {
      set((state) => {
        if (!state.terminalPanes[tabId]) {
          const initialPane: TerminalPaneData = {
            type: "terminal",
            id: "pane-1",
            sessionId: `${tabId}-1`,
            cwd: workingDirectory || "",
            lastActivity: Date.now(),
          };
          state.terminalPanes[tabId] = {
            splitTree: { type: "pane", pane: initialPane },
            activePane: "pane-1",
          };
        }
      });
      persistWorkspace();
    },

    addPane: (tabId, direction, initialCommand) => {
      set((state) => {
        const tabState = state.terminalPanes[tabId];
        if (!tabState) return;

        const splitDir = direction || "horizontal";

        // Inherit CWD from the currently active terminal pane
        const panes = flattenPanes(tabState.splitTree);
        const activeP = panes.find((p) => p.id === tabState.activePane);
        const inheritCwd = (activeP && activeP.type === "terminal") ? activeP.cwd : "";

        const id = `pane-${Date.now()}`;
        const sessionId = `${tabId}-${Date.now()}`;

        const newPane: TerminalPaneData = {
          type: "terminal",
          id,
          sessionId,
          cwd: inheritCwd,
          lastActivity: Date.now(),
          initialCommand,
        };

        // Split the active pane in the requested direction
        tabState.splitTree = insertSplit(
          tabState.splitTree,
          tabState.activePane,
          newPane,
          splitDir
        );
        tabState.activePane = id;
      });
      persistWorkspace();
    },

    addContentPane: (tabId, pane, direction) => {
      set((state) => {
        const tabState = state.terminalPanes[tabId];
        if (!tabState) return;

        const splitDir = direction || "horizontal";
        tabState.splitTree = insertSplit(
          tabState.splitTree,
          tabState.activePane,
          pane,
          splitDir
        );
        tabState.activePane = pane.id;
      });
      persistWorkspace();
    },

    removePane: (tabId, paneId) => {
      set((state) => {
        const tabState = state.terminalPanes[tabId];
        if (!tabState) return;

        const newTree = removePaneFromTree(tabState.splitTree, paneId);
        if (!newTree) return; // Don't remove last pane

        tabState.splitTree = newTree;
        if (tabState.activePane === paneId) {
          const remaining = flattenPanes(newTree);
          tabState.activePane = remaining[remaining.length - 1].id;
        }
        // Clear zoom if zoomed pane was removed
        if (state.zoomedPane?.tabId === tabId && state.zoomedPane?.paneId === paneId) {
          state.zoomedPane = null;
        }
      });
      persistWorkspace();
    },

    setActivePane: (tabId, paneId) => {
      set((state) => {
        const tabState = state.terminalPanes[tabId];
        if (!tabState) return;
        tabState.activePane = paneId;
      });
      persistWorkspace();
    },

    toggleSplitDirection: (tabId) => {
      set((state) => {
        const tabState = state.terminalPanes[tabId];
        if (!tabState) return;
        // Toggle the root split direction
        if (tabState.splitTree.type === "split") {
          tabState.splitTree.direction =
            tabState.splitTree.direction === "horizontal" ? "vertical" : "horizontal";
        }
      });
      persistWorkspace();
    },

    updatePaneCwd: (tabId, paneId, cwd) => {
      set((state) => {
        const tabState = state.terminalPanes[tabId];
        if (!tabState) return;

        const node = findPaneNode(tabState.splitTree, paneId);
        if (node && node.pane.type === "terminal") {
          node.pane.cwd = cwd;
          node.pane.lastActivity = Date.now();
        }
      });
      persistWorkspace();
    },

    updatePaneProcess: (tabId, paneId, processName, processLabel) =>
      set((state) => {
        const tabState = state.terminalPanes[tabId];
        if (!tabState) return;
        const node = findPaneNode(tabState.splitTree, paneId);
        if (!node || node.pane.type !== "terminal") return;
        const pane = node.pane;

        const wasClaude = pane.processName === "claude";
        const isClaude = processName === "claude";

        pane.processName = processName || undefined;

        if (isClaude) {
          // Assign a Claude instance number if this pane doesn't already have one
          if (!pane.claudeInstanceNumber) {
            // Scope numbering per-project: only count Claude instances within
            // tabs that share the same projectId as this tab
            const thisTab = state.tabs.find((t) => t.id === tabId);
            const thisProjectId = thisTab?.projectId;

            const usedNumbers = new Set<number>();
            for (const [tid, ts] of Object.entries(state.terminalPanes)) {
              // Only consider tabs with the same project scope
              const tab = state.tabs.find((t) => t.id === tid);
              if (tab?.projectId !== thisProjectId) continue;

              for (const p of flattenPanes(ts.splitTree)) {
                if (p.type === "terminal" && p.claudeInstanceNumber && p !== pane) {
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
        const tabState = state.terminalPanes[tabId];
        if (!tabState) return;
        const node = findPaneNode(tabState.splitTree, paneId);
        if (node && node.pane.type === "terminal") {
          node.pane.customLabel = label || undefined;
        }
      });
      persistWorkspace();
    },

    clearTabPanes: (tabId) =>
      set((state) => {
        delete state.terminalPanes[tabId];
      }),

    create2x2GridLayout: (tabId) => {
      set((state) => {
        const tabState = state.terminalPanes[tabId];
        if (!tabState) return;

        const existingPanes = flattenPanes(tabState.splitTree);
        // Build up to 4 panes — reuse existing, create new as needed
        const allPanes: ContentPane[] = [...existingPanes];
        const activeCwd = existingPanes.find(
          (p) => p.id === tabState.activePane && p.type === "terminal"
        );
        const inheritCwd = activeCwd && activeCwd.type === "terminal" ? activeCwd.cwd : "";

        while (allPanes.length < 4) {
          const id = `pane-${Date.now()}-${allPanes.length}`;
          allPanes.push({
            type: "terminal",
            id,
            sessionId: `${tabId}-${Date.now()}-${allPanes.length}`,
            cwd: inheritCwd,
            lastActivity: Date.now(),
          } as TerminalPaneData);
        }

        tabState.splitTree = create2x2Grid(allPanes.slice(0, 4));
      });
      persistWorkspace();
    },

    updateSplitTreeSizes: (tabId, panelIds, sizes) => {
      set((state) => {
        const tabState = state.terminalPanes[tabId];
        if (!tabState) return;

        tabState.splitTree = updateSizes(tabState.splitTree, panelIds, sizes);
      });
      // Don't call persistWorkspace for every resize — let PanelGroup debounce
    },

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
          state.layout.panelSizes = { sidebar: 18, center: 42, rightPanel: 40 };
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
          state.layout.panelSizes = { sidebar: 18, center: 42, rightPanel: 40 };
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
          state.layout.panelSizes = { sidebar: 18, center: 42, rightPanel: 40 };
        }
        // Auto-create a browser tab when opening browser pane for the first time
        if (type === "browser" && state.layout.rightPanel.browserTabs.length === 0) {
          const tabId = `browser-${Date.now()}`;
          const browserId = `rp-${tabId}`;
          state.layout.rightPanel.browserTabs.push({
            id: tabId,
            browserId,
            url: "http://localhost:3000",
            title: "localhost",
          });
          state.layout.rightPanel.activeBrowserTabId = tabId;
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

    // Right panel browser tabs
    addBrowserTab: (url) => {
      const tabId = `browser-${Date.now()}`;
      const browserId = `rp-${tabId}`;
      set((state) => {
        state.layout.rightPanel.browserTabs.push({
          id: tabId,
          browserId,
          url: url || "http://localhost:3000",
          title: "New Tab",
        });
        state.layout.rightPanel.activeBrowserTabId = tabId;
      });
      persistLayout(() => get().layout);
      return browserId;
    },

    removeBrowserTab: (tabId) => {
      // Destroy the browser view for the removed tab
      const tab = get().layout.rightPanel.browserTabs.find((t) => t.id === tabId);
      if (tab) {
        window.breadcrumbAPI?.browser?.destroy(tab.browserId);
      }
      set((state) => {
        const tabs = state.layout.rightPanel.browserTabs;
        const index = tabs.findIndex((t) => t.id === tabId);
        if (index === -1) return;

        tabs.splice(index, 1);

        // If removed tab was active, activate adjacent
        if (state.layout.rightPanel.activeBrowserTabId === tabId) {
          const next = tabs[Math.min(index, tabs.length - 1)];
          state.layout.rightPanel.activeBrowserTabId = next?.id || null;
        }
      });
      persistLayout(() => get().layout);
    },

    setActiveBrowserTab: (tabId) => {
      set((state) => {
        state.layout.rightPanel.activeBrowserTabId = tabId;
      });
      persistLayout(() => get().layout);
    },

    updateBrowserTab: (tabId, updates) => {
      set((state) => {
        const tab = state.layout.rightPanel.browserTabs.find((t) => t.id === tabId);
        if (tab) {
          if (updates.url !== undefined) tab.url = updates.url;
          if (updates.title !== undefined) tab.title = updates.title;
        }
      });
      persistLayout(() => get().layout);
    },

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
        if (!snapshot.tabs || !Array.isArray(snapshot.tabs) || snapshot.tabs.length === 0) return;

        // Build reverse map: old projectId → path, then path → current projectId
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

        const validTabTypes: TabType[] = ["terminal", "welcome", "diff", "browser"];

        // Restore tabs, filtering out any with invalid types
        state.tabs = snapshot.tabs
          .filter((t) => t.id && validTabTypes.includes(t.type as TabType))
          .map((t) => ({
            id: t.id,
            type: t.type as TabType,
            title: t.title || t.type,
            url: t.url,
            projectId: t.projectId ? (projectIdMap.get(t.projectId) || t.projectId) : undefined,
            customTitle: t.customTitle,
            // Restore browser tab fields with fresh browserId to avoid stale view references
            ...(t.type === "browser" ? {
              browserId: `center-browser-${Date.now()}-${t.id}`,
              initialUrl: t.initialUrl || t.url || "http://localhost:3000",
            } : {}),
          }));

        // If all tabs were filtered out, fall back to default welcome tab
        if (state.tabs.length === 0) {
          state.tabs = [{ id: "welcome", type: "welcome", title: "Welcome" }];
          state.activeTabId = "welcome";
          state.terminalPanes = {};
          state.zoomedPane = null;
          return;
        }

        // Restore active tab (fall back to first tab if saved tab no longer exists)
        const savedActiveExists = state.tabs.some((t) => t.id === snapshot.activeTabId);
        state.activeTabId = savedActiveExists
          ? snapshot.activeTabId
          : state.tabs[0]?.id || null;

        // Restore terminal pane structure with fresh sessionIds
        // Handles both old flat format (panes[]) and would handle tree format in future
        state.terminalPanes = {};
        for (const [tabId, savedPaneState] of Object.entries(snapshot.terminalPanes || {})) {
          // Only restore pane state if the tab still exists
          if (!state.tabs.some((t) => t.id === tabId)) continue;
          // Skip if panes array is invalid
          if (!savedPaneState?.panes || !Array.isArray(savedPaneState.panes) || savedPaneState.panes.length === 0) continue;

          const restoredPanes: TerminalPaneData[] = savedPaneState.panes
            .filter((p) => p.id)
            .map((p, i) => ({
              type: "terminal" as const,
              id: p.id,
              sessionId: `${tabId}-${Date.now()}-${i}`,
              cwd: p.cwd || "",
              customLabel: p.customLabel,
              lastActivity: Date.now(),
            }));

          if (restoredPanes.length === 0) continue;

          // Convert flat pane list into a split tree
          state.terminalPanes[tabId] = {
            splitTree: treeFromFlat(restoredPanes, savedPaneState.splitDirection || "horizontal"),
            activePane: savedPaneState.activePane || restoredPanes[0].id,
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
/** Flat list of panes from the split tree (backward-compat for rendering) */
export const useTabPanesList = (tabId: string) =>
  useAppStore((s) => {
    const ts = s.terminalPanes[tabId];
    return ts ? flattenPanes(ts.splitTree) : [];
  });
export const useActivePane = (tabId: string) =>
  useAppStore((s) => s.terminalPanes[tabId]?.activePane);
/** Root-level split direction (backward-compat) */
export const useSplitDirection = (tabId: string) =>
  useAppStore((s) => {
    const ts = s.terminalPanes[tabId];
    return ts ? getRootDirection(ts.splitTree) : "horizontal";
  });
/** The full split tree for recursive rendering */
export const useSplitTree = (tabId: string) =>
  useAppStore((s) => s.terminalPanes[tabId]?.splitTree);
export const useZoomedPane = () => useAppStore((s) => s.zoomedPane);

// Layout selector hooks
export const useLayout = () => useAppStore((s) => s.layout);
export const useRightPanelOpen = () => useAppStore((s) => s.layout.rightPanel.isOpen);
export const useRightPanelPanes = () => useAppStore((s) => s.layout.rightPanel.panes);
export const usePanelSizes = () => useAppStore((s) => s.layout.panelSizes);
export const useDevToolsDockOpen = () => useAppStore((s) => s.layout.devToolsDockOpen);

// Browser tab selector hooks
export const useBrowserTabs = () => useAppStore((s) => s.layout.rightPanel.browserTabs);
export const useActiveBrowserTabId = () => useAppStore((s) => s.layout.rightPanel.activeBrowserTabId);
