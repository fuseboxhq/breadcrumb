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

**3 research documents completed (2026-02-12). All HIGH confidence.**

### SQLite & IPC Patterns (`PHASE-12-sqlite-ipc.md`)
- **better-sqlite3 v12.4.1** already installed in monorepo with native module support
- Working reference implementation in `server/services/beadsService.ts` — port to desktop main process
- Use `{ readonly: true, fileMustExist: true }` to prevent accidental writes
- Beads DB schema: `issues`, `dependencies`, `labels`, `comments`, `events` tables + `ready_issues`/`blocked_issues` views
- IPC follows established `ipcMain.handle()` + `{ success, data/error }` pattern

### Planning File Format (`PHASE-12-planning-files.md`)
- STATE.md parsed with regex: `PHASE-XX: Title (status) - X/Y tasks done`
- PHASE-XX.md has 11 sections; tasks stored in markdown table (pipe-delimited)
- Existing `PlanningPanel.tsx` handles basic STATE.md parsing — extend, don't rewrite
- Projects via `projectsStore.ts`: `{ id, name, path, lastOpened, terminalSessions }`
- Missing: PHASE-XX.md parser, Beads DB queries, file listing/discovery IPC

### IPC Architecture (`PHASE-12-ipc-architecture.md`)
- 3-layer pattern: shared types → main handlers → preload bridge
- Modular handler files (one per domain), guard flags, cleanup functions
- Services: stateful (EventEmitter) or stateless (pure functions), singleton exports
- Follow `terminalIpc.ts` pattern for new `planningIpc.ts`
- Check `!mainWindow.isDestroyed()` before `webContents.send()`

## Recommended Approach

**Three layers: data → state → UI.**

1. **Data Layer (Main Process)** — New `PlanningService` in `desktop/src/main/planning/PlanningService.ts`. Stateless service (no EventEmitter needed — read-only, request/response only). Parses STATE.md with enhanced regex, parses PHASE-XX.md task tables, queries `.beads/beads.db` with better-sqlite3. Methods: `getProjectPhases(projectPath)`, `getPhaseDetail(projectPath, phaseId)`, `getBeadsTasks(projectPath, epicId)`, `getProjectCapabilities(projectPath)` (checks for .planning/ and .beads/).

2. **IPC Layer** — New channels in `IPC_CHANNELS` (`planning:get-phases`, `planning:get-phase-detail`, `planning:get-beads-tasks`, `planning:get-capabilities`). Handler in `desktop/src/main/ipc/planningIpc.ts`. Preload bridge additions in `preload/index.ts`.

3. **State Layer (Renderer)** — New `planningStore` (Zustand + immer) that caches phase/task data per project path. Fetches via IPC on mount and manual refresh. Selectors: `useProjectPhases(path)`, `usePhaseDetail(path, phaseId)`.

4. **UI Layer (Components)** — Replace current `PlanningPanel.tsx` with navigable dashboard:
   - **Dashboard shell** — project tabs/selector, refresh button, breadcrumb navigation
   - **ProjectSummaryGrid** — cards for each project showing active phase, progress bars, task counts
   - **PhaseDetail** — full phase view with tasks table, dependency indicators, completion criteria checklist
   - Navigation: Dashboard overview → Phase detail (two levels, keep it simple for MVP)

## Tasks

| ID | Title | Status | Complexity | Depends On |
|----|-------|--------|------------|------------|
| bdi.1 | PlanningService: parse .planning/ files & query .beads/beads.db | done | L | — |
| bdi.2 | IPC channels, handlers & preload bridge for planning data | done | M | bdi.1 |
| bdi.3 | planningStore: Zustand store for caching planning data per project | not_started | M | bdi.2 |
| bdi.4 | Dashboard shell: navigation, project selector & layout | not_started | M | bdi.3 |
| bdi.5 | ProjectSummaryGrid: project overview cards with phase progress | not_started | M | bdi.3 |
| bdi.6 | PhaseDetail: phase drill-down with tasks, deps & completion criteria | not_started | L | bdi.3 |
| bdi.7 | Polish: graceful degradation, error states & design system compliance | not_started | M | bdi.5, bdi.6 |

## Task Details

### bdi.1 — PlanningService: parse .planning/ files & query .beads/beads.db
**Beads:** breadcrumb-kuy.1 | **Complexity:** L

Create `desktop/src/main/planning/PlanningService.ts` — a stateless service class (like GitService) that:

1. **`getProjectCapabilities(projectPath)`** — Checks existence of `.planning/STATE.md` and `.beads/beads.db`. Returns `{ hasPlanning: boolean, hasBeads: boolean }`.

2. **`getProjectPhases(projectPath)`** — Reads and parses `.planning/STATE.md`. Returns array of `{ id, title, status, completedCount, taskCount, isActive }`. Enhanced regex from existing PlanningPanel.tsx. Parses "Active Work" and "Completed Phases" sections.

3. **`getPhaseDetail(projectPath, phaseId)`** — Reads `.planning/PHASE-XX.md` and parses all sections: header metadata (status, beads epic, created), objective, scope (in/out), constraints, tasks table, completion criteria, decisions. Returns structured `PhaseDetail` object.

4. **`getBeadsTasks(projectPath, epicId)`** — Opens `.beads/beads.db` read-only via better-sqlite3. Queries issues under the given epic (via parent-child dependencies). Returns task status, priority, created/updated dates. Uses `ready_issues` view for blocking info.

**Acceptance criteria:**
- [ ] Parses STATE.md correctly for this project (breadcrumb itself)
- [ ] Parses PHASE-11.md and PHASE-12.md task tables
- [ ] Queries beads.db for tasks under an epic
- [ ] Handles missing .planning/ and .beads/ gracefully (returns empty/null, no crash)

### bdi.2 — IPC channels, handlers & preload bridge for planning data
**Beads:** breadcrumb-kuy.2 | **Complexity:** M

Wire up PlanningService to the renderer:

1. **Shared types** — Add to `IPC_CHANNELS` in `shared/types/index.ts`:
   - `PLANNING_GET_CAPABILITIES`, `PLANNING_GET_PHASES`, `PLANNING_GET_PHASE_DETAIL`, `PLANNING_GET_BEADS_TASKS`

2. **IPC handlers** — Create `desktop/src/main/ipc/planningIpc.ts` following `terminalIpc.ts` pattern. Register handlers, validate paths, return `{ success, data/error }`.

3. **Preload bridge** — Add methods to `BreadcrumbAPI` in `preload/index.ts`:
   - `getProjectCapabilities(path)`, `getProjectPhases(path)`, `getPhaseDetail(path, phaseId)`, `getBeadsTasks(path, epicId)`

4. **Registration** — Register in `main/index.ts` with cleanup function.

**Acceptance criteria:**
- [ ] Renderer can call `window.breadcrumbAPI.getProjectPhases(path)` and get data
- [ ] Path validation prevents directory traversal
- [ ] Cleanup function removes all handlers on shutdown

### bdi.3 — planningStore: Zustand store for caching planning data per project
**Beads:** breadcrumb-kuy.3 | **Complexity:** M

Create `desktop/src/renderer/store/planningStore.ts`:

1. **State shape** — Per-project cache: `Record<projectPath, { phases, phaseDetails, capabilities, lastFetched }>`.

2. **Actions** — `fetchPhases(projectPath)`, `fetchPhaseDetail(projectPath, phaseId)`, `refreshProject(projectPath)`, `clearProject(projectPath)`.

3. **Selectors** — `useProjectPhases(path)`, `usePhaseDetail(path, phaseId)`, `useProjectCapabilities(path)`, `useIsLoading(path)`.

4. **Integration** — Auto-fetch phases when projects change in `projectsStore`. Manual refresh via action.

**Acceptance criteria:**
- [ ] Store fetches and caches phase data per project
- [ ] Re-fetch on manual refresh
- [ ] Loading/error states tracked per project
- [ ] No data fetched for projects without .planning/

### bdi.4 — Dashboard shell: navigation, project selector & layout
**Beads:** breadcrumb-kuy.4 | **Complexity:** M

Replace `PlanningPanel.tsx` with a proper dashboard layout:

1. **Dashboard header** — Title ("Breadcrumb"), refresh button, optional project filter/tabs.

2. **Navigation** — Two-level: overview (all projects) → phase detail. Use state-based navigation (no router needed). Breadcrumb trail shows current location.

3. **Layout** — Responsive grid that adapts to sidebar width. Consistent padding, spacing from design system.

4. **Project integration** — Read projects from `projectsStore`. Auto-trigger data fetch for each project on mount.

**Acceptance criteria:**
- [ ] Dashboard renders in the Breadcrumb tab
- [ ] Can navigate between overview and phase detail
- [ ] Breadcrumb navigation shows current location
- [ ] Refresh button triggers data re-fetch

### bdi.5 — ProjectSummaryGrid: project overview cards with phase progress
**Beads:** breadcrumb-kuy.5 | **Complexity:** M

The main dashboard view showing all projects:

1. **Project cards** — One card per workspace project. Shows: project name, active phase name, overall progress (completed/total phases), task completion percentage.

2. **Phase progress bar** — Visual indicator of phase completion (done vs total tasks in active phase).

3. **Capabilities badges** — Show icons for .planning/ and .beads/ availability.

4. **Click to drill down** — Clicking a project card navigates to its phase list.

5. **Empty state** — "No projects in workspace. Add a folder to get started." with link to explorer.

**Acceptance criteria:**
- [ ] Shows one card per workspace project
- [ ] Active phase and progress visible at a glance
- [ ] Cards clickable to drill into phase detail
- [ ] Projects without .planning/ show "No planning data" state
- [ ] Follows Dracula design system

### bdi.6 — PhaseDetail: phase drill-down with tasks, deps & completion criteria
**Beads:** breadcrumb-kuy.6 | **Complexity:** L

Full phase view when clicking into a project:

1. **Phase list** — All phases for the project with status indicators (active/complete/not started). Click to expand.

2. **Phase detail panel** — When a phase is selected, show:
   - Header: phase title, status badge, beads epic link, created date
   - Objective section
   - Tasks table: ID, title, status (with color-coded badges), complexity, dependencies
   - Completion criteria: checklist with checked/unchecked indicators
   - Scope (collapsible): in-scope / out-of-scope bullets

3. **Task status enrichment** — If Beads DB available, merge richer status from beads (comments count, last updated, priority) into the task display.

4. **Back navigation** — Back arrow or breadcrumb to return to project overview.

**Acceptance criteria:**
- [ ] Phase list shows all phases with status indicators
- [ ] Clicking a phase expands to show full detail
- [ ] Tasks table displays with proper status badges
- [ ] Completion criteria shown as checklist
- [ ] Beads data merged when available

### bdi.7 — Polish: graceful degradation, error states & design system compliance
**Beads:** breadcrumb-kuy.7 | **Complexity:** M

Final polish pass:

1. **Error handling** — Network/IPC errors shown as inline alerts, not crashes. Retry button.
2. **Loading states** — Skeleton cards while data loads. Spinner on refresh.
3. **Graceful degradation** — Projects without .planning/ show "Initialize with /bc:init". Projects with .planning/ but no .beads/ show markdown-only data (no task enrichment).
4. **Design system** — Verify all components use Dracula theme tokens. Consistent typography, spacing, border-radius. Hover/active states on interactive elements.
5. **Accessibility** — Keyboard navigation for cards and phase list. Focus indicators.

**Acceptance criteria:**
- [ ] Error states display user-friendly messages
- [ ] Loading skeletons shown while fetching
- [ ] All projects handled regardless of .planning/.beads/ presence
- [ ] Visual consistency with Dracula design system
- [ ] Keyboard navigable

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Data source | .planning/ files + .beads/beads.db | Files provide structure (phases, tasks, descriptions), Beads DB provides richer status and metadata. Best of both worlds. |
| Multi-project approach | Unified dashboard tab | One tab shows all projects. Core value prop of the desktop app is cross-project orchestration. |
| Interactivity | Read-only for this phase | Ship faster, validate the UX, add mutations in a follow-up phase. |
| Project detection | Auto-detect from workspace explorer | Uses the projects already added to the sidebar. No manual folder browsing. |
| MVP scope | Project overview + phase drill-down | Foundation that future views (kanban, timeline) build on. |
| PlanningService type | Stateless (like GitService) | Read-only data, no events needed. Request/response via IPC handle/invoke is sufficient. |
| SQLite library | better-sqlite3 v12.4.1 | Already installed, proven in beadsService.ts, native module handled by electron-forge. |
| Markdown parsing | Regex + string split | Files follow strict convention. AST parsers (remark/unified) are overkill. |
| State management | Zustand + immer (new store) | Consistent with existing stores (appStore, projectsStore). Per-project caching. |
| Navigation | State-based (no router) | Two levels only (overview ↔ detail). Router is overhead for this simple nav. |

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
- Research: `.planning/research/PHASE-12-sqlite-ipc.md` (HIGH confidence)
- Research: `.planning/research/PHASE-12-planning-files.md` (HIGH confidence)
- Research: `.planning/research/PHASE-12-ipc-architecture.md` (HIGH confidence)
