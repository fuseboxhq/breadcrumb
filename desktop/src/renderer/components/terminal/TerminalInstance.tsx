import { useEffect, useRef, useCallback, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { SearchAddon } from "@xterm/addon-search";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { Unicode11Addon } from "@xterm/addon-unicode11";
import { useShellIntegration } from "../../hooks/useShellIntegration";
import { useTerminalSettings } from "../../store/settingsStore";
import { TerminalSearch } from "./TerminalSearch";
import "@xterm/xterm/css/xterm.css";

interface TerminalInstanceProps {
  sessionId: string;
  isActive: boolean;
  workingDirectory?: string;
  onCwdChange?: (cwd: string) => void;
}

// Dracula-inspired terminal color scheme
const TERMINAL_THEME = {
  background: "#0a0a0f",
  foreground: "#f2f2f2",
  cursor: "#f2f2f2",
  cursorAccent: "#0a0a0f",
  selectionBackground: "#44475a80",
  selectionForeground: "#f2f2f2",
  black: "#18181b",
  red: "#ff5555",
  green: "#50fa7b",
  yellow: "#f1fa8c",
  blue: "#8be9fd",
  magenta: "#bd93f9",
  cyan: "#8be9fd",
  white: "#f2f2f2",
  brightBlack: "#6272a4",
  brightRed: "#ff6e6e",
  brightGreen: "#69ff94",
  brightYellow: "#ffffa5",
  brightBlue: "#a4ffff",
  brightMagenta: "#d6acff",
  brightCyan: "#a4ffff",
  brightWhite: "#ffffff",
};

export function TerminalInstance({ sessionId, isActive, workingDirectory, onCwdChange }: TerminalInstanceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const [lastExitCode, setLastExitCode] = useState<number | null>(null);
  const [searchVisible, setSearchVisible] = useState(false);
  const terminalSettings = useTerminalSettings();

  // Stable ref for settings — used during terminal creation without
  // being a dependency (so changing settings doesn't recreate the terminal)
  const settingsRef = useRef(terminalSettings);
  settingsRef.current = terminalSettings;

  // Shell integration (OSC 133 + OSC 7)
  // registerHandlers is now stable (no deps) thanks to callbacksRef pattern
  const { registerHandlers } = useShellIntegration({
    onCwdChange: (cwd) => {
      onCwdChange?.(cwd);
    },
    onCommandEnd: (block) => {
      setLastExitCode(block.exitCode);
      if (block.exitCode === 0) {
        setTimeout(() => setLastExitCode(null), 5000);
      }
    },
  });

  const fit = useCallback(() => {
    const fitAddon = fitAddonRef.current;
    const terminal = terminalRef.current;
    if (!fitAddon || !terminal) return;

    try {
      const dims = fitAddon.proposeDimensions();
      if (dims && dims.cols > 0 && dims.rows > 0) {
        // Only resize PTY when dimensions actually change — avoids
        // spurious SIGWINCH that clears the shell prompt on focus
        if (dims.cols !== terminal.cols || dims.rows !== terminal.rows) {
          terminal.resize(dims.cols, dims.rows);
          window.breadcrumbAPI?.resizeTerminal(sessionId, dims.cols, dims.rows);
        }
      }
    } catch {
      // Ignore resize errors during teardown
    }
  }, [sessionId]);

  // Cmd+F to toggle search, Cmd+L to clear
  useEffect(() => {
    if (!isActive) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        setSearchVisible((prev) => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "l") {
        e.preventDefault();
        terminalRef.current?.clear();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isActive]);

  // Terminal creation — runs once per sessionId+workingDirectory.
  // All other values (settings, callbacks) are accessed via refs so
  // they don't trigger destruction/recreation of the terminal.
  useEffect(() => {
    if (!containerRef.current) return;

    const settings = settingsRef.current;

    const terminal = new Terminal({
      cursorBlink: settings.cursorBlink,
      cursorStyle: settings.cursorStyle,
      fontSize: settings.fontSize,
      fontFamily: settings.fontFamily,
      theme: TERMINAL_THEME,
      scrollback: settings.scrollback,
      allowProposedApi: true,
    });

    // Load addons in correct order

    // 1. Unicode11 — must be first, then activate
    const unicode11Addon = new Unicode11Addon();
    terminal.loadAddon(unicode11Addon);
    terminal.unicode.activeVersion = "11";

    // 2. FitAddon
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    // 3. WebLinks — clickable URLs, opens in system browser via IPC
    const webLinksAddon = new WebLinksAddon((event, uri) => {
      event.preventDefault();
      window.open(uri, "_blank");
    });
    terminal.loadAddon(webLinksAddon);

    // 4. Search
    const searchAddon = new SearchAddon();
    terminal.loadAddon(searchAddon);
    searchAddonRef.current = searchAddon;

    // 5. Shell integration OSC handlers
    const cleanupShell = registerHandlers(terminal);

    terminal.open(containerRef.current);
    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Fit first to get actual dimensions, THEN create PTY with those
    // dimensions. This avoids the initial-resize SIGWINCH that causes
    // duplicate/re-wrapped prompts when the PTY starts at 120x30 but
    // the actual pane is much smaller.
    const createPtyWithDimensions = (cwd: string) => {
      let cols = 120;
      let rows = 30;
      try {
        const dims = fitAddon.proposeDimensions();
        if (dims && dims.cols > 0 && dims.rows > 0) {
          cols = dims.cols;
          rows = dims.rows;
          terminal.resize(cols, rows);
        }
      } catch { /* use defaults */ }

      window.breadcrumbAPI?.createTerminal({
        id: sessionId,
        name: sessionId,
        workingDirectory: cwd,
        cols,
        rows,
      });
    };

    // Defer PTY creation to next frame so the DOM has laid out and
    // fitAddon can measure the real container size.
    requestAnimationFrame(() => {
      if (workingDirectory) {
        createPtyWithDimensions(workingDirectory);
      } else {
        window.breadcrumbAPI?.getWorkingDirectory().then((workingDir) => {
          createPtyWithDimensions(workingDir || "/");
        }).catch(() => {
          createPtyWithDimensions("/");
        });
      }
    });

    // Forward keystrokes to PTY
    const dataDisposable = terminal.onData((data) => {
      window.breadcrumbAPI?.writeTerminal(sessionId, data);
    });

    // Receive PTY output
    const cleanupData = window.breadcrumbAPI?.onTerminalData((event) => {
      if (event.sessionId === sessionId) {
        terminal.write(event.data);
      }
    });

    const cleanupExit = window.breadcrumbAPI?.onTerminalExit((event) => {
      if (event.sessionId === sessionId) {
        terminal.write(`\r\n[Process exited with code ${event.exitCode}]\r\n`);
      }
    });

    // Resize observer
    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        try {
          const dims = fitAddon.proposeDimensions();
          if (dims && dims.cols > 0 && dims.rows > 0) {
            if (dims.cols !== terminal.cols || dims.rows !== terminal.rows) {
              terminal.resize(dims.cols, dims.rows);
              window.breadcrumbAPI?.resizeTerminal(sessionId, dims.cols, dims.rows);
            }
          }
        } catch { /* ignore */ }
      });
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      dataDisposable.dispose();
      cleanupShell();
      cleanupData?.();
      cleanupExit?.();
      resizeObserver.disconnect();
      searchAddonRef.current = null;
      fitAddonRef.current = null;
      terminalRef.current = null;
      terminal.dispose();
    };
    // Only recreate when the session or working directory changes.
    // registerHandlers is stable (empty deps). Settings are read from ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, workingDirectory]);

  // Refit + focus on activation — no PTY resize if dimensions unchanged
  useEffect(() => {
    if (isActive) {
      requestAnimationFrame(() => {
        fit();
        terminalRef.current?.focus();
      });
    }
  }, [isActive, fit]);

  // Live settings updates — apply to existing terminal without recreating
  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;
    terminal.options.fontSize = terminalSettings.fontSize;
    terminal.options.fontFamily = terminalSettings.fontFamily;
    terminal.options.cursorBlink = terminalSettings.cursorBlink;
    terminal.options.cursorStyle = terminalSettings.cursorStyle;
    terminal.options.scrollback = terminalSettings.scrollback;
    requestAnimationFrame(() => fit());
  }, [terminalSettings, fit]);

  return (
    <div className="relative w-full h-full">
      <div
        ref={containerRef}
        className="w-full h-full bg-background"
      />

      {/* Search overlay */}
      <TerminalSearch
        searchAddon={searchAddonRef.current}
        isVisible={searchVisible}
        onClose={() => {
          setSearchVisible(false);
          terminalRef.current?.focus();
        }}
      />

      {/* Exit code badge */}
      {lastExitCode !== null && !searchVisible && (
        <div className={`absolute top-2 right-2 flex items-center gap-1.5 px-2 py-1 rounded-md text-2xs font-mono animate-fade-in ${
          lastExitCode === 0
            ? "bg-dracula-green/15 border border-dracula-green/25 text-dracula-green"
            : "bg-destructive/20 border border-destructive/30 text-destructive"
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${
            lastExitCode === 0 ? "bg-dracula-green" : "bg-destructive"
          }`} />
          {lastExitCode === 0 ? "OK" : `Exit ${lastExitCode}`}
        </div>
      )}
    </div>
  );
}
