# Research: Accessible Tree View Component for Sidebar

**Task ID:** PHASE-10-tree-component
**Date:** 2026-02-12
**Domain:** React UI Component (Tree View)
**Overall Confidence:** HIGH

## TL;DR

Build a custom lightweight tree component. For ~50 nodes (projects + tabs + panes), virtualization is unnecessary overhead. React-arborist and react-complex-tree are excellent for large datasets (1000+ nodes) but add complexity and bundle weight you don't need. A custom implementation gives you full control over the Project → Tab → Pane hierarchy, integrates cleanly with your existing Zustand stores, and keeps styling consistent with your Dracula-inspired design system.

## Recommended Stack

| Library | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| None (custom) | - | Tree view logic | HIGH |
| Zustand | 5.0.0 (existing) | State management | HIGH |
| Tailwind CSS | 3.4.14 (existing) | Styling | HIGH |
| Lucide React | 0.563.0 (existing) | Icons (ChevronRight) | HIGH |

**Install:**
```bash
# No new dependencies needed
```

## Key Patterns

### WAI-ARIA Tree View Structure
**Use when:** Building accessible tree navigation
```tsx
// Source: W3C WAI-ARIA Authoring Practices Guide
<div role="tree" aria-label="Project Terminals">
  <div role="treeitem" aria-expanded="true" aria-level="1" tabIndex={0}>
    <button>Project Name</button>
    <div role="group">
      <div role="treeitem" aria-expanded="false" aria-level="2" tabIndex={-1}>
        <button>Terminal Tab</button>
        <div role="group">
          <div role="treeitem" aria-level="3" tabIndex={-1}>
            Split Pane
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
```

### Keyboard Navigation (Required for Accessibility)
**Use when:** Implementing keyboard controls per W3C standards
```tsx
// Source: WAI-ARIA APG Tree View Pattern
const handleKeyDown = (e: React.KeyboardEvent, nodeId: string) => {
  switch (e.key) {
    case 'ArrowRight':
      // If collapsed: expand. If expanded: focus first child
      if (isCollapsed(nodeId)) expand(nodeId);
      else focusFirstChild(nodeId);
      break;
    case 'ArrowLeft':
      // If expanded: collapse. If collapsed: focus parent
      if (isExpanded(nodeId)) collapse(nodeId);
      else focusParent(nodeId);
      break;
    case 'ArrowDown':
      focusNext(nodeId);
      break;
    case 'ArrowUp':
      focusPrevious(nodeId);
      break;
    case 'Home':
      focusFirst();
      break;
    case 'End':
      focusLast();
      break;
    case 'Enter':
    case ' ':
      activate(nodeId);
      break;
  }
};
```

### Roving TabIndex for Focus Management
**Use when:** Managing keyboard focus in tree
```tsx
// Source: WAI-ARIA APG Keyboard Interface Patterns
// Only one treeitem has tabIndex={0} at a time; all others are tabIndex={-1}
const TreeItem = ({ nodeId, isFocused }) => (
  <div
    role="treeitem"
    tabIndex={isFocused ? 0 : -1}
    onFocus={() => setFocusedNode(nodeId)}
  >
    {/* content */}
  </div>
);
```

### Expand/Collapse Animation
**Use when:** Adding smooth height transitions
```tsx
// Source: CSS-Tricks + react-collapse patterns
const TreeNode = ({ expanded, children }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | 'auto'>(0);

  useEffect(() => {
    if (expanded && contentRef.current) {
      setHeight(contentRef.current.scrollHeight);
      // After transition completes, set to 'auto' for dynamic content
      const timer = setTimeout(() => setHeight('auto'), 300);
      return () => clearTimeout(timer);
    } else {
      setHeight(0);
    }
  }, [expanded]);

  return (
    <div
      ref={contentRef}
      style={{
        height,
        overflow: 'hidden',
        transition: 'height 280ms cubic-bezier(0.4, 0, 0.2, 1)'
      }}
    >
      {children}
    </div>
  );
};
```

### Tree State Management with Zustand
**Use when:** Managing expand/collapse and selection state
```tsx
// Extend existing appStore or create sidebarStore
interface TreeState {
  expandedNodes: Set<string>; // node IDs
  selectedNode: string | null;
  focusedNode: string | null;
}

interface TreeActions {
  toggleNode: (id: string) => void;
  expandNode: (id: string) => void;
  collapseNode: (id: string) => void;
  selectNode: (id: string) => void;
  setFocusedNode: (id: string) => void;
}
```

### Visual States (VS Code Pattern)
**Use when:** Styling hover, active, and selected states
```tsx
// Source: VS Code theme colors and tree widget patterns
// Separate concerns: selected (user choice), active (current view), focused (keyboard)
<button
  className={cn(
    // Base styles
    "px-2 py-1.5 rounded-md transition-default",
    // Hover state (not when active)
    "hover:bg-muted/50",
    // Selected state (user selected this node)
    isSelected && "bg-primary/10 text-primary",
    // Active state (this is the current terminal/pane in view)
    isActive && "bg-primary/20 border-l-2 border-primary",
    // Focus state (keyboard navigation)
    isFocused && "ring-2 ring-primary/50"
  )}
>
```

## Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| Virtualization for 50 nodes | Nothing - skip it | Adds complexity (react-window, tanstack-virtual) for zero benefit. Virtualization is for 1000+ nodes. 50 nodes render instantly. |
| Drag-and-drop reordering | Custom implementation if needed later | Libraries like react-arborist include this, but you don't need it yet. Add later if users request reordering tabs. |
| Type-ahead search | Custom implementation | Simple string matching is fine. Don't pull in a search library for a sidebar tree. |

## Library Comparison (If You Change Your Mind)

### react-arborist
- **Version:** 3.4.3 (last updated 1 year ago)
- **Downloads:** 115,527/week
- **Bundle Size:** ~329 KB unpacked (minified+gzip metrics not verified)
- **Pros:** Virtualized rendering, drag-and-drop built-in, highly customizable, popular
- **Cons:** Over-engineered for 50 nodes, requires learning custom API, styling is fully your responsibility
- **Use when:** You expect 1000+ nodes, need drag-and-drop now, or want battle-tested virtualization
- **Confidence:** MEDIUM (library is mature but overkill for this use case)

### react-complex-tree
- **Version:** 2.6.1 (Oct 2025)
- **Downloads:** 27,098/week
- **Bundle Size:** Zero dependencies
- **Pros:** W3C-compliant accessibility, full keyboard navigation, multi-select, drag-and-drop, TypeScript support
- **Cons:** "Unopinionated" means you build everything, successor library "Headless Tree" in beta suggests API churn
- **Use when:** Accessibility is critical and you want a library that handles it, or you need multi-tree environments
- **Confidence:** HIGH (for accessibility), MEDIUM (for long-term API stability)

### Custom Implementation (RECOMMENDED)
- **Bundle Size:** 0 KB (no dependencies)
- **Pros:** Full control, integrates directly with Zustand stores, matches your design system exactly, no API learning curve, easy to debug
- **Cons:** You implement keyboard navigation and accessibility yourself (but it's straightforward with WAI-ARIA patterns above)
- **Use when:** Tree is simple (3 levels max), node count is low (<100), and you want maximum flexibility
- **Confidence:** HIGH

## Virtualization: When Is It Needed?

**Threshold for virtualization:** 1000+ visible nodes minimum.

**Your use case:** ~50 nodes maximum (assume 5 projects × 4 terminals × 2 panes = 40 nodes). Even with 20 projects, you'd hit ~160 nodes.

**Verdict:** Skip virtualization entirely. It adds complexity (react-window, @tanstack/react-virtual) for zero performance benefit at this scale. React renders 50 DOM nodes in milliseconds. Virtualization is for rendering 10,000+ items or infinite scroll scenarios.

**Evidence:**
- TanStack Virtual docs: "rendering large lists and tabular data" (thousands of items)
- react-arborist demos: "over 30,000 nodes" to showcase performance
- Performance guides: "when rendering a list with 10,000+ items in React, things start to slow down"

**Confidence:** HIGH

## Pitfalls

### Pitfall: CSS `height: auto` Doesn't Transition
**What happens:** Setting `height: auto` in CSS transitions doesn't animate. The browser can't interpolate between a pixel value and `auto`.

**Avoid by:** Measure the element's `scrollHeight` with JavaScript and transition to that explicit pixel value. After the transition completes, set `height: 'auto'` to allow dynamic resizing.

**Example:**
```tsx
// BAD: Doesn't animate
<div style={{ height: expanded ? 'auto' : 0, transition: 'height 300ms' }}>

// GOOD: Animates smoothly
const height = expanded ? contentRef.current?.scrollHeight : 0;
<div style={{ height, transition: 'height 300ms' }}>
```

**Confidence:** HIGH

### Pitfall: Breaking ARIA Semantics with Custom Render
**What happens:** Using `<div role="treeitem">` but putting interactive elements like buttons inside without proper structure breaks screen reader navigation.

**Avoid by:** The treeitem role should be on the interactive element itself (the button), not a wrapper div. Or, use `aria-owns` to establish the relationship correctly.

**Example:**
```tsx
// BAD: Screen readers see nested interactives
<div role="treeitem">
  <button>Click me</button>
</div>

// GOOD: The interactive element IS the treeitem
<button role="treeitem" aria-expanded="true">
  Click me
</button>
```

**Confidence:** HIGH

### Pitfall: Losing Keyboard Focus After Node Expansion
**What happens:** When a node expands, React re-renders children. If you don't manage focus explicitly, the user's keyboard position is lost.

**Avoid by:** Store the focused node ID in state. After expansion, restore focus to the correct element using `useEffect` and `element.focus()`.

**Example:**
```tsx
const treeItemRef = useRef<HTMLButtonElement>(null);

useEffect(() => {
  if (isFocused && treeItemRef.current) {
    treeItemRef.current.focus();
  }
}, [isFocused]);
```

**Confidence:** HIGH

### Pitfall: Forgetting `tabIndex={-1}` for Non-Focused Items
**What happens:** If all treeitems have `tabIndex={0}`, tab navigation includes every node instead of moving to the next UI component. This violates WAI-ARIA guidelines.

**Avoid by:** Use roving tabindex: only the currently focused treeitem has `tabIndex={0}`. All others have `tabIndex={-1}`.

**Confidence:** HIGH

### Pitfall: Over-Engineering Selection vs. Active vs. Focused States
**What happens:** You conflate "selected" (user clicked), "active" (current view), and "focused" (keyboard navigation) into one state, causing visual confusion.

**Avoid by:** Separate these states explicitly. VS Code does this well:
- **Selected:** User clicked this node (light background)
- **Active:** This is the current terminal/pane in the workspace (stronger background + border)
- **Focused:** Keyboard navigation is on this node (ring or outline)

**Confidence:** MEDIUM (design choice, but important for UX clarity)

## Open Questions

1. **Should expand/collapse state persist across sessions?** (e.g., save to localStorage or electron-store)
   - Recommendation: Yes, for UX continuity. Users expect sidebar state to persist.

2. **Should the tree auto-expand to reveal the active terminal/pane?**
   - Recommendation: Yes, when a terminal tab is activated, auto-expand its parent nodes in the sidebar tree so the user can always see where they are.

3. **Should right-click context menus appear on tree nodes or require a dedicated button?**
   - Recommendation: Right-click on the node itself (standard IDE pattern). VS Code does this. Provide keyboard equivalent (e.g., Shift+F10 or custom shortcut).

4. **Should we support multi-select in the tree?** (e.g., select multiple terminals and close them all)
   - Recommendation: Not in Phase 10. Single-select is sufficient for MVP. Add multi-select later if users request bulk operations.

## Implementation Checklist

- [ ] Create TreeNode component with ARIA roles (role="tree", role="treeitem", role="group")
- [ ] Implement keyboard navigation (Arrow keys, Home/End, Enter/Space)
- [ ] Implement roving tabindex for focus management
- [ ] Add expand/collapse animation using measured height transitions
- [ ] Separate visual states: selected, active, focused
- [ ] Add aria-expanded, aria-level, aria-label attributes
- [ ] Connect to Zustand store for expand/collapse state
- [ ] Test with keyboard-only navigation (no mouse)
- [ ] Test with screen reader (VoiceOver on macOS)
- [ ] Add auto-expand to reveal active terminal/pane
- [ ] Persist expand/collapse state to electron-store
- [ ] Add right-click context menu integration (future)

## Sources

**HIGH confidence:**
- [Tree View Pattern | APG | WAI | W3C](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/) - ARIA specification
- [Navigation Treeview Example | APG | WAI | W3C](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/examples/treeview-navigation/) - Working example
- [Developing a Keyboard Interface | APG | WAI | W3C](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/) - Keyboard patterns
- [GitHub - lukasbach/react-complex-tree](https://github.com/lukasbach/react-complex-tree) - Library analysis
- [Accessibility | React Complex Tree](https://rct.lukasbach.com/docs/guides/accessibility/) - Accessibility best practices

**MEDIUM confidence:**
- [GitHub - brimdata/react-arborist](https://github.com/brimdata/react-arborist) - Library features
- [7 Best React Tree View Components For React App (2026 Update)](https://reactscript.com/best-tree-view/) - Library comparison
- [react-arborist npm trends comparison](https://npmtrends.com/react-accessible-treeview-vs-react-arborist-vs-react-checkbox-tree-vs-react-complex-tree-vs-react-simple-tree-menu-vs-react-tree-menu-vs-react-treeview) - Download statistics
- [VS Code Theme Color Reference](https://code.visualstudio.com/api/references/theme-color) - Visual patterns
- [Using CSS Transitions on Auto Dimensions | CSS-Tricks](https://css-tricks.com/using-css-transitions-auto-dimensions/) - Animation technique

**LOW confidence (needs validation):**
- [VS Code Lists And Trees Wiki](https://github.com/Microsoft/vscode/wiki/Lists-And-Trees) - Implementation details (older wiki page)
- react-arborist bundle size: Unverified (329 KB unpacked reported on forks, but minified+gzip not confirmed)
