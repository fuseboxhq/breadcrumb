# Research: Nested Split Pane Layout for Terminal IDE

**Date:** 2026-02-20
**Domain:** React UI Layout / Terminal Windowing
**Overall Confidence:** HIGH

## TL;DR

Use `react-resizable-panels` with nested PanelGroups — it's already in your codebase (v2.1.7) and explicitly supports nesting. Model the layout as a recursive split tree (union type: pane node vs split node) in Zustand state. Avoid react-mosaic (heavier, more opinionated) and allotment (VS Code fork, no clear nesting examples). Follow Warp terminal's tree algorithm for split insertion/removal. Don't hand-roll resize logic or tree traversal — let react-resizable-panels handle rendering and let a simple recursive state structure drive it.

## Recommended Stack

| Library | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| react-resizable-panels | 2.1.7+ (current: 4.6.4) | Nested split rendering | HIGH |
| zustand + immer | current | Split tree state management | HIGH |
| N/A (hand-rolled) | - | Tree traversal/mutation logic | MEDIUM |

**Current Version:** You're on v2.1.7. Nested PanelGroups are supported (confirmed in docs and GitHub discussions). Consider upgrading to v4.x for performance improvements (flexbox-based resizing, better React 18 compat), but not required for nesting functionality.

**Install (if upgrading):**
```bash
pnpm add react-resizable-panels@^4.6.4
```

## Q1: Does react-resizable-panels support nested PanelGroups?

**Answer:** YES (HIGH confidence)

### Evidence

1. **Official Documentation:** [react-resizable-panels README](https://github.com/bvaughn/react-resizable-panels) states "Nested groups are supported" with a reference to `Nested.tsx` example file.

2. **Live Example:** Nested example available at https://react-resizable-panels.vercel.app/examples/nested (confirmed in search results).

3. **GitHub Discussion #314:** User reported nested groups not working when dynamically injected. Maintainer (bvaughn) confirmed nested groups ARE supported and pointed to the Nested.tsx reference implementation. User resolved issue by studying the example.

4. **Architecture:** Uses `display: flex` instead of absolute positioning (since PR #33), which naturally supports nested layouts by letting the browser handle multi-level reflows in a single render frame.

### Version Requirements

- **Minimum:** Not explicitly documented, but nested support existed as early as v2.x (your v2.1.7 should work).
- **Recommended:** v4.x for performance improvements (moved flex-grow styles from CSS vars to inline for faster rendering, reduced forced-reflow impact).

### Critical Constraint

**Panel elements must be direct DOM children of their parent Group elements.** This means:

```tsx
// CORRECT
<PanelGroup direction="horizontal">
  <Panel>
    <PanelGroup direction="vertical"> {/* nested group inside Panel */}
      <Panel>Content A</Panel>
      <PanelResizeHandle />
      <Panel>Content B</Panel>
    </PanelGroup>
  </Panel>
</PanelGroup>

// INCORRECT
<PanelGroup direction="horizontal">
  <div> {/* breaks direct child requirement */}
    <Panel>Content</Panel>
  </div>
</PanelGroup>
```

## Q2: Best Data Structure for Recursive Split Tree

**Answer:** Union type with pane/split variants (HIGH confidence, based on Warp terminal architecture)

### Recommended Structure

```typescript
type SplitNode =
  | { type: "pane"; paneId: string; pane: ContentPane }
  | {
      type: "split";
      direction: "horizontal" | "vertical";
      children: SplitNode[];
      sizes: number[] // flex ratios, not absolute px
    }
```

### Why This Works

**1. Natural Recursion:** A split can contain panes OR more splits, enabling arbitrary nesting depth (2x2 grids, L-shapes, 3-pane layouts).

**2. Flex Ratios Over Absolute Sizes:** Store proportions (e.g., `[40, 60]` for 40%/60% split) rather than pixel values. When container resizes, proportions scale automatically. Warp uses this approach: "we decided to save the ratio each child node takes of the branch node's size instead."

**3. Mirrors react-mosaic:** The [react-mosaic library](https://github.com/nomcopter/react-mosaic) uses a nearly identical structure:
```typescript
type MosaicNode<T> = T | {
  direction: 'row' | 'column';
  first: MosaicNode<T>;
  second: MosaicNode<T>;
  splitPercentage: number; // 0-100
}
```

**4. Maps Cleanly to react-resizable-panels:** Recursive render function:
```typescript
function renderSplitTree(node: SplitNode) {
  if (node.type === "pane") {
    return <Panel>{renderPaneContent(node.pane)}</Panel>;
  }
  return (
    <PanelGroup direction={node.direction}>
      {node.children.map((child, i) => (
        <Fragment key={i}>
          {i > 0 && <PanelResizeHandle />}
          {renderSplitTree(child)}
        </Fragment>
      ))}
    </PanelGroup>
  );
}
```

### State Management Pattern

Store the tree in Zustand:

```typescript
interface TabPaneState {
  splitTree: SplitNode; // replaces flat panes[] + splitDirection
  activePane: string;
}
```

Use `immer` for immutable tree mutations (Zustand middleware you already use):

```typescript
// Add pane (horizontal split on active pane)
splitPaneHorizontal: (tabId: string, activePaneId: string) =>
  set(produce((state) => {
    const tree = state.terminalPanes[tabId].splitTree;
    const targetNode = findPaneNode(tree, activePaneId); // DFS traversal
    // Replace pane node with split node containing old + new pane
    replacePaneWithSplit(tree, activePaneId, "horizontal", [
      targetNode,
      { type: "pane", paneId: generateId(), pane: createTerminalPane() }
    ], [50, 50]);
  }))
```

## Q3: How Do VS Code and Other IDEs Model Split Layout?

**VS Code:** Grid-based layout using `SerializableGrid` (not a binary tree). Editor groups arranged via `IEditorGroupsService`. State persists via `IStorageService`. [Source](https://code.visualstudio.com/docs/configure/custom-layout)

**Warp Terminal (binary tree approach — best match for your use case):**

From [Warp's blog post](https://www.warp.dev/blog/using-tree-data-structures-to-implement-terminal-split-panes-more-fun-than-it-sounds):

### Architecture

**Two node types:**
- **BranchNode:** Holds split direction (horizontal/vertical) and children. Represents spatial relationships.
- **PaneNode:** Leaf node containing terminal instance.

**Key advantage over 2D arrays:** No sparse storage waste, no expensive row/column shifting. Tree mutations are O(1) space.

### Algorithm for Split Insertion

1. **Find target pane** via depth-first search (O(N) time).
2. **Check parent branch direction:**
   - If matches new split direction → insert pane directly into parent's children array
   - If differs → replace target pane with new branch node (perpendicular split) containing old + new pane
3. **On removal:** If branch has only one child after deletion, collapse branch into its remaining child.

### Resizing & Proportions

**Flex ratios propagate down from root:**
- Each split stores children's proportional sizes (e.g., `[0.4, 0.6]`).
- During render, available space multiplies by ratio at each level.
- User resizes update only the immediate parent split's ratios — no cascade recalculations.

**This is the pattern to follow.** It maps directly to react-resizable-panels' API (PanelGroup with defaultSize props).

### Ghostty Terminal

Uses a similar split tree with 16-bit handles for nodes (memory optimization). Root is always handle 0. [Source](https://deepwiki.com/ghostty-org/ghostty/6.4-split-management-system)

## Q4: React Libraries for Tiling/Mosaic Layouts

### react-mosaic-component

**What it is:** Full-featured tiling window manager for React. [GitHub](https://github.com/nomcopter/react-mosaic)

**Pros:**
- Built-in drag-and-drop for pane rearrangement and docking
- MosaicWindow component with toolbar, controls, split/remove buttons
- Supports controlled (you manage state) and uncontrolled (internal state) modes
- TypeScript-first with type-safe MosaicNode tree

**Cons:**
- Heavier API — opinionated about window chrome, drag UX
- More abstraction — harder to customize if you already have a terminal UI
- Would replace your current TerminalPanel toolbar/tab logic

**Verdict:** Overkill. You already have a tab bar, pane labels, split buttons. react-mosaic gives you a full window manager when you only need the layout engine.

**Confidence:** MEDIUM (viable but not recommended given existing UI)

### allotment

**What it is:** React wrapper around VS Code's split view implementation. [GitHub](https://github.com/johnwalley/allotment)

**Pros:**
- Industry-standard look/feel (VS Code lineage)
- Supports min/max size constraints, snap-to-zero behavior
- Programmatic resize/reset methods

**Cons:**
- **No explicit nested split examples** in docs (absence of evidence ≠ evidence of absence, but suspicious)
- Array-based size API (`defaultSizes={[100, 200]}`) — less natural for tree structures
- VS Code's actual grid system is more complex than allotment exposes

**Verdict:** Less proven for deep nesting than react-resizable-panels. No clear advantage over your current library.

**Confidence:** LOW (works for simple splits, unverified for nested trees)

### react-resizable-panels (your current choice)

**Why it wins:**
- Already in your codebase (v2.1.7)
- Explicit nested group support with working examples
- Flexbox-based (no layout timing bugs with nested groups)
- Minimal API — you control the tree, it renders the panels
- 1,583 dependents on npm (mature, well-tested)
- Active maintenance (v4.6.4 released recently)

**Confidence:** HIGH

## Q5: Pitfalls of Nested PanelGroups

### 1. Resize Cascade (FIXED in react-resizable-panels)

**Problem:** When resizing a child panel, the parent panel's size also changes ("nested one changing then the upper one is changing her height and width" — [GitHub Discussion #314](https://github.com/bvaughn/react-resizable-panels/discussions/314)).

**Cause:** Absolute positioning lag — child panel updates in a different render frame than parent.

**Solution:** Library switched to flexbox in PR #33. Browser handles multi-level layout atomically in one reflow. **You won't hit this if you use v2.1.7+.**

### 2. Direct Child Requirement

**Problem:** Panels must be direct DOM children of PanelGroup. Wrapping in a `<div>` breaks resize detection.

**Solution:** Use `<Fragment>` or `<React.Fragment>` when rendering lists, not wrapper divs.

```tsx
// WRONG
<PanelGroup>
  <div className="wrapper">
    <Panel>Content</Panel>
  </div>
</PanelGroup>

// RIGHT
<PanelGroup>
  <Panel>
    <div className="content-wrapper">Content</div>
  </Panel>
</PanelGroup>
```

### 3. Performance with Deep Nesting

**Issue:** Warp's algorithm is O(N) for insert/remove (N = total nodes). With 20+ panes, this could lag.

**Mitigation:**
- User-driven splits (not programmatic mass-creates) are naturally limited (users rarely split beyond 4-6 panes per tab).
- React's reconciliation handles tree re-renders efficiently if you use stable keys (pane IDs).
- Zustand + immer already batches updates — structural sharing minimizes re-renders.

**Realistically not a problem** for your use case (terminal tabs with <10 panes typical).

### 4. Scrollbars During Resize

**Issue:** "If you start resizing a panel in the parent PanelGroup, all scrollbars contained in the child PanelGroup will appear" ([GitHub Issue #96](https://github.com/bvaughn/react-resizable-panels/issues/96)).

**Cause:** Resize handle drag triggers overflow calculations on nested content.

**Solution:** Set `overflow: hidden` on Panel wrappers during active resize, or accept minor visual artifact (scrollbars flash briefly).

### 5. State Serialization

**Pitfall:** Storing absolute pixel sizes breaks on window resize or monitor change.

**Solution:** Store flex ratios (0-1 or 0-100 range) in `sizes` array. react-resizable-panels' `onLayout` callback gives you current percentages:

```tsx
<PanelGroup
  direction="horizontal"
  onLayout={(sizes) => {
    // sizes = [40, 60] (percentages)
    updateSplitSizes(tabId, nodeId, sizes);
  }}
>
```

Save these ratios in workspace snapshot. On restore, pass as `defaultSizes` prop.

## Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| Resize handle drag detection | PanelResizeHandle | Touch-friendly, keyboard accessible (Apple guidelines), debounced |
| Nested flexbox calculations | PanelGroup | Handles edge cases (min/max size, collapse, snap-to-zero) |
| Panel collapse animations | react-resizable-panels API | Built-in `collapsible` prop, smooth transitions |
| Drag-to-dock zones | react-mosaic (if needed) | Full DnD system with drop zone detection — OR build on top of HTML5 Drag API + tree mutations |

**Drag-and-drop for pane swap/dock:** This is NOT built into react-resizable-panels. You have two options:

1. **Use react-mosaic** (gets you drag-to-dock for free, but replaces your entire panel UI).
2. **Hand-roll with HTML5 Drag API** (recommended): Detect drop zone (center = swap, edges = dock), mutate split tree accordingly. react-resizable-panels just renders the result.

Warp doesn't document drag-and-drop in their blog post — they focused on the tree structure. For drag UX, look at react-mosaic's source or implement a simpler 5-zone overlay (center + 4 edges).

## Key Patterns

### Pattern 1: Recursive Render

**Use when:** Converting split tree to nested PanelGroups.

```tsx
function renderSplitTree(node: SplitNode): ReactNode {
  if (node.type === "pane") {
    return (
      <Panel key={node.paneId} minSize={10}>
        <PaneContentRenderer pane={node.pane} {...otherProps} />
      </Panel>
    );
  }

  // Split node — render nested PanelGroup
  return (
    <PanelGroup
      key={`split-${node.children[0]?.paneId || "root"}`}
      direction={node.direction}
      onLayout={(sizes) => saveSplitSizes(node, sizes)}
    >
      {node.children.map((child, i) => (
        <Fragment key={child.type === "pane" ? child.paneId : `split-${i}`}>
          {i > 0 && <PanelResizeHandle className="resize-handle" />}
          {renderSplitTree(child)} {/* recursion */}
        </Fragment>
      ))}
    </PanelGroup>
  );
}
```

### Pattern 2: Tree Traversal (Find Pane Node)

**Use when:** Locating a pane in the tree for split/remove operations.

```typescript
function findPaneNode(tree: SplitNode, paneId: string): SplitNode | null {
  if (tree.type === "pane") {
    return tree.paneId === paneId ? tree : null;
  }
  // DFS through children
  for (const child of tree.children) {
    const result = findPaneNode(child, paneId);
    if (result) return result;
  }
  return null;
}
```

### Pattern 3: Split Insertion (Warp Algorithm)

**Use when:** User splits active pane horizontally or vertically.

```typescript
// Pseudocode (implement with immer in Zustand action)
function insertSplit(tree: SplitNode, targetPaneId: string, direction: "horizontal" | "vertical"): void {
  const parentSplit = findParentSplit(tree, targetPaneId);
  const targetIndex = parentSplit.children.findIndex(n => n.type === "pane" && n.paneId === targetPaneId);
  const targetNode = parentSplit.children[targetIndex];

  if (parentSplit.direction === direction) {
    // Same direction — insert new pane next to target
    parentSplit.children.splice(targetIndex + 1, 0, createNewPane());
    parentSplit.sizes = distributeEvenly(parentSplit.children.length);
  } else {
    // Different direction — replace target with new split
    const newSplit: SplitNode = {
      type: "split",
      direction,
      children: [targetNode, createNewPane()],
      sizes: [50, 50],
    };
    parentSplit.children[targetIndex] = newSplit;
  }
}
```

### Pattern 4: State Persistence

**Use when:** Saving/restoring workspace layout.

```typescript
// Serialization (flatten tree to JSON-safe structure)
interface SerializedSplitNode {
  type: "pane" | "split";
  paneId?: string;
  cwd?: string; // for pane nodes
  direction?: "horizontal" | "vertical"; // for split nodes
  children?: SerializedSplitNode[];
  sizes?: number[];
}

function serializeSplitTree(node: SplitNode): SerializedSplitNode {
  if (node.type === "pane") {
    return { type: "pane", paneId: node.paneId, cwd: node.pane.cwd };
  }
  return {
    type: "split",
    direction: node.direction,
    children: node.children.map(serializeSplitTree),
    sizes: node.sizes,
  };
}

// Deserialization (restore terminals from serialized state)
function deserializeSplitTree(node: SerializedSplitNode, workingDir: string): SplitNode {
  if (node.type === "pane") {
    return {
      type: "pane",
      paneId: node.paneId!,
      pane: createTerminalPane(node.cwd || workingDir),
    };
  }
  return {
    type: "split",
    direction: node.direction!,
    children: node.children!.map(c => deserializeSplitTree(c, workingDir)),
    sizes: node.sizes!,
  };
}
```

## Open Questions

1. **Drag-and-drop implementation details:** react-resizable-panels doesn't provide drag-to-swap/dock. Should you:
   - Use react-mosaic (heavy, replaces UI)?
   - Hand-roll HTML5 Drag API with drop zone overlays (lighter, custom)?
   - Defer drag-and-drop and ship keyboard-driven splits first?

   **Recommendation:** Ship keyboard splits first (Cmd+D, Cmd+Shift+D already work). Add drag later with HTML5 Drag API + custom overlay.

2. **Upgrade to react-resizable-panels v4.x?** Your v2.1.7 supports nesting, but v4.x has:
   - Performance improvements (inline flex-grow styles, less forced-reflow)
   - Better React 18 compatibility (`useSyncExternalStore`)
   - Double-click to reset panel sizes (nice UX for terminal splits)

   **Low risk, medium reward.** Test in dev first (check for breaking changes in migration guide).

3. **2x2 grid shortcut:** Should this be a preset tree structure or dynamically generated?

   **Answer:** Preset structure. When user clicks "2x2 grid" button:
   ```typescript
   const gridTree: SplitNode = {
     type: "split",
     direction: "horizontal",
     children: [
       {
         type: "split",
         direction: "vertical",
         children: [createPane(), createPane()],
         sizes: [50, 50],
       },
       {
         type: "split",
         direction: "vertical",
         children: [createPane(), createPane()],
         sizes: [50, 50],
       },
     ],
     sizes: [50, 50],
   };
   ```
   Replace active tab's tree with this structure.

## Sources

**HIGH confidence:**
- [Warp Terminal: Using tree data structures to implement terminal split panes](https://www.warp.dev/blog/using-tree-data-structures-to-implement-terminal-split-panes-more-fun-than-it-sounds)
- [react-resizable-panels GitHub](https://github.com/bvaughn/react-resizable-panels)
- [react-resizable-panels nested support discussion #314](https://github.com/bvaughn/react-resizable-panels/discussions/314)
- [react-resizable-panels nested panel bug fix #32](https://github.com/bvaughn/react-resizable-panels/issues/32)

**MEDIUM confidence:**
- [react-mosaic GitHub](https://github.com/nomcopter/react-mosaic)
- [VS Code Layout System documentation](https://code.visualstudio.com/docs/configure/custom-layout)
- [allotment GitHub](https://github.com/johnwalley/allotment)

**LOW confidence (needs validation):**
- Scrollbar flashing issue during resize ([GitHub Issue #96](https://github.com/bvaughn/react-resizable-panels/issues/96)) — reported but unclear if still present in v4.x
- Performance of deep nesting (>10 levels) — no benchmarks found, extrapolated from Warp's O(N) algorithm analysis
