import { app, BrowserWindow, session } from "electron";
import path from "path";
import { createMainWindow } from "./windows/createMainWindow";
import { registerIPCHandlers } from "./ipc/handlers";
import { registerTerminalIPCHandlers } from "./ipc/terminalIpc";
import { registerExtensionIPCHandlers } from "./ipc/extensionIpc";
import { registerSettingsIPCHandlers } from "./ipc/settingsIpc";
import { registerPlanningIPCHandlers } from "./ipc/planningIpc";
import { registerBrowserIPCHandlers } from "./ipc/browserIpc";
import { registerProjectIPCHandlers } from "./ipc/projectIpc";
import { terminalService } from "./terminal/TerminalService";
import { ExtensionManager } from "./extensions/ExtensionManager";

let mainWindow: BrowserWindow | null = null;
let cleanupIPC: (() => void) | null = null;
let cleanupTerminalIPC: (() => void) | null = null;
let cleanupExtensionIPC: (() => void) | null = null;
let cleanupSettingsIPC: (() => void) | null = null;
let cleanupPlanningIPC: (() => void) | null = null;
let cleanupBrowserIPC: (() => void) | null = null;
let cleanupProjectIPC: (() => void) | null = null;
let extensionManager: ExtensionManager | null = null;

function setupMainWindow(): void {
  if (!mainWindow) return;
  cleanupIPC = registerIPCHandlers(mainWindow);
  cleanupTerminalIPC = registerTerminalIPCHandlers(mainWindow);
  cleanupSettingsIPC = registerSettingsIPCHandlers(mainWindow);
  cleanupPlanningIPC = registerPlanningIPCHandlers();
  cleanupBrowserIPC = registerBrowserIPCHandlers(mainWindow);
  cleanupProjectIPC = registerProjectIPCHandlers();

  // Initialize extension system
  try {
    const appRoot = path.resolve(__dirname, "../..");
    extensionManager = new ExtensionManager(appRoot);
    cleanupExtensionIPC = registerExtensionIPCHandlers(mainWindow, extensionManager);

    // Discover and start extensions (non-blocking)
    extensionManager.discover().then(() => {
      extensionManager?.startAll().catch((err) => {
        console.error("[Extensions] failed to start:", err);
      });
    }).catch((err) => {
      console.error("[Extensions] discovery failed:", err);
    });
  } catch (err) {
    console.error("[Extensions] initialization failed:", err);
  }
}

function cleanupMainWindow(): void {
  if (cleanupIPC) { cleanupIPC(); cleanupIPC = null; }
  if (cleanupTerminalIPC) { cleanupTerminalIPC(); cleanupTerminalIPC = null; }
  if (cleanupExtensionIPC) { cleanupExtensionIPC(); cleanupExtensionIPC = null; }
  if (cleanupPlanningIPC) { cleanupPlanningIPC(); cleanupPlanningIPC = null; }
  if (cleanupBrowserIPC) { cleanupBrowserIPC(); cleanupBrowserIPC = null; }
  if (cleanupProjectIPC) { cleanupProjectIPC(); cleanupProjectIPC = null; }
  if (cleanupSettingsIPC) { cleanupSettingsIPC(); cleanupSettingsIPC = null; }
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  // Allow macOS Keychain client certificates for mutual TLS flows
  // (e.g. Microsoft SSO on device.login.microsoftonline.com).
  app.on("select-client-certificate", (event, _webContents, _url, list, callback) => {
    if (list.length > 0) {
      event.preventDefault();
      callback(list[0]);
    }
  });

  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    app.setName("Breadcrumb");

    // Make the embedded browser session look like standard Chrome.
    // Electron's default UA contains "Electron/XX" which causes many sites
    // (Microsoft SSO, some SPAs) to serve degraded or broken responses.
    const browserSession = session.fromPartition("persist:browser");
    const electronUA = browserSession.getUserAgent();
    browserSession.setUserAgent(
      electronUA.replace(/\s*Electron\/\S+/, "").replace(/\s*Breadcrumb\/\S+/, "")
    );

    mainWindow = createMainWindow();
    setupMainWindow();

    mainWindow.on("closed", () => {
      cleanupMainWindow();
      mainWindow = null;
    });
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow = createMainWindow();
    setupMainWindow();

    mainWindow.on("closed", () => {
      cleanupMainWindow();
      mainWindow = null;
    });
  }
});

app.on("before-quit", () => {
  cleanupMainWindow();
  terminalService.terminateAll();
  extensionManager?.shutdown().catch(() => {});
});
