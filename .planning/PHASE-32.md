# Phase 32: Terminal & Planning Robustness

**Status:** in_progress
**Beads Epic:** breadcrumb-48z
**Created:** 2026-02-20

## Objective

Replace xterm.js with ghostty-web (Ghostty's WASM-based terminal emulator by Coder) to fix persistent rendering issues with complex TUI applications like Claude Code — specifically scroll jumping and floating blinking cursors below output. Simultaneously, harden the PlanningService parser to handle real-world STATE.md format variations (case, status values, phase file locations in subdirectories) so projects like argus-platform display correctly in the planning panel.

## Research Summary

**Overall Confidence:** MEDIUM — ghostty-web is a young library (v0.4) but purpose-built for this exact use case (Mux, a parallel agentic development app). The API is near-identical to xterm.js with two critical gaps that need workarounds.

### ghostty-web API Compatibility

ghostty-web is a near drop-in replacement for xterm.js. The constructor, events, buffer API, FitAddon, write/writeln, dispose, and theme interface are all compatible. However, two gaps require explicit handling:

**Gap 1: No `parser.registerOscHandler()`**
ghostty-web's VT parsing happens entirely inside the Ghostty WASM core and is not extensible from JavaScript. Our shell integration (`useShellIntegration.ts`) registers custom handlers for OSC 133 (command boundaries) and OSC 7 (working directory). These won't work.

**Solution:** Build a lightweight OSC parser shim that intercepts the raw data stream *before* it reaches `terminal.write()`. The shim scans for `\x1b]133;` and `\x1b]7;` sequences, extracts the payload, fires callbacks, then passes the full data through to the terminal. This is the same approach used by VS Code's terminal integration when the terminal backend doesn't support custom handlers.

**Gap 2: `buffer.active.viewportY` / `baseY` return 0**
ghostty-web tracks viewport scroll position on the Terminal class itself (`terminal.getViewportY()`) rather than on the buffer object.

**Solution:** Replace `buf.viewportY` / `buf.baseY` reads with `terminal.getViewportY()` and `terminal.getScrollbackLength()`. The auto-scroll logic (`wasAtBottom`) needs to use these instead.

**Gap 3: No `refresh()` method**
ghostty-web uses a 60fps dirty-row render loop. No manual refresh is needed.

**Solution:** Remove `terminal.refresh(0, terminal.rows - 1)` call in the activation handler. The auto-renderer handles it.

**Gap 4: Theme changes after `open()` are not fully supported**
Runtime theme updates may not apply reliably.

**Solution:** Re-create the terminal on theme change (dark/light toggle), or apply theme at construction time only. Since theme changes are infrequent (user toggles dark/light mode), recreation is acceptable.

**Gap 5: `init()` required before Terminal construction**
ghostty-web needs a one-time `await init()` to load the WASM module.

**Solution:** Call `init()` once at app startup (e.g., in `App.tsx` or a module-level lazy init wrapper). All Terminal instances created after init() resolves.

### Recommended Stack

| Library | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| ghostty-web | ^0.4.0 | Terminal renderer (WASM) | MEDIUM |
| node-pty | ^1.0.0 | PTY backend (unchanged) | HIGH |
| react-resizable-panels | ^2.1.7 | Split panes (unchanged) | HIGH |

### Key Patterns

- **OSC shim pattern**: Intercept raw PTY data before terminal.write(). Scan for ESC ] sequences with a state machine. Extract payload, fire callback, pass data through. Must handle sequences split across write() calls (buffering partial sequences).
- **WASM init pattern**: Module-level `let initPromise: Promise<void> | null = null; export function ensureGhosttyInit() { if (!initPromise) initPromise = init(); return initPromise; }` — called before first terminal creation.
- **Theme at construction**: Build theme object before `new Terminal()`, don't rely on runtime `terminal.options.theme = ...`.

### Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| VT100 parsing | ghostty-web WASM core | Ghostty has superior escape sequence handling vs xterm.js |
| FitAddon | ghostty-web's built-in FitAddon | Same API, import from `ghostty-web` directly |
| OSC detection in raw stream | Simple state machine (not regex) | ESC sequences can span write() boundaries |

### Pitfalls

- **Partial OSC sequences**: PTY data arrives in arbitrary chunks. An OSC 133 sequence like `\x1b]133;D;0\x07` could be split as `\x1b]133;D;` in one write and `0\x07` in the next. The shim must buffer partial sequences.
- **Search regression**: ghostty-web has no search addon. Cmd+F will stop working. Explicitly out of scope — will address in a follow-up phase.
- **CSS import**: xterm.js requires `@xterm/xterm/css/xterm.css`. ghostty-web may have its own CSS or none. Remove the old import, check if ghostty-web needs one.
- **`.xterm-helper-textarea` selector**: The focusTerminal() function queries for `.xterm-helper-textarea`. ghostty-web may use a different class name or structure. Need to check and adapt.
- **`allowProposedApi` option**: Used in current xterm.js constructor. Not relevant for ghostty-web — remove it.

## Tasks

| ID | Title | Status | Complexity | Dependencies |
|----|-------|--------|------------|--------------|
| breadcrumb-48z.1 | Install ghostty-web, remove @xterm/* packages | done | Low | - |
| breadcrumb-48z.2 | Build OSC parser shim for shell integration | done | High | .1 |
| breadcrumb-48z.3 | Migrate TerminalInstance.tsx to ghostty-web API | done | High | .1, .2 |
| breadcrumb-48z.4 | Adapt scroll, theme, and settings management | done | Medium | .3 |
| breadcrumb-48z.5 | Harden PlanningService parser and phase file resolution | done | Medium | - |
| breadcrumb-48z.6 | Fix argus-platform STATE.md and CLAUDE.md | done | Low | .5 |

### Task Details

#### breadcrumb-48z.1: Install ghostty-web, remove @xterm/* packages

**What:** Remove `@xterm/xterm`, `@xterm/addon-fit`, `@xterm/addon-search`, `@xterm/addon-webgl`, `@xterm/addon-web-links`, `@xterm/addon-unicode11` from `desktop/package.json`. Install `ghostty-web`. Run `npm install`.

**Files:**
- `desktop/package.json` — swap dependencies

**Done when:** `ghostty-web` is in dependencies, all `@xterm/*` packages removed, `npm install` succeeds.

---

#### breadcrumb-48z.2: Build OSC parser shim for shell integration

**What:** Create a lightweight data interceptor that scans raw PTY output for OSC 133 and OSC 7 sequences before passing data to the terminal. This replaces `terminal.parser.registerOscHandler()` which ghostty-web doesn't support.

**Architecture:**
```
PTY data → oscShim.process(data) → { callbacks fired, data passed through to terminal.write() }
```

The shim is a class with:
- `process(data: string): string` — scans for OSC sequences, fires callbacks, returns data unchanged
- `onOsc133(callback: (data: string) => void)` — register OSC 133 handler
- `onOsc7(callback: (data: string) => void)` — register OSC 7 handler
- Internal buffer for partial sequences that span write() boundaries
- State machine: NORMAL → ESC_SEEN → OSC_COLLECTING → (fire callback on ST/BEL)

**Files:**
- `desktop/src/renderer/lib/oscShim.ts` — NEW: OSC interceptor class
- `desktop/src/renderer/hooks/useShellIntegration.ts` — Refactor to use oscShim instead of `terminal.parser.registerOscHandler()`

**Done when:** OSC 133 A/B/C/D and OSC 7 sequences are detected from raw data and callbacks fire correctly. Shell integration hook works without depending on xterm.js parser API.

---

#### breadcrumb-48z.3: Migrate TerminalInstance.tsx to ghostty-web API

**What:** Rewrite the terminal creation and lifecycle in TerminalInstance.tsx to use ghostty-web.

**Key changes:**
1. **Imports**: `import { init, Terminal, FitAddon } from "ghostty-web"` (remove all `@xterm/*` imports)
2. **CSS**: Remove `import "@xterm/xterm/css/xterm.css"` — check if ghostty-web needs its own
3. **WASM init**: Call `await init()` before first `new Terminal()` — use module-level lazy init
4. **Constructor**: Remove `allowProposedApi`, keep `cursorBlink`, `cursorStyle`, `fontSize`, `fontFamily`, `theme`, `scrollback`
5. **Remove Unicode11Addon** — ghostty-web handles Unicode natively via its Zig core
6. **Remove WebLinksAddon** — out of scope, can add back later
7. **Remove SearchAddon** — out of scope, search UI will be hidden/disabled
8. **Shell integration**: Wire up the new OSC shim from task .2 in the data flow
9. **Data flow**: `PTY data → oscShim.process(data) → terminal.write(data)` instead of direct write
10. **Focus**: Check if `.xterm-helper-textarea` selector still works or needs updating for ghostty-web's DOM structure
11. **TerminalSearch**: Temporarily disable or show "not available" since search addon doesn't exist

**Files:**
- `desktop/src/renderer/components/terminal/TerminalInstance.tsx` — Major rewrite
- `desktop/src/renderer/components/terminal/TerminalSearch.tsx` — Disable/hide (no search addon)

**Done when:** Terminal opens, renders shell output, accepts input, resizes correctly, shell integration (CWD tracking, exit codes) works via OSC shim.

---

#### breadcrumb-48z.4: Adapt scroll, theme, and settings management

**What:** Fix the activation/focus handler, auto-scroll logic, theme application, and live settings updates for ghostty-web's differences.

**Key changes:**
1. **Remove `terminal.refresh()`** — ghostty-web auto-renders at 60fps, no manual refresh needed
2. **Auto-scroll logic**: Replace `buf.baseY === buf.viewportY` with ghostty-web's viewport API:
   - Use `terminal.getViewportY()` for current scroll position
   - Use `terminal.getScrollbackLength()` for total scrollback
   - `wasAtBottom = getViewportY() >= getScrollbackLength() - rows` (approximately)
3. **Scroll preservation on focus**: Replace `buf.viewportY` save/restore with `terminal.getViewportY()` / `terminal.scrollToLine()`
4. **Theme**: Apply theme at construction time. On dark/light toggle, dispose and recreate the terminal (reconnect to existing PTY session via replay buffer)
5. **Live settings**: `fontSize`, `fontFamily`, `cursorBlink`, `cursorStyle` — check if ghostty-web supports runtime option changes. If not, recreate terminal.
6. **scrollback option**: Verify ghostty-web accepts runtime scrollback changes

**Files:**
- `desktop/src/renderer/components/terminal/TerminalInstance.tsx` — Scroll/theme/settings logic

**Done when:** No scroll jump when clicking into a pane running Claude Code. Theme toggles work. Font size changes apply.

---

#### breadcrumb-48z.5: Harden PlanningService parser and phase file resolution

**What:** Make `parseStateFile()` and `resolvePhaseFile()` handle real-world format variations.

**Parser changes:**
1. **Phase ID regex**: Accept both `PHASE-\d+` and `Phase \d+` formats. Normalize to `PHASE-XX`.
   ```
   /^(?:PHASE-|Phase\s+)(\d+):\s+(.+?)\s+\((complete|done|closed|in_progress|not_started)\)/
   ```
2. **Status mapping**: Map `done` → `complete`, `closed` → `complete`
3. **Current Phase regex**: Accept both `PHASE-XX` and `Phase XX` in `**Current Phase:**` line
4. **List prefix**: Allow optional `- ` prefix before the phase line (for lines like `- PHASE-24: ...`)

**Phase file resolution:**
5. **Subdirectory search**: After checking `.planning/PHASE-XX.md` and `.planning/PHASE-XX-*.md`, also search in `.planning/phases/` for subdirectories matching the phase number:
   - Scan `.planning/phases/` for directories starting with `XX-` (e.g., `24-fraud-intelligence-hub`)
   - Look for any `.md` file inside that starts with `PHASE-` or is the primary planning doc
   - Pattern: `.planning/phases/{number}-{slug}/PHASE-{number}.md`

**Files:**
- `desktop/src/main/planning/PlanningService.ts` — `parseStateFile()` (line 214), `resolvePhaseFile()` (line 110), current phase regex (line 221)

**Done when:** argus-platform's STATE.md parses correctly — all phases appear with correct status. Phase detail drill-down works for phases stored in both root `.planning/` and `.planning/phases/XX-slug/` subdirectories.

---

#### breadcrumb-48z.6: Fix argus-platform STATE.md and CLAUDE.md

**What:** Update argus-platform's files to use canonical format going forward.

**STATE.md changes:**
1. Rename all `Phase XX:` entries to `PHASE-XX:` format in the Active Work section
2. Replace `(done)` with `(complete)` for completed phases
3. Keep the detailed descriptions and task counts intact

**CLAUDE.md changes:**
4. Add instruction to use `PHASE-XX:` format (uppercase, hyphen) in STATE.md
5. Add instruction to use `(complete|in_progress|not_started)` status values only

**Files:**
- `/Users/krsecurity/Repositories/argus/argus-platform/.planning/STATE.md`
- `/Users/krsecurity/Repositories/argus/argus-platform/.claude/CLAUDE.md` (or equivalent instructions file)

**Done when:** argus-platform STATE.md uses canonical format. CLAUDE.md instructs future sessions to maintain the format.

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Terminal renderer | ghostty-web over xterm.js patching | Ghostty's Zig VT100 parser handles complex TUI escape sequences (Claude Code) correctly where xterm.js doesn't. Same API surface minimizes migration risk. |
| OSC handling | Data stream interception shim | ghostty-web doesn't expose parser.registerOscHandler(). Intercepting raw PTY data before terminal.write() is the established pattern (VS Code uses this approach). |
| Theme changes | Recreate terminal on toggle | ghostty-web warns theme changes after open() aren't fully supported. Since theme toggles are rare, recreation with PTY replay is acceptable. |
| Search | Temporarily disabled | ghostty-web has no search addon. Explicitly out of scope — ship rendering fix first, iterate search later. |
| Parser flexibility | Accept variations + fix source | Belt-and-suspenders: parser handles real-world formats AND argus-platform is updated to canonical format. |

## Completion Criteria

- [ ] ghostty-web renders terminals correctly in Breadcrumb IDE
- [ ] Claude Code runs without scroll jumping or floating cursor artifacts
- [ ] Basic terminal operations work: shell input/output, resize, split panes, reconnect
- [ ] Shell integration works (CWD tracking, exit code badges) via OSC shim
- [ ] argus-platform phases appear in the Breadcrumb planning panel
- [ ] Clicking an argus phase shows phase details (including phases in subdirectories)
- [ ] TypeScript compiles with no errors (`npx tsc --noEmit`)

## Sources

**HIGH confidence:**
- [coder/ghostty-web GitHub](https://github.com/coder/ghostty-web) — source code analysis of Terminal class, FitAddon, Buffer API, events
- [DeepWiki: coder/ghostty-web](https://deepwiki.com/coder/ghostty-web) — API documentation
- Current codebase: TerminalInstance.tsx, useShellIntegration.ts, PlanningService.ts

**MEDIUM confidence:**
- [ghostty-web npm](https://www.npmjs.com/package/ghostty-web) — v0.4.0 release, December 2025
- [Libghostty Is Coming - Mitchell Hashimoto](https://mitchellh.com/writing/libghostty-is-coming) — architecture context
- Hacker News discussion on ghostty-web — community usage reports
