import { useEffect, useRef, useCallback, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { SearchAddon } from "@xterm/addon-search";
import { WebglAddon } from "@xterm/addon-webgl";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { Unicode11Addon } from "@xterm/addon-unicode11";
import { useShellIntegration } from "../../hooks/useShellIntegration";
import { useTerminalSettings, useResolvedTheme } from "../../store/settingsStore";
import { TerminalSearch } from "./TerminalSearch";
import {
  ContextMenu,
  MenuItem,
  MenuSeparator,
} from "../shared/ContextMenu";
import { Copy, ClipboardPaste, CheckSquare, Eraser, Maximize2, Minimize2, SplitSquareVertical, Rows3, RotateCcw } from "lucide-react";
import "@xterm/xterm/css/xterm.css";

// Module-level WebGL fallback flag — if WebGL fails once, skip for all future terminals (VS Code pattern)
let webglFailed = false;

// Maximum scrollback lines — prevents memory exhaustion with Claude Code burst output.
// 160 cols × 50K lines ≈ 100MB per terminal. 10K is safe for heavy workloads.
const MAX_SCROLLBACK = 10_000;

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
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const webglAddonRef = useRef<WebglAddon | null>(null);
  const [lastExitCode, setLastExitCode] = useState<number | null>(null);
  const [searchVisible, setSearchVisible] = useState(false);
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

  // Focus terminal without triggering browser scroll-into-view on the
  // hidden textarea. Uses preventScroll to avoid viewport jumps when
  // switching between panes (especially noticeable with Claude Code).
  const focusTerminal = useCallback(() => {
    const textarea = containerRef.current?.querySelector<HTMLTextAreaElement>('.xterm-helper-textarea');
    if (textarea) {
      textarea.focus({ preventScroll: true });
    } else {
      terminalRef.current?.focus();
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
      theme: getTerminalTheme(),
      scrollback: Math.min(settings.scrollback, MAX_SCROLLBACK),
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

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    let ptyCreated = false;
    let resizeTimer: ReturnType<typeof setTimeout> | undefined;
    let destroyed = false;

    let opened = false;
    const container = containerRef.current;
    const tryOpen = () => {
      if (opened || destroyed || !container) return false;
      const { clientWidth, clientHeight } = container;
      if (clientWidth > 0 && clientHeight > 0) {
        terminal.open(container);
        opened = true;

        // Load WebGL2 renderer for GPU-accelerated rendering (~900% faster).
        // Must load AFTER open() — needs the canvas element.
        if (!webglFailed) {
          try {
            const webglAddon = new WebglAddon();
            webglAddon.onContextLoss(() => {
              // GPU context lost (OOM, system sleep, context limit).
              // Dispose addon — xterm.js falls back to canvas automatically.
              try { webglAddon.dispose(); } catch { /* ignore */ }
              webglAddonRef.current = null;
            });
            terminal.loadAddon(webglAddon);
            webglAddonRef.current = webglAddon;
          } catch {
            // WebGL2 not available — skip for all future terminals
            webglFailed = true;
            webglAddonRef.current = null;
          }
        }

        return true;
      }
      return false;
    };

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

            // When reconnecting to an existing PTY session (e.g. pane moved
            // via tab merge), replay the output buffer so the fresh xterm.js
            // restores the full terminal state — alternate screen mode, cursor
            // position, colors, scroll regions, etc.
            if (result?.replayBuffer) {
              terminal.write(result.replayBuffer);
            }

            // Sync PTY dimensions — handles the case where the session
            // already existed and the PTY still has old dimensions from
            // the previous container. Also triggers SIGWINCH so TUI apps
            // (like Claude Code) redraw at the correct size.
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

    // Defer terminal.open() to next animation frame. This prevents the
    // xterm Viewport crash caused by React StrictMode's double-invoke:
    // StrictMode runs mount → cleanup → remount synchronously. The first
    // mount's rAF is cancelled in cleanup (cancelAnimationFrame below),
    // so the terminal never opens and no Viewport setTimeout is scheduled.
    // The second mount's rAF fires normally and creates a working terminal.
    const openRafId = requestAnimationFrame(() => {
      if (destroyed) return;
      if (tryOpen()) {
        tryCreatePty();
        // If fitAddon.proposeDimensions() wasn't ready yet (renderer
        // needs a frame to initialize after open), retry shortly.
        // The ResizeObserver also retries at 80ms as a final fallback.
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

    // Receive PTY output — tmux-like auto-scroll: pin to bottom on new
    // output only if the user hasn't scrolled up. When the user scrolls
    // back to the bottom, auto-scroll resumes on the next write.
    // Flow control: ACK inside write() callback so the PTY is paused until
    // xterm.js has actually parsed and rendered the data (true backpressure).
    const cleanupData = window.breadcrumbAPI?.onTerminalData((event) => {
      if (event.sessionId === sessionId && opened) {
        const buf = terminal.buffer.active;
        const wasAtBottom = buf.baseY === buf.viewportY;
        terminal.write(event.data, () => {
          // ACK after xterm.js has finished parsing — enables backpressure
          window.breadcrumbAPI?.ackTerminalData(sessionId, event.data.length);
        });
        if (wasAtBottom) {
          terminal.scrollToBottom();
        }
      }
    });

    const cleanupExit = window.breadcrumbAPI?.onTerminalExit((event) => {
      if (event.sessionId === sessionId) {
        setPtyExited(true);
        // Auto-close pane/tab after a short delay so the user sees
        // the exit briefly (like iTerm/tmux closing on shell exit).
        setTimeout(() => {
          if (!destroyed) {
            onProcessExitRef.current?.(event.exitCode);
          }
        }, 150);
      }
    });

    // Debounced resize handler — collapses rapid PanelGroup layout
    // transitions into a single PTY resize (avoids SIGWINCH storms).
    // Horizontal resize is expensive (causes line reflow) so gets a longer
    // debounce for terminals with large buffers (VS Code pattern).
    let horizontalResizeTimer: ReturnType<typeof setTimeout> | undefined;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (destroyed) return;
        // Deferred open: if the terminal hasn't been opened yet (container
        // was zero-sized on mount), open it now that we have dimensions.
        tryOpen();
        if (!ptyCreated) {
          tryCreatePty();
          return;
        }
        try {
          const dims = fitAddon.proposeDimensions();
          if (!dims || dims.cols <= 0 || dims.rows <= 0) return;
          const colsChanged = dims.cols !== terminal.cols;
          const rowsChanged = dims.rows !== terminal.rows;
          if (!colsChanged && !rowsChanged) return;

          // Vertical resize is cheap — apply immediately
          if (rowsChanged && !colsChanged) {
            terminal.resize(dims.cols, dims.rows);
            window.breadcrumbAPI?.resizeTerminal(sessionId, dims.cols, dims.rows);
            return;
          }

          // Horizontal resize with large buffer — debounce to avoid expensive reflow
          const bufferLength = terminal.buffer.normal.length;
          if (colsChanged && bufferLength > 200) {
            clearTimeout(horizontalResizeTimer);
            // Apply row change immediately if needed
            if (rowsChanged) {
              terminal.resize(terminal.cols, dims.rows);
              window.breadcrumbAPI?.resizeTerminal(sessionId, terminal.cols, dims.rows);
            }
            horizontalResizeTimer = setTimeout(() => {
              if (destroyed) return;
              terminal.resize(dims.cols, terminal.rows);
              window.breadcrumbAPI?.resizeTerminal(sessionId, dims.cols, terminal.rows);
            }, 100);
            return;
          }

          // Small buffer or only horizontal — apply immediately
          terminal.resize(dims.cols, dims.rows);
          window.breadcrumbAPI?.resizeTerminal(sessionId, dims.cols, dims.rows);
        } catch { /* ignore */ }
      }, 80);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.current);

    return () => {
      destroyed = true;
      cancelAnimationFrame(openRafId);
      clearTimeout(resizeTimer);
      clearTimeout(horizontalResizeTimer);
      dataDisposable.dispose();
      selectionDisposable.dispose();
      cleanupShell();
      cleanupData?.();
      cleanupExit?.();
      resizeObserver.disconnect();
      // Dispose WebGL addon FIRST to release GPU context before terminal teardown
      try { webglAddonRef.current?.dispose(); } catch { /* ignore */ }
      webglAddonRef.current = null;
      searchAddonRef.current = null;
      fitAddonRef.current = null;
      terminalRef.current = null;
      terminal.dispose();
    };
    // Only recreate when the session or working directory changes.
    // registerHandlers is stable (empty deps). Settings are read from ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, workingDirectory]);

  // Refit + focus on activation — handles tab switches where the container
  // was invisible. refresh() forces xterm to re-render its buffer content.
  // Preserves scroll position to prevent viewport jumps when clicking into
  // a pane (especially noticeable with long-running TUIs like Claude Code).
  useEffect(() => {
    if (isActive) {
      requestAnimationFrame(() => {
        const terminal = terminalRef.current;
        if (terminal) {
          // Save scroll position before operations that might cause a jump
          const buf = terminal.buffer.active;
          const savedViewportY = buf.viewportY;

          terminal.refresh(0, terminal.rows - 1);
          fit();
          focusTerminal();

          // Restore scroll position if fit/refresh caused a viewport jump
          if (buf.viewportY !== savedViewportY) {
            terminal.scrollLines(savedViewportY - buf.viewportY);
          }
        }
      });
    }
  }, [isActive, fit, focusTerminal]);

  // Live settings updates — apply to existing terminal without recreating
  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;
    terminal.options.fontSize = terminalSettings.fontSize;
    terminal.options.fontFamily = terminalSettings.fontFamily;
    terminal.options.cursorBlink = terminalSettings.cursorBlink;
    terminal.options.cursorStyle = terminalSettings.cursorStyle;
    terminal.options.scrollback = Math.min(terminalSettings.scrollback, MAX_SCROLLBACK);
    requestAnimationFrame(() => fit());
  }, [terminalSettings, fit]);

  // Re-apply terminal theme when light/dark mode changes
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

        {/* Search overlay */}
        <TerminalSearch
          searchAddon={searchAddonRef.current}
          isVisible={searchVisible}
          onClose={() => {
            setSearchVisible(false);
            focusTerminal();
          }}
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
        {lastExitCode !== null && !searchVisible && (
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
