import { app, BrowserWindow } from "electron";
import { createMainWindow } from "./windows/createMainWindow";
import { registerIPCHandlers } from "./ipc/handlers";
import { registerTerminalIPCHandlers } from "./ipc/terminalIpc";
import { terminalService } from "./terminal/TerminalService";

let mainWindow: BrowserWindow | null = null;
let cleanupIPC: (() => void) | null = null;
let cleanupTerminalIPC: (() => void) | null = null;

function setupMainWindow(): void {
  if (!mainWindow) return;
  cleanupIPC = registerIPCHandlers(mainWindow);
  cleanupTerminalIPC = registerTerminalIPCHandlers(mainWindow);
}

function cleanupMainWindow(): void {
  if (cleanupIPC) { cleanupIPC(); cleanupIPC = null; }
  if (cleanupTerminalIPC) { cleanupTerminalIPC(); cleanupTerminalIPC = null; }
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
});
