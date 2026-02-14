# Phase 17: Sprint 3 — Architecture, Polish & UX Fixes

**Status:** in_progress
**Beads Epic:** breadcrumb-elm
**Created:** 2026-02-14

## Objective

Address the remaining medium-priority findings from the PHASE-15 comprehensive review. This covers Sprint 3 from the findings report: async I/O conversions to stop blocking the main thread, terminal polling optimization, first-run UX improvements, visual polish consistency, and small wiring fixes that were deferred from PHASE-16.

## Scope

**In scope:**
- M31: Convert PlanningService to async file I/O (stop blocking main thread)
- M33: Reduce terminal process polling from 200ms fixed to adaptive/event-driven
- M36: Replace BrowserViewManager 50ms setTimeout with explicit ready signal
- M1/M2: First-run experience — onboarding + "Open Project" on welcome screen
- H8: Extension panel "Open Extensions Folder" button + docs link
- M22: Terminal theme — use CSS custom properties instead of hardcoded hex
- M23: Fix browser URL input conflicting font-size classes
- M24: Fix browser nav bar height breaking toolbar hierarchy
- M25: ProjectSwitcher — use button instead of div for clickable rows (a11y)
- M26: Add focus rings on inline action buttons
- M3: Add confirmation dialog on project removal
- M4: TabBar "+" should create terminal scoped to active project
- M17: Shell paths — detect platform instead of hardcoding macOS /bin/zsh
- M5: Terminal PTY exit — show restart option instead of dead pane
- M12: Preserve planning navigation state across panel close/reopen
- M41: Wire extension command execution from renderer UI

**Out of scope:**
- New feature development (editor, AI, git UI, multi-browser)
- Planning mutations from UI (M11, M40 — dedicated phase)
- Full settings UI expansion (M16 — dedicated phase)
- Low-priority polish items (L1-L42)
- Command palette synthetic events refactor (M13 — risky for little gain)
- Layout state store consolidation (M30 — architectural, needs careful planning)

## Constraints

- Follow existing codebase patterns (Zustand stores, IPC handler registration, Tailwind classes)
- All fixes should pass TypeScript strict mode (`tsc --noEmit`)
- No new dependencies unless strictly necessary
- Async conversions must not change IPC API signatures (renderer code shouldn't need changes)
- Visual fixes must follow the Dracula design system from PHASE-08
- Frontend design skill active — follow design thinking process for UI tasks

## Research Summary

**Overall Confidence:** HIGH

All findings are documented in `.planning/research/phase-15-findings.md` with exact file paths and line numbers. Source files verified — all changes are straightforward applications of existing patterns. No external libraries needed.

### Key Patterns

- **Async I/O:** Replace `readFileSync`/`readdirSync`/`existsSync` with `fs.promises` equivalents. IPC handlers are already `async` so this is non-breaking.
- **Adaptive polling:** Replace fixed 200ms `setInterval` with a two-speed approach: 2s idle, 200ms for 5s after process change detected. Or use node-pty's `onData` as an activity signal.
- **Browser ready signal:** Replace 50ms `setTimeout` with `webContents.once('did-finish-load')` or `'dom-ready'` event on the WebContentsView. Apply pending bounds in the callback.
- **CSS theme tokens:** Read `getComputedStyle(document.documentElement).getPropertyValue('--color-xxx')` at terminal init. Map to xterm theme object.
- **Confirm dialog:** Simple inline modal component or `window.confirm()` for MVP. Inline modal matches existing command palette glassmorphism pattern.

### Design Guidance

The `frontend-design` skill will be active during execution of UI tasks (welcome screen, extension panel, confirm dialog, visual polish). Follow design thinking process for these items.

## Tasks

| ID | Title | Status | Complexity | Findings |
|----|-------|--------|------------|----------|
| breadcrumb-elm.1 | Main thread performance: async PlanningService, adaptive polling, browser ready signal | open | High | M31, M33, M36 |
| breadcrumb-elm.2 | First-run UX: welcome Open Project, extension folder button, confirm dialogs, scoped terminals | open | Medium | M1, M2, H8, M3, M4 |
| breadcrumb-elm.3 | Visual polish: terminal theme tokens, browser bar fixes, a11y focus rings | open | Medium | M22, M23, M24, M25, M26 |
| breadcrumb-elm.4 | Wiring fixes: PTY exit restart, planning state persistence, platform shell detection, extension commands | open | Medium | M5, M12, M17, M41 |
| breadcrumb-elm.5 | Cross-cutting: TabBar scoped terminals, ProjectSwitcher a11y, Escape consistency | open | Low | M4, M25, M20 |

### Task Details

**elm.1 — Main thread performance (High)**
Three main-thread blocking patterns to fix:
- **PlanningService (M31):** Replace 2x `readFileSync`, 1x `readdirSync`, 4x `existsSync` with async equivalents (`fs.promises.readFile`, `fs.promises.readdir`, `fs.promises.access`). Methods: `getProjectCapabilities`, `getProjectPhases`, `getPhaseDetail`. All callers are already async IPC handlers.
- **TerminalService polling (M33):** Replace fixed 200ms `setInterval` in `startProcessPolling()` with adaptive: 2s baseline, drop to 200ms for 5s after any `onData` event. Saves CPU when terminals are idle.
- **BrowserViewManager (M36):** Replace `setTimeout(50ms)` in `create()` with `this.view.webContents.once('dom-ready', ...)` to apply pending bounds. Deterministic instead of timing-based.

**elm.2 — First-run UX (Medium)**
- **Welcome screen (M1/M2):** Add "Open Project" quick action to `WorkspaceContent.tsx` welcome view. Uses existing `selectDirectory` IPC + `addProject` store action. Add brief onboarding hint text.
- **Extension panel (H8):** Add "Open Extensions Folder" button to `ExtensionsPanel.tsx` header. Uses `shell.openPath` via new IPC channel or existing `openExternal` with `file://` path.
- **Confirm dialog (M3):** Add confirmation before `removeProject()` in `ProjectSwitcher.tsx`. Simple inline confirm or small modal component.
- **TabBar scoped terminals (M4):** Update `handleNewTerminal` in `TabBar.tsx` to read active project from `projectsStore` and set `projectId` + project name as title. Matches `useGlobalLayoutHotkeys` Cmd+T behavior.

**elm.3 — Visual polish (Medium)**
- **Terminal theme tokens (M22):** In `TerminalInstance.tsx`, replace 24 hardcoded hex values with CSS custom property reads via `getComputedStyle`. Map `--color-background`, `--color-foreground`, Dracula palette vars to xterm theme object.
- **Browser bar fixes (M23/M24):** Remove conflicting `text-sm` + `text-2xs` on URL input. Change nav bar from `h-10` to `h-8` to match other toolbar heights.
- **ProjectSwitcher a11y (M25):** Change clickable rows from `<div>` to `<button>` with proper `role` and keyboard handling.
- **Focus rings (M26):** Add `focus-visible:ring-1 focus-visible:ring-primary/30` to inline action buttons across StatusBar, TabBar, TerminalPanel toolbar, and ExtensionsPanel.

**elm.4 — Wiring fixes (Medium)**
- **PTY exit (M5):** In `TerminalInstance.tsx`, detect terminal exit event and show restart overlay (button to re-create session) instead of leaving a dead pane.
- **Planning state (M12):** Persist planning panel navigation state (selected project, selected phase) in `planningStore` so it survives panel close/reopen. Currently resets to overview on every mount.
- **Platform shell (M17):** Change `defaultShell` in `settingsStore.ts` from hardcoded `/bin/zsh` to `process.env.SHELL || "/bin/zsh"`. Note: TerminalService already handles this at runtime, but the settings UI shows the wrong default.
- **Extension commands (M41):** In `ExtensionsPanel.tsx` detail view, make command list items clickable. Wire onClick to call `executeExtensionCommand(commandId)` via preload API.

**elm.5 — Cross-cutting (Low)**
Leftover items that touch files already modified in other tasks:
- Verify TabBar "+" scoping works end-to-end with working directory (from elm.2)
- Verify ProjectSwitcher keyboard navigation works (from elm.3)
- Quick pass on Escape key consistency: ensure command palette, search overlay, and dropdowns all close on Escape without conflicting

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Scope | Sprint 3 medium items from PHASE-15 findings | Continues hardening before new features |
| Async approach | Replace readFileSync with fs.promises in PlanningService | Non-breaking — IPC handlers already async |
| Polling fix | Adaptive interval (2s idle → 200ms on activity) | Better than pure event-driven — simpler, less coupling |
| Browser ready | `webContents.once('dom-ready')` | Deterministic vs arbitrary 50ms timeout |
| Terminal theme | CSS custom properties read at init | Single source of truth, theme-ready for future |
| Confirm dialog | Inline component (not window.confirm) | Matches existing design system, non-blocking |

## Completion Criteria

- [ ] PlanningService uses async file I/O — no readFileSync calls remain
- [ ] Terminal process detection uses adaptive polling (not fixed 200ms)
- [ ] BrowserViewManager uses explicit ready signal instead of setTimeout
- [ ] Welcome screen has "Open Project" button and basic onboarding guidance
- [ ] Extension panel has "Open Extensions Folder" button
- [ ] Terminal theme reads colors from CSS custom properties
- [ ] All visual polish items (M23-M26) resolved
- [ ] Project removal shows confirmation dialog
- [ ] TabBar "+" creates project-scoped terminal
- [ ] Shell detection works cross-platform (not just macOS)
- [ ] TypeScript strict mode passes with no errors

## Sources

- `.planning/research/phase-15-findings.md` — consolidated findings with file paths and line numbers
- PHASE-16 execution context — patterns established for fix implementation
