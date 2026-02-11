import { create } from "zustand";

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

export interface AppState {
  // Sidebar
  sidebarView: SidebarView;
  sidebarCollapsed: boolean;

  // Tabs
  tabs: WorkspaceTab[];
  activeTabId: string | null;

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
  currentProjectPath: null,
  theme: "dark",
};

export const useAppStore = create<AppStore>((set) => ({
  ...initialState,

  // Sidebar
  setSidebarView: (view) =>
    set((state) => ({
      sidebarView: view,
      sidebarCollapsed: state.sidebarView === view ? !state.sidebarCollapsed : false,
    })),

  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  // Tabs
  addTab: (tab) =>
    set((state) => ({
      tabs: [...state.tabs, tab],
      activeTabId: tab.id,
    })),

  removeTab: (id) =>
    set((state) => {
      const newTabs = state.tabs.filter((t) => t.id !== id);
      const newActiveId =
        state.activeTabId === id
          ? newTabs[newTabs.length - 1]?.id || null
          : state.activeTabId;
      return { tabs: newTabs, activeTabId: newActiveId };
    }),

  setActiveTab: (id) => set({ activeTabId: id }),

  updateTab: (id, updates) =>
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),

  // Project
  setCurrentProjectPath: (path) => set({ currentProjectPath: path }),

  // Theme
  setTheme: (theme) => set({ theme }),
}));

// Selector hooks
export const useSidebarView = () => useAppStore((s) => s.sidebarView);
export const useSidebarCollapsed = () => useAppStore((s) => s.sidebarCollapsed);
export const useTabs = () => useAppStore((s) => s.tabs);
export const useActiveTabId = () => useAppStore((s) => s.activeTabId);
export const useActiveTab = () =>
  useAppStore((s) => s.tabs.find((t) => t.id === s.activeTabId));
export const useCurrentProjectPath = () => useAppStore((s) => s.currentProjectPath);
