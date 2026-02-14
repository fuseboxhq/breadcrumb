# Phase 16: Fix Critical & High-Priority PHASE-15 Findings

**Status:** not_started
**Beads Epic:** breadcrumb-cz3
**Created:** 2026-02-14

## Objective

Address all critical and high-priority findings from the PHASE-15 Desktop IDE Comprehensive Review. This covers Sprints 1 and 2 from the findings report: security vulnerabilities, broken features, keyboard workflow gaps, accessibility issues, and essential wiring fixes. Each fix should be production-quality, following existing codebase patterns.

## Scope

**In scope (Sprint 1 — Quick Wins):**
- C1: Fix path traversal vulnerability in `validatePath()`
- C2: Fix command palette "Show Breadcrumb" / "Show Browser Panel" navigation
- H2: Change default browser URL from `https://` to `http://localhost:3000`
- H3: Make Cmd+W close single-pane terminal tabs
- H4: Add tab switching shortcuts (Cmd+Shift+]/[)
- H6: Fix event listener leak in extensionIpc
- H7: Replace non-null assertions in browserIpc with proper null guards
- H9: StatusBar — render info items as `<span>` not `<button>`
- H10: TabBar — change close `<span>` to `<button>` with aria-label
- H12: Validate URL scheme in `shell.openExternal`
- M37: Remove diagnostic console.log from BrowserViewManager
- M38: Wire StatusBar to actual git branch / extension count (or remove fakes)

**In scope (Sprint 2 — Wiring & UX Fixes):**
- C3: Wire terminal process detection (subscribe to `onTerminalProcessChange`)
- H1: Persist project state across restarts via electron-store
- H5: Add keyboard region focus navigation (Cmd+1/2/3)
- M6: Bind Cmd+T globally for new terminal
- M7: Normalize bare hostnames in browser URL input
- M14: Add sidebar toggle keyboard shortcut
- M19: Add activity bar keyboard shortcuts
- M32: Replace `execSync` with async in GitService
- M35: Improve extension manifest validation
- H11: Move dead IPC channels to separate `types.planned.ts` file

**Out of scope:**
- Sprint 3 items (architecture refactoring, component decomposition, async PlanningService)
- New feature development (editor, AI integration, git UI)
- Visual polish (medium/low findings from the visual sweep)
- Planning mutation support (read/write from IDE)

## Constraints

- Follow existing codebase patterns (Zustand stores, IPC handler registration, Tailwind classes)
- Frontend design skill active — follow design thinking process for UI tasks
- Security fixes (C1, H12) must be thorough — not just patches
- All fixes should pass TypeScript strict mode (`tsc --noEmit`)
- No new dependencies unless strictly necessary

## Research Summary

All findings are already thoroughly documented in `.planning/research/phase-15-findings.md` with file paths, line numbers, descriptions, and recommended fixes. No additional research needed — proceed directly to planning and execution.

## Recommended Approach

Work through items roughly in the sprint order from the findings report:

1. **Security first** — C1 (path traversal) and H12 (openExternal scheme validation)
2. **Broken features** — C2 (cmd palette nav), C3 (process detection wiring)
3. **Keyboard workflow** — H3, H4, H5, M6, M14, M19 (all shortcut additions)
4. **Accessibility** — H9, H10 (semantic HTML fixes)
5. **Error quality** — H6 (event leak), H7 (null guards)
6. **Wiring** — H1 (project persistence), M32 (async git), M35 (manifest validation), H2/M7 (URL fixes)
7. **Cleanup** — M37 (remove debug logging), M38 (StatusBar), H11 (dead code separation)

## Tasks

| ID | Title | Status | Complexity |
|----|-------|--------|------------|
| - | No tasks yet | - | - |

Run `/bc:plan PHASE-16` to break down this phase into tasks.

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Implementation quality | Full, production-grade fixes | Phase is about hardening, not prototyping |
| Sprint scope | Sprints 1+2 from findings report | Covers all critical/high items plus key medium items |
| Security approach | Defense-in-depth | Path validation uses allowlist, not blocklist |
| Dead code handling | Separate file, not delete | Preserves planned feature types for future phases |

## Completion Criteria

- [ ] All 3 critical findings (C1, C2, C3) resolved
- [ ] All 12 high-priority findings (H1-H12) resolved
- [ ] Sprint 2 medium items (M6, M7, M14, M19, M32, M35, M37, M38) resolved
- [ ] TypeScript strict mode passes with no errors
- [ ] No security vulnerabilities in path validation or URL handling
- [ ] Keyboard-driven workflow functional (tab switching, region focus, sidebar toggle, new terminal)
- [ ] Terminal process detection working (process icons, Claude numbering visible)

## Sources

- `.planning/research/phase-15-findings.md` — consolidated findings with file paths and line numbers
- PHASE-15 audit agents (UX flow, feature gap, visual polish, code quality, integration/dead code)
