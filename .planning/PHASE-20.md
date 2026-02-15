# Phase 20: Code Quality & Codebase Health Review

**Status:** not_started
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

Run `/bc:plan PHASE-20` to research this phase and populate this section.

## Recommended Approach

Systematic sweep through the codebase layer by layer:
1. Audit first (find all issues), then fix by category
2. Start with main process (foundation), then preload (bridge), then renderer (UI)
3. Within each layer, handle dead code first (safest), then types, then logic consolidation
4. Verify TypeScript strict mode passes after each task

## Tasks

| ID | Title | Status | Complexity |
|----|-------|--------|------------|
| - | No tasks yet | - | - |

Run `/bc:plan PHASE-20` to break down this phase into tasks.

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Refactoring depth | Moderate | Fix issues + simplify, but preserve existing architecture |
| Scope | Full codebase | Main process, preload, renderer, stores, components, config |
| Behavior changes | None allowed | Pure cleanup — app must work identically after |
| New dependencies | None | Cleanup only, no new tools |

## Completion Criteria

- [ ] No dead code (unused imports, functions, components, types) remains
- [ ] `any` types reduced to only genuinely necessary cases (with comments explaining why)
- [ ] Duplicated logic consolidated where it reduces complexity
- [ ] Naming conventions consistent across the codebase
- [ ] TODO/FIXME/HACK comments resolved or documented as intentional
- [ ] TypeScript strict mode passes with no errors
- [ ] App launches and all features work identically to before the cleanup
