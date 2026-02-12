# Phase 13: Right Panel Layout Overhaul

**Status:** planned
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

### Current Architecture (from codebase analysis)

The app uses a **2-column layout**: `ActivityBar (48px fixed) | PanelGroup[Sidebar (18%) | Workspace]`. Content routing is tab-based — `WorkspaceContent` switches on `activeTab.type` to render terminal, browser, breadcrumb, or welcome views. Terminal split panes use nested `PanelGroup` within `TerminalPanel`. State is centralized in `appStore` (Zustand + Immer).

**Key files to modify:**
- `AppShell.tsx` — Core layout container, currently `[Sidebar | Workspace]`
- `WorkspaceContent.tsx` — Tab-based content routing (to be simplified)
- `TabBar.tsx` — Tab bar (to be removed/simplified)
- `appStore.ts` — Needs LayoutState extension for right panel
- `SidebarPanel.tsx` — Breadcrumb/browser views become right panel launchers

### react-resizable-panels (research doc: PHASE-13-resizable-panels.md)

- **Imperative API is critical**: Use `ref.collapse()`/`ref.expand()` — do NOT conditionally render panels with JSX
- **Collapsible panels**: Set `collapsible={true}` + `collapsedSize={0}` for panels that hide
- **Nested PanelGroups**: Fully supported — nest vertical `PanelGroup` inside horizontal panel for right panel's browser/planning split
- **Unique autoSaveId**: Each nested PanelGroup needs its own ID
- **No CSS transitions on panels**: Breaks drag-to-resize. Accept instant collapse/expand. Use opacity transitions on inner content wrappers if needed.
- **Stable id + order props**: Required on all panels for persistence and layout stability
- **Current version**: v2.1.9 installed (consider upgrade to v4.6.2 for newer imperative methods like `isCollapsed()`)

### Layout Persistence (research doc: PHASE-13-layout-persistence.md)

- **Don't use `autoSaveId`**: Persists to localStorage, not electron-store. Electron apps need cross-process persistence via IPC.
- **Use `onLayout` callback**: Capture panel sizes → debounce 300ms → write to electron-store via IPC
- **Restore imperatively**: `panelGroupRef.current.setLayout([sizes])` on mount
- **Extend appStore**: Add `LayoutState` with `rightPanel.isOpen`, `rightPanel.panes[]`, `panelSizes`
- **Extend settings schema**: Add `layout` namespace to electron-store schema with defaults and constraints
- **Guard against race condition**: Wait for `settingsLoaded` before rendering PanelGroup
- **Avoid stale closures**: Use `get()` inside debounced timeout, not captured state

## Recommended Approach

The core architectural change is splitting the current `Workspace` panel into two: a center terminal area and a right content panel. The `AppShell` PanelGroup goes from `[Sidebar | Workspace]` to `[Sidebar | Center | RightPanel]`. The tab system (`TabBar` + `WorkspaceContent`) gets replaced with direct terminal rendering in center and a new `RightPanel` component that manages browser/planning panes.

**Target layout:**
```
┌─────────────────────────────────────────────────────┐
│                  TitleBar (h-11)                     │
├──┬────────────────────────────────────────────────── ┤
│AB│ PanelGroup (horizontal)                           │
│  │ ┌──────────┬─┬──────────────┬─┬────────────────┐ │
│  │ │ Sidebar  │R│   Center     │R│  Right Panel   │ │
│  │ │ (18%)    │H│  (terminals) │H│  (collapsible) │ │
│  │ │          │ │              │ │  ┌───────────┐ │ │
│  │ │ explorer │ │  ┌────┬────┐ │ │  │ Browser   │ │ │
│  │ │ terms    │ │  │pane│pane│ │ │  ├───────────┤ │ │
│  │ │ breadcrumb│ │  │ 1  │ 2  │ │ │  │ Planning  │ │ │
│  │ │ browser  │ │  └────┴────┘ │ │  └───────────┘ │ │
│  │ │ settings │ │              │ │                │ │
│  │ └──────────┴─┴──────────────┴─┴────────────────┘ │
├──┴───────────────────────────────────────────────────┤
│                 StatusBar (h-6)                       │
└─────────────────────────────────────────────────────┘
```

**Key architectural decisions:**
1. **Center column** renders terminal panes directly (no tab bar needed — it's always terminals)
2. **Right panel** has its own nested vertical `PanelGroup` for stacking browser + planning
3. **Right panel is always in DOM** — visibility via imperative `collapse()`/`expand()`, not conditional JSX
4. **Sidebar entries** for breadcrumb/browser become "open in right panel" actions
5. **State management** extends `appStore` with `LayoutState` (not a separate store)
6. **Persistence** uses `onLayout` callback → debounced IPC → electron-store (not `autoSaveId`)

## Tasks

| ID | Title | Status | Complexity | Depends On |
|----|-------|--------|------------|------------|
| breadcrumb-pli.1 | Layout state & persistence foundation | done | Medium | — |
| breadcrumb-pli.2 | Restructure AppShell to 3-column layout | done | High | pli.1 |
| breadcrumb-pli.3 | Build RightPanel component with nested panes | done | Medium | pli.2 |
| breadcrumb-pli.4 | Wire sidebar entries to open in right panel | done | Medium | pli.3 |
| breadcrumb-pli.5 | Hotkey toggle & keyboard panel navigation | open | Medium | pli.2 |
| breadcrumb-pli.6 | Layout persistence & restoration | open | Medium | pli.1 |
| breadcrumb-pli.7 | Polish & design system compliance | open | Low | pli.4, pli.5, pli.6 |

### Task Details

**pli.1 — Layout state & persistence foundation**
Add `LayoutState` interface to `appStore` with `rightPanel.isOpen`, `rightPanel.panes[]`, and `panelSizes`. Add `layout` namespace to electron-store settings schema with defaults and min/max constraints. Implement debounced `persistLayout()` helper (300ms). Update `loadSettings()` to deep-merge layout state with defaults.

**pli.2 — Restructure AppShell to 3-column layout**
Change AppShell's `PanelGroup` from `[Sidebar | Workspace]` to `[Sidebar | Center | RightPanel]`. Center panel renders terminal content directly (remove TabBar for tab routing). Right panel is `collapsible` with `collapsedSize={0}`, controlled via `ImperativePanelHandle` ref. Add resize handles between all panels. Keep ActivityBar unchanged.

**pli.3 — Build RightPanel component with nested panes**
Create `RightPanel` component containing a nested vertical `PanelGroup` for browser and planning panes. Track which panes are open in store state. Handle single-pane (full height) and dual-pane (stacked) configurations. Render `BrowserPanel` and `PlanningPanel` as pane content. Auto-collapse right panel when last pane is closed.

**pli.4 — Wire sidebar entries to open in right panel**
Change sidebar breadcrumb/browser click behavior from switching sidebar views to opening corresponding panes in the right panel. ActivityBar breadcrumb icon click → opens planning pane in right panel (and expands right panel if collapsed). Same for browser icon. Sidebar views for explorer, terminals, extensions, settings remain sidebar-only.

**pli.5 — Hotkey toggle & keyboard panel navigation**
Add `Cmd+B` (or similar) hotkey to toggle right panel visibility. Implement `Cmd+1/2/3` or `Cmd+Shift+Arrow` for focus navigation between sidebar, center, and right panels. Ensure focus trap works correctly within each panel zone.

**pli.6 — Layout persistence & restoration**
Wire `onLayout` callbacks to debounced persistence. Implement imperative `setLayout()` restoration on mount. Persist right panel open/closed state and which panes are active. Guard with `settingsLoaded` check. Test: resize → restart → sizes restored.

**pli.7 — Polish & design system compliance**
Dracula theme for all right panel elements (resize handles, pane headers, borders). Content opacity transitions (not CSS panel transitions). Edge cases: minimum widths, ultra-narrow windows, right panel overflow. Accessibility: aria-labels, focus indicators. Test all layouts.

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Center column content | Terminals only | Dedicated workspace for terminal panes. No tab mixing — cleaner mental model. |
| Right panel behavior | Collapse when empty | Maximizes center space when not needed. Opens on demand. |
| Right panel panes | Splittable (vertical stack) | Can have browser + planning visible simultaneously, or just one. |
| Right panel visibility | Imperative collapse/expand (always in DOM) | react-resizable-panels requires panels to stay mounted. Conditional rendering breaks imperative API. |
| Sidebar scope | Keep all views | Sidebar entries for breadcrumb/browser become launchers for right panel. Familiar icon → content association. |
| Tab system | Remove | Replaced by direct content routing — center = terminals, right = browser/planning. Simpler architecture. |
| Layout state location | Extend appStore (not new store) | Layout tightly coupled with panel rendering. Avoids cross-store sync issues. |
| Layout persistence | onLayout + debounced IPC (not autoSaveId) | autoSaveId uses localStorage — Electron needs electron-store for cross-process persistence. |
| Persistence debounce | 300ms | Prevents disk thrashing during drag. User doesn't notice delay. |
| Panel animations | None on panels, opacity on inner content | CSS transitions on panels break drag-to-resize. Opacity/transform on wrappers is safe. |

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
