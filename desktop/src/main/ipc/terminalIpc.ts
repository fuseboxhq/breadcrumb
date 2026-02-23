import { BrowserWindow, ipcMain } from "electron";
import { IPC_CHANNELS } from "../../shared/types";
import { terminalService } from "../terminal/TerminalService";

let handlersRegistered = false;

export function registerTerminalIPCHandlers(mainWindow: BrowserWindow): () => void {
  if (handlersRegistered) return () => {};
  handlersRegistered = true;

  const dataHandler = (data: { sessionId: string; data: string }) => {
    mainWindow.webContents.send(IPC_CHANNELS.TERMINAL_DATA, data);
  };
  terminalService.on("data", dataHandler);

  const exitHandler = (data: { sessionId: string; exitCode: number; signal?: number }) => {
    mainWindow.webContents.send(IPC_CHANNELS.TERMINAL_EXIT, data);
  };
  terminalService.on("exit", exitHandler);

  const processChangeHandler = (data: { sessionId: string; processName: string; processLabel: string }) => {
    mainWindow.webContents.send(IPC_CHANNELS.TERMINAL_PROCESS_CHANGE, data);
  };
  terminalService.on("processChange", processChangeHandler);

  ipcMain.handle(
    IPC_CHANNELS.TERMINAL_CREATE,
    async (_, config: { id: string; name: string; workingDirectory: string; cols?: number; rows?: number }) => {
      try {
        const existed = terminalService.hasSession(config.id);
        const sessionId = terminalService.createSession(config);
        // When reconnecting to an existing session (e.g. pane moved via tab
        // merge), include the output replay buffer so the fresh xterm.js can
        // restore the full terminal state (alternate screen, cursor pos, etc.)
        const replayBuffer = existed ? terminalService.getReplayBuffer(config.id) : undefined;
        return { success: true, sessionId, replayBuffer };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.TERMINAL_WRITE,
    async (_, { sessionId, data }: { sessionId: string; data: string }) => {
      try {
        return { success: terminalService.write(sessionId, data) };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.TERMINAL_RESIZE,
    async (_, { sessionId, cols, rows }: { sessionId: string; cols: number; rows: number }) => {
      try {
        return { success: terminalService.resize(sessionId, cols, rows) };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }
  );

  // Flow control: renderer acknowledges processed data (fire-and-forget, no response needed)
  const ackHandler = (_: Electron.IpcMainEvent, { sessionId, charCount }: { sessionId: string; charCount: number }) => {
    terminalService.acknowledgeData(sessionId, charCount);
  };
  ipcMain.on(IPC_CHANNELS.TERMINAL_ACK_DATA, ackHandler);

  ipcMain.handle(IPC_CHANNELS.TERMINAL_TERMINATE, async (_, sessionId: string) => {
    try {
      return { success: terminalService.terminate(sessionId) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  return () => {
    terminalService.off("data", dataHandler);
    terminalService.off("exit", exitHandler);
    terminalService.off("processChange", processChangeHandler);
    ipcMain.removeListener(IPC_CHANNELS.TERMINAL_ACK_DATA, ackHandler);
    ipcMain.removeHandler(IPC_CHANNELS.TERMINAL_CREATE);
    ipcMain.removeHandler(IPC_CHANNELS.TERMINAL_WRITE);
    ipcMain.removeHandler(IPC_CHANNELS.TERMINAL_RESIZE);
    ipcMain.removeHandler(IPC_CHANNELS.TERMINAL_TERMINATE);
    handlersRegistered = false;
  };
}
