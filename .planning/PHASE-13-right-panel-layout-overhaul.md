# Phase 13: Right Panel Layout Overhaul

**Status:** not_started
**Beads Epic:** breadcrumb-pli
**Created:** 2026-02-12

## Objective

Restructure the desktop app from a 2-column layout (sidebar + workspace) into a proper 3-column IDE layout: ActivityBar | Center Terminal Panes | Right Panel (browser + planning). The center column becomes a dedicated terminal workspace with splittable panes, while the browser and Breadcrumb planning dashboard move to a collapsible right panel that can itself be split into stacked panes. This eliminates the current awkward tab-mixing where terminals, browser, and planning all compete for the same workspace area.

## Scope

**In scope:**
- Restructure AppShell to 3-column layout: ActivityBar | Center | Right Panel
- Center column: terminal-only workspace with existing split pane support
- Right panel: splittable panes for browser and planning dashboard content
- Right panel collapses to zero width when empty, expands when content opens
- Sidebar keeps all current views (explorer, terminals list, breadcrumb, browser, extensions, settings) — clicking breadcrumb/browser entries in sidebar opens content in the right panel
- Resize handles between center and right panel (react-resizable-panels)
- Hotkey to toggle right panel visibility
- Animated transitions for panel open/close
- Persist layout state (panel sizes, what's open) across sessions
- Keyboard navigation between all panels (center, right, sidebar)
- Design system compliance (Dracula theme)
- Remove the tab bar system for content routing — center is always terminals, right panel handles browser/planning

**Out of scope:**
- Drag-to-reorder panes (future enhancement)
- Floating/detached panels
- New content types beyond what exists (terminal, browser, planning)
- Changes to the planning dashboard itself (PHASE-12 handles that)
- Changes to the terminal split pane logic (PHASE-11 handles that)
- Mobile/responsive layout (desktop only)

## Constraints

- Frontend design skill active — follow design thinking process for UI tasks
- Must preserve existing terminal split pane functionality from PHASE-11
- Must preserve existing planning dashboard from PHASE-12
- Must work with react-resizable-panels (already installed)
- Sidebar breadcrumb/browser entries become launchers for right panel content, not sidebar panel replacements
- Layout state persistence should use the existing settingsStore/IPC pattern from PHASE-09
- Keep the ActivityBar as-is — it controls sidebar views, not the right panel

## Research Summary

Run `/bc:plan PHASE-13` to research this phase and populate this section.

## Recommended Approach

The core architectural change is splitting the current `Workspace` panel into two: a center terminal area and a right content panel. The `AppShell` PanelGroup goes from `[Sidebar | Workspace]` to `[Sidebar | Center | RightPanel]`. The tab system (`TabBar` + `WorkspaceContent`) gets replaced with direct terminal rendering in center and a new `RightPanel` component that manages browser/planning panes.

Key architectural decisions:
1. **Center column** renders terminal panes directly (no tab bar needed — it's always terminals)
2. **Right panel** has its own pane management (vertical split for stacking browser + planning)
3. **Sidebar entries** for breadcrumb/browser become "open in right panel" actions instead of sidebar views
4. **State management** needs a new `layoutStore` or extension of `appStore` to track right panel state (open/closed, panes, sizes)

Run `/bc:plan PHASE-13` to research and break this down into tasks.

## Tasks

| ID | Title | Status | Complexity |
|----|-------|--------|------------|
| - | No tasks yet | - | - |

Run `/bc:plan PHASE-13` to break down this phase into tasks.

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Center column content | Terminals only | Dedicated workspace for terminal panes. No tab mixing — cleaner mental model. |
| Right panel behavior | Collapse when empty | Maximizes center space when not needed. Opens on demand. |
| Right panel panes | Splittable (vertical stack) | Can have browser + planning visible simultaneously, or just one. |
| Sidebar scope | Keep all views | Sidebar entries for breadcrumb/browser become launchers for right panel. Familiar icon → content association. |
| Tab system | Remove | Replaced by direct content routing — center = terminals, right = browser/planning. Simpler architecture. |
| Layout persistence | settingsStore | Follow existing pattern from PHASE-09 settings persistence. |

## Completion Criteria

- [ ] App uses 3-column layout: ActivityBar | Center (terminals) | Right Panel (browser/planning)
- [ ] Center column renders terminal panes with existing split functionality
- [ ] Right panel supports splittable panes for browser and planning dashboard
- [ ] Right panel collapses when empty, expands when content opens
- [ ] Sidebar breadcrumb/browser entries open content in right panel
- [ ] Hotkey toggles right panel visibility
- [ ] Layout state (sizes, open panes) persists across app restarts
- [ ] Keyboard navigation works between all panels
- [ ] Animated transitions for panel open/close
- [ ] Follows Dracula design system
