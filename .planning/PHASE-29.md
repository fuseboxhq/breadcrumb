# Phase 29: Advanced Terminal Windowing

**Status:** not_started
**Beads Epic:** breadcrumb-2bn
**Created:** 2026-02-20

## Objective

Upgrade the terminal windowing system from a flat single-direction split model to a fully flexible tree-based layout supporting nested splits in any direction, drag-and-drop pane rearrangement (swap and dock), terminal group (tab) renaming, and pane size persistence. The result should feel like a polished tiling window manager embedded in the IDE.

## Scope

**In scope:**
- Tree-based nested split layout (replace flat `splitDirection` with a recursive split tree)
- Any pane can be split further in either direction — naturally supports 2x2 grids, L-shapes, 3-pane layouts, etc.
- Drag-and-drop pane swap (drag onto center of another pane to swap positions)
- Drag-and-drop pane dock (drag to edge of another pane to split and dock there)
- Visual drag feedback: drop zone highlights, drag ghost, smooth animations
- Terminal group (tab) renaming — double-click tab title in sidebar or tab bar to rename (e.g. "Claude #1" → "Dev Servers")
- Pane size/proportion persistence across app restarts
- Keyboard shortcuts for all new split actions
- Quick-action button for 2x2 grid layout (convenience shortcut for nested splits)

**Out of scope:**
- Floating/detached pane windows
- Cross-tab pane moves (dragging a pane from one tab to another)
- Layout presets or saved layout configurations
- Tab groups (Chrome-style grouping of multiple tabs under a label)

## Constraints

- Must preserve all existing terminal functionality (process detection, shell integration, zoom, Claude numbering)
- Must work with all ContentPane types (terminal, browser, diff) — not terminal-only
- Follow existing `react-resizable-panels` patterns (upgrade if needed for nested support)
- Follow existing Zustand + immer state management patterns
- Frontend design skill active — follow design thinking process for UI tasks
- Pane drag-and-drop must not conflict with existing tab drag-and-drop (tab merge)

## Research Summary

Run `/bc:plan PHASE-29` to research this phase and populate this section.

## Recommended Approach

**Core architectural change:** Replace the flat `TabPaneState.splitDirection + ContentPane[]` model with a recursive split tree:

```typescript
type SplitNode =
  | { type: "pane"; paneId: string; pane: ContentPane }
  | { type: "split"; direction: "horizontal" | "vertical"; children: SplitNode[]; sizes: number[] }
```

This tree structure naturally supports:
- Single pane (just a `pane` node)
- Horizontal split (a `split` node with `direction: "horizontal"`)
- Vertical split (same with `"vertical"`)
- 2x2 grid (horizontal split where each child is a vertical split)
- L-shapes, 3-pane layouts, any arbitrary nesting

**Drag-and-drop:** Use HTML5 Drag API with drop zone detection — divide each pane into 5 zones (center = swap, top/bottom/left/right edges = dock in that direction). Visual overlay shows which zone is active during drag.

**Group renaming:** Add `customTitle?: string` to the tab state. Render editable input on double-click in both the tab bar and sidebar tree. Fall back to auto-generated name when no custom title set.

**Size persistence:** The `sizes: number[]` in each split node captures proportions. Serialize the full tree in the workspace snapshot.

Run `/bc:plan PHASE-29` to research and refine this approach with concrete task breakdown.

## Tasks

| ID | Title | Status | Complexity |
|----|-------|--------|------------|
| - | No tasks yet | - | - |

Run `/bc:plan PHASE-29` to break down this phase into tasks.

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Layout model | Recursive split tree | Replaces flat direction + array. Supports arbitrary nesting, natural 2x2 grids, L-shapes |
| Drag interaction | Swap (center) + Dock (edges) | Most flexible — covers reordering and layout creation in one gesture |
| Drop zone detection | 5-zone overlay per pane | Center = swap, 4 edges = dock. Visual feedback during drag |
| Group renaming | Inline edit on tab title | Double-click to rename in tab bar and sidebar. Simple, familiar UX |
| Size persistence | Sizes stored in split tree nodes | Natural fit — each split node owns its children's proportions |

## Completion Criteria

- [ ] Panes can be split in any direction at any nesting depth (2x2 grid works naturally)
- [ ] Dragging a pane onto the center of another swaps their positions
- [ ] Dragging a pane to the edge of another docks/splits it in that direction
- [ ] Drop zones are visually highlighted during drag with smooth animations
- [ ] Terminal group tabs can be renamed via double-click (in tab bar and sidebar)
- [ ] Pane size proportions persist across app restarts
- [ ] Keyboard shortcuts work for all new split/navigation actions
- [ ] All existing terminal features (zoom, process detection, shell integration) still work
