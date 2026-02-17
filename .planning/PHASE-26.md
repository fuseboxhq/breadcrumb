# Phase 26: Multi-Tab Browser & Universal Split Panes

**Status:** not_started
**Beads Epic:** breadcrumb-gpr
**Created:** 2026-02-14

## Objective

Transform the Breadcrumb desktop IDE into a true multi-pane workspace by adding multi-tab browser support (in both the right panel and center workspace), promoting any content type into the center area, and enabling universal pane splitting so terminals, diffs, and browsers can all be split and arranged within a single tab — like VS Code's split editor, but for all content types.

## Scope

**In scope:**
- Multiple browser tabs in the right panel (tab bar within the browser pane)
- Browser as a first-class center workspace tab type (`TabType = "browser"`)
- Promote/demote browser tabs between right panel and center workspace (button + drag-and-drop)
- Universal pane splitting: any content type (terminal, diff, browser) can be split horizontally/vertically within a tab
- BrowserViewManager refactor to support multiple concurrent WebContentsViews
- Bounds syncing for multiple browser views simultaneously
- Persistence of browser tabs and universal pane state across restart

**Out of scope:**
- Drag-and-drop reordering of center workspace tabs (existing tab bar behavior is fine)
- Floating/detached windows (separate Electron windows)
- Browser extension support
- Tab groups or tab stacking
- Cross-tab drag-and-drop (dragging a pane from one tab to another)

## Constraints

- Must use Electron's `WebContentsView` (not deprecated `BrowserView`) for browser instances
- Follow existing `react-resizable-panels` patterns for split panes
- Follow existing Zustand + immer state management patterns
- Browser bounds syncing must handle multiple simultaneous views without performance issues
- Frontend design skill active — follow design thinking process for UI tasks

## Research Summary

Run `/bc:plan PHASE-26` to research this phase and populate this section.

## Recommended Approach

**Architecture sketch:**

1. **Generalize pane system**: Replace `TerminalPane` with a generic `ContentPane` that has a `type` field (`terminal | diff | browser`) and type-specific data. `TabPaneState` becomes content-agnostic.

2. **Multi-browser in right panel**: Add a tab bar to the browser section of the right panel. Each tab maps to its own `WebContentsView`. BrowserViewManager becomes a registry of multiple views keyed by a pane/tab ID.

3. **Browser as center tab**: Add `"browser"` to `TabType`. When rendering a browser tab, use the same `BrowserPanel` component but sized to the center area. Bounds syncing already works via ResizeObserver.

4. **Promote/demote**: "Open in main area" button creates a new center tab of type `browser` with the same URL. Drag-and-drop uses HTML5 drag API with drop zones on the tab bar area.

5. **Universal splits**: `WorkspaceContent` renders a `PanelGroup` of `ContentPane[]` instead of switching on tab type. Each pane renders its own content based on `pane.type`. Split actions available via toolbar and context menu for all content types.

## Tasks

| ID | Title | Status | Complexity |
|----|-------|--------|------------|
| - | No tasks yet | - | - |

Run `/bc:plan PHASE-26` to break down this phase into tasks.

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Split model | Pane splits within tabs | Keeps the tab model simple, extends existing pattern from terminal panes |
| Browser location | Both right panel + center workspace | Right panel for quick reference, center for focused browsing |
| Promote interaction | Button primary + drag-and-drop | Button is discoverable, DnD is power-user enhancement |
| Pane type system | Generic `ContentPane` with discriminated union | Replaces terminal-specific panes, extensible for future content types |
| Multi-browser impl | Multiple WebContentsViews keyed by pane ID | Each browser pane gets its own native view with independent bounds |

## Completion Criteria

- [ ] Right panel browser has a tab bar supporting multiple concurrent browser tabs
- [ ] Browser tabs can be opened as center workspace tabs (full-width browsing)
- [ ] "Open in main area" button promotes a right-panel browser tab to center workspace
- [ ] Drag-and-drop from right panel browser tab to center tab bar works
- [ ] Any content type (terminal, diff, browser) can be split horizontally/vertically within a tab
- [ ] Multiple browser WebContentsViews render simultaneously without bounds conflicts
- [ ] Browser tab and pane state persists across app restart
