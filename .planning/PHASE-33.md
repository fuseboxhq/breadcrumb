# Phase 33: xterm.js Terminal Hardening

**Status:** in_progress
**Beads Epic:** breadcrumb-8vj
**Created:** 2026-02-20

## Objective

Fix all known xterm.js scrollback and rendering issues with Claude Code by applying proven production patterns: WebGL2 GPU rendering (900% faster), PTY flow control to prevent burst output overwhelming the renderer, and intelligent scrollback management. These are the exact techniques used by VS Code, Hyper, and Wave Terminal — all built on xterm.js — to handle demanding TUI applications.

## Research Summary

**Overall Confidence:** HIGH — all techniques are documented, battle-tested in VS Code's codebase, and verified against xterm.js 5.x source code.

### Key Discoveries

1. **DEC mode 2026 is already native in xterm.js 5.x.** The `SynchronizedOutputHandler` in `RenderService.ts` buffers row updates between `\x1b[?2026h` (begin) and `\x1b[?2026l` (end) sequences, flushing all changes in a single render. Includes a 1-second safety timeout. **No code needed** — Claude Code and tmux get batched rendering automatically.

2. **Resize order (terminal-first → PTY) is correct.** VS Code does the same: resize xterm.js first so it knows the new dimensions for line reflow, then send `SIGWINCH` to the PTY. Our current implementation is correct. The "PTY-first" pattern from Mux research was ghostty-web-specific.

3. **WebGL2 addon is installed but never loaded.** `@xterm/addon-webgl` is in package.json but not imported or used anywhere. This is the single biggest rendering performance win — up to 900% faster frame rendering vs canvas.

4. **Flow control is the missing piece for burst output.** VS Code uses a 100K char high-watermark with node-pty `pause()`/`resume()`. The ACK happens inside xterm.js's `write()` callback, creating true end-to-end backpressure. Our implementation has zero flow control — PTY data fires directly into `terminal.write()`.

### Recommended Stack

| Library | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| @xterm/xterm | ^5.5.0 | Terminal emulator (unchanged) | HIGH |
| @xterm/addon-webgl | ^0.18.0 | GPU-accelerated rendering (load it!) | HIGH |
| @xterm/addon-fit | ^0.10.0 | Auto-sizing (unchanged) | HIGH |
| node-pty | existing | PTY backend + flow control | HIGH |

### Key Patterns

**WebGL loading (from VS Code):**
```typescript
// Load AFTER terminal.open()
try {
  const webglAddon = new WebglAddon();
  webglAddon.onContextLoss(() => {
    webglAddon.dispose();
    // Mark globally to skip WebGL for future terminals
  });
  terminal.loadAddon(webglAddon);
} catch {
  // Canvas fallback — no action needed
}
```

**Flow control (from VS Code):**
```
PTY data → track unacknowledged chars → if > 100K: pty.pause()
Frontend: terminal.write(data, () => { ack(data.length) })
Backend: on ack, if unacked < 5K: pty.resume()
```

**Disposal order:**
```
WebGL addon → Search addon → other addons → Terminal
```

### Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| Synchronized output | xterm.js native DEC 2026 | Already built in, handles timeouts |
| GPU rendering | @xterm/addon-webgl | Context loss handling, atlas management |
| Flow control watermarks | VS Code's proven constants | 100K high / 5K low / 5K ack batch |

### Pitfalls

- **WebGL context limit**: Max ~16 WebGL contexts per Electron process. Each terminal with WebGL addon consumes one. With 5+ split panes, could exhaust. Dispose WebGL on hidden terminals if needed.
- **WebGL addon must load after `open()`**: Loading before `open()` will fail — no canvas element yet.
- **Flow control ACK timing**: Must ACK inside `write()` callback, not after the call returns. The callback fires when xterm.js has finished parsing, ensuring true backpressure.
- **Scrollback memory**: 160 cols × 50K scrollback ≈ 100MB per terminal. Cap aggressively.

## Tasks

| ID | Title | Status | Complexity | Dependencies |
|----|-------|--------|------------|--------------|
| breadcrumb-8vj.1 | Enable WebGL2 GPU renderer with fallback | open | Medium | - |
| breadcrumb-8vj.2 | Implement PTY flow control with backpressure | open | High | - |
| breadcrumb-8vj.3 | Cap scrollback and fix disposal hygiene | open | Low | - |
| breadcrumb-8vj.4 | Verify DEC 2026 and resize debounce | open | Low | .1, .2 |

### Task Details

#### breadcrumb-8vj.1: Enable WebGL2 GPU renderer with fallback

**What:** Load `@xterm/addon-webgl` for GPU-accelerated rendering. Currently the addon is in package.json but never imported or used.

**Implementation:**
1. Import `WebglAddon` from `@xterm/addon-webgl`
2. After `terminal.open(container)`, create and load the addon inside try/catch
3. Handle `onContextLoss` → dispose addon (canvas fallback is automatic)
4. Store addon ref for proper disposal in cleanup
5. Add module-level flag: if WebGL failed once, skip for all future terminals (VS Code pattern)

**Key constraint:** Must load AFTER `terminal.open()` — needs the canvas element.

**Files:**
- `desktop/src/renderer/components/terminal/TerminalInstance.tsx` — load WebGL addon after open()

**Done when:** Terminal renders with WebGL2 (verify via DevTools → chrome://gpu). Falls back to canvas gracefully if WebGL unavailable.

---

#### breadcrumb-8vj.2: Implement PTY flow control with backpressure

**What:** Add backpressure between PTY output and xterm.js rendering. Currently PTY data fires directly into `terminal.write()` with no throttling — Claude Code burst output (thousands of lines/sec) overwhelms the renderer.

**Implementation:**

Backend (TerminalService.ts):
1. Add `unacknowledgedCharCount` per session
2. In `onData` handler: increment count, if > HIGH_WATERMARK (100,000) → `pty.pause()`
3. Add `acknowledgeData(sessionId, charCount)` method: decrement count, if < LOW_WATERMARK (5,000) → `pty.resume()`

IPC (handlers.ts + types):
4. Add `TERMINAL_ACK_DATA` IPC channel
5. Wire handler to call `terminalService.acknowledgeData()`

Preload (index.ts):
6. Add `ackTerminalData(sessionId: string, charCount: number)` to BreadcrumbAPI

Frontend (TerminalInstance.tsx):
7. Change `terminal.write(event.data)` to `terminal.write(event.data, () => { ackTerminalData(sessionId, event.data.length) })`
8. The write callback fires after xterm.js has parsed the data — true end-to-end backpressure

**Constants (from VS Code):**
```
HIGH_WATERMARK = 100_000  // Pause PTY
LOW_WATERMARK  = 5_000    // Resume PTY
```

**Files:**
- `desktop/src/main/terminal/TerminalService.ts` — flow control logic
- `desktop/src/main/ipc/handlers.ts` — new IPC handler
- `desktop/src/shared/types/index.ts` — new IPC channel constant
- `desktop/src/preload/index.ts` — expose ackTerminalData
- `desktop/src/renderer/components/terminal/TerminalInstance.tsx` — ACK in write callback

**Done when:** During Claude Code burst output, PTY is paused/resumed based on watermarks. Renderer is never overwhelmed. No dropped frames during rapid output.

---

#### breadcrumb-8vj.3: Cap scrollback and fix disposal hygiene

**What:** Enforce a maximum scrollback of 10,000 lines and ensure proper addon disposal order to prevent GPU context leaks.

**Implementation:**
1. In Terminal constructor: `scrollback: Math.min(settings.scrollback, 10_000)`
2. In live settings update: cap the same way
3. In cleanup: dispose WebGL addon FIRST (before other addons and terminal)
4. Set addon refs to null after dispose to prevent double-dispose

**Files:**
- `desktop/src/renderer/components/terminal/TerminalInstance.tsx` — scrollback cap + disposal order

**Done when:** Scrollback never exceeds 10K regardless of user settings. Disposal is clean with no console errors.

---

#### breadcrumb-8vj.4: Verify DEC 2026 and resize debounce

**What:** Verify that xterm.js native DEC mode 2026 (synchronized output) works correctly with Claude Code, and add horizontal resize debounce for large buffers.

**Implementation:**
1. Verify: Run Claude Code, check that `terminal.modes.synchronizedOutputMode` toggles during TUI updates
2. Add resize debounce: For terminals with buffer > 200 lines, debounce horizontal resize at 100ms (VS Code pattern) — vertical is already cheap
3. Test scroll preservation during pane focus switching with active Claude Code session

**Files:**
- `desktop/src/renderer/components/terminal/TerminalInstance.tsx` — resize debounce refinement

**Done when:** Claude Code renders without flickering (DEC 2026 working). Horizontal resize doesn't cause visible reflow artifacts. Scroll position preserved on focus switch.

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Terminal library | Stay on xterm.js 5.5 | Only production-ready option; verified VS Code patterns |
| GPU renderer | WebGL2 via @xterm/addon-webgl | Already in deps; 900% faster than canvas |
| Flow control | pause/resume with 100K/5K watermarks | VS Code's exact constants; ACK in write() callback |
| Synchronized output | No code needed | xterm.js 5.x handles DEC 2026 natively |
| Resize strategy | Keep current (terminal-first → PTY) | Matches VS Code; our order is already correct |
| Scrollback limit | Cap at 10,000 | Memory safety for Claude Code workloads |
| WebGL fallback | Canvas (automatic) | Dispose WebGL on context loss; skip globally if fails |

## Completion Criteria

- [ ] WebGL2 renderer active on terminals (verify via DevTools GPU panel)
- [ ] Claude Code renders without scroll jumping or floating cursors
- [ ] Scrollback through Claude Code output is smooth without lag
- [ ] Flow control prevents renderer overwhelm during burst output
- [ ] Multiple terminals (5+) work without WebGL context exhaustion
- [ ] Shell integration still works (CWD tracking, exit code badges)
- [ ] Theme toggle (dark/light) applies correctly
- [ ] TypeScript compiles with no errors (`npx tsc --noEmit`)

## Sources

**HIGH confidence:**
- VS Code terminal implementation: `src/vs/workbench/contrib/terminal/browser/xterm/xtermTerminal.ts` — WebGL loading pattern
- VS Code flow control: `src/vs/platform/terminal/node/terminalProcess.ts` — pause/resume with watermarks
- VS Code flow control: `src/vs/workbench/contrib/terminal/browser/terminalInstance.ts` — ACK in write callback
- xterm.js source: `src/browser/services/RenderService.ts` — DEC 2026 SynchronizedOutputHandler
- xterm.js addon-webgl README: loading, context loss, disposal
- Context7 xterm.js docs: WebGL addon API, write callback signature

**MEDIUM confidence:**
- Terminal emulator research document (provided by user) — scrollback architecture, flow control recommendations, WebGL context limits
- Mux ghostty-web research — PTY-first resize (turns out to be ghostty-specific, not universal)
