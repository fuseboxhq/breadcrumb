# Phase 04: Phase-Scoped Research Workflow

**Status:** in_progress
**Beads Epic:** breadcrumb-crw
**Created:** 2026-02-05

## Objective

Overhaul the research workflow so that research documents are scoped per phase instead of dumped into a single flat folder. When a new phase is created, Breadcrumb suggests relevant research topics that the user can selectively run. The `/bc:plan` command reads all phase research to inform task breakdown and technical decisions. The web UI Research tab shows only research for the currently selected phase.

## Research Summary

**Overall Confidence:** HIGH

No external libraries needed. This is internal wiring across four layers: server service, API route, frontend hooks/components, and Claude Code commands. All code involved is already well-understood from previous phases.

### Key Patterns

- **Server**: `getResearchDocs(projectPath, phaseId)` reads from `.planning/research/<phaseId>/` directory. Returns empty array if directory doesn't exist (backward compatible).
- **API**: `/api/research?project=...&phase=PHASE-XX` — phase parameter required. Without it, return empty.
- **Frontend**: `useResearch(projectPath, phaseId)` — both params required, query disabled when either is null.
- **Commands**: `/bc:research` derives phase from task's epic parent. `/bc:new-phase` suggests topics after step 5. `/bc:plan` reads research docs in step 2.

### Pitfalls

- **Phase detection in `/bc:research`**: The command receives a task ID, not a phase. Must look up the task's epic parent, then map epic → phase via PHASE file metadata. If the task has no epic parent, fall back to asking the user.
- **Nested layout support**: Research folder path must be `.planning/research/PHASE-XX/` regardless of whether the PHASE file is flat or nested. Research storage is always flat at the top level — don't nest research inside `.planning/phases/*/`.

## Tasks

| ID | Title | Status | Complexity | Dependencies |
|----|-------|--------|------------|--------------|
| breadcrumb-crw.1 | Update server getResearchDocs to accept phaseId and read from phase subfolder | open | Low | - |
| breadcrumb-crw.2 | Update research API route to accept phase query parameter | open | Low | crw.1 |
| breadcrumb-crw.3 | Update frontend useResearch hook and api.ts to pass phaseId | open | Low | crw.2 |
| breadcrumb-crw.4 | Update PhaseDetailView to pass phase ID to Research tab | open | Low | crw.3 |
| breadcrumb-crw.5 | Update bc:research command to write to phase-scoped folder | open | Medium | - |
| breadcrumb-crw.6 | Update bc:new-phase command to suggest research topics after creation | open | Medium | - |
| breadcrumb-crw.7 | Update bc:plan command to read phase research before planning | open | Low | - |

### Dependency Graph

```
crw.1 (Server service) → crw.2 (API route) → crw.3 (Frontend hook) → crw.4 (PhaseDetailView)
crw.5 (bc:research command)     — independent
crw.6 (bc:new-phase command)    — independent
crw.7 (bc:plan command)         — independent
```

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Research storage | `.planning/research/PHASE-XX/` subdirectories | Groups research with phase, clean separation, works with file watchers |
| Doc naming | Kebab-case descriptive names (not task IDs) | Human-readable, browsable in file explorer |
| Legacy flat docs | Ignored in UI | No migration needed, keeps scope small |
| Research tab scoping | Phase-only, no global view | Focused, less noise, matches user's mental model |
| Plan integration | Full read, not just TL;DR | Gives the planner maximum context for decisions |
| Phase detection in research cmd | Look up task's epic → match to PHASE file | Automatic, no manual phase arg needed |
| Research path | Always `.planning/research/PHASE-XX/` | Consistent regardless of flat vs nested PHASE file layout |

## Completion Criteria

- [ ] `/bc:new-phase` suggests 3-5 research topics after phase creation; user selects which to run
- [ ] `/bc:research` saves output to `.planning/research/PHASE-XX/<topic>.md`
- [ ] `/bc:plan` reads all research from phase folder and references findings in planning
- [ ] Server `getResearchDocs()` accepts phase ID and returns only that phase's research
- [ ] Research tab in UI shows only the selected phase's research documents
- [ ] Empty research folder shows "No research documents" with prompt to run `/bc:research`

## Sources

**HIGH confidence:**
- Server service: inspected directly at `server/services/planningService.ts`
- Research route: inspected directly at `server/routes/phases.ts`
- Frontend hooks: inspected directly at `src/hooks/useResearch.ts`, `src/lib/api.ts`
- Commands: inspected directly at `~/.claude/commands/bc/research.md`, `new-phase.md`, `plan.md`
