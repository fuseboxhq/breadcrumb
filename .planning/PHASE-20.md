# Phase 20: Code Quality & Codebase Health Review

**Status:** in_progress
**Beads Epic:** breadcrumb-j2o
**Created:** 2026-02-14

## Objective

Perform a comprehensive code quality review and cleanup across the entire desktop IDE codebase after 19 phases of feature development. The goal is to eliminate dead code, resolve inconsistencies, simplify overly complex patterns, consolidate duplicated logic, and improve naming — without changing the app's architecture or behavior. This is a hygiene pass that leaves the codebase cleaner and more maintainable for future development.

## Scope

**In scope:**
- Dead code removal (unused imports, functions, components, types, variables)
- Type safety improvements (reduce `any` usage, add missing interfaces, tighten loose types)
- Consolidate duplicated logic into shared utilities where it meaningfully reduces complexity
- Fix inconsistent patterns (naming conventions, error handling approaches, event patterns)
- Simplify overly complex code (unnecessary abstractions, convoluted control flow)
- Clean up TODO/FIXME/HACK comments — resolve or document as intentional
- Review and clean up IPC channel definitions and handler patterns
- Audit store logic for unnecessary complexity or stale state
- Ensure TypeScript strict mode passes cleanly (no suppression comments hiding real issues)

**Out of scope:**
- Architectural restructuring (no moving modules between main/renderer/preload boundaries)
- New features or behavior changes
- UI/visual changes
- Performance optimization (separate concern)
- Test infrastructure (no test framework exists yet — that's a separate phase)
- Dependency upgrades or replacements
- Build/packaging changes (PHASE-19 just completed that)

## Constraints

- All changes must be behavior-preserving — the app should work identically before and after
- Follow existing project patterns (TypeScript strict, Zustand stores, Electron IPC via preload)
- No new dependencies
- Keep refactoring moderate — simplify and consolidate, but don't restructure modules or move files between directories
- TypeScript strict mode must pass after every task

## Research Summary

**Overall Confidence:** HIGH — codebase audit, no external research needed

Full-codebase audit across main process (14 files), preload (1 file), renderer (20+ components), shared types (3 files), and config. The codebase is generally well-structured with good component organization and appropriate use of Zustand, but has accumulated dead code, duplicated utilities, loose typing, and some over-large components over 19 phases of feature development.

### Key Findings

**Dead code:** `planned.ts` (273 lines of potentially unused types), `GitProvider` type never imported, stale TabBar icon mappings, unused `icon` field on WorkspaceTab.

**Type safety:** 5+ locations using `Record<string, unknown>` where proper types exist (preload settings, planning data, extension capabilities). 3 `as Record<string, unknown>` casts in extension manifest parsing.

**Duplicated logic:** `folderName()` duplicated 3 times (SidebarPanel, TerminalPanel, appStore). ResizeObserver+rAF pattern duplicated in BrowserPanel and DevToolsDock. IPC try/catch `{ success, error }` wrapper repeated ~40 times across 6 handler files.

**Complex components:** CommandPalette has 174 lines of inline command definitions. PlanningPanel's PhaseDetailView is 220 lines rendering 7+ sections. TerminalPanel keyboard handler is 62 lines handling 8+ keybinds.

**Inconsistent patterns:** Event handler naming (`cleanup` vs `unsubscribe` vs unnamed), loading state management (local vs store), collapsed/expanded naming (`collapsed` vs `open`).

### Pitfalls

- **Don't split appStore** — it's a "god object" but splitting is architectural restructuring (out of scope)
- **Don't change IPC channel names** — would require coordinated main+preload+renderer changes
- **Planned types may be intentionally forward-looking** — verify before deleting
- **Test after each task** — TypeScript check + manual app launch

## Tasks

| ID | Title | Status | Complexity | Dependencies |
|----|-------|--------|------------|--------------|
| breadcrumb-j2o.1 | Remove dead code, unused exports, and stale types | open | Medium | - |
| breadcrumb-j2o.2 | Harden type safety: proper types, fix unsafe casts | open | Medium | j2o.1 |
| breadcrumb-j2o.3 | Extract shared utilities: folderName, ResizeObserver hook, IPC wrapper | open | Medium | j2o.1 |
| breadcrumb-j2o.4 | Simplify complex components: extract commands, break down renders | open | Medium | j2o.3 |
| breadcrumb-j2o.5 | Standardize patterns, clean up comments, final verification | open | Low | j2o.4 |

### Task Details

**j2o.1 — Remove dead code, unused exports, and stale types (Medium)**
Sweep all layers for dead code and remove it:
- Audit `src/shared/types/planned.ts` — check every exported type for imports elsewhere. Remove unused ones.
- Remove `GitProvider` type from `src/main/git/GitService.ts` if unused outside the file
- Remove stale `browser`/`breadcrumb` icon mappings from TabBar.tsx
- Remove unused `icon?: string` field from WorkspaceTab in appStore.ts
- Check all extension types in `src/main/extensions/types.ts` — remove any that are only exported but never imported
- Run TypeScript check after all removals

**j2o.2 — Harden type safety: proper types, fix unsafe casts (Medium)**
Replace loose typing with proper interfaces:
- Replace `Record<string, unknown>` in preload with proper types (AppSettings, PhaseDetail, BeadsTask)
- Fix `as Record<string, unknown>` casts in ExtensionManager.ts with type guards
- Fix `globalThis as Record<string, unknown>` in extensionHostWorker.ts with proper type augmentation
- Tighten `capabilities: Record<string, unknown>` in ExtensionsPanel.tsx
- Ensure preload BreadcrumbAPI interface matches actual return types from main process handlers
- Run TypeScript check

**j2o.3 — Extract shared utilities: folderName, ResizeObserver hook, IPC wrapper (Medium)**
Consolidate duplicated logic:
- Create `src/renderer/utils/folderName.ts` — extract from SidebarPanel, TerminalPanel, appStore
- Create `src/renderer/hooks/useResizeObserver.ts` — extract rAF-throttled ResizeObserver from BrowserPanel/DevToolsDock
- Create `src/main/ipc/wrapHandler.ts` — extract try/catch `{ success, error }` wrapper, refactor handler files to use it
- Update all call sites to use shared utilities
- Run TypeScript check

**j2o.4 — Simplify complex components: extract commands, break down renders (Medium)**
Break down over-large component code:
- Extract CommandPalette command definitions to `src/renderer/components/command/commandDefinitions.ts`
- Extract PlanningPanel's PhaseDetailView subsections into smaller components (PhaseHeader, PhaseTasksSection, etc.)
- Extract TerminalPanel's keyboard handler into named callbacks or a keybinding map
- Extract SidebarPanel's terminal tree-building logic into a helper function
- Run TypeScript check

**j2o.5 — Standardize patterns, clean up comments, final verification (Low)**
Final consistency pass:
- Standardize event handler cleanup naming (prefer `cleanup` or `unsubscribe` consistently)
- Resolve or document TODO/FIXME/HACK comments (4 found in audit)
- Add brief comments to fragile patterns (Strict Mode generation counter, settingsRef pattern)
- Final TypeScript strict check
- Manual app launch and verification (terminals, browser, settings, planning panel)

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Refactoring depth | Moderate | Fix issues + simplify, but preserve existing architecture |
| Scope | Full codebase | Main process, preload, renderer, stores, components, config |
| Behavior changes | None allowed | Pure cleanup — app must work identically after |
| New dependencies | None | Cleanup only, no new tools |
| appStore splitting | Not doing | Out of scope — would be architectural restructuring |
| IPC channel renaming | Not doing | Would require coordinated multi-layer changes |
| Shared utility location | `src/renderer/utils/` and `src/renderer/hooks/` | Follow existing patterns |
| IPC wrapper location | `src/main/ipc/wrapHandler.ts` | Co-located with handlers |

## Completion Criteria

- [ ] No dead code (unused imports, functions, components, types) remains
- [ ] `any` types reduced to only genuinely necessary cases (with comments explaining why)
- [ ] Duplicated logic consolidated where it reduces complexity
- [ ] Naming conventions consistent across the codebase
- [ ] TODO/FIXME/HACK comments resolved or documented as intentional
- [ ] TypeScript strict mode passes with no errors
- [ ] App launches and all features work identically to before the cleanup

## Sources

**HIGH confidence:**
- `.planning/research/phase-20-code-quality.md` — full codebase audit findings
- Codebase audit of `desktop/src/` — 3 parallel agents audited main, renderer, and shared types
