# Research: Terminal Multiplexer UI (xterm.js + node-pty in Electron)

**Task ID:** breadcrumb-r5t
**Date:** 2026-02-11
**Domain:** Terminal Emulation, Electron Desktop Apps
**Overall Confidence:** HIGH

## TL;DR

Build a tmux-like terminal multiplexer using **@xterm/xterm 6.0.0** with the **@xterm/addon-webgl** renderer for performance, **react-resizable-panels** for split pane layout, and **node-pty** for PTY session management. Use Electron IPC to communicate between main process (node-pty) and renderer process (xterm.js). Implement tmux-like keyboard shortcuts using Electron's `before-input-event` API with `preventDefault()`. For 10+ terminals, use WebGL renderer and carefully manage terminal lifecycle with disposal patterns.

## Recommended Stack

| Library | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| @xterm/xterm | 6.0.0 | Terminal UI component | HIGH |
| @xterm/addon-webgl | Latest | GPU-accelerated rendering | HIGH |
| @xterm/addon-fit | Latest | Terminal resize handling | HIGH |
| node-pty | Latest | PTY (pseudoterminal) sessions | HIGH |
| react-resizable-panels | Latest | Resizable split pane layout | MEDIUM |
| electron | Latest | Desktop app framework | HIGH |

**Install:**
```bash
npm install @xterm/xterm @xterm/addon-webgl @xterm/addon-fit node-pty react-resizable-panels
```

**Important:** The old `xterm` and `xterm-*` packages are deprecated. Use the new scoped `@xterm/*` packages instead.

## Key APIs and Patterns

### 1. xterm.js Terminal Class

**Core APIs (v6.0.0):**

```typescript
import { Terminal } from '@xterm/xterm';

// Create terminal instance
const terminal = new Terminal({
  cols: 80,
  rows: 24,
  cursorBlink: true,
  scrollback: 5000, // Memory consideration: 34MB for 160x24 terminal with 5000 scrollback
});

// Lifecycle methods
terminal.open(containerElement);  // Mount to DOM
terminal.write('Hello\n');        // Write text
terminal.writeln('Starting...');  // Write line with newline
terminal.focus();                 // Focus terminal
terminal.dispose();               // Clean up (CRITICAL for memory management)

// Event handlers (return IDisposable)
const dataDisposable = terminal.onData((data) => {
  // User types/pastes - send to PTY
  ptyProcess.write(data);
});

const keyDisposable = terminal.onKey(({ key, domEvent }) => {
  // Lower-level key events
  // Use onData for most cases - it's easier
});

// Cleanup
dataDisposable.dispose();
keyDisposable.dispose();
```

**Confidence:** HIGH (from official API docs and npm package)

### 2. WebGL Renderer (Performance-Critical)

**Use WebGL for multiple terminals:**

```typescript
import { Terminal } from '@xterm/xterm';
import { WebglAddon } from '@xterm/addon-webgl';

const terminal = new Terminal();
const webglAddon = new WebglAddon();

terminal.loadAddon(webglAddon);
terminal.open(element);
```

**Performance characteristics:**
- WebGL is **900% faster** than canvas renderer in some cases
- Uses `Float32Array` and GPU shaders instead of individual draw calls
- Canvas addon is **deprecated** in v6, use only as fallback for no WebGL2 support
- Multiple terminals can saturate main thread: 2 instances → 30fps, 4 → 15fps

**Memory optimization:**
- v6.0.0 includes improved GPU texture atlas packing
- Uses `IdleTaskQueue` and `PriorityTaskQueue` to prevent blocking main thread
- Single terminal (160x24, 5000 scrollback) = ~34MB memory

**Confidence:** HIGH (from performance benchmarks and official docs)

### 3. FitAddon for Resize Handling

**Basic usage:**

```typescript
import { FitAddon } from '@xterm/addon-fit';

const fitAddon = new FitAddon();
terminal.loadAddon(fitAddon);

// Fit to container
fitAddon.fit();

// Get proposed dimensions before fitting
const dimensions = fitAddon.proposeDimensions();
// { cols: 120, rows: 40 }
```

**CRITICAL ISSUE with split panes:**
- FitAddon has documented issues with split panes
- Width doesn't remain constant when resizing vertically
- Solution: Use `proposeDimensions()` and manually resize with custom logic

```typescript
// Manual resize pattern for split panes
const resizeTerminal = (paneElement: HTMLElement) => {
  const proposed = fitAddon.proposeDimensions();
  if (proposed) {
    terminal.resize(proposed.cols + 2, proposed.rows + 1); // Add buffer
    ptyProcess.resize(proposed.cols + 2, proposed.rows + 1);
  }
};
```

**Confidence:** MEDIUM (known issues require workarounds)

### 4. node-pty Session Management

**Spawn PTY session:**

```typescript
import * as pty from 'node-pty';

const ptyProcess = pty.spawn(shell, [], {
  name: 'xterm-color',
  cols: 80,
  rows: 30,
  cwd: process.env.HOME,
  env: process.env
});

// Receive output from PTY
ptyProcess.onData((data) => {
  terminal.write(data);
});

// Write input to PTY
ptyProcess.write(input);

// Resize PTY
ptyProcess.resize(cols, rows);

// Kill PTY (defaults to SIGHUP)
ptyProcess.kill();
```

**Confidence:** HIGH (from official node-pty docs)

### 5. Multiple PTY Sessions Pattern

**TerminalManager singleton:**

```typescript
class TerminalManager {
  private sessions = new Map<string, PtySession>();

  createSession(id: string, options: PtyOptions): PtySession {
    const ptyProcess = pty.spawn(shell, [], options);

    ptyProcess.onExit(() => {
      this.sessions.delete(id);
    });

    const session = { id, ptyProcess };
    this.sessions.set(id, session);
    return session;
  }

  writeToSession(id: string, data: string) {
    const session = this.sessions.get(id);
    session?.ptyProcess.write(data);
  }

  killSession(id: string) {
    const session = this.sessions.get(id);
    if (session) {
      session.ptyProcess.kill();
      this.sessions.delete(id);
    }
  }
}
```

**Lifecycle management:**
- Listen to `exit` and `close` events to cleanup sessions
- Use window `unload` event to kill spawned processes
- Fallback to SIGKILL if graceful shutdown fails

**Confidence:** HIGH (from multiple production examples)

### 6. Electron IPC Architecture

**Main Process (node-pty):**

```typescript
// main.js
import { ipcMain } from 'electron';
import * as pty from 'node-pty';

const terminals = new Map();

ipcMain.handle('terminal:create', (event, { id, options }) => {
  const ptyProcess = pty.spawn('bash', [], options);

  ptyProcess.onData((data) => {
    event.sender.send('terminal:data', { id, data });
  });

  ptyProcess.onExit(() => {
    event.sender.send('terminal:exit', { id });
    terminals.delete(id);
  });

  terminals.set(id, ptyProcess);
  return { id };
});

ipcMain.on('terminal:write', (event, { id, data }) => {
  terminals.get(id)?.write(data);
});

ipcMain.on('terminal:resize', (event, { id, cols, rows }) => {
  terminals.get(id)?.resize(cols, rows);
});

ipcMain.on('terminal:kill', (event, { id }) => {
  terminals.get(id)?.kill();
  terminals.delete(id);
});
```

**Renderer Process (xterm.js):**

```typescript
// renderer.js
import { Terminal } from '@xterm/xterm';
import { ipcRenderer } from 'electron';

const terminal = new Terminal();
terminal.open(containerElement);

const terminalId = generateId();

// Create PTY session
ipcRenderer.invoke('terminal:create', {
  id: terminalId,
  options: { cols: 80, rows: 24 }
});

// Receive data from PTY
ipcRenderer.on('terminal:data', (event, { id, data }) => {
  if (id === terminalId) {
    terminal.write(data);
  }
});

// Send user input to PTY
terminal.onData((data) => {
  ipcRenderer.send('terminal:write', { id: terminalId, data });
});

// Handle PTY exit
ipcRenderer.on('terminal:exit', (event, { id }) => {
  if (id === terminalId) {
    terminal.dispose();
  }
});
```

**Confidence:** HIGH (from official Electron and node-pty docs)

### 7. Split Pane Layout with react-resizable-panels

**Basic structure:**

```tsx
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

function TerminalSplitView() {
  return (
    <PanelGroup direction="horizontal">
      <Panel defaultSize={50} minSize={20}>
        <TerminalPane id="term-1" />
      </Panel>

      <PanelResizeHandle />

      <Panel defaultSize={50} minSize={20}>
        <PanelGroup direction="vertical">
          <Panel defaultSize={50}>
            <TerminalPane id="term-2" />
          </Panel>

          <PanelResizeHandle />

          <Panel defaultSize={50}>
            <TerminalPane id="term-3" />
          </Panel>
        </PanelGroup>
      </Panel>
    </PanelGroup>
  );
}
```

**Why react-resizable-panels:**
- Better keyboard accessibility with separators
- Min/max size constraints and collapsible behavior
- Layout persistence (remember sizes between reloads)
- More widely adopted (2M+ weekly downloads vs 113K for allotment)

**Alternative:** Allotment (VS Code-based, simpler API, good for VS Code-like behavior)

**Confidence:** MEDIUM (popular but not terminal-specific)

### 8. Terminal Component with Resize Handling

```tsx
import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';

function TerminalPane({ id }: { id: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Create terminal
    const terminal = new Terminal({
      cursorBlink: true,
      scrollback: 5000,
    });

    // Add addons
    const fitAddon = new FitAddon();
    const webglAddon = new WebglAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webglAddon);
    terminal.open(containerRef.current);

    // Fit to container
    fitAddon.fit();

    // Create PTY session via IPC
    ipcRenderer.invoke('terminal:create', {
      id,
      options: {
        cols: terminal.cols,
        rows: terminal.rows,
      }
    });

    // Handle data from PTY
    const handleData = (event: any, { id: termId, data }: any) => {
      if (termId === id) terminal.write(data);
    };
    ipcRenderer.on('terminal:data', handleData);

    // Send user input to PTY
    const dataDisposable = terminal.onData((data) => {
      ipcRenderer.send('terminal:write', { id, data });
    });

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Cleanup
    return () => {
      dataDisposable.dispose();
      ipcRenderer.removeListener('terminal:data', handleData);
      ipcRenderer.send('terminal:kill', { id });
      terminal.dispose();
    };
  }, [id]);

  // Handle panel resize
  useEffect(() => {
    const resizeObserver = new ResizeObserver(() => {
      if (fitAddonRef.current && terminalRef.current) {
        const proposed = fitAddonRef.current.proposeDimensions();
        if (proposed) {
          terminalRef.current.resize(proposed.cols, proposed.rows);
          ipcRenderer.send('terminal:resize', {
            id,
            cols: proposed.cols,
            rows: proposed.rows,
          });
        }
      }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, [id]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
```

**Confidence:** HIGH (composite pattern from docs)

### 9. tmux-like Keyboard Shortcuts

**Prefix key pattern (e.g., Ctrl+B then %):**

```typescript
// Main process - intercept before DOM
import { BrowserWindow } from 'electron';

let prefixKeyPressed = false;
let prefixTimeout: NodeJS.Timeout | null = null;

win.webContents.on('before-input-event', (event, input) => {
  // Detect prefix key (Ctrl+B)
  if (input.control && input.key.toLowerCase() === 'b') {
    event.preventDefault();
    prefixKeyPressed = true;

    // Reset prefix state after timeout
    if (prefixTimeout) clearTimeout(prefixTimeout);
    prefixTimeout = setTimeout(() => {
      prefixKeyPressed = false;
    }, 1000);

    return;
  }

  // Handle command after prefix
  if (prefixKeyPressed) {
    event.preventDefault();

    switch (input.key) {
      case '%': // Vertical split
        win.webContents.send('terminal:split', { direction: 'vertical' });
        break;
      case '"': // Horizontal split
        win.webContents.send('terminal:split', { direction: 'horizontal' });
        break;
      case 'x': // Close pane
        win.webContents.send('terminal:close-pane');
        break;
    }

    prefixKeyPressed = false;
    if (prefixTimeout) clearTimeout(prefixTimeout);
  }
});
```

**Renderer process - handle split commands:**

```tsx
function TerminalMultiplexer() {
  const [panes, setPanes] = useState<Pane[]>([]);

  useEffect(() => {
    const handleSplit = (event: any, { direction }: { direction: 'horizontal' | 'vertical' }) => {
      // Add new pane to layout
      addPane(direction);
    };

    const handleClosePane = () => {
      // Remove active pane
      removeActivePane();
    };

    ipcRenderer.on('terminal:split', handleSplit);
    ipcRenderer.on('terminal:close-pane', handleClosePane);

    return () => {
      ipcRenderer.removeListener('terminal:split', handleSplit);
      ipcRenderer.removeListener('terminal:close-pane', handleClosePane);
    };
  }, []);

  // Render PanelGroup with panes...
}
```

**Alternative: Global shortcuts (work when app is unfocused):**

```typescript
import { globalShortcut } from 'electron';

app.whenReady().then(() => {
  globalShortcut.register('CommandOrControl+Shift+T', () => {
    // Create new terminal
  });
});
```

**Confidence:** MEDIUM (pattern works but needs state management)

## Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| PTY process spawning | node-pty | Handles platform differences (Windows/Unix), signal handling, edge cases with process cleanup |
| Terminal rendering | @xterm/xterm | Complex ANSI parsing, cursor positioning, Unicode support, accessibility |
| Split pane resizing | react-resizable-panels | Touch/mobile support, keyboard navigation, min/max constraints, persistence |
| Keyboard event capture | Electron before-input-event | Runs before DOM, can preventDefault, works with global shortcuts |

## Pitfalls

### 1. Memory Leaks with Multiple Terminals

**What happens:** Each terminal instance holds ~34MB (160x24, 5000 scrollback). Creating 10+ terminals without cleanup causes memory bloat. Multiple terminals saturate main thread (4 terminals → 15fps).

**Avoid by:**
- Always call `terminal.dispose()` when closing panes
- Dispose event listeners: `terminal.onData()` returns `IDisposable` - call `.dispose()`
- Kill PTY processes: Use `ptyProcess.kill()` and listen to `exit` events
- Use WebGL renderer for better performance
- Consider reducing scrollback for inactive panes

### 2. FitAddon Width Issues in Split Panes

**What happens:** Calling `fitAddon.fit()` on resize causes width to change when resizing vertically. Scrollbar positioning breaks, terminal doesn't fill container.

**Avoid by:**
- Use `fitAddon.proposeDimensions()` instead of `fit()`
- Manually call `terminal.resize(cols, rows)` with buffered dimensions
- Sync PTY resize: `ptyProcess.resize(cols, rows)` must match terminal

### 3. Race Conditions with IPC

**What happens:** Terminal writes data before PTY session is ready. PTY data arrives after terminal is disposed.

**Avoid by:**
- Use `ipcRenderer.invoke()` (returns Promise) for session creation, wait before writing
- Check terminal exists before writing: `if (terminalRef.current) terminal.write(data)`
- Remove IPC listeners in cleanup: `ipcRenderer.removeListener()`

### 4. Electron Context Isolation

**What happens:** node-pty requires Node.js APIs. If `contextIsolation: true` (default), `require('node-pty')` fails in renderer.

**Avoid by:**
- Keep node-pty in main process only
- Use IPC for all PTY operations
- Use preload script with `contextBridge.exposeInMainWorld()` if needed

### 5. Terminal Not Responding to Input

**What happens:** User types but nothing appears. Often caused by not wiring `terminal.onData()` to PTY write.

**Avoid by:**
```typescript
// MUST wire user input to PTY
terminal.onData((data) => {
  ipcRenderer.send('terminal:write', { id, data });
});
```

### 6. tmux Output Corruption with Multiple xterm Instances

**What happens:** When multiple xterm.js instances share a tmux session (e.g., split terminals), output corruption occurs with certain EOL conversions.

**Avoid by:**
- Use separate tmux sessions per terminal instance
- Don't share single tmux session across split panes
- OR use tmux control mode (`tmux -CC`) for better multi-client support

## Performance Best Practices

### For 10+ Terminal Instances

1. **Use WebGL renderer** (900% faster than canvas)
2. **Reduce scrollback** for inactive panes (1000 instead of 5000)
3. **Lazy load terminals** - create on-demand, not all at mount
4. **Use IdleTaskQueue pattern** (built into xterm.js v6.0.0)
5. **Dispose properly** - memory leaks compound with multiple instances
6. **Monitor performance** - use xterm-benchmark for profiling

### Renderer Selection

```typescript
// Try WebGL, fallback to DOM
const terminal = new Terminal();
try {
  const webglAddon = new WebglAddon();
  terminal.loadAddon(webglAddon);
} catch (e) {
  console.warn('WebGL not supported, using DOM renderer');
  // DOM renderer is default - no addon needed
}
```

## Real-World Examples

### Production Terminals Using This Stack

1. **VSCode** - Uses xterm.js with split panes via `SplitView`, custom resize logic with `proposeDimensions()`
2. **Hyper** - Electron + React + Redux, xterm.js, split panes with `<SplitPane>` component
3. **Tabby** - Angular + Electron, xterm.js, percentage-based split layout
4. **Netcatty** - React + Electron + xterm.js, features horizontal/vertical splits, GPU-accelerated rendering

### VSCode Split Pane Pattern

VSCode's approach (from their wiki):
- DOM: `.split-view-container` → `.split-view-view` → `.terminal-wrapper` → `.xterm`
- Uses `SplitView` to manage panes
- `resizePanes(relativeSizes: number[])` for layout restoration
- Keyboard shortcuts trigger split operations (Ctrl+Cmd+Arrow)

## Open Questions

1. **State persistence:** How to serialize split pane layout for restore? react-resizable-panels has built-in persistence, but need to also restore terminal state (CWD, scrollback). Consider storing session info in localStorage.

2. **Pane focus management:** How to indicate which pane has focus when multiple terminals are visible? Need visual indicator (border color?) and keyboard shortcuts to cycle focus.

3. **Drag-and-drop pane rearrangement:** Is this needed? Hyper and Tabby support it, but adds complexity. May not be needed for MVP.

4. **Cloud sync of layouts:** Tabby mentions this - worth investigating if building cloud-connected app.

## Sources

**HIGH confidence:**

- [@xterm/xterm npm package](https://www.npmjs.com/package/@xterm/xterm) - Latest version 6.0.0
- [xterm.js Official Documentation](https://xtermjs.org/docs/)
- [xterm.js Terminal API](https://xtermjs.org/docs/api/terminal/classes/terminal/)
- [xterm.js GitHub Releases](https://github.com/xtermjs/xterm.js/releases)
- [node-pty GitHub Repository](https://github.com/microsoft/node-pty)
- [node-pty npm documentation](https://www.npmjs.com/package/node-pty)
- [Electron IPC Documentation](https://www.electronjs.org/docs/latest/tutorial/ipc)
- [Electron Keyboard Shortcuts](https://www.electronjs.org/docs/latest/tutorial/keyboard-shortcuts)
- [VSCode Working with xterm.js Wiki](https://github.com/microsoft/vscode/wiki/Working-with-xterm.js/)
- [xterm.js WebGL vs Canvas Performance](https://github.com/xtermjs/xterm.js/pull/1790)

**MEDIUM confidence:**

- [react-resizable-panels GitHub](https://github.com/bvaughn/react-resizable-panels)
- [Allotment GitHub](https://github.com/johnwalley/allotment)
- [FitAddon Issues with Split Panes](https://github.com/xtermjs/xterm.js/issues/3584)
- [Tabby Split Tab System](https://deepwiki.com/Eugeny/tabby/5.2-split-tab-system)
- [Hyper Split Panes Implementation](https://github.com/vercel/hyper/commit/a7595c1a45bf584c9baee490e6c3bffc04732183)
- [node-pty Electron Example](https://github.com/microsoft/node-pty/blob/main/examples/electron/README.md)
- [Multiple PTY Sessions with Socket.io](https://medium.com/@deysouvik700/efficient-and-scalable-usage-of-node-js-pty-with-socket-io-for-multiple-users-402851075c4a)

**LOW confidence (needs validation):**

- NPM trends data for library popularity (react-resizable vs allotment)
- Performance numbers (900% improvement, 34MB memory) - these are from specific benchmarks, may vary by use case
- tmux EOL conversion issues - specific to certain configurations
