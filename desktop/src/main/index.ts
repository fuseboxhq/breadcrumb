import { app, BrowserWindow } from "electron";
import { createMainWindow } from "./windows/createMainWindow";

// Keep a global reference of the window object
let mainWindow: BrowserWindow | null = null;

// Prevent multiple instances
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

    mainWindow.on("closed", () => {
      mainWindow = null;
    });
  });
}

// Quit when all windows are closed
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// macOS: Re-create window when dock icon clicked
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow = createMainWindow();

    mainWindow.on("closed", () => {
      mainWindow = null;
    });
  }
});
