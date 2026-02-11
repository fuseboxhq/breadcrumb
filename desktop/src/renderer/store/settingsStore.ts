import { create } from "zustand";

export interface TerminalSettings {
  fontFamily: string;
  fontSize: number;
  scrollback: number;
  cursorStyle: "block" | "underline" | "bar";
  cursorBlink: boolean;
  defaultShell: string;
}

export interface AppSettings {
  terminal: TerminalSettings;
}

const DEFAULT_TERMINAL_SETTINGS: TerminalSettings = {
  fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', 'Cascadia Code', Menlo, Monaco, monospace",
  fontSize: 13,
  scrollback: 5000,
  cursorStyle: "block",
  cursorBlink: true,
  defaultShell: "/bin/zsh",
};

interface SettingsState {
  settings: AppSettings;
  loaded: boolean;
}

interface SettingsActions {
  loadSettings: () => Promise<void>;
  updateTerminalSetting: <K extends keyof TerminalSettings>(key: K, value: TerminalSettings[K]) => Promise<void>;
  resetSettings: () => Promise<void>;
}

export type SettingsStore = SettingsState & SettingsActions;

export const useSettingsStore = create<SettingsStore>((set) => ({
  settings: {
    terminal: DEFAULT_TERMINAL_SETTINGS,
  },
  loaded: false,

  loadSettings: async () => {
    const all = await window.breadcrumbAPI?.getSettings() as unknown as AppSettings | undefined;
    if (all?.terminal) {
      set({
        settings: {
          terminal: { ...DEFAULT_TERMINAL_SETTINGS, ...(all.terminal as Partial<TerminalSettings>) },
        },
        loaded: true,
      });
    } else {
      set({ loaded: true });
    }
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

  resetSettings: async () => {
    await window.breadcrumbAPI?.resetSettings();
    set({
      settings: { terminal: DEFAULT_TERMINAL_SETTINGS },
    });
  },
}));

// Selector hooks
export const useTerminalSettings = () => useSettingsStore((s) => s.settings.terminal);
export const useSettingsLoaded = () => useSettingsStore((s) => s.loaded);
