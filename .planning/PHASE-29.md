# Phase 29: Advanced Terminal Windowing

**Status:** in_progress
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
- Follow existing `react-resizable-panels` patterns (v2.1.7 supports nested groups natively)
- Follow existing Zustand + immer state management patterns
- Frontend design skill active — follow design thinking process for UI tasks
- Pane drag-and-drop must not conflict with existing tab drag-and-drop (tab merge)

## Research Summary

**Overall Confidence:** HIGH

Nested PanelGroups are confirmed supported by react-resizable-panels (v2.1.7+) using flexbox layout (PR #33 fixed the old absolute-positioning timing bugs). The Warp terminal's binary tree approach is the best-fit pattern — SplitNode union type with pane/split variants, flex-ratio-based sizing, and O(1) split insertion when parent direction matches. For drag-and-drop, use HTML5 Drag API (already used in the codebase for tab merge) with a 5-zone drop target overlay per pane.

### Key Patterns

**Recursive SplitNode tree** (from Warp terminal architecture):
```typescript
type SplitNode =
  | { type: "pane"; paneId: string; pane: ContentPane }
  | { type: "split"; direction: "horizontal" | "vertical"; children: SplitNode[]; sizes: number[] }
```

**Split insertion algorithm:**
1. Find target pane via DFS
2. If parent split direction matches → insert sibling directly
3. If direction differs → replace target with new perpendicular split node
4. On removal, collapse single-child splits into their remaining child

**Recursive renderer** maps tree to nested `PanelGroup` components. Each split node becomes a `PanelGroup`, each pane node becomes a `Panel` with `PaneContentRenderer`.

### Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| Panel resize drag detection | `PanelResizeHandle` from react-resizable-panels | Touch-friendly, keyboard accessible, debounced |
| Nested flexbox calculations | Nested `PanelGroup` components | Browser handles multi-level layout atomically |
| Drag ghost rendering | `setDragImage()` HTML5 API | Already used for tab merge in codebase |
| Zone detection math | Custom 5-zone calculator with adaptive thresholds | Simple enough, avoids adding @dnd-kit dependency |

### Pitfalls

- **Direct child requirement**: Panels must be direct DOM children of PanelGroup. Use `<Fragment>` not wrapper divs
- **Scrollbars during resize**: Set `overflow: hidden` on Panel wrappers during active resize to prevent flash
- **Key stability**: Use pane IDs as React keys, not array indices — prevents terminal session destruction on tree restructure
- **dragover performance**: Fires continuously during drag. Use `dragenter`/`dragleave` for state changes
- **Zoom interaction**: Zoom must work at any nesting depth — find pane in tree, render only that pane at full size

### Design Guidance

The `frontend-design` skill will be active during execution of UI tasks in this phase. It provides guidelines for typography, color, motion, spatial composition, and avoiding generic aesthetics.

## Recommended Approach

**Core architectural change:** Replace the flat `TabPaneState.splitDirection + ContentPane[]` model with a recursive split tree. The tree maps directly to nested `PanelGroup` components from react-resizable-panels, which already handles the flexbox layout, resize handles, and min/max constraints.

**Drag-and-drop:** Use HTML5 Drag API (no new dependencies needed — same approach as existing tab merge) with 5-zone drop target overlays per pane. Zone detection uses 25% edge threshold with 40px minimum.

**Group renaming:** Add `customTitle?: string` to the `WorkspaceTab` interface. Render inline editable input on double-click in both the workspace tab bar and sidebar tree. Fall back to auto-generated name when no custom title set.

**Size persistence:** The `sizes: number[]` in each split node captures flex proportions. `PanelGroup`'s `onLayout` callback updates sizes on drag. Full tree serialized in workspace snapshot.

## Tasks

| ID | Title | Status | Complexity | Dependencies |
|----|-------|--------|------------|--------------|
| breadcrumb-2bn.1 | SplitNode tree data model and store migration | open | High | - |
| breadcrumb-2bn.2 | Recursive split tree renderer | open | High | .1 |
| breadcrumb-2bn.3 | Terminal group (tab) renaming | open | Low | - |
| breadcrumb-2bn.4 | Drag-and-drop pane swap and dock | open | High | .1, .2 |
| breadcrumb-2bn.5 | Drop zone feedback, animations, and polish | open | Medium | .4 |
| breadcrumb-2bn.6 | Layout persistence and workspace migration | open | Medium | .1, .2 |
| breadcrumb-2bn.7 | Fix terminal scroll jump on pane focus | open | Medium | - |

### Task Details

**breadcrumb-2bn.1: SplitNode tree data model and store migration** (frontend-design skill active)
- Define `SplitNode` union type: `PaneNode | SplitContainerNode`
- Replace `TabPaneState { panes: ContentPane[], splitDirection, activePane }` with `TabPaneState { splitTree: SplitNode, activePane }`
- Create tree manipulation functions: `findPaneNode()`, `findParentSplit()`, `insertSplit()`, `removePaneFromTree()`, `swapPanes()`, `dockPane()`, `flattenPanes()` (for backward compat)
- Migrate all store actions: `addPane()` → inserts into tree, `removePane()` → removes from tree with single-child collapse, `setActivePane()` → unchanged, `toggleSplitDirection()` → removed (direction is per-split now)
- Add `create2x2Grid()` helper that builds preset tree structure
- Update `navigatePane()` to traverse tree in visual order (left-to-right, top-to-bottom)
- Backward-compatible deserialization: detect old flat format and convert to single-split tree

**breadcrumb-2bn.2: Recursive split tree renderer** (frontend-design skill active)
- Build `SplitTreeRenderer` component that recursively creates nested `PanelGroup` → `Panel` → `PanelGroup` structures
- Replace flat `PanelGroup` rendering in `TerminalPanel.tsx` (lines 400-454) with `SplitTreeRenderer`
- Each `PanelGroup` gets `onLayout` callback to capture panel sizes into tree state
- Each `Panel` wraps `PaneContentRenderer` with click handler for `setActivePane`
- Active pane highlight ring works at any nesting depth
- Zoom works with tree: when zoomed, render only the target pane at full size (existing pattern)
- Resize handles styled consistently with existing design (3px transparent, hover accent)
- Keyboard shortcuts updated: Cmd+D splits active pane horizontally, Cmd+Shift+D vertically (splitting the active pane in the tree, not changing global direction)
- Add 2x2 grid button in toolbar (calls `create2x2Grid()`)

**breadcrumb-2bn.3: Terminal group (tab) renaming**
- Add `customTitle?: string` to `WorkspaceTab` interface in `appStore.ts`
- Add `setTabCustomTitle(tabId, title)` store action
- In workspace tab bar (`WorkspaceContent.tsx`): double-click tab title → inline editable input
- In sidebar `TerminalsView` (`SidebarPanel.tsx`): double-click tab node → inline editable input
- Context menu "Rename Group" option on tab nodes in sidebar (alongside existing Split/Close)
- Tab title display priority: `customTitle` → auto-generated from process/CWD
- Clear button (X) on custom title to revert to auto-generated
- Persist `customTitle` in `SerializedTab` for workspace snapshot

**breadcrumb-2bn.4: Drag-and-drop pane swap and dock** (frontend-design skill active)
- Make pane header/toolbar area draggable: `draggable="true"`, `onDragStart` sets `dataTransfer` with pane ID + tab ID
- Each pane is a drop target with 5-zone detection: center (swap), top/bottom/left/right (dock)
- Zone detection: calculate relative pointer position in pane rect, 25% edge threshold (min 40px, always leave 20% center)
- `onDragOver`: prevent default + calculate active zone
- `onDrop` center zone: call `swapPanes(tree, draggedPaneId, targetPaneId)` — swap positions in tree
- `onDrop` edge zone: call `dockPane(tree, draggedPaneId, targetPaneId, direction)` — remove from old position, insert as split neighbor
- Custom drag ghost via `setDragImage()` showing pane label + icon
- Guard: don't allow dropping on self, don't allow if only 1 pane total
- Must not conflict with existing tab merge drag-and-drop (check `dataTransfer` type to distinguish)

**breadcrumb-2bn.5: Drop zone feedback, animations, and polish** (frontend-design skill active)
- Drop zone overlay: absolute-positioned div inside each pane, showing which zone is active during drag
- Zone colors: edge zones show blue tint (25% of pane highlighted), center zone shows green/accent tint
- Transition: `transition: opacity 150ms ease` on overlay appearance
- Drag source opacity: reduce to 50% while dragging
- Layout transition: when tree restructures after drop, panels animate to new sizes (CSS transition on flex-basis)
- Pane toolbar: add drag handle icon (grip dots) that indicates draggability
- Test with mixed pane types (terminal + browser + diff in same tree)

**breadcrumb-2bn.6: Layout persistence and workspace migration** (frontend-design skill active)
- Define `SerializedSplitNode` type for JSON-safe tree representation
- `serializeSplitTree()`: converts `SplitNode` → `SerializedSplitNode` (strips transient data: sessionId, processName)
- `deserializeSplitTree()`: converts `SerializedSplitNode` → `SplitNode` (creates fresh sessionIds, inherits workingDirectory)
- Update `buildWorkspaceSnapshot()` to serialize tree instead of flat pane array
- Update `restoreWorkspace()` to deserialize tree, handling both old flat format and new tree format
- `PanelGroup` `onLayout` callbacks persist sizes into tree state, debounced via existing `persistWorkspace()`
- Migration path: detect old `{ panes: [], splitDirection }` format → convert to `{ splitTree: { type: "split", direction, children: [...panes as PaneNodes], sizes: evenDistribution } }`
- Test: save layout, restart app, verify tree structure and pane sizes restored correctly

**breadcrumb-2bn.7: Fix terminal scroll jump on pane focus**
- Investigate: clicking into a terminal pane (especially one running Claude Code) causes the viewport to jump/scroll to a mid-buffer position instead of staying at the current scroll offset
- Likely cause: xterm.js `focus()` or `scrollToBottom()` being called inappropriately when the pane receives click focus, or FitAddon triggering a re-render that resets scroll position
- Check `TerminalInstance.tsx` click/focus handlers and `useShellIntegration.ts` for scroll-related side effects
- Check if `terminal.scrollToBottom()` is called on focus events or resize events that shouldn't trigger it
- Fix should preserve scroll position when clicking into an already-visible pane — only auto-scroll on new output
- Test with Claude Code (long output, user scrolled up mid-conversation) and regular shell sessions

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Layout model | Recursive SplitNode tree | Replaces flat direction + array. Supports arbitrary nesting, natural 2x2 grids, L-shapes. Follows Warp terminal pattern |
| Split rendering | Nested `PanelGroup` from react-resizable-panels | Already in codebase (v2.1.7), confirmed nested support. Flexbox-based, no timing bugs |
| Drag-and-drop lib | HTML5 Drag API (no new dep) | Already used for tab merge. Simple enough for 5-zone detection. Avoids adding @dnd-kit |
| Drop zone detection | 5-zone overlay per pane | Center = swap, 4 edges = dock. 25% threshold with adaptive minimum |
| Group renaming | Inline edit on tab title | Double-click in tab bar + sidebar. `customTitle` field on WorkspaceTab |
| Size persistence | Flex ratios in split tree nodes | `PanelGroup.onLayout` captures proportions. Serialized in workspace snapshot |
| Old format migration | Auto-detect and convert | Check for `panes[]` vs `splitTree` in deserialization. Seamless upgrade |

## Completion Criteria

- [ ] Panes can be split in any direction at any nesting depth (2x2 grid works naturally)
- [ ] Dragging a pane onto the center of another swaps their positions
- [ ] Dragging a pane to the edge of another docks/splits it in that direction
- [ ] Drop zones are visually highlighted during drag with smooth animations
- [ ] Terminal group tabs can be renamed via double-click (in tab bar and sidebar)
- [ ] Pane size proportions persist across app restarts
- [ ] Keyboard shortcuts work for all new split/navigation actions
- [ ] All existing terminal features (zoom, process detection, shell integration) still work
- [ ] Old workspace snapshots (flat format) auto-migrate to tree format on restore

## Sources

**HIGH confidence:**
- [Warp Terminal: Using tree data structures for terminal split panes](https://www.warp.dev/blog/using-tree-data-structures-to-implement-terminal-split-panes-more-fun-than-it-sounds)
- [react-resizable-panels GitHub](https://github.com/bvaughn/react-resizable-panels) — nested group support confirmed
- [react-resizable-panels nested panel fix PR #33](https://github.com/bvaughn/react-resizable-panels/issues/32) — flexbox migration resolved nesting bugs
- Direct codebase audit: `TerminalPanel.tsx`, `PaneContentRenderer.tsx`, `appStore.ts`, `SidebarPanel.tsx`

**MEDIUM confidence:**
- [VS Code drag-and-drop system](https://deepwiki.com/microsoft/vscode/4.6-drag-and-drop-system) — 5-zone detection pattern
- [react-mosaic GitHub](https://github.com/nomcopter/react-mosaic) — similar tree structure validates approach
