import { BrowserWindow, nativeTheme, shell } from "electron";
import path from "path";
import { settingsStore } from "../settings/SettingsStore";

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

export function createMainWindow(): BrowserWindow {
  // Read persisted theme preference and sync native chrome before window is created
  const theme = settingsStore.get("theme") || "light";
  nativeTheme.themeSource = theme;
  const isDark =
    theme === "dark" ||
    (theme === "system" && nativeTheme.shouldUseDarkColors);

  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 15, y: 15 },
    backgroundColor: isDark ? "#0f0f0f" : "#ffffff",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Load the app
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }

  // Open DevTools in development
  if (process.env.NODE_ENV === "development") {
    mainWindow.webContents.openDevTools({ mode: "right" });
  }

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  return mainWindow;
}
