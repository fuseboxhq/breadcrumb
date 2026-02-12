# Research: react-resizable-panels for 3-Column IDE Layout

**Date:** 2026-02-12
**Domain:** React UI Layout / Desktop IDE
**Library Version:** 2.1.7 (installed) / 4.6.2 (latest)
**Overall Confidence:** HIGH

## TL;DR

Use react-resizable-panels (already installed at v2.1.7, latest is v4.6.2 - consider upgrading) for the 3-column IDE layout. Key approach: collapsible right panel with conditional rendering via collapse/expand imperative API, nested PanelGroups for vertical splitting within the right panel, autoSaveId for automatic localStorage persistence. Don't hand-roll panel animations - the library doesn't support them and adding CSS transitions breaks drag-to-resize.

## Recommended Stack

| Library | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| react-resizable-panels | 4.6.2 | Layout panels with resize | HIGH |

**Upgrade command:**
```bash
npm install react-resizable-panels@latest
```

Current version (2.1.7) is 2 years old. Version 4.6.2 was released Feb 2026 and includes improvements to the imperative API (getSize, isCollapsed methods added in later versions).

## Key Patterns

### 1. Conditionally Visible Panel (Collapse to Zero Width)

**Use when:** Right panel should disappear when empty, expanding on demand.

**CRITICAL:** Do NOT use conditional JSX rendering (`{condition && <Panel>}`). The imperative API requires panels to stay in the DOM. Use collapse/expand instead.

```tsx
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useRef } from "react";
import type { ImperativePanelHandle } from "react-resizable-panels";

function AppShell() {
  const rightPanelRef = useRef<ImperativePanelHandle>(null);

  const openRightPanel = () => {
    rightPanelRef.current?.expand();
  };

  const closeRightPanel = () => {
    rightPanelRef.current?.collapse();
  };

  return (
    <PanelGroup direction="horizontal" autoSaveId="main-layout">
      <Panel id="sidebar" defaultSize={18} minSize={12} maxSize={30} order={1}>
        {/* Sidebar content */}
      </Panel>
      <PanelResizeHandle />

      <Panel id="center" order={2}>
        {/* Terminal workspace */}
      </Panel>
      <PanelResizeHandle />

      {/* Right panel: always rendered, but collapsible */}
      <Panel
        id="right-panel"
        ref={rightPanelRef}
        collapsible
        defaultSize={30}
        minSize={20}
        collapsedSize={0}
        order={3}
      >
        {/* Browser/planning content */}
      </Panel>
    </PanelGroup>
  );
}
```

**How collapse works:**
- Set `collapsible={true}` on the Panel
- When panel size is dragged below half its `minSize`, it auto-collapses to `collapsedSize`
- `collapsedSize` defaults to 0 (zero width = completely hidden)
- Use `ref.collapse()` and `ref.expand()` for programmatic control

### 2. Nested PanelGroups (Vertical Split Inside Horizontal)

**Use when:** Right panel needs internal vertical stacking (browser above planning pane).

```tsx
// Source: react-resizable-panels documentation
<PanelGroup direction="horizontal" autoSaveId="main-layout">
  <Panel id="sidebar" order={1}>...</Panel>
  <PanelResizeHandle />

  <Panel id="center" order={2}>...</Panel>
  <PanelResizeHandle />

  <Panel id="right-panel" collapsible ref={rightPanelRef} order={3}>
    {/* Nested vertical PanelGroup inside horizontal panel */}
    <PanelGroup direction="vertical">
      <Panel id="browser" defaultSize={60} minSize={30}>
        {/* Browser view */}
      </Panel>
      <PanelResizeHandle />
      <Panel id="planning" defaultSize={40} minSize={30}>
        {/* Planning dashboard */}
      </Panel>
    </PanelGroup>
  </Panel>
</PanelGroup>
```

**Key points:**
- Nesting is fully supported - component-based API makes this natural
- Each nested PanelGroup can have its own `direction` (horizontal/vertical)
- Each nested PanelGroup should have its own `autoSaveId` for separate persistence
- Assign `id` and `order` props to all panels for stable layouts

### 3. Persist Panel Sizes (autoSaveId + Storage)

**Use when:** Panel layouts should survive app restarts.

**Simple approach (recommended):**
```tsx
// Automatic persistence to localStorage
<PanelGroup direction="horizontal" autoSaveId="breadcrumb-main-layout">
  <Panel id="sidebar" defaultSize={18}>...</Panel>
  <PanelResizeHandle />
  <Panel id="center">...</Panel>
  <PanelResizeHandle />
  <Panel id="right-panel" defaultSize={30}>...</Panel>
</PanelGroup>
```

**Advanced approach (custom storage):**
```tsx
// Use electron-store instead of localStorage
import Store from 'electron-store';

const store = new Store();

const customStorage = {
  getItem: (name: string) => {
    return store.get(name) as string;
  },
  setItem: (name: string, value: string) => {
    store.set(name, value);
  }
};

<PanelGroup
  direction="horizontal"
  autoSaveId="breadcrumb-main-layout"
  storage={customStorage}
>
  {/* panels */}
</PanelGroup>
```

**For nested PanelGroups:**
```tsx
// Outer group
<PanelGroup autoSaveId="main-layout">...</PanelGroup>

// Inner group (different autoSaveId)
<PanelGroup autoSaveId="right-panel-split">...</PanelGroup>
```

**Caveats:**
- `autoSaveId` must be unique per PanelGroup
- Storage API must be synchronous (localStorage, electron-store work fine)
- Panels need stable `id` props for persistence to work correctly

### 4. Imperative API (ref.collapse, ref.expand, etc.)

**Use when:** You need programmatic control (hotkeys, sidebar clicks, etc.).

```tsx
import { useRef } from "react";
import type { ImperativePanelHandle } from "react-resizable-panels";

function MyComponent() {
  const panelRef = useRef<ImperativePanelHandle>(null);

  const togglePanel = () => {
    const panel = panelRef.current;
    if (panel?.isCollapsed()) {
      panel.expand();
    } else {
      panel.collapse();
    }
  };

  const setPanelSize = (size: number) => {
    panelRef.current?.resize(size); // size: 1-100 (percentage)
  };

  const checkSize = () => {
    const size = panelRef.current?.getSize(); // returns 0-100
    console.log(`Panel is ${size}% of parent`);
  };

  return (
    <>
      <button onClick={togglePanel}>Toggle Right Panel</button>
      <PanelGroup direction="horizontal">
        {/* ... */}
        <Panel ref={panelRef} collapsible>...</Panel>
      </PanelGroup>
    </>
  );
}
```

**Available methods on ImperativePanelHandle:**
- `collapse(): void` - Collapse panel to collapsedSize (if collapsible=true)
- `expand(): void` - Expand panel to its previous size
- `getSize(): number` - Returns current size as percentage (1-100)
- `isCollapsed(): boolean` - Returns true if size === 0
- `resize(size: number): void` - Set size to specific percentage (1-100)

**TypeScript helpers:**
```tsx
import { usePanelRef, usePanelCallbackRef } from "react-resizable-panels";
```

### 5. Best Practices for 3+ Panel Layouts

**Use when:** Building IDE-style horizontal layouts with multiple panels.

```tsx
// Source: Best practices from react-resizable-panels community
<PanelGroup direction="horizontal" autoSaveId="ide-layout">
  {/* Left sidebar - collapsible, narrow */}
  <Panel
    id="sidebar"
    defaultSize={18}   // 18% of total width
    minSize={12}       // Can't be smaller than 12%
    maxSize={30}       // Can't be larger than 30%
    collapsible
    order={1}
  >
    <Sidebar />
  </Panel>
  <PanelResizeHandle />

  {/* Center workspace - always visible, flexible */}
  <Panel
    id="center"
    minSize={30}       // Ensure center has breathing room
    order={2}
  >
    <TerminalWorkspace />
  </Panel>
  <PanelResizeHandle />

  {/* Right panel - collapsible, medium */}
  <Panel
    id="right"
    defaultSize={30}   // 30% of total width
    minSize={20}       // Minimum usable size
    collapsible
    collapsedSize={0}  // Collapse to invisible
    order={3}
  >
    <RightPanel />
  </Panel>
</PanelGroup>
```

**Guidelines:**
1. **Always specify defaultSize** - Prevents layout flicker on mount
2. **Set minSize on center panel** - Ensures workspace doesn't get crushed
3. **Use collapsible only where needed** - Not all panels need to collapse
4. **Assign id and order props** - Required for stable layouts and persistence
5. **Sum of defaultSizes should be 100** - Not enforced, but prevents surprises
6. **Don't mix pixels and percentages** - Library uses percentages (1-100)

**Don't:**
- Don't conditionally render panels with JSX - breaks imperative API
- Don't set maxSize on all panels - at least one should be flexible
- Don't forget PanelResizeHandle between panels - no handle = no resize
- Don't use CSS transitions on panel size - breaks drag-to-resize

## Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| Panel collapse animations | Library's imperative API | CSS transitions break drag-to-resize. Library doesn't support animations - accept instant collapse/expand. |
| Custom drag handlers | PanelResizeHandle | Handles pointer math, touch events, accessibility. |
| Layout persistence | autoSaveId prop | Automatic localStorage sync. No manual onResize handlers needed. |
| Conditional panel visibility | ref.collapse()/expand() | Imperative API requires panels to stay in DOM. Conditional rendering breaks it. |

## Pitfalls

### 1. Animation Support is Limited

**What happens:** Adding CSS transitions to panel width/height breaks drag-to-resize functionality.

**Why:** The library applies inline styles during drag operations. Transitions interfere with the smooth dragging experience.

**Avoid by:**
- Accept instant collapse/expand (it's fast enough)
- If animations are critical, use a wrapper div inside the Panel with opacity/transform transitions
- Don't apply transitions to the Panel component itself

**Source:** GitHub issue #310 - maintainer confirmed "the library doesn't really support animation"

### 2. Conditional Rendering Breaks Imperative API

**What happens:** Using `{condition && <Panel ref={ref}>}` causes imperative methods (collapse, expand, getSize) to fail or behave unpredictably.

**Why:** The imperative API requires panels to maintain consistent DOM presence. When a panel unmounts, refs become stale.

**Avoid by:**
- Always render all panels
- Control visibility via `ref.collapse()` and `ref.expand()` instead
- Set `collapsible={true}` and use `collapsedSize={0}` for hidden panels

**Source:** GitHub issue #285 - maintainer confirmed "panel must be rendered (even if it's collapsed)"

### 3. Nested PanelGroups Need Unique autoSaveId

**What happens:** Using the same `autoSaveId` for nested PanelGroups causes layout conflicts and persistence bugs.

**Why:** The library uses `autoSaveId` as a localStorage key. Duplicate keys overwrite each other.

**Avoid by:**
- Assign unique `autoSaveId` to each PanelGroup (e.g., "main-layout", "right-panel-split")
- Document the autoSaveId naming convention in code comments
- Consider namespacing: "breadcrumb:main-layout", "breadcrumb:right-panel"

### 4. Panel Sizes Don't Update After Mount Without id/order Props

**What happens:** Panels shift unexpectedly when resizing or reloading the app.

**Why:** Without stable `id` and `order` props, the library can't track which panel is which across renders.

**Avoid by:**
- Always assign `id` and `order` to all Panel components
- Make `id` descriptive ("sidebar", "center", "right-panel")
- Use sequential `order` values (1, 2, 3) for clarity

### 5. Version 2.1.7 is Outdated

**What happens:** Missing newer API methods like `isCollapsed()` and `getSize()`.

**Why:** The app uses v2.1.7 (from ~2023), but latest is v4.6.2 (Feb 2026).

**Avoid by:**
- Upgrade to latest version: `npm install react-resizable-panels@latest`
- Review changelog for breaking changes (unlikely - library is stable)
- Test imperative API after upgrade to access newer methods

## Open Questions

1. **Keyboard navigation between panels** - The library provides accessible resize handles, but keyboard focus management between panel contents is application-specific. Need to implement custom focus trap or keyboard shortcuts.

2. **Panel transition timing** - If animations are later required (e.g., for Cmd+K right panel toggle), what's the best wrapper strategy? Opacity transitions on inner divs? Transform: translateX? Needs experimentation.

3. **Electron-store integration** - Will custom storage API work seamlessly with autoSaveId? The sync nature of electron-store should work, but needs testing in main/renderer IPC context.

4. **Collapsed panel hotkey state** - How to sync hotkey toggle state with user-initiated collapse (dragging handle below minSize)? May need onCollapse callback or polling isCollapsed().

## Sources

**HIGH confidence:**
- [react-resizable-panels official documentation](https://react-resizable-panels.vercel.app/)
- [GitHub repository - bvaughn/react-resizable-panels](https://github.com/bvaughn/react-resizable-panels)
- [NPM package page](https://www.npmjs.com/package/react-resizable-panels)
- [Imperative Panel API example](https://react-resizable-panels.vercel.app/examples/imperative-panel-api)
- [Collapsible panel example](https://react-resizable-panels.vercel.app/examples/collapsible)
- [Conditional rendering example](https://react-resizable-panels.vercel.app/examples/conditional)

**MEDIUM confidence:**
- [LogRocket: Essential tools for React panel layouts](https://blog.logrocket.com/essential-tools-implementing-react-panel-layouts/)
- [DhiWise: React Resizable Panels Guide](https://www.dhiwise.com/post/react-resizable-panels-crafting-fluid-interfaces-with-ease)

**LOW confidence (needs validation):**
- Animation workarounds - no official guidance exists, community suggestions vary
- Best practices for 3+ panels - extrapolated from 2-panel examples and general UI conventions
