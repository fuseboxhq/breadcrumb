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
  const cleanupRef = useRef<(() => void) | null>(null);
  const [lastExitCode, setLastExitCode] = useState<number | null>(null);
  const [searchVisible, setSearchVisible] = useState(false);
  const terminalSettings = useTerminalSettings();

  // Shell integration (OSC 133 + OSC 7)
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
        terminal.resize(dims.cols, dims.rows);
        window.breadcrumbAPI?.resizeTerminal(sessionId, dims.cols, dims.rows);
      }
    } catch {
      // Ignore resize errors during teardown
    }
  }, [sessionId]);

  // Cmd+F to toggle search
  useEffect(() => {
    if (!isActive) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        setSearchVisible((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isActive]);

  useEffect(() => {
    if (!containerRef.current) return;

    const terminal = new Terminal({
      cursorBlink: terminalSettings.cursorBlink,
      cursorStyle: terminalSettings.cursorStyle,
      fontSize: terminalSettings.fontSize,
      fontFamily: terminalSettings.fontFamily,
      theme: TERMINAL_THEME,
      scrollback: terminalSettings.scrollback,
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
      // Use IPC to open external URL (can't use shell.openExternal in renderer)
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

    // Initial fit
    requestAnimationFrame(() => fit());

    // Create PTY session
    if (workingDirectory) {
      window.breadcrumbAPI?.createTerminal({
        id: sessionId,
        name: sessionId,
        workingDirectory,
      });
    } else {
      window.breadcrumbAPI?.getWorkingDirectory().then((workingDir) => {
        window.breadcrumbAPI?.createTerminal({
          id: sessionId,
          name: sessionId,
          workingDirectory: workingDir || "/",
        });
      }).catch(() => {
        window.breadcrumbAPI?.createTerminal({
          id: sessionId,
          name: sessionId,
          workingDirectory: "/",
        });
      });
    }

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
      requestAnimationFrame(() => fit());
    });
    resizeObserver.observe(containerRef.current);

    cleanupRef.current = () => {
      dataDisposable.dispose();
      cleanupShell();
      cleanupData?.();
      cleanupExit?.();
      resizeObserver.disconnect();
      searchAddonRef.current = null;
      terminal.dispose();
    };

    return () => {
      cleanupRef.current?.();
    };
  }, [sessionId, fit, registerHandlers, workingDirectory]);

  // Refit on activation
  useEffect(() => {
    if (isActive) {
      requestAnimationFrame(() => {
        fit();
        terminalRef.current?.focus();
      });
    }
  }, [isActive, fit]);

  // Live settings updates — apply changes to existing terminal without recreating
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
      {lastExitCode !== null && lastExitCode !== 0 && !searchVisible && (
        <div className="absolute top-2 right-2 flex items-center gap-1.5 px-2 py-1 rounded-md bg-destructive/20 border border-destructive/30 text-destructive text-2xs font-mono animate-fade-in">
          <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
          Exit {lastExitCode}
        </div>
      )}
    </div>
  );
}
