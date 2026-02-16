# Phase 23: Breadcrumb Panel Redesign

**Status:** not_started
**Beads Epic:** breadcrumb-rjx
**Created:** 2026-02-14

## Objective

Redesign the Breadcrumb planning panel (right panel) into a proper programme-of-works dashboard. The current panel is a scattered data dump of raw phase markdown. Replace it with a combined dashboard: overall progress at the top, phase pipeline in the middle, and an active task list at the bottom — all in a single scrollable view. The panel should be project-aware, automatically showing data for whichever project is active in the workspace.

## Scope

**In scope:**
- Combined dashboard layout: progress summary + phase pipeline + active task list
- Phase pipeline: visual representation of phases (not_started → in_progress → done) with task counts and progress
- Active task list: tasks grouped by status (ready/in-flight/blocked) for the current phase(s)
- Inline expand: clicking a phase expands its tasks in-place within the pipeline
- Project-aware: panel content updates when the active project changes
- Apply the refined design token system from PHASE-21 (teal accents, Inter font, etc.)
- Smooth transitions and polished empty states

**Out of scope:**
- ROADMAP.md rendering (roadmap may be opened separately — not part of this panel redesign)
- Modifying the data layer (Beads CLI, IPC handlers, planning file parsing)
- New features or commands (just the panel UI)
- Changes to other panels (sidebar, terminal, browser)
- Multi-project simultaneous view (panel shows active project only)

## Constraints

- Frontend design skill active — follow design thinking process for UI tasks
- Must work within the existing right panel architecture (RightPanel.tsx pane system)
- Data comes from existing IPC: `getPlanningData`, `getPhaseDetail`, Beads CLI
- Follow existing patterns: Zustand stores, Tailwind classes, component structure
- Apply PHASE-21 design tokens (teal accent, Inter font, softened backgrounds)

## Research Summary

Run `/bc:plan PHASE-23` to research this phase and populate this section.

## Recommended Approach

Run `/bc:plan PHASE-23` to research and define the approach.

## Tasks

| ID | Title | Status | Complexity |
|----|-------|--------|------------|
| - | No tasks yet | - | - |

Run `/bc:plan PHASE-23` to break down this phase into tasks.

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Primary view | Combined dashboard | Progress + pipeline + task list in one scrollable view |
| Phase interaction | Inline expand | Click to expand tasks in-place, keeps single-view UX |
| Project awareness | Active project only | Panel shows data for whichever project is selected |
| Roadmap integration | Separate concern | ROADMAP.md not rendered in this panel — may open differently |
| Design system | PHASE-21 tokens | Teal accents, Inter font, softened palette |

## Completion Criteria

- [ ] Panel shows overall progress (phases done / total, tasks done / total)
- [ ] Phase pipeline displays all phases with status, task counts, and progress indicators
- [ ] Clicking a phase expands its tasks inline with status grouping (ready/in-flight/done)
- [ ] Active task list shows what needs attention now (ready, in-progress, blocked)
- [ ] Panel updates automatically when active project changes
- [ ] Design is cohesive with PHASE-21 polish (teal accents, Inter, consistent spacing)
- [ ] Empty states feel designed, not placeholder
