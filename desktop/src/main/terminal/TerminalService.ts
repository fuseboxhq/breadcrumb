import { EventEmitter } from "events";
import * as pty from "node-pty";
import * as os from "os";

const DEFAULT_TERMINAL_COLS = 120;
const DEFAULT_TERMINAL_ROWS = 30;

export interface TerminalConfig {
  id: string;
  name: string;
  workingDirectory: string;
  shell?: string;
}

export interface TerminalSession {
  id: string;
  name: string;
  pty: pty.IPty;
  workingDirectory: string;
}

export class TerminalService extends EventEmitter {
  private sessions: Map<string, TerminalSession> = new Map();

  constructor() {
    super();
  }

  createSession(config: TerminalConfig): string {
    const { id, name, workingDirectory, shell } = config;

    if (this.sessions.has(id)) {
      return id;
    }

    const env = {
      ...process.env,
      TERM: "xterm-256color",
      COLORTERM: "truecolor",
      TERM_PROGRAM: "Breadcrumb",
    } as { [key: string]: string };

    const defaultShell = os.platform() === "win32"
      ? process.env.COMSPEC || "cmd.exe"
      : process.env.SHELL || "/bin/zsh";

    const shellToUse = shell || defaultShell;

    const ptyProcess = pty.spawn(shellToUse, [], {
      name: "xterm-256color",
      cols: DEFAULT_TERMINAL_COLS,
      rows: DEFAULT_TERMINAL_ROWS,
      cwd: workingDirectory,
      env,
    });

    const session: TerminalSession = {
      id,
      name,
      pty: ptyProcess,
      workingDirectory,
    };

    this.sessions.set(id, session);

    ptyProcess.onData((data: string) => {
      this.emit("data", { sessionId: id, data });
    });

    ptyProcess.onExit(({ exitCode, signal }) => {
      this.emit("exit", { sessionId: id, exitCode, signal });
      this.sessions.delete(id);
    });

    return id;
  }

  write(sessionId: string, data: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    session.pty.write(data);
    return true;
  }

  resize(sessionId: string, cols: number, rows: number): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    try {
      session.pty.resize(cols, rows);
      return true;
    } catch {
      return false;
    }
  }

  terminate(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    try {
      session.pty.kill();
      this.sessions.delete(sessionId);
      return true;
    } catch {
      return false;
    }
  }

  getSessionIds(): string[] {
    return Array.from(this.sessions.keys());
  }

  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  terminateAll(): void {
    for (const sessionId of this.sessions.keys()) {
      this.terminate(sessionId);
    }
  }
}

export const terminalService = new TerminalService();
