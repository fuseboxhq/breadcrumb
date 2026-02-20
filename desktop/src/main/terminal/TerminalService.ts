import { EventEmitter } from "events";
import { execFile } from "child_process";
import { promisify } from "util";
import * as pty from "node-pty";
import * as os from "os";

const execFileAsync = promisify(execFile);

const DEFAULT_TERMINAL_COLS = 120;
const DEFAULT_TERMINAL_ROWS = 30;
const IDLE_POLL_INTERVAL_MS = 2000;
const ACTIVE_POLL_INTERVAL_MS = 200;
const ACTIVE_DURATION_MS = 5000;

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

  // CLIs that pty.process might return directly
  claude: "Claude Code",

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

// ---- Smart command-line inspection ----

/** Generic runtimes where pty.process is useless — need to inspect actual args */
const INSPECT_RUNTIMES = new Set(["node", "python", "python3", "ruby", "java"]);

/** Shells are the resting state — don't treat them as a meaningful processLabel */
const SHELL_NAMES = new Set(["bash", "zsh", "fish", "sh", "dash", "ksh", "tcsh", "login"]);

/**
 * Should we run command-line inspection for this process name?
 * Yes for: generic runtimes ("node"), unknown names ("2.1.38"), version strings
 * No for: shells, well-known tools with good names ("vim", "git", "docker")
 */
function shouldInspect(rawName: string): boolean {
  if (SHELL_NAMES.has(rawName)) return false;
  if (INSPECT_RUNTIMES.has(rawName)) return true;
  // Unknown process — not in our friendly names map. Inspect it.
  if (!PROCESS_FRIENDLY_NAMES[rawName]) return true;
  return false;
}

interface ProcessLabel {
  processName: string;
  processLabel: string;
}

/**
 * Patterns to match against command-line args of Node.js processes.
 * Checked in order — first match wins.
 */
const NODE_COMMAND_PATTERNS: Array<{
  test: (args: string) => boolean;
  label: (args: string) => ProcessLabel;
}> = [
  // Claude Code
  {
    test: (args) => /claude|@anthropic/i.test(args),
    label: () => ({ processName: "claude", processLabel: "Claude Code" }),
  },
  // Cursor
  {
    test: (args) => /cursor/i.test(args),
    label: () => ({ processName: "cursor", processLabel: "Cursor" }),
  },
  // pnpm with subcommand
  {
    test: (args) => /\/pnpm|pnpm\.cjs/i.test(args),
    label: (args) => {
      const m = args.match(/pnpm(?:\.cjs)?\s+(?:run\s+)?(\S+)/i);
      return { processName: "pnpm", processLabel: m ? `pnpm ${m[1]}` : "pnpm" };
    },
  },
  // npm with subcommand
  {
    test: (args) => /\/npm|npm-cli/i.test(args),
    label: (args) => {
      const m = args.match(/npm(?:-cli\.js)?\s+(?:run\s+)?(\S+)/i);
      return { processName: "npm", processLabel: m ? `npm ${m[1]}` : "npm" };
    },
  },
  // yarn with subcommand
  {
    test: (args) => /\/yarn/i.test(args),
    label: (args) => {
      const m = args.match(/yarn(?:\.js)?\s+(\S+)/i);
      return { processName: "yarn", processLabel: m ? `yarn ${m[1]}` : "yarn" };
    },
  },
  // npx
  {
    test: (args) => /\/npx/i.test(args),
    label: (args) => {
      const m = args.match(/npx\s+(\S+)/i);
      return { processName: "npx", processLabel: m ? `npx ${m[1]}` : "npx" };
    },
  },
  // Next.js
  {
    test: (args) => /next\s+(dev|build|start)/i.test(args),
    label: (args) => {
      const m = args.match(/next\s+(dev|build|start)/i);
      return { processName: "next", processLabel: `Next.js ${m?.[1] || ""}`.trim() };
    },
  },
  // Vite
  {
    test: (args) => /\/vite\b/i.test(args),
    label: () => ({ processName: "vite", processLabel: "Vite" }),
  },
  // Remix
  {
    test: (args) => /remix\s+(dev|build)/i.test(args),
    label: (args) => {
      const m = args.match(/remix\s+(dev|build)/i);
      return { processName: "remix", processLabel: `Remix ${m?.[1] || ""}`.trim() };
    },
  },
  // Astro
  {
    test: (args) => /astro\s+(dev|build)/i.test(args),
    label: (args) => {
      const m = args.match(/astro\s+(dev|build)/i);
      return { processName: "astro", processLabel: `Astro ${m?.[1] || ""}`.trim() };
    },
  },
  // Turbopack / Turborepo
  {
    test: (args) => /turbo/i.test(args),
    label: () => ({ processName: "turbo", processLabel: "Turborepo" }),
  },
  // webpack
  {
    test: (args) => /webpack/i.test(args),
    label: () => ({ processName: "webpack", processLabel: "webpack" }),
  },
  // esbuild
  {
    test: (args) => /esbuild/i.test(args),
    label: () => ({ processName: "esbuild", processLabel: "esbuild" }),
  },
  // tsx / ts-node
  {
    test: (args) => /\/tsx[\s/]|ts-node/i.test(args),
    label: () => ({ processName: "tsx", processLabel: "TypeScript" }),
  },
  // Electron
  {
    test: (args) => /electron/i.test(args),
    label: () => ({ processName: "electron", processLabel: "Electron" }),
  },
  // Jest
  {
    test: (args) => /jest/i.test(args),
    label: () => ({ processName: "jest", processLabel: "Jest" }),
  },
  // Vitest
  {
    test: (args) => /vitest/i.test(args),
    label: () => ({ processName: "vitest", processLabel: "Vitest" }),
  },
  // Playwright
  {
    test: (args) => /playwright/i.test(args),
    label: () => ({ processName: "playwright", processLabel: "Playwright" }),
  },
  // ESLint
  {
    test: (args) => /eslint/i.test(args),
    label: () => ({ processName: "eslint", processLabel: "ESLint" }),
  },
  // Prettier
  {
    test: (args) => /prettier/i.test(args),
    label: () => ({ processName: "prettier", processLabel: "Prettier" }),
  },
  // Storybook
  {
    test: (args) => /storybook/i.test(args),
    label: () => ({ processName: "storybook", processLabel: "Storybook" }),
  },
  // Express / Fastify / Hono / Koa — generic but better than "Node.js"
  {
    test: (args) => /express|fastify|hono|koa/i.test(args),
    label: (args) => {
      for (const fw of ["Express", "Fastify", "Hono", "Koa"]) {
        if (args.toLowerCase().includes(fw.toLowerCase())) {
          return { processName: fw.toLowerCase(), processLabel: fw };
        }
      }
      return { processName: "node", processLabel: "Node.js" };
    },
  },
  // Catch-all: any node invocation (interactive REPL, unknown scripts, etc.)
  {
    test: (args) => /\bnode\b/i.test(args),
    label: () => ({ processName: "node", processLabel: "Node.js" }),
  },
];

/** Patterns for Python processes */
const PYTHON_COMMAND_PATTERNS: Array<{
  test: (args: string) => boolean;
  label: (args: string) => ProcessLabel;
}> = [
  {
    test: (args) => /manage\.py|django/i.test(args),
    label: () => ({ processName: "django", processLabel: "Django" }),
  },
  {
    test: (args) => /flask/i.test(args),
    label: () => ({ processName: "flask", processLabel: "Flask" }),
  },
  {
    test: (args) => /uvicorn/i.test(args),
    label: () => ({ processName: "uvicorn", processLabel: "Uvicorn" }),
  },
  {
    test: (args) => /gunicorn/i.test(args),
    label: () => ({ processName: "gunicorn", processLabel: "Gunicorn" }),
  },
  {
    test: (args) => /pytest/i.test(args),
    label: () => ({ processName: "pytest", processLabel: "pytest" }),
  },
  {
    test: (args) => /ipython/i.test(args),
    label: () => ({ processName: "ipython", processLabel: "IPython" }),
  },
  {
    test: (args) => /jupyter/i.test(args),
    label: () => ({ processName: "jupyter", processLabel: "Jupyter" }),
  },
  // Generic: python script.py → "Python: script"
  {
    test: (args) => /python3?\s+\S+\.py/i.test(args),
    label: (args) => {
      const m = args.match(/python3?\s+(\S+\.py)/i);
      const script = m?.[1].split("/").pop()?.replace(/\.py$/, "");
      return {
        processName: "python",
        processLabel: script ? `Python: ${script}` : "Python",
      };
    },
  },
  // Catch-all: any python invocation (interactive REPL, modules, etc.)
  {
    test: (args) => /python3?/i.test(args),
    label: () => ({ processName: "python", processLabel: "Python" }),
  },
];

/** All patterns combined — used when runtime is unknown */
const ALL_COMMAND_PATTERNS = [...NODE_COMMAND_PATTERNS, ...PYTHON_COMMAND_PATTERNS];

function getCommandPatterns(runtime: string) {
  if (runtime === "node") return NODE_COMMAND_PATTERNS;
  if (runtime === "python" || runtime === "python3") return PYTHON_COMMAND_PATTERNS;
  // Unknown runtime (e.g. "2.1.38" from Claude Code setting process.title) —
  // try ALL patterns since we don't know what kind of process this is
  return ALL_COMMAND_PATTERNS;
}

/**
 * Parse a list of command-line strings to find the most specific label.
 * Checks ALL lines against patterns — first match across all lines wins.
 */
function matchCommandLines(commandLines: string[], runtime: string): ProcessLabel | null {
  const patterns = getCommandPatterns(runtime);
  // Check each pattern across all command lines (pattern priority > line order)
  for (const pattern of patterns) {
    for (const line of commandLines) {
      if (pattern.test(line)) {
        return pattern.label(line);
      }
    }
  }
  return null;
}

// ---- Service ----

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
  /** Track last emitted label to avoid duplicate emissions */
  private lastEmittedLabel: Map<string, string> = new Map();
  /** Generation counter per session — prevents stale async results */
  private inspectGeneration: Map<string, number> = new Map();
  /** Track whether each session is in "active" (fast) polling mode */
  private activePolling: Map<string, NodeJS.Timeout | null> = new Map();
  /**
   * Ring buffer of recent PTY output per session. Used to replay terminal
   * state when a renderer reconnects to an existing session (e.g. after a
   * tab merge moves a pane to a different tab, creating a fresh xterm.js
   * instance that needs the full escape sequence history to restore
   * alternate screen mode, cursor position, colors, etc.).
   */
  private outputBuffers: Map<string, string> = new Map();
  private static readonly MAX_REPLAY_BUFFER = 100_000; // 100KB

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

    const ptyProcess = pty.spawn(shellToUse, ["--login"], {
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

      // Append to replay buffer (ring-trimmed to MAX_REPLAY_BUFFER)
      let buf = this.outputBuffers.get(id) || "";
      buf += data;
      if (buf.length > TerminalService.MAX_REPLAY_BUFFER) {
        buf = buf.slice(-TerminalService.MAX_REPLAY_BUFFER);
      }
      this.outputBuffers.set(id, buf);
    });

    ptyProcess.onExit(({ exitCode, signal }) => {
      this.stopProcessPolling(id);
      this.outputBuffers.delete(id);
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

    // Start with idle (slow) polling — 2s baseline
    const interval = setInterval(() => {
      this.emitProcessChange(sessionId, ptyProcess);
    }, IDLE_POLL_INTERVAL_MS);

    this.processPollers.set(sessionId, interval);

    // Use onData as activity signal to temporarily boost polling rate
    ptyProcess.onData(() => {
      this.boostPolling(sessionId, ptyProcess);
    });
  }

  /**
   * Temporarily switch to fast polling (200ms) for 5 seconds after terminal
   * activity is detected. Resets the timer on each new data event.
   */
  private boostPolling(sessionId: string, ptyProcess: pty.IPty): void {
    const existingTimeout = this.activePolling.get(sessionId);

    if (!existingTimeout) {
      // Switch from idle to active polling
      const idleInterval = this.processPollers.get(sessionId);
      if (idleInterval) clearInterval(idleInterval);

      const activeInterval = setInterval(() => {
        this.emitProcessChange(sessionId, ptyProcess);
      }, ACTIVE_POLL_INTERVAL_MS);
      this.processPollers.set(sessionId, activeInterval);
    } else {
      // Already in active mode — just reset the decay timer
      clearTimeout(existingTimeout);
    }

    // Set decay timer to revert to idle polling after ACTIVE_DURATION_MS
    const decayTimeout = setTimeout(() => {
      this.activePolling.set(sessionId, null);

      // Switch back to idle polling
      const activeInterval = this.processPollers.get(sessionId);
      if (activeInterval) clearInterval(activeInterval);

      // Only restart if session still exists
      if (this.sessions.has(sessionId)) {
        const idleInterval = setInterval(() => {
          this.emitProcessChange(sessionId, ptyProcess);
        }, IDLE_POLL_INTERVAL_MS);
        this.processPollers.set(sessionId, idleInterval);
      }
    }, ACTIVE_DURATION_MS);

    this.activePolling.set(sessionId, decayTimeout);
  }

  private emitProcessChange(sessionId: string, ptyProcess: pty.IPty): void {
    try {
      const rawName = ptyProcess.process;
      const lastRaw = this.lastProcessNames.get(sessionId);

      if (rawName === lastRaw) return;
      this.lastProcessNames.set(sessionId, rawName);

      // Bump generation to invalidate any in-flight async inspections
      const gen = (this.inspectGeneration.get(sessionId) || 0) + 1;
      this.inspectGeneration.set(sessionId, gen);

      // Shells are the resting state — emit shell name but empty processLabel
      // so the renderer can show "zsh - foldername" via resolveLabel
      if (SHELL_NAMES.has(rawName)) {
        this.emitLabel(sessionId, rawName, "");
        return;
      }

      if (shouldInspect(rawName)) {
        // Emit whatever we have immediately, then try to find something better
        this.emitLabel(sessionId, rawName, getFriendlyProcessName(rawName));
        this.inspectAndEmit(sessionId, ptyProcess, rawName, gen);
      } else {
        this.emitLabel(sessionId, rawName, getFriendlyProcessName(rawName));
      }
    } catch {
      // PTY may have been destroyed between check and access
    }
  }

  /** Emit processChange only if the label actually changed */
  private emitLabel(sessionId: string, processName: string, processLabel: string): void {
    const key = `${processName}::${processLabel}`;
    if (this.lastEmittedLabel.get(sessionId) === key) return;
    this.lastEmittedLabel.set(sessionId, key);
    this.emit("processChange", { sessionId, processName, processLabel });
  }

  /**
   * Inspect the process tree to determine what's actually running.
   * Uses `pgrep` + `ps` to get command lines of shell children.
   * Only emits if the generation hasn't changed (process still the same).
   */
  private async inspectAndEmit(
    sessionId: string,
    ptyProcess: pty.IPty,
    runtime: string,
    generation: number,
  ): Promise<void> {
    try {
      const smartLabel = await this.getSmartLabel(ptyProcess.pid, runtime);

      // Check this is still the current generation (process hasn't changed since)
      if (!smartLabel || this.inspectGeneration.get(sessionId) !== generation) return;

      this.emitLabel(sessionId, smartLabel.processName, smartLabel.processLabel);
    } catch {
      // Inspection failed — keep the generic label already emitted
    }
  }

  /**
   * Inspect the child process tree of the shell to find what's really running.
   *
   * Strategy:
   * 1. pgrep -P <shell_pid> → direct children
   * 2. For each child, pgrep -P <child_pid> → grandchildren (handles sh -c wrappers)
   * 3. ps -o args= -p <all_pids> → full command lines
   * 4. Match against known patterns (claude, pnpm, npm, vite, etc.)
   */
  private async getSmartLabel(shellPid: number, runtime: string): Promise<ProcessLabel | null> {
    // Step 1: Find direct children of the shell
    const childPids = await this.getChildPids(shellPid);
    if (childPids.length === 0) return null;

    // Step 2: Also check grandchildren (handles `sh -c "node ..."` wrappers)
    const allPids = [...childPids];
    for (const pid of childPids.slice(0, 5)) {
      const grandchildren = await this.getChildPids(parseInt(pid));
      allPids.push(...grandchildren);
    }

    if (allPids.length === 0) return null;

    // Step 3: Get command lines
    try {
      const { stdout } = await execFileAsync(
        "ps",
        ["-o", "args=", "-p", allPids.slice(0, 20).join(",")],
        { timeout: 1000 },
      );
      const commandLines = stdout.trim().split("\n").filter(Boolean);
      if (commandLines.length === 0) return null;

      // Step 4: Match against patterns
      return matchCommandLines(commandLines, runtime);
    } catch {
      return null;
    }
  }

  private async getChildPids(parentPid: number): Promise<string[]> {
    try {
      const { stdout } = await execFileAsync(
        "pgrep",
        ["-P", String(parentPid)],
        { timeout: 500 },
      );
      return stdout.trim().split("\n").filter(Boolean);
    } catch {
      return []; // No children or pgrep failed
    }
  }

  private stopProcessPolling(sessionId: string): void {
    const interval = this.processPollers.get(sessionId);
    if (interval) {
      clearInterval(interval);
      this.processPollers.delete(sessionId);
    }
    const activeTimeout = this.activePolling.get(sessionId);
    if (activeTimeout) {
      clearTimeout(activeTimeout);
    }
    this.activePolling.delete(sessionId);
    this.lastProcessNames.delete(sessionId);
    this.lastEmittedLabel.delete(sessionId);
    this.inspectGeneration.delete(sessionId);
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
      this.outputBuffers.delete(sessionId);
      session.pty.kill();
      this.sessions.delete(sessionId);
      return true;
    } catch {
      return false;
    }
  }

  /** Return buffered output for replay when reconnecting to an existing session. */
  getReplayBuffer(sessionId: string): string | undefined {
    return this.outputBuffers.get(sessionId);
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
