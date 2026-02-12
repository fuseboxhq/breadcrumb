# Phase 12: Breadcrumb Dashboard Integration

**Status:** not_started
**Beads Epic:** breadcrumb-kuy
**Created:** 2026-02-12

## Objective

Transform the Breadcrumb tab from a minimal STATE.md reader into a unified multi-project dashboard that shows phases, tasks, and progress across all initialized projects in the workspace. The dashboard should feel like a proper planning hub inside the IDE — the place you go to see what's happening across all your projects at once. This phase builds the foundation (project overview + phase drill-down); future phases will add kanban boards, timeline views, and interactive mutations.

## Scope

**In scope:**
- Unified dashboard showing ALL projects added to the workspace explorer
- Project overview cards with phase progress summaries
- Phase drill-down: click a phase to see its tasks, status, dependencies, and completion criteria
- Data from both `.planning/` markdown files AND `.beads/beads.db` SQLite database
- IPC service to read `.planning/` files and query Beads DB from the main process
- Project-level filtering/switching within the single dashboard tab
- Auto-detect projects from the workspace explorer (no manual folder selection)
- Read-only in this phase — all mutations still via CLI (`/bc` commands)
- Responsive layout that works with sidebar open or collapsed

**Out of scope:**
- Kanban/board view (future phase)
- Timeline/Gantt/roadmap view (future phase)
- Creating or editing phases from the UI (future phase — read-only first)
- Updating task status from the UI (future phase)
- Cross-project dependency tracking
- Beads CLI integration within the UI (still use terminal)
- Real-time file watching / live reload (manual refresh is fine for MVP)

## Constraints

- Frontend design skill active — follow design thinking process for UI tasks
- Must work with the existing workspace/project system from PHASE-10 (projects store, sidebar explorer)
- Data access via IPC only — renderer cannot access filesystem or SQLite directly
- Parse `.planning/STATE.md` for phase overview, `PHASE-XX.md` for task details
- Query `.beads/beads.db` for richer task status data (if Beads is initialized in the project)
- Graceful degradation: projects without `.planning/` or `.beads/` should still appear (just with less data)
- Follow the Dracula-inspired design system established in PHASE-08
- Must natively support multiple projects simultaneously — this is the core value proposition of the desktop app

## Research Summary

Run `/bc:plan PHASE-12` to research this phase and populate this section.

## Recommended Approach

**Three layers: data → state → UI.**

1. **Data Layer (Main Process)** — New `PlanningService` in the main process that reads `.planning/` files and queries `.beads/beads.db`. Exposes IPC endpoints: `getProjectPhases(projectPath)`, `getPhaseDetail(projectPath, phaseId)`, `getTaskDetail(projectPath, taskId)`. Handles parsing STATE.md, PHASE-XX.md markdown, and SQLite queries.

2. **State Layer (Renderer)** — New `planningStore` (Zustand) that caches phase/task data per project. Fetches via IPC on mount and refresh. Provides selectors for the UI: `useProjectPhases(projectPath)`, `usePhaseDetail(phaseId)`, etc.

3. **UI Layer (Components)** — Replace the current `PlanningPanel.tsx` with a proper dashboard:
   - **ProjectSummaryGrid** — cards for each project showing active phase, progress, task counts
   - **PhaseList** — expandable phase cards with task breakdown
   - **PhaseDetail** — full phase view with tasks table, dependencies, completion criteria, research notes
   - **TaskDetail** — task description, status, complexity, blocked-by info

**Navigation flow:** Dashboard (all projects) → Project phases → Phase detail → Task detail

## Tasks

| ID | Title | Status | Complexity |
|----|-------|--------|------------|
| - | No tasks yet | - | - |

Run `/bc:plan PHASE-12` to break down this phase into tasks.

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Data source | .planning/ files + .beads/beads.db | Files provide structure (phases, tasks, descriptions), Beads DB provides richer status and metadata. Best of both worlds. |
| Multi-project approach | Unified dashboard tab | One tab shows all projects. Core value prop of the desktop app is cross-project orchestration. |
| Interactivity | Read-only for this phase | Ship faster, validate the UX, add mutations in a follow-up phase. |
| Project detection | Auto-detect from workspace explorer | Uses the projects already added to the sidebar. No manual folder browsing. |
| MVP scope | Project overview + phase drill-down | Foundation that future views (kanban, timeline) build on. |

## Completion Criteria

- [ ] Breadcrumb tab shows a unified dashboard with all workspace projects
- [ ] Each project card displays phase progress summary (active phase, completion %)
- [ ] Clicking a project shows its phases with task counts and status
- [ ] Clicking a phase shows full detail: tasks, dependencies, completion criteria
- [ ] Data sourced from both `.planning/` files and `.beads/beads.db` where available
- [ ] Projects without `.planning/` or `.beads/` degrade gracefully (shown but with limited data)
- [ ] Dashboard works with the existing project system from the sidebar explorer
- [ ] Follows the Dracula-inspired design system

## Sources

- PHASE-10: Workspace Sidebar Overhaul (project management patterns)
- PHASE-08: Desktop IDE Visual & UX Overhaul (design system)
- Existing `PlanningPanel.tsx` (current proof-of-concept)
- Existing `projectsStore.ts` (project data model)
