import { useEffect, useRef, useCallback, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { useShellIntegration } from "../../hooks/useShellIntegration";
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
  const cleanupRef = useRef<(() => void) | null>(null);
  const [lastExitCode, setLastExitCode] = useState<number | null>(null);

  // Shell integration (OSC 133 + OSC 7)
  const { registerHandlers } = useShellIntegration({
    onCwdChange: (cwd) => {
      onCwdChange?.(cwd);
    },
    onCommandEnd: (block) => {
      setLastExitCode(block.exitCode);
      // Clear badge after 5 seconds for successful commands
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

  useEffect(() => {
    if (!containerRef.current) return;

    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', 'Cascadia Code', Menlo, Monaco, monospace",
      theme: TERMINAL_THEME,
      scrollback: 5000,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    // Register shell integration OSC handlers before open
    const cleanupShell = registerHandlers(terminal);

    terminal.open(containerRef.current);
    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Initial fit
    requestAnimationFrame(() => fit());

    // Create PTY session — use project dir if provided, otherwise IPC for home dir
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

  return (
    <div className="relative w-full h-full">
      <div
        ref={containerRef}
        className="w-full h-full bg-background"
      />
      {/* Exit code badge */}
      {lastExitCode !== null && lastExitCode !== 0 && (
        <div className="absolute top-2 right-2 flex items-center gap-1.5 px-2 py-1 rounded-md bg-destructive/20 border border-destructive/30 text-destructive text-2xs font-mono animate-fade-in">
          <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
          Exit {lastExitCode}
        </div>
      )}
    </div>
  );
}
