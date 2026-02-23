# Phase 33: xterm.js Terminal Hardening

**Status:** not_started
**Beads Epic:** breadcrumb-8vj
**Created:** 2026-02-20

## Objective

Fix all known xterm.js scrollback and rendering issues with Claude Code by applying proven production patterns: WebGL2 GPU rendering (900% faster), PTY flow control to prevent burst output overwhelming the renderer, DEC mode 2026 synchronized output to batch TUI frame updates, PTY-first resize to prevent output clobbering, and intelligent scrollback management. These are the exact techniques used by VS Code, Hyper, and Wave Terminal — all built on xterm.js — to handle demanding TUI applications.

## Scope

**In scope:**
- WebGL2 renderer activation (addon is installed but never loaded!)
- PTY flow control with `pause()`/`resume()` and high-watermark backpressure
- DEC mode 2026 (synchronized output) support for batching Claude Code frame updates
- PTY-first resize strategy (resize backend before frontend, not the reverse)
- WebGL context lifecycle management (16 context limit per Electron process)
- Scrollback tuning (cap at 10,000 for memory safety with Claude Code)
- Proper terminal disposal hygiene (charAtlasCache leak prevention)

**Out of scope:**
- Switching to ghostty-web or any other terminal library
- Terminal search improvements
- PTY host process architecture (VS Code's dedicated process pattern — too much arch change)
- Terminal pop-out windows

## Constraints

- Must preserve existing shell integration (OSC 133/7 for CWD and exit code badges)
- Must preserve existing split pane / multi-terminal architecture
- Must preserve existing theme system and context menu
- All changes must be backward-compatible with existing terminal sessions

## Research Summary

### Problem Analysis

Current TerminalInstance.tsx has these specific gaps:

1. **No WebGL renderer** — `@xterm/addon-webgl` is in package.json (line 21) but never imported or loaded. Using canvas fallback (~900% slower frame rendering).

2. **No flow control** — PTY `onData` at line 424 fires directly into `terminal.write()` with no backpressure. Claude Code generates burst output (thousands of lines in seconds) that overwhelms the renderer, causing frame drops, scroll jumps, and visual artifacts.

3. **No DEC mode 2026** — Claude Code (and tmux) use synchronized output escape sequences (`\x1b[?2026h` / `\x1b[?2026l`) to batch screen updates into a single render frame. Without intercepting these, each escape sequence triggers a separate render pass, causing flickering and the "floating cursor" artifact.

4. **Resize order is backwards** — `fit()` (line 192-194) calls `terminal.resize()` FIRST then `resizeTerminal()` IPC to PTY. Should be: PTY resize → wait → frontend resize. Output formatted for old dimensions renders into already-resized frontend.

5. **Unbounded scrollback** — Uses `settings.scrollback` from user preferences with no upper cap. At 160 cols × 50,000 line scrollback, each terminal consumes ~100MB+. Claude Code fills buffers quickly.

6. **No disposal cleanup for WebGL** — When WebGL is added, must dispose WebGL addon before terminal to prevent GPU context leaks.

### Proven Fixes (from VS Code, Hyper, Wave Terminal)

| Fix | Impact | Evidence |
|-----|--------|----------|
| WebGL2 renderer | 900% faster frame rendering | VS Code default since 2022; Hyper switched from hterm for this |
| Flow control (pause/resume) | Prevents burst output overwhelming renderer | VS Code pty host uses ACK-based flow; 500KB high-watermark documented |
| DEC mode 2026 | Eliminates flickering, batches TUI frames | Anthropic shipped this fix mid-2025; "totally eliminates flickering" |
| PTY-first resize | Prevents output clobbering on resize | Mux's key architectural pattern; prevents misformatted output |
| Scrollback cap 10K | Prevents memory exhaustion | Standard across VS Code, Hyper for heavy workloads |

## Tasks

| ID | Title | Status | Complexity |
|----|-------|--------|------------|
| - | No tasks yet | - | - |

Run `/bc:plan PHASE-33` to break down this phase into tasks.

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Terminal library | Stay on xterm.js 5.5 | Only production-ready option; all Electron terminals use it |
| GPU renderer | WebGL2 via @xterm/addon-webgl | Already in deps, never loaded; 900% faster than canvas |
| Flow control | node-pty pause/resume with 500KB watermark | Prevents Claude Code burst output from overwhelming renderer |
| Synchronized output | DEC mode 2026 interception | Anthropic's own fix for Claude Code flickering |
| Resize strategy | PTY-first | Resize backend before frontend; prevents output clobbering |
| Scrollback limit | Cap at 10,000 | Memory safety; moderate limit for Claude Code workloads |
| WebGL fallback | Canvas for inactive terminals | Stay under 16 WebGL context limit per Electron process |

## Completion Criteria

- [ ] WebGL2 renderer active on all terminals (verify via DevTools GPU panel)
- [ ] Claude Code renders without scroll jumping or floating cursors
- [ ] Scrollback through Claude Code output is smooth without lag
- [ ] Terminal resize works correctly (no output clobbering on pane resize)
- [ ] Flow control prevents renderer overwhelm during burst output
- [ ] Multiple terminals (5+) work without WebGL context exhaustion
- [ ] Shell integration still works (CWD tracking, exit code badges)
- [ ] Theme toggle (dark/light) applies correctly
- [ ] TypeScript compiles with no errors (`npx tsc --noEmit`)
