/**
 * Extension IPC handlers — bridges ExtensionManager to the renderer.
 */

import { ipcMain, type BrowserWindow } from "electron";
import { IPC_CHANNELS } from "../../shared/types";
import type { ExtensionManager } from "../extensions/ExtensionManager";

export function registerExtensionIPCHandlers(
  mainWindow: BrowserWindow,
  extensionManager: ExtensionManager
): () => void {
  // List all discovered extensions
  const handleList = () => {
    return extensionManager.getExtensionsForRenderer();
  };

  // Activate an extension by id
  const handleActivate = async (
    _event: Electron.IpcMainInvokeEvent,
    extensionId: string
  ) => {
    try {
      await extensionManager.activateExtension(extensionId);
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  };

  // Deactivate an extension by id
  const handleDeactivate = async (
    _event: Electron.IpcMainInvokeEvent,
    extensionId: string
  ) => {
    try {
      await extensionManager.deactivateExtension(extensionId);
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  };

  // Get all registered commands
  const handleCommands = () => {
    return extensionManager.getCommands();
  };

  // Execute a command
  const handleExecuteCommand = async (
    _event: Electron.IpcMainInvokeEvent,
    commandId: string,
    ...args: unknown[]
  ) => {
    try {
      const result = await extensionManager.executeCommand(commandId, ...args);
      return { success: true, result };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  };

  // Register handlers
  ipcMain.handle(IPC_CHANNELS.EXTENSIONS_LIST, handleList);
  ipcMain.handle(IPC_CHANNELS.EXTENSIONS_ACTIVATE, handleActivate);
  ipcMain.handle(IPC_CHANNELS.EXTENSIONS_DEACTIVATE, handleDeactivate);
  ipcMain.handle(IPC_CHANNELS.EXTENSIONS_COMMANDS, handleCommands);
  ipcMain.handle(IPC_CHANNELS.EXTENSIONS_EXECUTE_COMMAND, handleExecuteCommand);

  // Forward modal requests to renderer
  const onShowInputModal = (requestId: string, schema: unknown) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(
        IPC_CHANNELS.EXTENSIONS_SHOW_MODAL,
        { requestId, schema }
      );
    }
  };
  extensionManager.on("show-input-modal", onShowInputModal);

  // Receive modal results from renderer
  const handleModalResult = async (
    _event: Electron.IpcMainInvokeEvent,
    requestId: string,
    result: Record<string, unknown> | null
  ) => {
    extensionManager.resolveModal(requestId, result);
    return { success: true };
  };
  ipcMain.handle(IPC_CHANNELS.EXTENSIONS_MODAL_RESULT, handleModalResult);

  // Forward browser open requests to renderer so it opens a browser tab
  const onBrowserOpened = (browserId: string, url?: string, extensionId?: string) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(
        IPC_CHANNELS.EXTENSIONS_BROWSER_OPENED,
        { browserId, url, extensionId }
      );
    }
  };
  extensionManager.on("browser-opened", onBrowserOpened);

  // Forward terminal creation to renderer so it opens a pane
  const onTerminalCreated = (sessionId: string, name: string, extensionId: string, workingDirectory?: string) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(
        IPC_CHANNELS.EXTENSIONS_TERMINAL_CREATED,
        { sessionId, name, extensionId, workingDirectory }
      );
    }
  };
  extensionManager.on("terminal-created", onTerminalCreated);

  // Forward status changes to renderer
  const onStatusChanged = (id: string, status: string) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(
        IPC_CHANNELS.EXTENSIONS_STATUS_CHANGED,
        { id, status }
      );
    }
  };
  const onExtensionsChanged = () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(
        IPC_CHANNELS.EXTENSIONS_STATUS_CHANGED,
        extensionManager.getExtensionsForRenderer()
      );
    }
  };
  extensionManager.on("extensions-changed", onExtensionsChanged);
  extensionManager.on("extension-status-changed", onStatusChanged);

  // Cleanup
  return () => {
    ipcMain.removeHandler(IPC_CHANNELS.EXTENSIONS_LIST);
    ipcMain.removeHandler(IPC_CHANNELS.EXTENSIONS_ACTIVATE);
    ipcMain.removeHandler(IPC_CHANNELS.EXTENSIONS_DEACTIVATE);
    ipcMain.removeHandler(IPC_CHANNELS.EXTENSIONS_COMMANDS);
    ipcMain.removeHandler(IPC_CHANNELS.EXTENSIONS_EXECUTE_COMMAND);
    extensionManager.removeListener("extensions-changed", onExtensionsChanged);
    extensionManager.removeListener("extension-status-changed", onStatusChanged);
    extensionManager.removeListener("terminal-created", onTerminalCreated);
    extensionManager.removeListener("browser-opened", onBrowserOpened);
    extensionManager.removeListener("show-input-modal", onShowInputModal);
    ipcMain.removeHandler(IPC_CHANNELS.EXTENSIONS_MODAL_RESULT);
  };
}
