import { useEffect, useRef, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

interface TerminalInstanceProps {
  sessionId: string;
  isActive: boolean;
  workingDirectory?: string;
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

export function TerminalInstance({ sessionId, isActive, workingDirectory }: TerminalInstanceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

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
      cleanupData?.();
      cleanupExit?.();
      resizeObserver.disconnect();
      terminal.dispose();
    };

    return () => {
      cleanupRef.current?.();
    };
  }, [sessionId, fit]);

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
    <div
      ref={containerRef}
      className="w-full h-full bg-background"
    />
  );
}
