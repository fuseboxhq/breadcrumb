import { app, BrowserWindow } from "electron";
import path from "path";
import { createMainWindow } from "./windows/createMainWindow";
import { registerIPCHandlers } from "./ipc/handlers";
import { registerTerminalIPCHandlers } from "./ipc/terminalIpc";
import { registerExtensionIPCHandlers } from "./ipc/extensionIpc";
import { registerSettingsIPCHandlers } from "./ipc/settingsIpc";
import { terminalService } from "./terminal/TerminalService";
import { ExtensionManager } from "./extensions/ExtensionManager";

let mainWindow: BrowserWindow | null = null;
let cleanupIPC: (() => void) | null = null;
let cleanupTerminalIPC: (() => void) | null = null;
let cleanupExtensionIPC: (() => void) | null = null;
let cleanupSettingsIPC: (() => void) | null = null;
let extensionManager: ExtensionManager | null = null;

function setupMainWindow(): void {
  if (!mainWindow) return;
  cleanupIPC = registerIPCHandlers(mainWindow);
  cleanupTerminalIPC = registerTerminalIPCHandlers(mainWindow);
  cleanupSettingsIPC = registerSettingsIPCHandlers(mainWindow);

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
  if (cleanupSettingsIPC) { cleanupSettingsIPC(); cleanupSettingsIPC = null; }
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    app.setName("Breadcrumb");

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
