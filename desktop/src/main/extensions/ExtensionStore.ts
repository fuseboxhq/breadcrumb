/**
 * Extension state persistence — separate from app settings.
 *
 * Uses its own electron-store instance (extension-data.json) to avoid
 * schema conflicts with SettingsStore. State is keyed by extensionId.
 */

import Store from "electron-store";

const extensionDataStore = new Store<Record<string, Record<string, unknown>>>({
  name: "extension-data",
  defaults: {},
});

export const ExtensionStateManager = {
  get(extensionId: string, key: string): unknown {
    return extensionDataStore.get(`${extensionId}.${key}`);
  },

  set(extensionId: string, key: string, value: unknown): void {
    extensionDataStore.set(`${extensionId}.${key}`, value);
  },

  getAll(extensionId: string): Record<string, unknown> {
    const all = extensionDataStore.store;
    const prefix = `${extensionId}.`;
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(all)) {
      if (k.startsWith(prefix)) {
        result[k.slice(prefix.length)] = v;
      }
    }
    return result;
  },

  clear(extensionId: string): void {
    const all = extensionDataStore.store;
    for (const key of Object.keys(all)) {
      if (key.startsWith(`${extensionId}.`)) {
        extensionDataStore.delete(key as never);
      }
    }
  },
};
