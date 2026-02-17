# Phase 26: Multi-Tab Browser & Universal Split Panes

**Status:** in_progress
**Beads Epic:** breadcrumb-gpr
**Created:** 2026-02-14

## Objective

Transform the Breadcrumb desktop IDE into a true multi-pane workspace by adding multi-tab browser support (in both the right panel and center workspace), promoting any content type into the center area, and enabling universal pane splitting so terminals, diffs, and browsers can all be split and arranged within a single tab — like VS Code's split editor, but for all content types.

## Research Summary

**Overall Confidence:** HIGH

The approach is well-defined: Electron natively supports multiple `WebContentsView` instances via `addChildView()`/`removeChildView()`, and `react-resizable-panels` supports dynamic panel groups with conditional rendering using panel IDs. The main complexity is migrating the terminal-specific pane system to a generic content pane system without breaking existing functionality.

### Key Patterns

**Multi-WebContentsView (Electron):**
Each browser instance gets its own `WebContentsView` added to `mainWindow.contentView`. Bounds are set per-view. Views can be added/removed dynamically. No special library needed — it's native Electron.

```js
const view = new WebContentsView()
win.contentView.addChildView(view)
view.setBounds({ x, y, width, height })
```

**Dynamic panels (react-resizable-panels):**
Panels can be conditionally rendered. Use stable `id` props so the layout manager correctly adjusts sizes when panels appear/disappear. Imperative API available via `usePanelRef()` for programmatic resize/collapse.

```tsx
<PanelGroup direction="horizontal">
  {panes.map(pane => (
    <Fragment key={pane.id}>
      <Panel id={pane.id}><ContentRenderer pane={pane} /></Panel>
      <PanelResizeHandle />
    </Fragment>
  ))}
</PanelGroup>
```

**Generic ContentPane discriminated union:**
```typescript
type ContentPane =
  | { type: "terminal"; id: string; sessionId: string; cwd: string; ... }
  | { type: "browser"; id: string; browserId: string; url: string; }
  | { type: "diff"; id: string; diffHash: string; diffProjectPath: string; }
```

### Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| Panel resize/split UI | `react-resizable-panels` | Already used throughout the app, handles keyboard/touch/mouse |
| Drag-and-drop | HTML5 Drag API (`draggable`, `onDragStart/Over/Drop`) | Native, no library needed for tab-to-tab DnD |
| Browser view management | Electron `WebContentsView` directly | Native API, each view is independent |

### Pitfalls

- **Bounds race condition**: Multiple browser views updating bounds simultaneously can cause flickering. Use `requestAnimationFrame` throttling per-view (existing `useBoundsSync` pattern).
- **WebContentsView z-order**: Views added later render on top. When switching browser tabs, must reorder with `removeChildView` + `addChildView` to bring active view to front.
- **View cleanup**: Forgetting to call `removeChildView` and destroy WebContents on close causes memory leaks. Must clean up in both tab close and app shutdown.
- **Migration safety**: The TerminalPane → ContentPane migration must preserve all existing terminal pane behavior (Claude numbering, process detection, initial commands, zoom).

### Design Guidance

The `frontend-design` skill will be active during execution of UI tasks in this phase. It provides guidelines for typography, color, motion, spatial composition, and avoiding generic aesthetics.

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
- Drag-and-drop reordering of center workspace tabs
- Floating/detached windows (separate Electron windows)
- Browser extension support
- Tab groups or tab stacking
- Cross-tab drag-and-drop (dragging a pane from one tab to another)

## Constraints

- Must use Electron's `WebContentsView` (not deprecated `BrowserView`)
- Follow existing `react-resizable-panels` patterns for split panes
- Follow existing Zustand + immer state management patterns
- Browser bounds syncing must handle multiple simultaneous views without performance issues
- Frontend design skill active — follow design thinking process for UI tasks

## Tasks

| ID | Title | Status | Complexity | Dependencies |
|----|-------|--------|------------|--------------|
| breadcrumb-gpr.1 | Refactor BrowserViewManager for multi-instance support | open | High | - |
| breadcrumb-gpr.2 | Build generic ContentPane system in appStore | open | High | - |
| breadcrumb-gpr.3 | Multi-tab browser in right panel | open | Medium | breadcrumb-gpr.1 |
| breadcrumb-gpr.4 | Browser as center workspace tab with promote button | open | Medium | breadcrumb-gpr.1, breadcrumb-gpr.2 |
| breadcrumb-gpr.5 | Universal pane splitting for all content types | open | High | breadcrumb-gpr.2 |
| breadcrumb-gpr.6 | Drag-and-drop tab promotion from right panel to center | open | Medium | breadcrumb-gpr.4 |
| breadcrumb-gpr.7 | Persistence and cleanup for browser tabs and universal panes | open | Medium | breadcrumb-gpr.3, breadcrumb-gpr.4, breadcrumb-gpr.5 |

### Task Details

**breadcrumb-gpr.1: Refactor BrowserViewManager for multi-instance support**
- Replace singleton `BrowserViewManager` with a registry pattern: `Map<string, BrowserViewInstance>` keyed by `browserId`
- Each instance owns one `WebContentsView` with independent bounds, navigation state, and event forwarding
- Add `browserId` parameter to all IPC channels: `browser:create`, `browser:navigate`, `browser:set-bounds`, etc.
- Add `browserId` to all event types: `BrowserNavigateEvent`, `BrowserLoadingChangeEvent`, etc.
- Update `preload/index.ts` API surface: all browser methods accept `browserId` as first parameter
- Update `browserIpc.ts` handlers to route commands to correct instance
- Factory methods: `createBrowser(browserId)`, `destroyBrowser(browserId)`, `showBrowser(browserId)`, `hideBrowser(browserId)`
- Handle z-ordering: active browser view is always on top via `removeChildView`/`addChildView` reorder
- DevTools attaches to whichever browser is currently focused

**breadcrumb-gpr.2: Build generic ContentPane system in appStore**
- Define `ContentPane` discriminated union: `TerminalPaneData | BrowserPaneData | DiffPaneData`
- `TerminalPaneData`: existing `TerminalPane` fields + `type: "terminal"`
- `BrowserPaneData`: `type: "browser"`, `browserId`, `url`
- `DiffPaneData`: `type: "diff"`, `diffHash`, `diffProjectPath`, `pinned?`
- Generalize `TabPaneState.panes` from `TerminalPane[]` to `ContentPane[]`
- Migrate all terminal pane actions (`addPane`, `removePane`, `setActivePane`, etc.) to work with the generic system
- Preserve terminal-specific logic: Claude numbering, process detection, initial commands, zoom — all guarded by `pane.type === "terminal"` checks
- Add `"browser"` to `TabType`
- Add browser-specific fields to `WorkspaceTab`: `browserId?`, `initialUrl?`
- Extend `RightPanelPane` with `browserId?`, `url?` fields

**breadcrumb-gpr.3: Multi-tab browser in right panel** (frontend-design skill active)
- Add a tab bar UI to the browser pane section in `RightPanel.tsx`
- Each browser tab creates a unique `browserId` and calls `createBrowser(browserId)` via IPC
- Tab bar supports: new tab (+), close tab (x), switch active tab
- `BrowserPanel.tsx` becomes `browserId`-aware: accepts `browserId` prop, parameterizes all API calls
- Event subscriptions scoped to `browserId` (no cross-tab event leakage)
- Bounds syncing via `useBoundsSync(browserId)` — only active tab's view is visible
- Inactive browser views hidden off-screen (setBounds to -9999) or removed from contentView
- Default first tab opens `localhost:3000` (existing behavior preserved)

**breadcrumb-gpr.4: Browser as center workspace tab with promote button** (frontend-design skill active)
- Add `"browser"` case to `WorkspaceContent.tsx` switch statement
- Render `BrowserPanel` with full center-area sizing when a browser tab is active
- Add `openBrowserTab(url?)` action to appStore that creates a center workspace tab
- "Open in main area" button in right panel browser tab bar — calls `openBrowserTab(currentUrl)` and optionally closes the right panel tab
- Browser tab in center tab bar shows favicon/globe icon + page title
- Handle bounds syncing: center browser uses the center panel's dimensions, not right panel's

**breadcrumb-gpr.5: Universal pane splitting for all content types** (frontend-design skill active)
- Replace terminal-only `PanelGroup` rendering in `TerminalPanel.tsx` with a generic `UniversalPaneRenderer`
- `UniversalPaneRenderer` takes `ContentPane[]` and renders each based on `pane.type`:
  - `terminal` → `TerminalInstance`
  - `browser` → `BrowserPanel`
  - `diff` → `DiffViewer`
- Split toolbar available for all content types (not just terminals): split horizontal, split vertical, close pane
- Context menu for panes: "Split Right", "Split Down", "Close Pane"
- When splitting, new pane defaults to same type as current pane (terminal splits into terminal, browser into browser)
- `addPane` action generalized: `addPane(tabId, paneType, direction?, config?)`
- Keyboard shortcuts extend to all pane types: Cmd+D splits, Cmd+W closes

**breadcrumb-gpr.6: Drag-and-drop tab promotion from right panel to center**
- Make right panel browser tabs draggable: `draggable="true"`, `onDragStart` sets `dataTransfer` with browser tab data
- Add drop zone on center `TabBar.tsx`: `onDragOver` shows visual indicator, `onDrop` creates center browser tab
- Drag ghost shows browser tab title/URL
- Drop indicator: highlight line or gap in tab bar where tab will land
- On successful drop, optionally close the right panel tab (or keep both)
- Handle drag cancellation gracefully

**breadcrumb-gpr.7: Persistence and cleanup for browser tabs and universal panes**
- Extend `SerializedTab` to include browser fields (`browserId`, `url`) and pane layout
- Update `buildWorkspaceSnapshot()` to serialize browser tab URLs and universal pane layouts
- Update `restoreWorkspace()` to recreate browser WebContentsViews and navigate to saved URLs
- Persist right panel browser tabs (URLs, active tab)
- Clean up WebContentsViews on: tab close, pane close, right panel tab close, app shutdown
- Handle edge case: restored browser tabs may fail to load (show error overlay, don't crash)
- Exclude browser tabs with `about:blank` or empty URLs from persistence

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Split model | Pane splits within tabs | Keeps the tab model simple, extends existing pattern from terminal panes |
| Browser location | Both right panel + center workspace | Right panel for quick reference, center for focused browsing |
| Promote interaction | Button primary + drag-and-drop | Button is discoverable, DnD is power-user enhancement |
| Pane type system | Generic `ContentPane` discriminated union | Replaces terminal-specific panes, extensible for future content types |
| Multi-browser impl | Multiple WebContentsViews keyed by browserId | Each browser pane gets its own native view with independent bounds |
| View visibility | Hide inactive views off-screen | Simpler than add/remove — avoids re-initialization on tab switch |
| BrowserViewManager pattern | Registry map, not singleton | Each instance is independent, clean lifecycle management |

## Completion Criteria

- [ ] Right panel browser has a tab bar supporting multiple concurrent browser tabs
- [ ] Browser tabs can be opened as center workspace tabs (full-width browsing)
- [ ] "Open in main area" button promotes a right-panel browser tab to center workspace
- [ ] Drag-and-drop from right panel browser tab to center tab bar works
- [ ] Any content type (terminal, diff, browser) can be split horizontally/vertically within a tab
- [ ] Multiple browser WebContentsViews render simultaneously without bounds conflicts
- [ ] Browser tab and pane state persists across app restart

## Sources

**HIGH confidence:**
- Direct codebase audit: `BrowserViewManager.ts`, `BrowserPanel.tsx`, `RightPanel.tsx`, `WorkspaceContent.tsx`, `appStore.ts`, `shared/types/index.ts`, `preload/index.ts`
- Electron docs: `WebContentsView` supports multiple instances natively via `addChildView()`
- react-resizable-panels docs: conditional panel rendering with stable IDs, imperative API

**MEDIUM confidence:**
- Z-ordering strategy (remove+re-add to bring to front) — common pattern but needs testing
- HTML5 Drag API for cross-panel promotion — straightforward but edge cases with Electron
