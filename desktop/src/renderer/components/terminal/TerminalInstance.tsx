import { useEffect, useRef, useCallback, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { SearchAddon } from "@xterm/addon-search";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { Unicode11Addon } from "@xterm/addon-unicode11";
import { useShellIntegration } from "../../hooks/useShellIntegration";
import { useTerminalSettings } from "../../store/settingsStore";
import { TerminalSearch } from "./TerminalSearch";
import {
  ContextMenu,
  MenuItem,
  MenuSeparator,
} from "../shared/ContextMenu";
import { Copy, ClipboardPaste, CheckSquare, Eraser, Maximize2, Minimize2, SplitSquareVertical, Rows3 } from "lucide-react";
import "@xterm/xterm/css/xterm.css";

interface TerminalInstanceProps {
  sessionId: string;
  isActive: boolean;
  workingDirectory?: string;
  onCwdChange?: (cwd: string) => void;
  // Context menu actions passed from TerminalPanel
  onSplitHorizontal?: () => void;
  onSplitVertical?: () => void;
  onToggleZoom?: () => void;
  isZoomed?: boolean;
  canZoom?: boolean;
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

export function TerminalInstance({
  sessionId,
  isActive,
  workingDirectory,
  onCwdChange,
  onSplitHorizontal,
  onSplitVertical,
  onToggleZoom,
  isZoomed,
  canZoom,
}: TerminalInstanceProps) {
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

  // Track whether there's a text selection in the terminal
  const [hasSelection, setHasSelection] = useState(false);

  // Context menu handlers
  const handleCopy = useCallback(async () => {
    const selection = terminalRef.current?.getSelection();
    if (selection) {
      await navigator.clipboard.writeText(selection);
    }
    terminalRef.current?.focus();
  }, []);

  const handlePaste = useCallback(async () => {
    const text = await navigator.clipboard.readText();
    if (text) {
      terminalRef.current?.paste(text);
    }
    terminalRef.current?.focus();
  }, []);

  const handleSelectAll = useCallback(() => {
    terminalRef.current?.selectAll();
    terminalRef.current?.focus();
  }, []);

  const handleClear = useCallback(() => {
    terminalRef.current?.clear();
    terminalRef.current?.focus();
  }, []);

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

    // 6. Track selection state for context menu
    const selectionDisposable = terminal.onSelectionChange(() => {
      setHasSelection(!!terminal.getSelection());
    });

    terminal.open(containerRef.current);
    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // --- PTY lifecycle ---
    // The PTY is created lazily on the first stable resize, NOT eagerly.
    // This avoids dimension mismatches (PTY at 120x30 vs actual 20x10)
    // and resize storms from PanelGroup layout transitions that cause
    // duplicate prompts and zsh PROMPT_EOL_MARK artifacts.

    let ptyCreated = false;
    let resizeTimer: ReturnType<typeof setTimeout> | undefined;
    let destroyed = false;

    // Resolve working directory upfront (async but fast)
    let resolvedCwd: string | null = workingDirectory || null;
    if (!resolvedCwd) {
      window.breadcrumbAPI?.getWorkingDirectory().then((dir) => {
        resolvedCwd = dir || "/";
        // If the ResizeObserver already fired but couldn't create the PTY
        // because cwd wasn't resolved yet, create it now
        if (!ptyCreated && !destroyed) {
          tryCreatePty();
        }
      }).catch(() => {
        resolvedCwd = "/";
      });
    }

    const tryCreatePty = () => {
      if (ptyCreated || destroyed || !resolvedCwd) return;
      try {
        const dims = fitAddon.proposeDimensions();
        if (dims && dims.cols > 0 && dims.rows > 0) {
          ptyCreated = true;
          terminal.resize(dims.cols, dims.rows);
          window.breadcrumbAPI?.createTerminal({
            id: sessionId,
            name: sessionId,
            workingDirectory: resolvedCwd,
            cols: dims.cols,
            rows: dims.rows,
          });
        }
      } catch { /* ignore — will retry on next resize */ }
    };

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

    // Debounced resize handler — collapses rapid PanelGroup layout
    // transitions into a single PTY resize (avoids SIGWINCH storms).
    // On the very first callback, creates the PTY with actual dimensions.
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (destroyed) return;
        if (!ptyCreated) {
          tryCreatePty();
          return;
        }
        try {
          const dims = fitAddon.proposeDimensions();
          if (dims && dims.cols > 0 && dims.rows > 0) {
            if (dims.cols !== terminal.cols || dims.rows !== terminal.rows) {
              terminal.resize(dims.cols, dims.rows);
              window.breadcrumbAPI?.resizeTerminal(sessionId, dims.cols, dims.rows);
            }
          }
        } catch { /* ignore */ }
      }, 80);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.current);

    return () => {
      destroyed = true;
      clearTimeout(resizeTimer);
      dataDisposable.dispose();
      selectionDisposable.dispose();
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

  // Restore terminal focus when context menu closes
  const handleContextMenuOpenChange = useCallback((open: boolean) => {
    if (!open) {
      requestAnimationFrame(() => terminalRef.current?.focus());
    }
  }, []);

  return (
    <ContextMenu
      onOpenChange={handleContextMenuOpenChange}
      content={
        <>
          <MenuItem
            icon={<Copy className="w-3.5 h-3.5" />}
            label="Copy"
            shortcut="⌘C"
            disabled={!hasSelection}
            onSelect={handleCopy}
          />
          <MenuItem
            icon={<ClipboardPaste className="w-3.5 h-3.5" />}
            label="Paste"
            shortcut="⌘V"
            onSelect={handlePaste}
          />
          <MenuItem
            icon={<CheckSquare className="w-3.5 h-3.5" />}
            label="Select All"
            shortcut="⌘A"
            onSelect={handleSelectAll}
          />
          <MenuSeparator />
          <MenuItem
            icon={<Eraser className="w-3.5 h-3.5" />}
            label="Clear Terminal"
            shortcut="⌘L"
            onSelect={handleClear}
          />
          {(onSplitHorizontal || onSplitVertical || canZoom) && (
            <>
              <MenuSeparator />
              {canZoom && onToggleZoom && (
                <MenuItem
                  icon={isZoomed
                    ? <Minimize2 className="w-3.5 h-3.5" />
                    : <Maximize2 className="w-3.5 h-3.5" />
                  }
                  label={isZoomed ? "Restore Panes" : "Maximize Pane"}
                  shortcut="⇧⌘↵"
                  onSelect={onToggleZoom}
                />
              )}
              {onSplitHorizontal && (
                <MenuItem
                  icon={<SplitSquareVertical className="w-3.5 h-3.5" />}
                  label="Split Horizontal"
                  shortcut="⌘D"
                  onSelect={onSplitHorizontal}
                />
              )}
              {onSplitVertical && (
                <MenuItem
                  icon={<Rows3 className="w-3.5 h-3.5" />}
                  label="Split Vertical"
                  shortcut="⇧⌘D"
                  onSelect={onSplitVertical}
                />
              )}
            </>
          )}
        </>
      }
    >
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
    </ContextMenu>
  );
}
