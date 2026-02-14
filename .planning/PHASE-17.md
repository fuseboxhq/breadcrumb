# Phase 17: Sprint 3 — Architecture, Polish & UX Fixes

**Status:** not_started
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

Run `/bc:plan PHASE-17` to break down into tasks.

## Recommended Approach

Group by theme to minimize context switching:

1. **Main thread performance** — M31 (async PlanningService), M33 (adaptive polling), M36 (browser ready signal)
2. **First-run & UX** — M1/M2 (welcome/onboarding), M3 (confirm dialog), M4 (scoped terminals), H8 (extension install UX)
3. **Visual polish** — M22 (terminal theme tokens), M23/M24 (browser bar fixes), M25/M26 (a11y focus rings)
4. **Wiring & small fixes** — M5 (PTY exit), M12 (planning state), M17 (platform shell detection), M41 (extension commands)

## Tasks

| ID | Title | Status | Complexity |
|----|-------|--------|------------|
| - | No tasks yet | - | - |

Run `/bc:plan PHASE-17` to break down this phase into tasks.

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Scope | Sprint 3 medium items from PHASE-15 findings | Continues hardening before new features |
| Async approach | Replace readFileSync with fs.promises in PlanningService | Non-breaking — IPC handlers already async |
| Polling fix | Adaptive interval (slow when idle, fast on activity) | Better than pure event-driven — simpler to implement |
| Terminal theme | CSS custom properties read at init | Single source of truth, theme-ready for future |

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
