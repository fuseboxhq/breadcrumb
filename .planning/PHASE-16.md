# Phase 16: Fix Critical & High-Priority PHASE-15 Findings

**Status:** complete
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

**Overall Confidence:** HIGH

All findings are already thoroughly documented in `.planning/research/phase-15-findings.md` with file paths, line numbers, descriptions, and recommended fixes. No additional research needed.

### Task Details

**Task 1 — Security Hardening (cz3.1):** Fix `validatePath()` in `handlers.ts` and `planningIpc.ts` to use allowlist pattern (resolve path, verify it starts with allowed root). Add URL scheme validation (`http:`/`https:` only) in `browserIpc.ts` before calling `shell.openExternal`.

**Task 2 — Fix Broken Features (cz3.2):** (a) Change command palette "Show Breadcrumb"/"Show Browser Panel" from `setSidebarView()` to `addRightPanelPane()`. Also clean up `SidebarView` type to remove vestigial "breadcrumb"/"browser" values. (b) Subscribe to `onTerminalProcessChange` in renderer and wire to `updatePaneProcess` store action. (c) Wire StatusBar to actual git branch via `getGitInfo` IPC, and actual extension count via store/IPC. Remove hardcoded values.

**Task 3 — Keyboard Shortcuts (cz3.3):** Add to `useGlobalLayoutHotkeys` or create dedicated hook: Cmd+W (close tab when single pane), Cmd+Shift+]/[ (tab switching), Cmd+1/2/3 (region focus), Cmd+T (new terminal), Cmd+\ (sidebar toggle), Cmd+Shift+E/T/X (activity bar views). Must prevent shortcuts from reaching terminal PTY when handled.

**Task 4 — Accessibility & Error Quality (cz3.4):** (a) StatusBar: render items as `<span>` when no onClick. (b) TabBar: change close `<span>` to `<button aria-label="Close tab">`. (c) Fix extensionIpc event listener leak — store handler reference for proper removal. (d) Replace all `browserManager!` non-null assertions with explicit null guards returning error responses.

**Task 5 — Browser & URL Fixes (cz3.5):** Change default browser URL from `https://localhost:3000` to `http://localhost:3000` in both `settingsStore.ts` and `SettingsStore.ts`. Add URL normalization in BrowserPanel (prepend `http://` for bare hostnames). Remove all 13 diagnostic `console.log` statements from `BrowserViewManager.ts`.

**Task 6 — Project Persistence & Backend Wiring (cz3.6):** (a) Wire `PROJECT_*` IPC channels to persist projects via electron-store. Restore on app launch. (b) Replace `execSync` with `execFile` (promisified) in `GitService.ts`. (c) Improve extension manifest validation — check `activationEvents`, `extensionDependencies`, `contributes.commands` before casting. (d) Move 30 dead IPC channels + ~20 dead type interfaces from `shared/types/index.ts` to `shared/types/planned.ts`.

### Design Guidance

The `frontend-design` skill will be active during execution of UI tasks (keyboard shortcuts, StatusBar, TabBar). Follow guidelines for consistent interactive states and accessible markup.

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

| ID | Title | Status | Complexity | Dependencies | Findings |
|----|-------|--------|------------|--------------|----------|
| breadcrumb-cz3.1 | Security hardening: path traversal fix + openExternal URL validation | done | Medium | - | C1, H12 |
| breadcrumb-cz3.2 | Fix broken features: cmd palette nav, process detection wiring, StatusBar | done | High | - | C2, C3, M38 |
| breadcrumb-cz3.3 | Keyboard shortcuts: Cmd+W close, tab switching, region focus, Cmd+T, sidebar, activity bar | done | High | - | H3, H4, H5, M6, M14, M19 |
| breadcrumb-cz3.4 | Accessibility & error quality: semantic HTML, event leak, null guards | done | Medium | - | H9, H10, H6, H7 |
| breadcrumb-cz3.5 | Browser & URL fixes: default HTTP, URL normalization, remove debug logging | done | Low | - | H2, M7, M37 |
| breadcrumb-cz3.6 | Project persistence & backend wiring: electron-store, async git, manifest validation, dead code separation | done | High | - | H1, M32, M35, H11 |

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Implementation quality | Full, production-grade fixes | Phase is about hardening, not prototyping |
| Sprint scope | Sprints 1+2 from findings report | Covers all critical/high items plus key medium items |
| Security approach | Defense-in-depth | Path validation uses allowlist, not blocklist |
| Dead code handling | Separate file, not delete | Preserves planned feature types for future phases |

## Completion Criteria

- [x] All 3 critical findings (C1, C2, C3) resolved
- [x] All 12 high-priority findings (H1-H12) resolved
- [x] Sprint 2 medium items (M6, M7, M14, M19, M32, M35, M37, M38) resolved
- [x] TypeScript strict mode passes with no errors
- [x] No security vulnerabilities in path validation or URL handling
- [x] Keyboard-driven workflow functional (tab switching, region focus, sidebar toggle, new terminal)
- [x] Terminal process detection working (process icons, Claude numbering visible)

## Sources

- `.planning/research/phase-15-findings.md` — consolidated findings with file paths and line numbers
- PHASE-15 audit agents (UX flow, feature gap, visual polish, code quality, integration/dead code)
