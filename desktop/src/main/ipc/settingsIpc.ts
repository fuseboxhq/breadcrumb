import { BrowserWindow, ipcMain, nativeTheme } from "electron";
import { IPC_CHANNELS } from "../../shared/types";
import { SettingsManager, settingsStore, type AppSettings } from "../settings/SettingsStore";

let handlersRegistered = false;

/**
 * Register settings IPC handlers.
 * Settings are managed in the main process via electron-store.
 * Returns a cleanup function.
 */
export function registerSettingsIPCHandlers(mainWindow: BrowserWindow): () => void {
  if (handlersRegistered) return () => {};
  handlersRegistered = true;

  // Get all settings
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET_ALL, () => {
    return SettingsManager.getAll();
  });

  // Get a specific setting key
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, (_, key: string) => {
    return SettingsManager.get(key as keyof AppSettings);
  });

  // Set a setting (supports nested keys like "terminal.fontSize")
  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, (_, key: string, value: unknown) => {
    try {
      if (key.includes(".")) {
        SettingsManager.setNested(key, value);
      } else {
        SettingsManager.set(key as keyof AppSettings, value as AppSettings[keyof AppSettings]);
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Reset all settings to defaults
  ipcMain.handle(IPC_CHANNELS.SETTINGS_RESET, () => {
    SettingsManager.reset();
    return { success: true };
  });

  // Watch for changes and broadcast to renderer + sync native theme
  const unsubscribe = settingsStore.onDidAnyChange((newValue) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_CHANNELS.SETTINGS_CHANGED, newValue);
    }
    // Sync macOS chrome (scroll bars, title bar, system dialogs) with app theme
    if (newValue?.theme) {
      nativeTheme.themeSource = newValue.theme;
    }
  });

  return () => {
    ipcMain.removeHandler(IPC_CHANNELS.SETTINGS_GET_ALL);
    ipcMain.removeHandler(IPC_CHANNELS.SETTINGS_GET);
    ipcMain.removeHandler(IPC_CHANNELS.SETTINGS_SET);
    ipcMain.removeHandler(IPC_CHANNELS.SETTINGS_RESET);
    unsubscribe?.();
    handlersRegistered = false;
  };
}
