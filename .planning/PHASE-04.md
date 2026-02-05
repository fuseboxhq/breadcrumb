# Phase 04: Phase-Scoped Research Workflow

**Status:** not_started
**Beads Epic:** breadcrumb-crw
**Created:** 2026-02-05

## Objective

Overhaul the research workflow so that research documents are scoped per phase instead of dumped into a single flat folder. When a new phase is created, Breadcrumb suggests relevant research topics that the user can selectively run. The `/bc:plan` command reads all phase research to inform task breakdown and technical decisions. The web UI Research tab shows only research for the currently selected phase.

## Scope

**In scope:**
- Phase-scoped research storage: `.planning/research/PHASE-XX/`
- Naming convention for research docs within phase folders
- `/bc:new-phase` suggests 3-5 research topics after phase creation, user picks which to run
- `/bc:research` writes output to `.planning/research/PHASE-XX/<topic>.md` instead of flat folder
- `/bc:plan` reads all research docs from the phase's research folder and incorporates findings
- Server API: `getResearchDocs()` accepts a phase ID and reads from `.planning/research/PHASE-XX/`
- Frontend Research tab fetches and displays only the selected phase's research
- Research route accepts optional `phaseId` query parameter

**Out of scope:**
- Migrating existing flat research docs to phase folders (they stay on disk, just not surfaced)
- Research auto-execution (user picks which topics to run)
- Cross-phase research sharing or linking
- Research quality scoring or ranking

## Constraints

- Research file naming must be human-readable (not just task IDs)
- Must work with both flat `.planning/PHASE-XX.md` and nested `.planning/phases/*/PHASE-XX.md` layouts
- `/bc:research` command must still accept a task ID argument but now also needs phase context
- Backward compatible: projects without `.planning/research/PHASE-XX/` just show empty Research tab

## Research Summary

Run `/bc:plan PHASE-04` to research this phase and populate this section.

## Recommended Approach

1. **Storage**: Research docs live at `.planning/research/PHASE-XX/<topic>.md` where `<topic>` is a kebab-case descriptive name (e.g., `sse-vs-websockets.md`, `auth-library-comparison.md`)
2. **New phase flow**: After creating the phase file and Beads epic, analyze the phase objective/scope and suggest 3-5 research topics. Present with `AskUserQuestion` (multiSelect). Run `/bc:research` for each selected topic, writing to the phase's research folder.
3. **Plan integration**: `/bc:plan` reads all `.md` files from `.planning/research/PHASE-XX/` before planning. Research findings feed into the "Research Summary" section and inform task breakdown.
4. **Server**: `getResearchDocs(projectPath, phaseId)` scans `.planning/research/<phaseId>/`. API route adds optional `?phase=PHASE-XX` parameter.
5. **Frontend**: `useResearch(projectPath, phaseId)` passes phase to the API. Research tab only renders docs for the viewed phase.

## Tasks

| ID | Title | Status | Complexity |
|----|-------|--------|------------|
| - | No tasks yet | - | - |

Run `/bc:plan PHASE-04` to break down this phase into tasks.

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Research storage | `.planning/research/PHASE-XX/` subdirectories | Groups research with phase, clean separation, works with file watchers |
| Doc naming | Kebab-case descriptive names (not task IDs) | Human-readable, browsable in file explorer |
| Legacy flat docs | Ignored in UI | No migration needed, keeps scope small |
| Research tab scoping | Phase-only, no global view | Focused, less noise, matches user's mental model |
| Plan integration | Full read, not just TL;DR | Gives the planner maximum context for decisions |

## Completion Criteria

- [ ] `/bc:new-phase` suggests 3-5 research topics after phase creation; user selects which to run
- [ ] `/bc:research` saves output to `.planning/research/PHASE-XX/<topic>.md`
- [ ] `/bc:plan` reads all research from phase folder and references findings in planning
- [ ] Server `getResearchDocs()` accepts phase ID and returns only that phase's research
- [ ] Research tab in UI shows only the selected phase's research documents
- [ ] Empty research folder shows "No research documents" with prompt to run `/bc:research`
