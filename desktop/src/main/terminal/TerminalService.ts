import { EventEmitter } from "events";
import * as pty from "node-pty";
import * as os from "os";

const DEFAULT_TERMINAL_COLS = 120;
const DEFAULT_TERMINAL_ROWS = 30;
const PROCESS_POLL_INTERVAL_MS = 200;

/** Maps raw process names from pty.process to friendly display names */
export const PROCESS_FRIENDLY_NAMES: Record<string, string> = {
  // Shells
  bash: "bash",
  zsh: "zsh",
  fish: "fish",
  sh: "sh",
  dash: "dash",
  ksh: "ksh",
  tcsh: "tcsh",
  pwsh: "PowerShell",
  "powershell.exe": "PowerShell",
  "cmd.exe": "CMD",

  // Editors
  vim: "Vim",
  nvim: "Neovim",
  nano: "nano",
  emacs: "Emacs",
  vi: "Vi",
  micro: "micro",
  hx: "Helix",

  // Languages & Runtimes
  node: "Node.js",
  python: "Python",
  python3: "Python",
  ruby: "Ruby",
  go: "Go",
  rust: "Rust",
  java: "Java",
  perl: "Perl",
  php: "PHP",
  lua: "Lua",
  deno: "Deno",
  bun: "Bun",

  // Tools
  git: "Git",
  ssh: "SSH",
  docker: "Docker",
  kubectl: "kubectl",
  make: "Make",
  cargo: "Cargo",
  npm: "npm",
  yarn: "yarn",
  pnpm: "pnpm",
  pip: "pip",
  pip3: "pip",
  brew: "Homebrew",

  // System
  top: "top",
  htop: "htop",
  btop: "btop",
  less: "less",
  man: "man",
  curl: "curl",
  wget: "wget",
};

export function getFriendlyProcessName(raw: string): string {
  return (
    PROCESS_FRIENDLY_NAMES[raw] ||
    raw.charAt(0).toUpperCase() + raw.slice(1)
  );
}

export interface TerminalConfig {
  id: string;
  name: string;
  workingDirectory: string;
  shell?: string;
  cols?: number;
  rows?: number;
}

export interface TerminalSession {
  id: string;
  name: string;
  pty: pty.IPty;
  workingDirectory: string;
}

export class TerminalService extends EventEmitter {
  private sessions: Map<string, TerminalSession> = new Map();
  private processPollers: Map<string, NodeJS.Timeout> = new Map();
  private lastProcessNames: Map<string, string> = new Map();

  constructor() {
    super();
  }

  createSession(config: TerminalConfig): string {
    const { id, name, workingDirectory, shell, cols, rows } = config;

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
      cols: cols || DEFAULT_TERMINAL_COLS,
      rows: rows || DEFAULT_TERMINAL_ROWS,
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
      this.stopProcessPolling(id);
      this.emit("exit", { sessionId: id, exitCode, signal });
      this.sessions.delete(id);
    });

    // Start process name polling (macOS/Linux only)
    this.startProcessPolling(id, ptyProcess);

    return id;
  }

  private startProcessPolling(sessionId: string, ptyProcess: pty.IPty): void {
    // Windows ConPTY doesn't update pty.process — skip polling
    if (os.platform() === "win32") return;

    // Send initial process name after a tick so listeners can attach
    setTimeout(() => {
      this.emitProcessChange(sessionId, ptyProcess);
    }, 0);

    const interval = setInterval(() => {
      this.emitProcessChange(sessionId, ptyProcess);
    }, PROCESS_POLL_INTERVAL_MS);

    this.processPollers.set(sessionId, interval);
  }

  private emitProcessChange(sessionId: string, ptyProcess: pty.IPty): void {
    try {
      const rawName = ptyProcess.process;
      const lastRaw = this.lastProcessNames.get(sessionId);

      if (rawName !== lastRaw) {
        this.lastProcessNames.set(sessionId, rawName);
        const friendlyName = getFriendlyProcessName(rawName);
        this.emit("processChange", {
          sessionId,
          processName: rawName,
          processLabel: friendlyName,
        });
      }
    } catch {
      // PTY may have been destroyed between check and access
    }
  }

  private stopProcessPolling(sessionId: string): void {
    const interval = this.processPollers.get(sessionId);
    if (interval) {
      clearInterval(interval);
      this.processPollers.delete(sessionId);
    }
    this.lastProcessNames.delete(sessionId);
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
      this.stopProcessPolling(sessionId);
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
