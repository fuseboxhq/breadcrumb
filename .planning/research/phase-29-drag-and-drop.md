# Research: Drag-and-Drop Pane Rearrangement for Tiling Editor

**Date:** 2026-02-20
**Domain:** React + Electron Desktop IDE
**Overall Confidence:** MEDIUM-HIGH

## TL;DR

Use **@dnd-kit** for drag-and-drop with HTML5 sensor support. Implement a **5-zone drop target pattern** (center + 4 edges) using collision detection and overlay positioning. **react-resizable-panels already supports nested groups** - leverage this with imperative API to programmatically rebuild layouts on drop. For visual feedback, use CSS classes on dragenter/dragleave with a custom drag preview via setDragImage(). Avoid hand-rolling zone detection math - use @dnd-kit's collision algorithms (closestCenter, closestCorners).

**Alternative consideration:** Pragmatic drag-and-drop from Atlassian is smaller (~4.7kB core) and more performant, but @dnd-kit has better community support and React-specific patterns.

## Recommended Stack

| Library | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| @dnd-kit/core | 6.x (latest) | Drag-drop orchestration | HIGH |
| @dnd-kit/utilities | latest | CSS transforms, collision detection | HIGH |
| react-resizable-panels | 2.x (already installed) | Panel layout management | HIGH |
| pragmatic-drag-and-drop | latest | Alternative: smaller bundle, Atlassian-backed | MEDIUM |

**Install:**
```bash
pnpm add @dnd-kit/core @dnd-kit/utilities
```

**Alternative (if bundle size critical):**
```bash
pnpm add @atlaskit/pragmatic-drag-and-drop-hitbox @atlaskit/pragmatic-drag-and-drop-react-drop-indicator
```

## Key Patterns

### 1. Five-Zone Drop Target Detection

**Use when:** Implementing swap (center) vs dock (edges) interactions

The pattern divides each pane into 5 zones:
- **Center zone**: Swap positions with dragged pane
- **Top/Bottom/Left/Right edges**: Dock and split in that direction

```typescript
// Collision detection with @dnd-kit
import { closestCenter, closestCorners } from '@dnd-kit/core';

// Zone calculation (based on VS Code pattern)
function calculateDropZone(
  rect: DOMRect,
  pointer: { x: number; y: number }
): 'center' | 'top' | 'bottom' | 'left' | 'right' {
  const edgeThreshold = 0.25; // 25% from edge
  const relativeX = (pointer.x - rect.left) / rect.width;
  const relativeY = (pointer.y - rect.top) / rect.height;

  if (relativeY < edgeThreshold) return 'top';
  if (relativeY > 1 - edgeThreshold) return 'bottom';
  if (relativeX < edgeThreshold) return 'left';
  if (relativeX > 1 - edgeThreshold) return 'right';

  return 'center';
}
```

**Source:** VS Code's EditorDropTarget.positionOverlay() calculates drop zone boundaries this way.

### 2. Nested Split Tree with react-resizable-panels

**Use when:** Supporting arbitrary nesting (2x2 grids, L-shapes, etc.)

react-resizable-panels supports nested PanelGroups out of the box:

```typescript
// Tree structure for split layout
type SplitNode =
  | { type: "pane"; paneId: string; pane: ContentPane }
  | {
      type: "split";
      direction: "horizontal" | "vertical";
      children: SplitNode[];
      sizes: number[]
    };

// Render recursively
function renderSplitNode(node: SplitNode): ReactNode {
  if (node.type === "pane") {
    return <PaneContentRenderer pane={node.pane} />;
  }

  return (
    <PanelGroup direction={node.direction}>
      {node.children.map((child, i) => (
        <Fragment key={i}>
          <Panel defaultSize={node.sizes[i]}>
            {renderSplitNode(child)}
          </Panel>
          {i < node.children.length - 1 && <PanelResizeHandle />}
        </Fragment>
      ))}
    </PanelGroup>
  );
}
```

**Source:** react-resizable-panels documentation and subdivide pattern analysis.

### 3. Programmatic Layout Manipulation

**Use when:** Rebuilding layout tree after drag-drop operations

react-resizable-panels provides imperative APIs for programmatic control:

```typescript
import { useRef } from 'react';
import type { ImperativePanelGroupHandle } from 'react-resizable-panels';

const panelGroupRef = useRef<ImperativePanelGroupHandle>(null);

// Get current layout
const layout = panelGroupRef.current?.getLayout(); // [25, 50, 25]

// Set new layout after drop
panelGroupRef.current?.setLayout([33, 33, 34]);

// On drop completion, rebuild tree and trigger layout update
function handleDrop(draggedPaneId: string, targetPaneId: string, zone: DropZone) {
  const newTree = zone === 'center'
    ? swapPanesInTree(currentTree, draggedPaneId, targetPaneId)
    : dockPaneInTree(currentTree, draggedPaneId, targetPaneId, zone);

  setLayoutTree(newTree);
  // React will re-render with new nested PanelGroups
}
```

**Source:** react-resizable-panels imperative API documentation.

### 4. Visual Feedback: Drop Zone Overlays

**Use when:** Showing user where pane will land during drag

Use CSS classes toggled on dragenter/dragleave:

```typescript
// State for drop zone highlight
const [dropZone, setDropZone] = useState<DropZone | null>(null);

// CSS classes (Tailwind example)
const zoneClasses = {
  top: 'absolute inset-x-0 top-0 h-1/4 bg-blue-500/20 border-2 border-blue-500',
  bottom: 'absolute inset-x-0 bottom-0 h-1/4 bg-blue-500/20 border-2 border-blue-500',
  left: 'absolute inset-y-0 left-0 w-1/4 bg-blue-500/20 border-2 border-blue-500',
  right: 'absolute inset-y-0 right-0 w-1/4 bg-blue-500/20 border-2 border-blue-500',
  center: 'absolute inset-0 bg-green-500/20 border-2 border-green-500',
};

// Overlay render
{dropZone && (
  <div className={zoneClasses[dropZone]} />
)}
```

**Important:** Use dragenter for class toggling, not dragover - dragover fires repeatedly and causes performance issues.

**Source:** W3Schools ondragover documentation, NN/g drag-drop UX guidelines.

### 5. Custom Drag Ghost/Preview

**Use when:** Providing visual feedback of what's being dragged

Use HTML5 setDragImage() in onDragStart:

```typescript
function handleDragStart(e: DragEvent, pane: ContentPane) {
  // Create ghost element
  const ghost = document.createElement('div');
  ghost.className = 'p-4 bg-gray-800 text-white rounded shadow-lg';
  ghost.innerText = resolveLabel(pane, 0);
  ghost.style.position = 'absolute';
  ghost.style.top = '-1000px'; // Off-screen
  document.body.appendChild(ghost);

  // Set as drag image
  e.dataTransfer.setDragImage(ghost, 20, 20);

  // Clean up after drag
  requestAnimationFrame(() => {
    document.body.removeChild(ghost);
  });

  // Transfer pane ID
  e.dataTransfer.setData('application/pane-id', pane.id);
}
```

**Source:** Kryogenix custom drag image article, React DnD community patterns.

## Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| Zone detection math | @dnd-kit collision algorithms (closestCenter, closestCorners) | Handles edge cases (overlapping zones, pointer offset, threshold tuning) |
| Drag event handling | @dnd-kit sensors (Pointer, Mouse, Touch, Keyboard) | Cross-browser compatibility, accessibility (keyboard navigation) |
| Layout tree updates | react-resizable-panels imperative API | Already tested for nested groups, handles resize handle positioning |
| Drop zone visual feedback | CSS class toggling on dragenter/dragleave | Performance - dragover fires continuously, causes repaints |

## Pitfalls

### 1. dragover Event Performance
**What happens:** dragover fires continuously while dragging (every few ms). Updating state or DOM on every fire causes jank.

**Avoid by:** Use dragenter/dragleave for state changes. Only use dragover with throttling/debouncing if you need live cursor tracking.

### 2. Drag Ghost in Electron
**What happens:** setDragImage() may not work consistently in Electron on all platforms (especially Linux).

**Avoid by:** Test early on Linux. Fallback: use a positioned absolute div that follows cursor position (track with dragover + pointer position).

### 3. Nested Panel Group Key Stability
**What happens:** React re-renders entire nested tree when layout changes, causing panels to lose state (scroll position, terminal sessions).

**Avoid by:** Use stable keys based on pane IDs, not array indices. Store pane state outside the tree (Zustand store) and restore after re-mount.

```typescript
// BAD
{children.map((child, i) => <Panel key={i}>...</Panel>)}

// GOOD
{children.map((child) => <Panel key={child.paneId}>...</Panel>)}
```

### 4. Center vs Edge Zone Ambiguity
**What happens:** With 25% edge thresholds, small panes may have no usable center zone.

**Avoid by:** Use adaptive thresholds - min 40px edge zone, max 33% of pane dimension. Always leave at least 20% center zone.

```typescript
const edgeSize = Math.max(40, Math.min(rect.width * 0.33, rect.height * 0.33));
```

### 5. react-resizable-panels Imperative API Timing
**What happens:** setLayout() called during render causes "Cannot update during render" warnings.

**Avoid by:** Call imperative methods in effects or event handlers, never during render. Wrap in useEffect if triggered by state change.

```typescript
// BAD
if (shouldUpdateLayout) {
  panelGroupRef.current?.setLayout(newSizes);
}

// GOOD
useEffect(() => {
  if (shouldUpdateLayout) {
    panelGroupRef.current?.setLayout(newSizes);
  }
}, [shouldUpdateLayout]);
```

## Implementation Strategy

### Phase 1: Data Model
1. Replace `TabPaneState.splitDirection + panes[]` with recursive `SplitNode` tree
2. Add tree manipulation functions: swapPanes(), dockPane(), removePane()
3. Update Zustand store to serialize/deserialize tree for persistence

### Phase 2: Layout Rendering
1. Implement renderSplitNode() recursive renderer with nested PanelGroups
2. Test with 2x2 grid, L-shape, 3-pane layouts
3. Verify panel resize handles work correctly at all nesting levels

### Phase 3: Drag-and-Drop
1. Install @dnd-kit, set up DndContext provider
2. Make pane headers draggable (useDraggable hook)
3. Make panes droppable (useDroppable hook)
4. Implement zone detection in onDragOver
5. Add drop zone overlay rendering

### Phase 4: Visual Feedback
1. Implement custom drag ghost (setDragImage)
2. Add drop zone highlight CSS
3. Add smooth animations for layout transitions (CSS transitions on panel sizes)
4. Test on macOS, Windows, Linux (Electron-specific behavior)

### Phase 5: Polish
1. Add keyboard shortcuts (Cmd+K → split, arrow keys to navigate zones)
2. Persist layout tree in workspace snapshot
3. Add "reset layout" action (collapse to single pane)
4. Test with 10+ panes, deeply nested layouts

## How IDEs Implement This

### VS Code
- **Architecture:** Grid-based editor groups with LocalSelectionTransfer for intra-window drags
- **Zone detection:** EditorDropTarget.positionOverlay() calculates zones, EditorDropTarget.doHandleDrop() executes
- **Visual feedback:** Light blue overlay on valid drop zones
- **Source:** VS Code drag-drop DeepWiki documentation

### JetBrains IDEs
- **Architecture:** Tool window docking system separate from editor tabs
- **Zone detection:** Light blue shading on valid dock zones during drag
- **Configuration:** Settings allow requiring Alt key for drag-drop (prevents accidental drags)
- **UX note:** Users report re-docking floating windows is non-intuitive - ensure clear visual feedback
- **Source:** JetBrains IDE documentation and user forums

### Common Pattern
Both use **edge-based zone detection with visual overlay feedback**. Neither uses a library - custom implementations on native HTML5 drag-drop API.

## Library Comparison: @dnd-kit vs Pragmatic vs react-dnd

| Aspect | @dnd-kit | Pragmatic (Atlassian) | react-dnd |
|--------|----------|----------------------|-----------|
| Bundle size | ~15kB (modular) | ~4.7kB core | ~30kB |
| Performance | High (uses RAF, transforms) | Highest (built on HTML5 API) | Medium |
| React integration | First-class hooks | Framework-agnostic (works with React) | First-class |
| Collision detection | Built-in algorithms | Manual via hitbox package | Custom required |
| Accessibility | Keyboard sensors included | Not emphasized | Custom required |
| TypeScript | Full support | Authored in TypeScript | Full support |
| Electron notes | None found | None found | None found |
| Community | 5.4M weekly downloads, active | Growing (Atlassian product) | 2.7M weekly downloads, mature |
| Customization | High (toolkit approach) | Highest (headless) | High (low-level API) |

**Recommendation:** @dnd-kit for balance of features, performance, and React ergonomics. Pragmatic if bundle size is critical (<5kB core). Avoid react-dnd (larger, older patterns).

## Open Questions

1. **Does @dnd-kit work reliably in Electron across all platforms?**
   - **Status:** No explicit documentation found. HTML5 drag-drop API works in Electron (used for file drops).
   - **Next step:** Test early on Linux - this is where Electron drag-drop issues most often occur.

2. **Can react-resizable-panels handle 10+ nested levels without performance issues?**
   - **Status:** Documentation shows nested examples, but no performance benchmarks for deep nesting.
   - **Next step:** Prototype with 20-pane layout, profile React DevTools for render performance.

3. **Should we support dragging panes across terminal tabs (cross-tab moves)?**
   - **Status:** Out of scope per PHASE-29.md. Would require LocalSelectionTransfer pattern like VS Code.
   - **Next step:** Defer to future phase. Intra-tab drag-drop is sufficient for MVP.

4. **Alternative: Subdivide library?**
   - **Status:** Provides complete split-pane solution with drag-drop built-in.
   - **Concern:** Redux-based (we use Zustand). Last commit 2017 - likely abandoned.
   - **Decision:** Don't use. Build on react-resizable-panels (maintained, already integrated).

## Performance: Electron vs Browser

**Key difference:** Electron drag-drop is identical to browser - both use HTML5 API. No special Electron considerations.

**Native file drag:** Electron has `webview` drag-drop for OS files. Not relevant for intra-window pane dragging.

**Optimization tips:**
1. Use `will-change: transform` on dragged elements (GPU acceleration)
2. Use `requestAnimationFrame` for drag position updates
3. Avoid layout recalculations during drag (pre-compute zone boundaries)
4. Use CSS transforms instead of position changes

**Source:** Atlassian performance blog, pragmatic drag-and-drop design principles.

## Sources

**HIGH confidence:**
- [@dnd-kit collision detection algorithms documentation](https://docs.dndkit.com/api-documentation/context-provider/collision-detection-algorithms)
- [react-resizable-panels GitHub repository](https://github.com/bvaughn/react-resizable-panels)
- [Pragmatic drag-and-drop Atlassian documentation](https://atlassian.design/components/pragmatic-drag-and-drop/core-package/)
- [VS Code drag-and-drop system DeepWiki](https://deepwiki.com/microsoft/vscode/4.6-drag-and-drop-system)

**MEDIUM confidence:**
- [JetBrains IDE drag-drop documentation](https://www.jetbrains.com/guide/java/tips/drag-and-dock/)
- [Top 5 Drag-and-Drop Libraries for React in 2026 (Puck)](https://puckeditor.com/blog/top-5-drag-and-drop-libraries-for-react)
- [Custom drag ghost in React (Medium article)](https://medium.com/@shojib116/custom-drag-ghost-in-react-the-way-that-actually-works-c802e4ec7128)
- [Subdivide GitHub repository](https://github.com/philholden/subdivide)
- [Recursive React tree component (The Guild)](https://the-guild.dev/blog/recursive-react-tree-component-implementation-made-easy)

**LOW confidence (needs validation):**
- Zone detection threshold values (25% edge) - no authoritative source, inferred from UX best practices
- Electron drag-drop platform differences - mentioned in community forums but not officially documented
- Performance claims for pragmatic-drag-and-drop vs @dnd-kit - based on bundle size comparison, not runtime benchmarks
