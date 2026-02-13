import { BrowserWindow, ipcMain, shell } from "electron";
import { IPC_CHANNELS, BrowserBounds } from "../../shared/types";
import { BrowserViewManager } from "../browser/BrowserViewManager";

let handlersRegistered = false;
let browserManager: BrowserViewManager | null = null;

/**
 * Register browser IPC handlers for the embedded WebContentsView browser.
 * Returns a cleanup function to remove all listeners and destroy the view.
 */
export function registerBrowserIPCHandlers(mainWindow: BrowserWindow): () => void {
  if (handlersRegistered) return () => {};
  handlersRegistered = true;

  browserManager = new BrowserViewManager(mainWindow);

  // Create the browser WebContentsView
  ipcMain.handle(IPC_CHANNELS.BROWSER_CREATE, async () => {
    try {
      await browserManager!.create();
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Navigate to URL
  ipcMain.handle(IPC_CHANNELS.BROWSER_NAVIGATE, async (_, url: string) => {
    try {
      await browserManager!.navigate(url);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Go back in navigation history
  ipcMain.handle(IPC_CHANNELS.BROWSER_GO_BACK, async () => {
    try {
      browserManager!.goBack();
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Go forward in navigation history
  ipcMain.handle(IPC_CHANNELS.BROWSER_GO_FORWARD, async () => {
    try {
      browserManager!.goForward();
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Reload current page
  ipcMain.handle(IPC_CHANNELS.BROWSER_RELOAD, async () => {
    try {
      browserManager!.reload();
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Set browser WebContentsView bounds (called from ResizeObserver in renderer)
  ipcMain.handle(IPC_CHANNELS.BROWSER_SET_BOUNDS, async (_, bounds: BrowserBounds) => {
    try {
      browserManager!.setBounds(bounds);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Destroy the browser WebContentsView
  ipcMain.handle(IPC_CHANNELS.BROWSER_DESTROY, async () => {
    try {
      browserManager!.destroy();
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Open DevTools for the browser WebContentsView
  ipcMain.handle(IPC_CHANNELS.BROWSER_OPEN_DEVTOOLS, async () => {
    try {
      browserManager!.openDevTools();
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Close DevTools
  ipcMain.handle(IPC_CHANNELS.BROWSER_CLOSE_DEVTOOLS, async () => {
    try {
      browserManager!.closeDevTools();
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Open URL in system's default browser
  ipcMain.handle(IPC_CHANNELS.BROWSER_OPEN_EXTERNAL, async (_, url: string) => {
    try {
      await shell.openExternal(url);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Set DevTools WebContentsView bounds
  // TODO: Wire to dedicated DevTools WebContentsView in ahr.6
  ipcMain.handle(IPC_CHANNELS.BROWSER_SET_DEVTOOLS_BOUNDS, async (_, _bounds: BrowserBounds) => {
    try {
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  return () => {
    // Destroy the browser view on cleanup
    if (browserManager) {
      browserManager.destroy();
      browserManager = null;
    }

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
 * Get the current BrowserViewManager instance (for use by other modules).
 */
export function getBrowserManager(): BrowserViewManager | null {
  return browserManager;
}
