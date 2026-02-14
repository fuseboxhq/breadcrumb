import Store from "electron-store";

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
  size: number; // percentage within right panel
}

export interface LayoutSettings {
  rightPanel: {
    isOpen: boolean;
    panes: RightPanelPane[];
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

export interface AppSettings {
  terminal: TerminalSettings;
  layout: LayoutSettings;
  browser: BrowserSettings;
}

const schema = {
  terminal: {
    type: "object" as const,
    properties: {
      fontFamily: {
        type: "string" as const,
        default: "'JetBrains Mono', 'SF Mono', 'Fira Code', 'Cascadia Code', Menlo, Monaco, monospace",
      },
      fontSize: { type: "number" as const, default: 13, minimum: 8, maximum: 32 },
      scrollback: { type: "number" as const, default: 5000, minimum: 0, maximum: 100000 },
      cursorStyle: {
        type: "string" as const,
        enum: ["block", "underline", "bar"],
        default: "block",
      },
      cursorBlink: { type: "boolean" as const, default: true },
      defaultShell: { type: "string" as const, default: process.env.SHELL || "/bin/zsh" },
    },
    default: {},
  },
  layout: {
    type: "object" as const,
    properties: {
      rightPanel: {
        type: "object" as const,
        properties: {
          isOpen: { type: "boolean" as const, default: false },
          panes: {
            type: "array" as const,
            items: {
              type: "object" as const,
              properties: {
                id: { type: "string" as const },
                type: { type: "string" as const, enum: ["browser", "planning"] },
                size: { type: "number" as const, minimum: 0, maximum: 100 },
              },
            },
            default: [],
          },
        },
        default: { isOpen: false, panes: [] },
      },
      panelSizes: {
        type: "object" as const,
        properties: {
          sidebar: { type: "number" as const, default: 18, minimum: 0, maximum: 40 },
          center: { type: "number" as const, default: 82, minimum: 30, maximum: 100 },
          rightPanel: { type: "number" as const, default: 0, minimum: 0, maximum: 60 },
        },
        default: { sidebar: 18, center: 82, rightPanel: 0 },
      },
    },
    default: {},
  },
  browser: {
    type: "object" as const,
    properties: {
      lastUrl: { type: "string" as const, default: "http://localhost:3000" },
    },
    default: {},
  },
};

export const settingsStore = new Store<AppSettings>({
  schema,
  name: "settings",
});

export class SettingsManager {
  static getAll(): AppSettings {
    return settingsStore.store;
  }

  static get<K extends keyof AppSettings>(key: K): AppSettings[K] {
    return settingsStore.get(key);
  }

  static set<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    settingsStore.set(key, value);
  }

  static setNested(key: string, value: unknown): void {
    settingsStore.set(key as keyof AppSettings, value as AppSettings[keyof AppSettings]);
  }

  static reset(): void {
    settingsStore.clear();
  }
}
