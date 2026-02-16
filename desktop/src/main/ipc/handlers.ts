import { BrowserWindow, ipcMain, dialog, app } from "electron";
import fs from "fs/promises";
import { IPC_CHANNELS } from "../../shared/types";
import { gitService, type CommitLogOptions } from "../git/GitService";
import { validatePath } from "../utils/pathValidation";

let handlersRegistered = false;

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

  // Read file (safe: validates path, returns null on error)
  ipcMain.handle(IPC_CHANNELS.SYSTEM_READ_FILE, async (_, filePath: string) => {
    try {
      const resolved = validatePath(filePath);
      const content = await fs.readFile(resolved, "utf-8");
      return { success: true, content };
    } catch {
      return { success: false, content: null };
    }
  });

  // Git
  ipcMain.handle(
    IPC_CHANNELS.GIT_INFO,
    async (_, { workingDirectory }: { workingDirectory: string }) => {
      try {
        const validatedPath = validatePath(workingDirectory);
        const gitInfo = await gitService.getGitInfo(validatedPath);
        return { success: true, gitInfo };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }
  );

  // Git log
  ipcMain.handle(
    IPC_CHANNELS.GIT_LOG,
    async (
      _,
      { projectPath, options }: { projectPath: string; options?: CommitLogOptions }
    ) => {
      try {
        const validated = validatePath(projectPath);
        const result = await gitService.getCommitLog(validated, options);
        return { success: true, data: result };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }
  );

  // Git diff
  ipcMain.handle(
    IPC_CHANNELS.GIT_DIFF,
    async (_, { projectPath, hash }: { projectPath: string; hash: string }) => {
      try {
        const validated = validatePath(projectPath);
        const diff = await gitService.getCommitDiff(validated, hash);
        return { success: true, data: diff };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }
  );

  // Git commit stats
  ipcMain.handle(
    IPC_CHANNELS.GIT_COMMIT_STATS,
    async (_, { projectPath, hash }: { projectPath: string; hash: string }) => {
      try {
        const validated = validatePath(projectPath);
        const stats = await gitService.getCommitStats(validated, hash);
        return { success: true, data: stats };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }
  );

  return () => {
    ipcMain.removeHandler(IPC_CHANNELS.DIALOG_SELECT_DIRECTORY);
    ipcMain.removeHandler(IPC_CHANNELS.SYSTEM_GET_WORKING_DIR);
    ipcMain.removeHandler(IPC_CHANNELS.SYSTEM_READ_FILE);
    ipcMain.removeHandler(IPC_CHANNELS.GIT_INFO);
    ipcMain.removeHandler(IPC_CHANNELS.GIT_LOG);
    ipcMain.removeHandler(IPC_CHANNELS.GIT_DIFF);
    ipcMain.removeHandler(IPC_CHANNELS.GIT_COMMIT_STATS);
    handlersRegistered = false;
  };
}
