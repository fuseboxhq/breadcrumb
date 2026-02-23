import { useEffect, useRef, useCallback, useState } from "react";
import { init, Terminal, FitAddon } from "ghostty-web";
import { OscShim } from "../../lib/oscShim";
import { useShellIntegration } from "../../hooks/useShellIntegration";
import { useTerminalSettings, useResolvedTheme } from "../../store/settingsStore";
import {
  ContextMenu,
  MenuItem,
  MenuSeparator,
} from "../shared/ContextMenu";
import { Copy, ClipboardPaste, CheckSquare, Eraser, Maximize2, Minimize2, SplitSquareVertical, Rows3, RotateCcw } from "lucide-react";

// ── WASM init singleton ──────────────────────────────────────────────────────
let ghosttyInitPromise: Promise<void> | null = null;
function ensureGhosttyInit(): Promise<void> {
  if (!ghosttyInitPromise) {
    ghosttyInitPromise = init();
  }
  return ghosttyInitPromise;
}

interface TerminalInstanceProps {
  sessionId: string;
  isActive: boolean;
  workingDirectory?: string;
  onCwdChange?: (cwd: string) => void;
  /** Command to run once after the shell starts (e.g. "claude\n") */
  initialCommand?: string;
  /** Called after the initial command has been sent */
  onInitialCommandSent?: () => void;
  /** Called when the PTY process exits (shell closed) */
  onProcessExit?: (exitCode: number) => void;
  // Context menu actions passed from TerminalPanel
  onSplitHorizontal?: () => void;
  onSplitVertical?: () => void;
  onToggleZoom?: () => void;
  isZoomed?: boolean;
  canZoom?: boolean;
}

// Fallback theme — used if CSS custom properties aren't available (dark mode)
const FALLBACK_THEME_DARK = {
  background: "#0f0f0f",
  foreground: "#eeeff1",
  cursor: "#eeeff1",
  cursorAccent: "#0f0f0f",
  selectionBackground: "#26262680",
  selectionForeground: "#eeeff1",
  black: "#262626",
  red: "#ef4444",
  green: "#22c55e",
  yellow: "#eab308",
  blue: "#3b82f6",
  magenta: "#8b5cf6",
  cyan: "#06b6d4",
  white: "#eeeff1",
  brightBlack: "#8c8c8c",
  brightRed: "#f87171",
  brightGreen: "#4ade80",
  brightYellow: "#facc15",
  brightBlue: "#60a5fa",
  brightMagenta: "#a78bfa",
  brightCyan: "#22d3ee",
  brightWhite: "#ffffff",
};

// Light mode bright ANSI colors — deeper/richer to read well on warm cream
const LIGHT_BRIGHT_ANSI = {
  brightBlack: "#6b6560",
  brightRed: "#dc2626",
  brightGreen: "#16a34a",
  brightYellow: "#ca8a04",
  brightBlue: "#2563eb",
  brightMagenta: "#7c3aed",
  brightCyan: "#0891b2",
  brightWhite: "#1c1917",
};

/**
 * Read a CSS custom property as a resolved hex color.
 * Properties use HSL format (e.g. "240 12% 4%"), convert via a temp element.
 */
function getCssColor(prop: string): string | null {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(prop).trim();
  if (!raw) return null;
  // If already hex, return as-is
  if (raw.startsWith("#")) return raw;
  // HSL components (e.g. "240 12% 4%") — resolve via temporary element
  const el = document.createElement("div");
  el.style.color = `hsl(${raw})`;
  document.body.appendChild(el);
  const resolved = getComputedStyle(el).color;
  document.body.removeChild(el);
  // Convert rgb(r, g, b) to hex
  const match = resolved.match(/(\d+)/g);
  if (!match || match.length < 3) return null;
  const hex = "#" + match.slice(0, 3).map((n) => parseInt(n).toString(16).padStart(2, "0")).join("");
  return hex;
}

/** Build terminal theme from CSS custom properties, falling back to hardcoded values. */
function getTerminalTheme(): typeof FALLBACK_THEME_DARK {
  const isDark = document.documentElement.classList.contains("dark");
  const fallback = FALLBACK_THEME_DARK;
  const bright = isDark ? fallback : LIGHT_BRIGHT_ANSI;

  const bg = getCssColor("--background") || fallback.background;
  const fg = getCssColor("--foreground") || fallback.foreground;
  return {
    background: bg,
    foreground: fg,
    cursor: fg,
    cursorAccent: bg,
    selectionBackground: (getCssColor("--background-overlay") || fallback.selectionBackground) + "80",
    selectionForeground: fg,
    black: getCssColor("--background-overlay") || fallback.black,
    red: getCssColor("--destructive") || fallback.red,
    green: getCssColor("--success") || fallback.green,
    yellow: getCssColor("--warning") || fallback.yellow,
    blue: getCssColor("--info") || fallback.blue,
    magenta: getCssColor("--accent") || fallback.magenta,
    cyan: getCssColor("--info") || fallback.cyan,
    white: fg,
    brightBlack: getCssColor("--foreground-muted") || bright.brightBlack,
    brightRed: bright.brightRed,
    brightGreen: bright.brightGreen,
    brightYellow: bright.brightYellow,
    brightBlue: bright.brightBlue,
    brightMagenta: bright.brightMagenta,
    brightCyan: bright.brightCyan,
    brightWhite: isDark ? fallback.brightWhite : bright.brightWhite,
  };
}

export function TerminalInstance({
  sessionId,
  isActive,
  workingDirectory,
  onCwdChange,
  initialCommand,
  onInitialCommandSent,
  onProcessExit,
  onSplitHorizontal,
  onSplitVertical,
  onToggleZoom,
  isZoomed,
  canZoom,
}: TerminalInstanceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const oscShimRef = useRef<OscShim | null>(null);
  const [lastExitCode, setLastExitCode] = useState<number | null>(null);
  const [ptyExited, setPtyExited] = useState(false);
  const terminalSettings = useTerminalSettings();
  const resolvedTheme = useResolvedTheme();

  // Refs for initial command — consumed once after PTY creation
  const initialCommandRef = useRef(initialCommand);
  initialCommandRef.current = initialCommand;
  const onInitialCommandSentRef = useRef(onInitialCommandSent);
  onInitialCommandSentRef.current = onInitialCommandSent;
  const onProcessExitRef = useRef(onProcessExit);
  onProcessExitRef.current = onProcessExit;

  // Stable ref for settings — used during terminal creation without
  // being a dependency (so changing settings doesn't recreate the terminal)
  const settingsRef = useRef(terminalSettings);
  settingsRef.current = terminalSettings;

  // Shell integration (OSC 133 + OSC 7) via OscShim
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

  // Focus terminal — use ghostty-web's textarea property directly
  const focusTerminal = useCallback(() => {
    const terminal = terminalRef.current;
    if (terminal?.textarea) {
      terminal.textarea.focus({ preventScroll: true });
    } else {
      terminal?.focus();
    }
  }, []);

  // Track whether there's a text selection in the terminal
  const [hasSelection, setHasSelection] = useState(false);

  // Context menu handlers
  const handleCopy = useCallback(async () => {
    const selection = terminalRef.current?.getSelection();
    if (selection) {
      await navigator.clipboard.writeText(selection);
    }
    focusTerminal();
  }, [focusTerminal]);

  const handlePaste = useCallback(async () => {
    const text = await navigator.clipboard.readText();
    if (text) {
      terminalRef.current?.paste(text);
    }
    focusTerminal();
  }, [focusTerminal]);

  const handleSelectAll = useCallback(() => {
    terminalRef.current?.selectAll();
    focusTerminal();
  }, [focusTerminal]);

  const handleClear = useCallback(() => {
    terminalRef.current?.clear();
    focusTerminal();
  }, [focusTerminal]);

  const handleRestart = useCallback(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;
    const resolvedCwd = workingDirectory || "/";
    setPtyExited(false);
    terminal.clear();
    const fitAddon = fitAddonRef.current;
    const dims = fitAddon?.proposeDimensions();
    window.breadcrumbAPI?.createTerminal({
      id: sessionId,
      name: sessionId,
      workingDirectory: resolvedCwd,
      cols: dims?.cols || terminal.cols,
      rows: dims?.rows || terminal.rows,
    });
  }, [sessionId, workingDirectory]);

  // Cmd+L to clear (search temporarily disabled — ghostty-web has no search addon)
  useEffect(() => {
    if (!isActive) return;
    const handler = (e: KeyboardEvent) => {
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
    let destroyed = false;

    // Create OSC shim for shell integration
    const oscShim = new OscShim();
    oscShimRef.current = oscShim;

    // ghostty-web requires WASM init before creating Terminal instances
    const setupPromise = ensureGhosttyInit().then(() => {
      if (destroyed) return;

      const terminal = new Terminal({
        cursorBlink: settings.cursorBlink,
        cursorStyle: settings.cursorStyle,
        fontSize: settings.fontSize,
        fontFamily: settings.fontFamily,
        theme: getTerminalTheme(),
        scrollback: settings.scrollback,
      });

      // Load FitAddon (built into ghostty-web)
      const fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);

      // Register shell integration handlers via OSC shim
      const cleanupShell = registerHandlers(terminal, oscShim);

      // Track selection state for context menu
      const selectionDisposable = terminal.onSelectionChange(() => {
        setHasSelection(!!terminal.getSelection());
      });

      terminalRef.current = terminal;
      fitAddonRef.current = fitAddon;

      let ptyCreated = false;
      let resizeTimer: ReturnType<typeof setTimeout> | undefined;

      let opened = false;
      const container = containerRef.current!;
      const tryOpen = () => {
        if (opened || destroyed || !container) return false;
        const { clientWidth, clientHeight } = container;
        if (clientWidth > 0 && clientHeight > 0) {
          terminal.open(container);
          opened = true;
          return true;
        }
        return false;
      };

      // Resolve working directory upfront (async but fast)
      let resolvedCwd: string | null = workingDirectory || null;
      if (!resolvedCwd) {
        window.breadcrumbAPI?.getWorkingDirectory().then((dir) => {
          resolvedCwd = dir || "/";
          if (!ptyCreated && !destroyed) {
            tryCreatePty();
          }
        }).catch(() => {
          resolvedCwd = "/";
        });
      }

      const tryCreatePty = () => {
        if (ptyCreated || destroyed || !resolvedCwd || !opened) return;
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
            }).then((result) => {
              if (destroyed) return;

              // Replay buffer to restore terminal state for reconnecting sessions
              if (result?.replayBuffer) {
                oscShim.process(result.replayBuffer);
                terminal.write(result.replayBuffer);
              }

              // Sync PTY dimensions
              window.breadcrumbAPI?.resizeTerminal(sessionId, dims.cols, dims.rows);

              // Send initial command (e.g. "claude\n") after shell starts
              const cmd = initialCommandRef.current;
              if (cmd) {
                setTimeout(() => {
                  if (!destroyed) {
                    window.breadcrumbAPI?.writeTerminal(sessionId, cmd);
                    initialCommandRef.current = undefined;
                    onInitialCommandSentRef.current?.();
                  }
                }, 300);
              }
            });
          }
        } catch { /* ignore — will retry on next resize */ }
      };

      // Defer terminal.open() to next animation frame (same React StrictMode
      // workaround as before — first mount's rAF is cancelled in cleanup)
      const openRafId = requestAnimationFrame(() => {
        if (destroyed) return;
        if (tryOpen()) {
          tryCreatePty();
          if (!ptyCreated) {
            setTimeout(() => {
              if (!destroyed) tryCreatePty();
            }, 50);
          }
        }
      });

      // Forward keystrokes to PTY
      const dataDisposable = terminal.onData((data) => {
        window.breadcrumbAPI?.writeTerminal(sessionId, data);
      });

      // Receive PTY output — process through OSC shim first, then write to terminal.
      // Auto-scroll: pin to bottom on new output only if user hasn't scrolled up.
      const cleanupData = window.breadcrumbAPI?.onTerminalData((event) => {
        if (event.sessionId === sessionId && opened) {
          // Detect if at bottom using ghostty-web's viewport API
          const scrollbackLen = terminal.getScrollbackLength();
          const viewportY = terminal.getViewportY();
          const wasAtBottom = viewportY <= 0 || scrollbackLen === 0;

          // Run through OSC shim (extracts OSC 133/7 for shell integration)
          oscShim.process(event.data);
          terminal.write(event.data);

          if (wasAtBottom) {
            terminal.scrollToBottom();
          }
        }
      });

      const cleanupExit = window.breadcrumbAPI?.onTerminalExit((event) => {
        if (event.sessionId === sessionId) {
          setPtyExited(true);
          setTimeout(() => {
            if (!destroyed) {
              onProcessExitRef.current?.(event.exitCode);
            }
          }, 150);
        }
      });

      // Debounced resize handler
      const handleResize = () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          if (destroyed) return;
          tryOpen();
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
      resizeObserver.observe(container);

      // Return cleanup — stored on the setupPromise so the outer cleanup can call it
      const cleanup = () => {
        destroyed = true;
        cancelAnimationFrame(openRafId);
        clearTimeout(resizeTimer);
        dataDisposable.dispose();
        selectionDisposable.dispose();
        cleanupShell();
        cleanupData?.();
        cleanupExit?.();
        resizeObserver.disconnect();
        oscShim.dispose();
        oscShimRef.current = null;
        fitAddonRef.current = null;
        terminalRef.current = null;
        terminal.dispose();
      };

      // Store cleanup on a ref-accessible location
      cleanupRef.current = cleanup;
    });

    // Ref to hold the async cleanup function
    const cleanupRef = { current: null as (() => void) | null };

    return () => {
      destroyed = true;
      if (cleanupRef.current) {
        cleanupRef.current();
      }
      oscShim.dispose();
      oscShimRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, workingDirectory]);

  // Refit + focus on activation — ghostty-web auto-renders at 60fps so no
  // manual refresh() needed. Preserve scroll position to prevent viewport
  // jumps when clicking into a pane (especially with Claude Code).
  useEffect(() => {
    if (isActive) {
      requestAnimationFrame(() => {
        const terminal = terminalRef.current;
        if (terminal) {
          // Save scroll position before operations that might cause a jump
          const savedViewportY = terminal.getViewportY();

          fit();
          focusTerminal();

          // Restore scroll position if fit caused a viewport jump
          const currentViewportY = terminal.getViewportY();
          if (currentViewportY !== savedViewportY) {
            terminal.scrollToLine(
              terminal.getScrollbackLength() - savedViewportY
            );
          }
        }
      });
    }
  }, [isActive, fit, focusTerminal]);

  // Live settings updates — apply to existing terminal without recreating.
  // ghostty-web supports runtime option changes via its options proxy.
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

  // Re-apply terminal theme when light/dark mode changes.
  // ghostty-web's CanvasRenderer.setTheme() handles runtime updates.
  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;
    terminal.options.theme = getTerminalTheme();
  }, [resolvedTheme]);

  // Restore terminal focus when context menu closes
  const handleContextMenuOpenChange = useCallback((open: boolean) => {
    if (!open) {
      requestAnimationFrame(() => focusTerminal());
    }
  }, [focusTerminal]);

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

        {/* PTY exited — restart overlay */}
        {ptyExited && (
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center p-4 bg-gradient-to-t from-background/90 to-transparent animate-fade-in">
            <button
              onClick={handleRestart}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-medium transition-default focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:outline-none"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Restart Terminal
            </button>
          </div>
        )}

        {/* Exit code badge */}
        {lastExitCode !== null && (
          <div className={`absolute top-2 right-2 flex items-center gap-1.5 px-2 py-1 rounded-md text-2xs font-mono animate-fade-in ${
            lastExitCode === 0
              ? "bg-success/15 border border-success/25 text-success"
              : "bg-destructive/20 border border-destructive/30 text-destructive"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              lastExitCode === 0 ? "bg-success" : "bg-destructive"
            }`} />
            {lastExitCode === 0 ? "OK" : `Exit ${lastExitCode}`}
          </div>
        )}
      </div>
    </ContextMenu>
  );
}
