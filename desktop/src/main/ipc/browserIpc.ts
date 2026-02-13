import { BrowserWindow, ipcMain } from "electron";
import { IPC_CHANNELS, BrowserBounds } from "../../shared/types";

let handlersRegistered = false;

/**
 * Register browser IPC handlers for the embedded WebContentsView browser.
 * Returns a cleanup function to remove all listeners.
 *
 * Handler implementations will be wired to BrowserViewManager in task ahr.2.
 */
export function registerBrowserIPCHandlers(mainWindow: BrowserWindow): () => void {
  if (handlersRegistered) return () => {};
  handlersRegistered = true;

  // Create the browser WebContentsView
  ipcMain.handle(IPC_CHANNELS.BROWSER_CREATE, async () => {
    try {
      // TODO: Wire to BrowserViewManager.create() in ahr.2
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Navigate to URL
  ipcMain.handle(IPC_CHANNELS.BROWSER_NAVIGATE, async (_, url: string) => {
    try {
      // TODO: Wire to BrowserViewManager.navigate(url) in ahr.2
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Go back in navigation history
  ipcMain.handle(IPC_CHANNELS.BROWSER_GO_BACK, async () => {
    try {
      // TODO: Wire to BrowserViewManager in ahr.2
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Go forward in navigation history
  ipcMain.handle(IPC_CHANNELS.BROWSER_GO_FORWARD, async () => {
    try {
      // TODO: Wire to BrowserViewManager in ahr.2
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Reload current page
  ipcMain.handle(IPC_CHANNELS.BROWSER_RELOAD, async () => {
    try {
      // TODO: Wire to BrowserViewManager in ahr.2
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Set browser WebContentsView bounds (called from ResizeObserver in renderer)
  ipcMain.handle(IPC_CHANNELS.BROWSER_SET_BOUNDS, async (_, bounds: BrowserBounds) => {
    try {
      // TODO: Wire to BrowserViewManager.setBounds(bounds) in ahr.3
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Destroy the browser WebContentsView
  ipcMain.handle(IPC_CHANNELS.BROWSER_DESTROY, async () => {
    try {
      // TODO: Wire to BrowserViewManager.destroy() in ahr.2
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Open DevTools for the browser WebContentsView
  ipcMain.handle(IPC_CHANNELS.BROWSER_OPEN_DEVTOOLS, async () => {
    try {
      // TODO: Wire to DevTools management in ahr.6
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Close DevTools
  ipcMain.handle(IPC_CHANNELS.BROWSER_CLOSE_DEVTOOLS, async () => {
    try {
      // TODO: Wire to DevTools management in ahr.6
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Set DevTools WebContentsView bounds
  ipcMain.handle(IPC_CHANNELS.BROWSER_SET_DEVTOOLS_BOUNDS, async (_, bounds: BrowserBounds) => {
    try {
      // TODO: Wire to DevTools bounds management in ahr.6
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  return () => {
    ipcMain.removeHandler(IPC_CHANNELS.BROWSER_CREATE);
    ipcMain.removeHandler(IPC_CHANNELS.BROWSER_NAVIGATE);
    ipcMain.removeHandler(IPC_CHANNELS.BROWSER_GO_BACK);
    ipcMain.removeHandler(IPC_CHANNELS.BROWSER_GO_FORWARD);
    ipcMain.removeHandler(IPC_CHANNELS.BROWSER_RELOAD);
    ipcMain.removeHandler(IPC_CHANNELS.BROWSER_SET_BOUNDS);
    ipcMain.removeHandler(IPC_CHANNELS.BROWSER_DESTROY);
    ipcMain.removeHandler(IPC_CHANNELS.BROWSER_OPEN_DEVTOOLS);
    ipcMain.removeHandler(IPC_CHANNELS.BROWSER_CLOSE_DEVTOOLS);
    ipcMain.removeHandler(IPC_CHANNELS.BROWSER_SET_DEVTOOLS_BOUNDS);
    handlersRegistered = false;
  };
}
