import Store from "electron-store";

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
