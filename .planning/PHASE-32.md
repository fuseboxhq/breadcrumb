# Phase 32: Terminal & Planning Robustness

**Status:** not_started
**Beads Epic:** breadcrumb-48z
**Created:** 2026-02-20

## Objective

Replace xterm.js with ghostty-web (Ghostty's WASM-based terminal emulator by Coder) to fix persistent rendering issues with complex TUI applications like Claude Code — specifically scroll jumping and floating blinking cursors below output. Simultaneously, harden the PlanningService parser to handle real-world STATE.md format variations (case, status values, phase file locations in subdirectories) so projects like argus-platform display correctly in the planning panel.

## Scope

**In scope:**
- Swap `@xterm/xterm` + all addons for `ghostty-web` as the terminal renderer
- Update `TerminalInstance.tsx` to use ghostty-web's API (should be near drop-in)
- Verify Claude Code renders correctly — no scroll jump, no floating cursor artifacts
- Verify basic terminal functionality: shell, output, input, resize, reconnect/replay
- Reimplement fit-to-container behavior if ghostty-web's addon differs
- Update PTY environment vars if ghostty-web reports a different TERM type
- Harden `PlanningService.parseStateFile()` regex to accept `Phase XX:` (space, mixed case) in addition to `PHASE-XX:` (hyphen, uppercase)
- Accept `(done)` and `(closed)` as valid status values, mapping them to `complete`
- Update `resolvePhaseFile()` to search `.planning/phases/XX-slug/` subdirectories
- Fix argus-platform's `STATE.md` to use canonical `PHASE-XX:` format
- Update argus-platform's `CLAUDE.md` to instruct future sessions to use `PHASE-XX:` format
- Accept `**Current Phase:**` with both `PHASE-XX` and `Phase XX` formats

**Out of scope:**
- Reimplementing terminal search (Cmd+F) — will iterate in a later phase if ghostty-web lacks it
- WebGL addon — ghostty-web has its own renderer
- Clickable URL addon — can be added back later
- Full libghostty native integration (C FFI, napi-rs) — that's a future phase when libghostty stabilizes
- Fixing xterm.js bugs directly — we're replacing it, not patching it
- Migrating argus-platform phase files from `.planning/phases/` subdirectories to root (they stay where they are, the parser adapts)

## Constraints

- ghostty-web v0.4 is the target — verify compatibility with Electron's renderer process
- Must preserve existing PTY backend (node-pty + TerminalService.ts) — only the frontend renderer changes
- Must preserve split pane architecture (react-resizable-panels + splitTree.ts)
- Must preserve shell integration hooks (OSC 133/7) if ghostty-web supports them
- Argus-platform changes are in a separate repo — coordinate carefully

## Research Summary

**ghostty-web** (github.com/coder/ghostty-web):
- Drop-in xterm.js replacement — same `Terminal()`, `open()`, `write()`, `onData()`, `onResize()` API
- Compiles Ghostty's Zig VT100 parser to WASM (~400KB bundle)
- Better VT100 compliance than xterm.js (complex scripts, XTPUSHSGR/XTPOPSGR)
- 60 FPS render loop, only redraws dirty rows
- Has its own addon system (`ITerminalAddon`)
- v0.4.0 (December 2025), actively developed by Coder
- Created for Mux (parallel agentic development desktop app — similar use case to Breadcrumb)

**PlanningService parser issues** (diagnosed from argus-platform):
1. Regex `PHASE-\d+` doesn't match `Phase \d+` (case + separator mismatch)
2. Status `(done)` and `(closed)` not in accepted values `(complete|in_progress|not_started)`
3. `resolvePhaseFile()` only searches `.planning/` root, not `.planning/phases/XX-slug/` subdirectories
4. `**Current Phase:**` regex only accepts `PHASE-XX` format

## Recommended Approach

**Track 1 — ghostty-web swap (tasks 1-3):**
1. Install ghostty-web, remove @xterm/* packages
2. Update TerminalInstance.tsx: swap imports, adapt lifecycle (open, write, resize, dispose)
3. Verify fit behavior, theme application, replay buffer, split panes
4. Test with Claude Code specifically — confirm no scroll jump or floating cursor

**Track 2 — PlanningService hardening (tasks 4-5):**
4. Update parseStateFile() regex + resolvePhaseFile() subdirectory search
5. Fix argus-platform STATE.md + CLAUDE.md

**Track 3 — Verification (task 6):**
6. End-to-end verification across both projects

## Tasks

| ID | Title | Status | Complexity |
|----|-------|--------|------------|
| - | No tasks yet | - | - |

Run `/bc:plan PHASE-32` to break down this phase into tasks.

## Technical Decisions

- **ghostty-web over xterm.js patching**: The persistent rendering issues with Claude Code (scroll jump on focus, floating cursor in empty rows below TUI content) stem from xterm.js's VT100 parser struggling with complex escape sequences. Rather than patch individual symptoms, swap to Ghostty's parser which handles these correctly.
- **ghostty-web over native libghostty**: libghostty-vt's C API isn't stable yet (~March 2026). ghostty-web is available now as WASM and has the same import API as xterm.js, making migration low-risk.
- **Parser flexibility + argus fix**: Belt-and-suspenders approach — make the parser accept real-world variations AND fix the source data. Prevents future projects from hitting the same issue.
- **Subdirectory phase file search**: argus-platform organizes phases in `.planning/phases/XX-slug/` subdirectories. Teaching `resolvePhaseFile()` to search there enables drill-down into historical phases without restructuring the project.

## Completion Criteria

- [ ] ghostty-web renders terminals correctly in Breadcrumb IDE
- [ ] Claude Code runs without scroll jumping or floating cursor artifacts
- [ ] Basic terminal operations work: shell input/output, resize, split panes, reconnect
- [ ] argus-platform phases appear in the Breadcrumb planning panel
- [ ] Clicking an argus phase in the panel shows phase details (including historical phases in subdirectories)
- [ ] TypeScript compiles with no errors (`npx tsc --noEmit`)
