import { BrowserWindow, ipcMain, dialog, app } from "electron";
import path from "path";
import { IPC_CHANNELS } from "../../shared/types";
import { gitService } from "../git/GitService";

let handlersRegistered = false;

/**
 * Validate a path to prevent path traversal attacks.
 */
function validatePath(inputPath: string): string {
  const resolved = path.resolve(inputPath);
  if (inputPath.includes("..")) {
    throw new Error("Path traversal not allowed");
  }
  return resolved;
}

/**
 * Register core IPC handlers (non-terminal).
 * Returns a cleanup function to remove all listeners.
 */
export function registerIPCHandlers(mainWindow: BrowserWindow): () => void {
  if (handlersRegistered) return () => {};
  handlersRegistered = true;

  // File dialog
  ipcMain.handle(IPC_CHANNELS.DIALOG_SELECT_DIRECTORY, async () => {
    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ["openDirectory", "createDirectory"],
      });
      if (result.canceled || result.filePaths.length === 0) return null;
      return result.filePaths[0];
    } catch {
      return null;
    }
  });

  // System
  ipcMain.handle(IPC_CHANNELS.SYSTEM_GET_WORKING_DIR, async () => {
    return app.getPath("home");
  });

  // Git
  ipcMain.handle(
    IPC_CHANNELS.GIT_INFO,
    async (_, { workingDirectory }: { workingDirectory: string }) => {
      try {
        const validatedPath = validatePath(workingDirectory);
        const gitInfo = gitService.getGitInfo(validatedPath);
        return { success: true, gitInfo };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }
  );

  return () => {
    ipcMain.removeHandler(IPC_CHANNELS.DIALOG_SELECT_DIRECTORY);
    ipcMain.removeHandler(IPC_CHANNELS.SYSTEM_GET_WORKING_DIR);
    ipcMain.removeHandler(IPC_CHANNELS.GIT_INFO);
    handlersRegistered = false;
  };
}
