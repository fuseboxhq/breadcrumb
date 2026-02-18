import { BrowserWindow, ipcMain, dialog, app } from "electron";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
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

  // List directory entries (safe: validates path, returns empty on error)
  ipcMain.handle(IPC_CHANNELS.SYSTEM_LIST_DIR, async (_, dirPath: string) => {
    try {
      const resolved = validatePath(dirPath);
      const entries = await fs.readdir(resolved, { withFileTypes: true });
      return {
        success: true,
        entries: entries.map((e) => ({ name: e.name, isDirectory: e.isDirectory() })),
      };
    } catch {
      return { success: false, entries: [] };
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

  // Image temp file save (for debug modal screenshots)
  ipcMain.handle(
    IPC_CHANNELS.IMAGE_SAVE_TEMP,
    async (_event, { dataUrl, extension }: { dataUrl: string; extension: string }) => {
      try {
        const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");
        const fileName = `breadcrumb-debug-${crypto.randomUUID()}.${extension}`;
        const filePath = path.join(app.getPath("temp"), fileName);
        await fs.writeFile(filePath, buffer);
        return { success: true, filePath };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }
  );

  // Image temp file delete
  ipcMain.handle(
    IPC_CHANNELS.IMAGE_DELETE_TEMP,
    async (_event, filePath: string) => {
      try {
        // Only allow deleting files from the temp directory
        const tempDir = app.getPath("temp");
        if (!filePath.startsWith(tempDir)) {
          return { success: false, error: "Path not in temp directory" };
        }
        await fs.unlink(filePath);
        return { success: true };
      } catch {
        return { success: true }; // Ignore if already deleted
      }
    }
  );

  return () => {
    ipcMain.removeHandler(IPC_CHANNELS.DIALOG_SELECT_DIRECTORY);
    ipcMain.removeHandler(IPC_CHANNELS.SYSTEM_GET_WORKING_DIR);
    ipcMain.removeHandler(IPC_CHANNELS.SYSTEM_READ_FILE);
    ipcMain.removeHandler(IPC_CHANNELS.SYSTEM_LIST_DIR);
    ipcMain.removeHandler(IPC_CHANNELS.GIT_INFO);
    ipcMain.removeHandler(IPC_CHANNELS.GIT_LOG);
    ipcMain.removeHandler(IPC_CHANNELS.GIT_DIFF);
    ipcMain.removeHandler(IPC_CHANNELS.GIT_COMMIT_STATS);
    ipcMain.removeHandler(IPC_CHANNELS.IMAGE_SAVE_TEMP);
    ipcMain.removeHandler(IPC_CHANNELS.IMAGE_DELETE_TEMP);
    handlersRegistered = false;
  };
}
