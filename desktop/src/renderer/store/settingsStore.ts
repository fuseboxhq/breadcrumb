import { create } from "zustand";

export type ThemePreference = "light" | "dark" | "system";

export interface TerminalSettings {
  fontFamily: string;
  fontSize: number;
  scrollback: number;
  cursorStyle: "block" | "underline" | "bar";
  cursorBlink: boolean;
  defaultShell: string;
}

export interface RightPanelPane {
  id: string;
  type: "browser" | "planning";
  size: number;
}

export interface LayoutSettings {
  rightPanel: {
    isOpen: boolean;
    panes: RightPanelPane[];
    browserTabs?: Array<{ id: string; browserId: string; url: string; title: string }>;
    activeBrowserTabId?: string | null;
  };
  panelSizes: {
    sidebar: number;
    center: number;
    rightPanel: number;
  };
}

export interface BrowserSettings {
  lastUrl: string;
}

export interface WorkspaceSettings {
  tabs?: Array<{
    id: string;
    type: string;
    title: string;
    url?: string;
    projectId?: string;
    browserId?: string;
    initialUrl?: string;
  }>;
  activeTabId?: string | null;
  terminalPanes?: Record<string, {
    panes: Array<{
      id: string;
      cwd: string;
      customLabel?: string;
    }>;
    activePane: string;
    splitDirection: "horizontal" | "vertical";
  }>;
  activeProjectId?: string | null;
  projectPaths?: Record<string, string>;
}

export interface AppSettings {
  terminal: TerminalSettings;
  layout: LayoutSettings;
  browser: BrowserSettings;
  workspace: WorkspaceSettings;
  theme: ThemePreference;
}

const DEFAULT_TERMINAL_SETTINGS: TerminalSettings = {
  fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', 'Cascadia Code', Menlo, Monaco, monospace",
  fontSize: 13,
  scrollback: 5000,
  cursorStyle: "block",
  cursorBlink: true,
  defaultShell: "",
};

const DEFAULT_BROWSER_SETTINGS: BrowserSettings = {
  lastUrl: "http://localhost:3000",
};

const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = {};

interface SettingsState {
  settings: AppSettings;
  loaded: boolean;
  theme: ThemePreference;
}

const DEFAULT_LAYOUT_SETTINGS: LayoutSettings = {
  rightPanel: { isOpen: false, panes: [] },
  panelSizes: { sidebar: 18, center: 82, rightPanel: 0 },
};

interface SettingsActions {
  loadSettings: () => Promise<void>;
  setTheme: (theme: ThemePreference) => void;
  updateTerminalSetting: <K extends keyof TerminalSettings>(key: K, value: TerminalSettings[K]) => Promise<void>;
  updateLayoutSetting: (layout: LayoutSettings) => Promise<void>;
  resetSettings: () => Promise<void>;
}

export type SettingsStore = SettingsState & SettingsActions;

/** Resolve a theme preference to 'light' or 'dark' */
function resolveTheme(pref: ThemePreference): "light" | "dark" {
  if (pref === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return pref;
}

/** Apply a theme to the DOM immediately */
function applyThemeToDOM(pref: ThemePreference): void {
  const resolved = resolveTheme(pref);
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

/** Read initial theme from localStorage (set by inline FOUC-prevention script) */
function getInitialTheme(): ThemePreference {
  try {
    const stored = localStorage.getItem("breadcrumb-theme") as ThemePreference | null;
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch { /* ignore */ }
  return "light";
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  settings: {
    terminal: DEFAULT_TERMINAL_SETTINGS,
    layout: DEFAULT_LAYOUT_SETTINGS,
    browser: DEFAULT_BROWSER_SETTINGS,
    workspace: DEFAULT_WORKSPACE_SETTINGS,
    theme: "light",
  },
  loaded: false,
  theme: getInitialTheme(),

  loadSettings: async () => {
    const all = await window.breadcrumbAPI?.getSettings() as unknown as AppSettings | undefined;
    const canonicalTheme = (all?.theme as ThemePreference) || "light";

    // Reconcile: electron-store is canonical — update localStorage if they disagree
    try {
      const localTheme = localStorage.getItem("breadcrumb-theme");
      if (localTheme !== canonicalTheme) {
        localStorage.setItem("breadcrumb-theme", canonicalTheme);
        applyThemeToDOM(canonicalTheme);
      }
    } catch { /* ignore */ }

    set({
      settings: {
        terminal: { ...DEFAULT_TERMINAL_SETTINGS, ...(all?.terminal as Partial<TerminalSettings> || {}) },
        layout: {
          rightPanel: {
            ...DEFAULT_LAYOUT_SETTINGS.rightPanel,
            ...(all?.layout?.rightPanel || {}),
          },
          panelSizes: {
            ...DEFAULT_LAYOUT_SETTINGS.panelSizes,
            ...(all?.layout?.panelSizes || {}),
          },
        },
        browser: { ...DEFAULT_BROWSER_SETTINGS, ...(all?.browser as Partial<BrowserSettings> || {}) },
        workspace: { ...DEFAULT_WORKSPACE_SETTINGS, ...(all?.workspace || {}) },
        theme: canonicalTheme,
      },
      loaded: true,
      theme: canonicalTheme,
    });
  },

  setTheme: (theme: ThemePreference) => {
    // 1. Apply immediately to DOM (instant visual change)
    applyThemeToDOM(theme);

    // 2. Persist to localStorage (for FOUC prevention on next load)
    try { localStorage.setItem("breadcrumb-theme", theme); } catch { /* ignore */ }

    // 3. Persist to electron-store (canonical — also triggers nativeTheme sync via main process)
    window.breadcrumbAPI?.setSetting("theme", theme);

    // 4. Update store
    set((state) => ({
      theme,
      settings: { ...state.settings, theme },
    }));
  },

  updateTerminalSetting: async (key, value) => {
    await window.breadcrumbAPI?.setSetting(`terminal.${key}`, value);
    set((state) => ({
      settings: {
        ...state.settings,
        terminal: { ...state.settings.terminal, [key]: value },
      },
    }));
  },

  updateLayoutSetting: async (layout) => {
    await window.breadcrumbAPI?.setSetting("layout", layout);
    set((state) => ({
      settings: { ...state.settings, layout },
    }));
  },

  resetSettings: async () => {
    await window.breadcrumbAPI?.resetSettings();
    set({
      theme: "light",
      settings: {
        terminal: DEFAULT_TERMINAL_SETTINGS,
        layout: DEFAULT_LAYOUT_SETTINGS,
        browser: DEFAULT_BROWSER_SETTINGS,
        workspace: DEFAULT_WORKSPACE_SETTINGS,
        theme: "light",
      },
    });
  },
}));

// Selector hooks
export const useTerminalSettings = () => useSettingsStore((s) => s.settings.terminal);
export const useLayoutSettings = () => useSettingsStore((s) => s.settings.layout);
export const useBrowserSettings = () => useSettingsStore((s) => s.settings.browser);
export const useWorkspaceSettings = () => useSettingsStore((s) => s.settings.workspace);
export const useSettingsLoaded = () => useSettingsStore((s) => s.loaded);
export const useTheme = () => useSettingsStore((s) => s.theme);
export const useSetTheme = () => useSettingsStore((s) => s.setTheme);
export const useResolvedTheme = (): "light" | "dark" => {
  const theme = useSettingsStore((s) => s.theme);
  return resolveTheme(theme);
};
