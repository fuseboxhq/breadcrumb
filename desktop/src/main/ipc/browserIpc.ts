import { BrowserWindow, ipcMain, shell } from "electron";
import { IPC_CHANNELS, BrowserBounds } from "../../shared/types";
import { BrowserViewManager } from "../browser/BrowserViewManager";
import { validateExternalUrl } from "../utils/pathValidation";

let handlersRegistered = false;

/**
 * Registry of browser instances keyed by browserId.
 * Each browserId maps to its own BrowserViewManager (and thus its own WebContentsView).
 */
const browsers = new Map<string, BrowserViewManager>();
let mainWindowRef: BrowserWindow | null = null;

/** Get or throw for a specific browser instance */
function requireBrowser(browserId: string): BrowserViewManager {
  const manager = browsers.get(browserId);
  if (!manager) {
    throw new Error(`Browser instance not found: ${browserId}`);
  }
  return manager;
}

/**
 * Register browser IPC handlers for the embedded WebContentsView browser.
 * All browser commands accept a `browserId` to route to the correct instance.
 * Returns a cleanup function to remove all listeners and destroy all views.
 */
export function registerBrowserIPCHandlers(mainWindow: BrowserWindow): () => void {
  if (handlersRegistered) return () => {};
  handlersRegistered = true;
  mainWindowRef = mainWindow;

  // Create a browser instance
  ipcMain.handle(IPC_CHANNELS.BROWSER_CREATE, async (_, browserId: string) => {
    try {
      if (browsers.has(browserId)) {
        return { success: true };
      }
      const manager = new BrowserViewManager(mainWindow, browserId);
      browsers.set(browserId, manager);
      await manager.create();
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Navigate to URL
  ipcMain.handle(IPC_CHANNELS.BROWSER_NAVIGATE, async (_, browserId: string, url: string) => {
    try {
      await requireBrowser(browserId).navigate(url);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Go back
  ipcMain.handle(IPC_CHANNELS.BROWSER_GO_BACK, async (_, browserId: string) => {
    try {
      requireBrowser(browserId).goBack();
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Go forward
  ipcMain.handle(IPC_CHANNELS.BROWSER_GO_FORWARD, async (_, browserId: string) => {
    try {
      requireBrowser(browserId).goForward();
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Reload
  ipcMain.handle(IPC_CHANNELS.BROWSER_RELOAD, async (_, browserId: string) => {
    try {
      requireBrowser(browserId).reload();
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Set bounds
  ipcMain.handle(IPC_CHANNELS.BROWSER_SET_BOUNDS, async (_, browserId: string, bounds: BrowserBounds) => {
    try {
      requireBrowser(browserId).setBounds(bounds);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Destroy a browser instance
  ipcMain.handle(IPC_CHANNELS.BROWSER_DESTROY, async (_, browserId: string) => {
    try {
      const manager = browsers.get(browserId);
      if (manager) {
        manager.destroy();
        browsers.delete(browserId);
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Open DevTools
  ipcMain.handle(IPC_CHANNELS.BROWSER_OPEN_DEVTOOLS, async (_, browserId: string) => {
    try {
      requireBrowser(browserId).openDevTools();
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Close DevTools
  ipcMain.handle(IPC_CHANNELS.BROWSER_CLOSE_DEVTOOLS, async (_, browserId: string) => {
    try {
      requireBrowser(browserId).closeDevTools();
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Open URL in system's default browser (no browserId needed)
  ipcMain.handle(IPC_CHANNELS.BROWSER_OPEN_EXTERNAL, async (_, url: string) => {
    try {
      const validated = validateExternalUrl(url);
      await shell.openExternal(validated);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Set DevTools bounds
  ipcMain.handle(IPC_CHANNELS.BROWSER_SET_DEVTOOLS_BOUNDS, async (_, browserId: string, bounds: BrowserBounds) => {
    try {
      requireBrowser(browserId).setDevToolsBounds(bounds);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  return () => {
    // Destroy all browser views on cleanup
    for (const [, manager] of browsers) {
      manager.destroy();
    }
    browsers.clear();
    mainWindowRef = null;

    ipcMain.removeHandler(IPC_CHANNELS.BROWSER_CREATE);
    ipcMain.removeHandler(IPC_CHANNELS.BROWSER_NAVIGATE);
    ipcMain.removeHandler(IPC_CHANNELS.BROWSER_GO_BACK);
    ipcMain.removeHandler(IPC_CHANNELS.BROWSER_GO_FORWARD);
    ipcMain.removeHandler(IPC_CHANNELS.BROWSER_RELOAD);
    ipcMain.removeHandler(IPC_CHANNELS.BROWSER_SET_BOUNDS);
    ipcMain.removeHandler(IPC_CHANNELS.BROWSER_DESTROY);
    ipcMain.removeHandler(IPC_CHANNELS.BROWSER_OPEN_DEVTOOLS);
    ipcMain.removeHandler(IPC_CHANNELS.BROWSER_CLOSE_DEVTOOLS);
    ipcMain.removeHandler(IPC_CHANNELS.BROWSER_OPEN_EXTERNAL);
    ipcMain.removeHandler(IPC_CHANNELS.BROWSER_SET_DEVTOOLS_BOUNDS);
    handlersRegistered = false;
  };
}

/**
 * Get a specific browser instance by ID.
 */
export function getBrowser(browserId: string): BrowserViewManager | undefined {
  return browsers.get(browserId);
}

/**
 * Get all active browser IDs.
 */
export function getAllBrowserIds(): string[] {
  return [...browsers.keys()];
}
