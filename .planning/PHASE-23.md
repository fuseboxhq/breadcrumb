# Phase 23: Breadcrumb Panel Redesign

**Status:** in_progress
**Beads Epic:** breadcrumb-rjx
**Created:** 2026-02-14

## Objective

Redesign the Breadcrumb planning panel (right panel) into a multi-project programme-of-works dashboard. The current panel is a 3-level drill-down (overview → project → phase detail) that scatters data across navigation levels and shows raw markdown dumps. Replace it with a single scrollable dashboard: a compact portfolio header showing all projects at a glance, a phase pipeline for the selected project, and an active task list at the bottom. The user should be able to see status across all their projects and drill into any one without losing context.

## Scope

**In scope:**
- Multi-project portfolio header: compact rows showing every workspace project with status and progress at a glance
- Project selection: clicking a project in the header selects it for the detail view below
- Progress summary for selected project (phases done / total, tasks done / total)
- Phase pipeline: vertical stepper with status icons (✓ done, ● active, ○ planned), inline progress bars, task counts
- Inline expand: clicking a phase expands its tasks in-place, grouped by status (ready/in-flight/blocked/done)
- Active task list: bottom section showing tasks that need attention NOW across the selected project
- Apply PHASE-21 design tokens (teal accents, Inter font, softened backgrounds)
- Smooth transitions for expand/collapse, polished empty states

**Out of scope:**
- ROADMAP.md rendering (may be opened separately)
- Modifying the data layer (Beads CLI, IPC handlers, planning file parsing)
- New IPC channels or backend changes
- Changes to other panels (sidebar, terminal, browser)
- Task editing/creation UI (panel remains read-only)

## Constraints

- Frontend design skill active — follow design thinking process for UI tasks
- Must work within the existing right panel architecture (RightPanel.tsx pane system)
- Data comes from existing IPC: `getPlanningCapabilities`, `getPlanningPhases`, `getPlanningPhaseDetail`, `getPlanningBeadsTasks`
- Follow existing patterns: Zustand stores, Tailwind classes, component structure
- Apply PHASE-21 design tokens (teal accent, Inter font, softened backgrounds)
- Panel width is ~400px — all layouts must work in this narrow constraint

## Research Summary

**Overall Confidence:** HIGH

### Architecture Analysis

The current PlanningPanel (`desktop/src/renderer/components/breadcrumb/PlanningPanel.tsx`) implements a 3-level hierarchical navigation with ephemeral state (`DashboardView`). It fetches data via `planningStore` which calls IPC handlers → `PlanningService` → reads `.planning/` markdown files and `.beads/beads.db`. The right panel system supports multiple panes (browser + planning) via `react-resizable-panels`.

**Key files:**
- `PlanningPanel.tsx` — Current 3-level nav UI (~600 lines, will be mostly rewritten)
- `planningStore.ts` — Data cache & fetching (keep as-is, extend selectors)
- `projectsStore.ts` — Project list & active project (keep as-is)
- `appStore.ts` — Right panel layout state (keep as-is)
- `PlanningService.ts` — Backend markdown/DB parsing (keep as-is, no changes)

### Design Patterns

**Portfolio header pattern:** Compact rows (not cards) showing each project with a 1-2px progress bar, phase count, and status icon. Clicking selects for detail view. Inspired by Linear's project list and VS Code's ProjectSwitcher.

**Phase pipeline pattern:** Vertical stepper with status icons (✓/●/○), inline 1-2px progress bars next to task counts, and expand chevrons. Material UI Stepper pattern adapted for dark theme and narrow panels.

**Task grouping pattern:** Group by status (Ready → In Progress → Blocked → Done) with collapsible headers. Color-coded status badges: teal for ready, amber for in-progress, red for blocked, muted for done.

**Empty state pattern:** Specific messages with actionable CTAs. Left-aligned content blocks, subtle icons, direct pathways to fix the empty state.

### Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| Expand/collapse animation | CSS `grid-template-rows: 0fr → 1fr` | Smooth, GPU-accelerated, no JS measurement |
| Progress bars | CSS `width: X%` with transition | Simple, performant, no library needed |
| Project switching | Existing `setActiveProject` in projectsStore | Already wired with persistence |

### Pitfalls

- **3-level accordion nesting**: Projects + phases + tasks = too deep. Use dropdown/header for projects, accordion only for phases
- **Showing all projects simultaneously in detail**: 5 projects × 4 phases = overwhelming. Show portfolio summary + one project detail
- **Progress bars too large**: Use 1-2px inline bars, not 8px blocks — saves vertical space
- **Generic empty states**: Be specific ("No phases planned yet — run `/bc:plan`") not vague ("Nothing here")

## Tasks

| ID | Title | Status | Complexity | Dependencies |
|----|-------|--------|------------|--------------|
| breadcrumb-rjx.1 | Scaffold dashboard layout & portfolio header | open | High | - |
| breadcrumb-rjx.2 | Build phase pipeline component | open | High | rjx.1 |
| breadcrumb-rjx.3 | Build inline task expansion | open | Medium | rjx.2 |
| breadcrumb-rjx.4 | Build active task list section | open | Medium | rjx.2 |
| breadcrumb-rjx.5 | Wire data layer & multi-project switching | open | Medium | rjx.1 |
| breadcrumb-rjx.6 | Polish: empty states, transitions & design tokens | open | Medium | rjx.4, rjx.5 |

### Task Details

**rjx.1 — Scaffold dashboard layout & portfolio header** (High)
Replace the current 3-level `PlanningPanel` with a new single-view dashboard structure:
- **Portfolio header** at the top: compact rows showing all workspace projects. Each row has project name, status icon, phases X/Y done, and a thin progress bar. The active/selected project is highlighted with teal. Clicking a row selects that project for the detail sections below.
- **Dashboard body**: scrollable area below the header containing the phase pipeline and task list sections (initially stubbed as empty placeholders).
- Remove the old `DashboardView` 3-level navigation state. Replace with a simpler `selectedProjectPath` state.
- Keep the existing `PaneHeader` integration (close button, refresh).
- Apply PHASE-21 design tokens throughout.
- Frontend-design skill active.

**rjx.2 — Build phase pipeline component** (High)
Create a `PhasePipeline` component rendered in the dashboard body for the selected project:
- **Vertical stepper layout**: Each phase is a row with:
  - Status icon: ✓ (done, muted), ● (active, teal), ○ (planned, muted)
  - Phase title + ID badge (monospace, small)
  - Task count: "3/7 tasks" with inline 1-2px progress bar
  - Expand chevron (rotates when open)
- **Stepper connector**: Thin vertical line connecting phase rows (accent-secondary for active, muted for others)
- Phases ordered by phase number (PHASE-01 at top)
- Active phases visually emphasized (teal glow, slightly raised background)
- Frontend-design skill active.

**rjx.3 — Build inline task expansion** (Medium)
When a phase row is clicked in the pipeline, expand its tasks in-place:
- Smooth expand animation using CSS grid `0fr → 1fr`
- Tasks grouped by status with collapsible headers:
  - **Ready** (teal badge) — tasks with no blockers
  - **In Progress** (amber badge) — tasks currently being worked on
  - **Blocked** (red badge) — tasks waiting on dependencies
  - **Done** (muted, strikethrough) — completed tasks, collapsed by default
- Each task row: ID (monospace), title, complexity badge
- Clicking a task could show a tooltip or inline detail (stretch goal)
- Frontend-design skill active.

**rjx.4 — Build active task list section** (Medium)
Below the phase pipeline, add an "Active Work" section:
- Shows tasks that need attention NOW across the selected project
- Flat list (not grouped by phase) sorted by priority:
  - Tasks in "ready" state (no blockers, can be started)
  - Tasks in "in_progress" state (currently active)
  - Tasks in "blocked" state (need attention to unblock)
- Each row: phase badge (small), task title, status badge
- Section header with count: "Active Work (5)"
- If no active tasks: designed empty state with actionable message
- Frontend-design skill active.

**rjx.5 — Wire data layer & multi-project switching** (Medium)
Connect the new dashboard components to the existing data layer:
- On mount, call `refreshProject()` for all projects in `useProjects()`
- When selected project changes, fetch its phases and capabilities
- Subscribe to `activeProjectId` changes in projectsStore — auto-select the active project
- When a phase is expanded, fetch its detail and beads tasks on demand
- Handle loading states (skeleton placeholders for each section)
- Handle error states (retry buttons, error messages)
- Add an `auto-refresh` interval (optional — every 30s when panel is visible)

**rjx.6 — Polish: empty states, transitions & design tokens** (Medium)
Final polish pass:
- **Empty states** for each section:
  - No projects: "Add a project folder to get started" + folder icon
  - No phases: "No phases yet — run `/bc:plan` to create one" + clipboard icon
  - No tasks: "Plan this phase to create tasks" + checklist icon
- **Transitions**: expand/collapse animations (150ms ease-out), hover effects on project rows and phase rows
- **Design token audit**: verify all colors use CSS custom properties, no hardcoded values
- **Responsive to panel width**: text truncation, wrapping behavior at narrow widths
- **Accessibility**: keyboard navigation for project/phase selection, focus indicators

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Primary view | Single scrollable dashboard | No drill-down navigation — everything visible in one view |
| Multi-project approach | Portfolio header + selected detail | See all projects at a glance, detail for one at a time |
| Phase visualization | Vertical stepper | Compact, scannable, works in narrow panels |
| Phase interaction | Inline expand | Click to expand tasks in-place, no navigation needed |
| Task grouping | By status (ready/active/blocked/done) | Prioritizes actionability over structure |
| Progress bars | 1-2px inline | Space-efficient, doesn't dominate visual hierarchy |
| Navigation state | Simple selectedProjectPath | Replace 3-level DashboardView with flat selection |
| Design system | PHASE-21 tokens | Teal accents, Inter font, softened palette |
| Data layer | Keep existing, extend selectors | No backend changes, add computed selectors for task grouping |

## Completion Criteria

- [ ] Portfolio header shows all workspace projects with progress at a glance
- [ ] Selecting a project in the header shows its phase pipeline and tasks below
- [ ] Phase pipeline displays all phases with vertical stepper, status icons, and progress
- [ ] Clicking a phase expands its tasks inline with status grouping (ready/in-flight/blocked/done)
- [ ] Active task list shows what needs attention now (ready, in-progress, blocked)
- [ ] Panel updates automatically when active project changes
- [ ] Multi-project switching works smoothly (data loads, no stale state)
- [ ] Design is cohesive with PHASE-21 polish (teal accents, Inter, consistent spacing)
- [ ] Empty states feel designed, not placeholder

## Sources

**HIGH confidence:**
- Current PlanningPanel architecture (direct code analysis)
- planningStore / projectsStore / appStore (direct code analysis)
- PlanningService IPC handlers (direct code analysis)
- Linear, Height, VS Code project management UI patterns (web research)
- Material UI Stepper pattern for vertical pipeline (web research)
