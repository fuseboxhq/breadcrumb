import { useEffect, useRef, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

interface TerminalInstanceProps {
  sessionId: string;
  isActive: boolean;
}

export function TerminalInstance({ sessionId, isActive }: TerminalInstanceProps) {
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
      fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', Menlo, Monaco, monospace",
      theme: {
        background: "#0a0a0f",
        foreground: "#e4e4e7",
        cursor: "#e4e4e7",
        selectionBackground: "#3f3f46",
        black: "#18181b",
        red: "#ef4444",
        green: "#22c55e",
        yellow: "#eab308",
        blue: "#3b82f6",
        magenta: "#a855f7",
        cyan: "#06b6d4",
        white: "#e4e4e7",
        brightBlack: "#52525b",
        brightRed: "#f87171",
        brightGreen: "#4ade80",
        brightYellow: "#facc15",
        brightBlue: "#60a5fa",
        brightMagenta: "#c084fc",
        brightCyan: "#22d3ee",
        brightWhite: "#fafafa",
      },
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

    // Create PTY session
    const workingDir = process.env.HOME || "/";
    window.breadcrumbAPI?.createTerminal({
      id: sessionId,
      name: sessionId,
      workingDirectory: workingDir,
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
      className="w-full h-full"
      style={{ backgroundColor: "#0a0a0f" }}
    />
  );
}
