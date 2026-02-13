# Research: DevTools Bottom Dock Panel in Electron

**Date:** 2026-02-13
**Domain:** Electron Desktop IDE / WebContentsView / DevTools
**Overall Confidence:** HIGH

## TL;DR

Use `webContents.setDevToolsWebContents()` with a dedicated WebContentsView to render DevTools inline in a bottom dock panel. This is the native, officially supported approach. For layout, nest a vertical PanelGroup inside your existing horizontal layout using react-resizable-panels—the library explicitly supports nested multi-level layouts.

## Recommended Stack

| Library | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| Electron WebContentsView | 33.0.0+ | DevTools container | HIGH |
| react-resizable-panels | 2.1.7 | Nested layout management | HIGH |
| Electron webContents API | Native | DevTools control | HIGH |

**Already installed in your project:** Both libraries are in use (Electron 33.0.0, react-resizable-panels 2.1.7)

## Key Patterns

### 1. Create DevTools WebContentsView

```typescript
// In main process
import { WebContentsView } from 'electron';

// Create a WebContentsView specifically for DevTools
const devToolsView = new WebContentsView({
  webPreferences: {
    devTools: false // DevTools of DevTools not needed
  }
});

// Get reference to your browser WebContentsView
const browserView = /* your existing browser WebContentsView */;

// Point DevTools to render in the dedicated view
browserView.webContents.setDevToolsWebContents(devToolsView.webContents);

// Open DevTools (will render in devToolsView)
browserView.webContents.openDevTools({ mode: 'detach' });
```

**Source:** [Electron webContents API](https://www.electronjs.org/docs/latest/api/web-contents)

### 2. Position DevTools View in Bottom Dock

```typescript
// In main process — after setting up devToolsView
const mainWindow = /* your BaseWindow */;

// Add DevTools view as child
mainWindow.contentView.addChildView(devToolsView);

// Position at bottom (example bounds)
const { width, height } = mainWindow.getBounds();
const devToolsHeight = 300; // or dynamic based on user preference

devToolsView.setBounds({
  x: 0,
  y: height - devToolsHeight,
  width: width,
  height: devToolsHeight
});
```

**Important:** You must manage bounds updates when window resizes or dock toggles.

### 3. Nested PanelGroup for Layout (React)

```tsx
// In renderer — AppShell.tsx or similar
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

export function AppShell() {
  return (
    <div className="flex flex-col h-screen">
      <TitleBar />

      {/* Outer vertical split: main content (top) + devtools dock (bottom) */}
      <PanelGroup direction="vertical" className="flex-1">

        {/* Top panel: existing 3-column horizontal layout */}
        <Panel defaultSize={70} minSize={30}>
          <div className="flex h-full">
            <ActivityBar />

            {/* Your existing horizontal PanelGroup */}
            <PanelGroup direction="horizontal" className="flex-1">
              <Panel /* sidebar */ />
              <PanelResizeHandle />
              <Panel /* center terminals */ />
              <PanelResizeHandle />
              <Panel /* right browser */ />
            </PanelGroup>
          </div>
        </Panel>

        {/* Resize handle between main content and devtools */}
        <PanelResizeHandle />

        {/* Bottom panel: DevTools dock */}
        <Panel
          defaultSize={30}
          minSize={15}
          collapsible
          collapsedSize={0}
        >
          <div id="devtools-container" className="h-full w-full" />
        </Panel>

      </PanelGroup>

      <StatusBar />
    </div>
  );
}
```

**Source:** [react-resizable-panels GitHub](https://github.com/bvaughn/react-resizable-panels)

**Pattern confirmed:** The library explicitly supports "nestable groups" for complex IDE layouts. Panel elements must be direct DOM children of their parent Group.

### 4. Toggle DevTools Visibility

```typescript
// Main process IPC handler
ipcMain.handle('toggle-devtools', async (event) => {
  const browserView = /* get browser view */;
  const devToolsView = /* get devtools view */;

  if (browserView.webContents.isDevToolsOpened()) {
    browserView.webContents.closeDevTools();
    devToolsView.setVisible(false); // Hide the view
  } else {
    browserView.webContents.openDevTools();
    devToolsView.setVisible(true); // Show the view
  }
});
```

**Alternative (React side):** Use `Panel.collapse()` / `Panel.expand()` imperatively via `ImperativePanelHandle` ref, same pattern as your current sidebar/right panel toggles.

## Architecture Decision: WebContentsView vs BrowserWindow

**Recommended: WebContentsView**

| Approach | Pros | Cons | Confidence |
|----------|------|------|------------|
| WebContentsView | - Native inline rendering<br>- Integrated with main window<br>- Proper bounds management<br>- No extra OS window | - Must manage lifecycle manually<br>- Requires BaseWindow (not BrowserWindow) | HIGH |
| BrowserWindow | - Separate process<br>- Independent lifecycle | - Extra OS window<br>- Complex positioning<br>- Feels detached, not docked | MEDIUM |
| Chrome DevTools Protocol (CDP) | - Custom UI possible<br>- Full control | - Massive engineering effort<br>- Reinventing the wheel | LOW |

**Verdict:** Use WebContentsView. It's what the API was designed for.

## DevTools API: Mode Options Explained

When calling `openDevTools({ mode })`:

| Mode | Behavior | Use Case |
|------|----------|----------|
| `detach` | Opens in separate window, **cannot** re-dock | Default for `<webview>` tags |
| `undocked` | Opens in separate window, **can** re-dock | User preference for floating DevTools |
| `bottom` | Docks at bottom of window | Traditional Chrome DevTools position |
| `right` | Docks at right of window | Wide monitor preference |
| `left` | Docks at left of window | Alternative positioning |

**Critical insight:** These modes apply to the **default internal DevTools rendering**. When using `setDevToolsWebContents()`, you control positioning via `setBounds()` or React layout (PanelGroup), so mode primarily affects where DevTools *expects* to render—use `'detach'` to prevent Electron from managing position itself.

**Source:** [Electron openDevTools documentation](https://www.electronjs.org/docs/latest/api/web-contents)

## Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| Custom DevTools UI via CDP | `setDevToolsWebContents()` | Electron provides native rendering; CDP is for instrumentation, not UI replacement |
| Manual panel resize math | react-resizable-panels | Already in your stack; handles edge cases, keyboard nav, persistence |
| BrowserWindow for dock | WebContentsView | WebContentsView is for embedded content; BrowserWindow is for top-level windows |

## Pitfalls

### 1. WebContents Lifecycle Management
**What happens:** When using `setDevToolsWebContents()`, closing DevTools does **not** destroy the WebContents. If you don't clean up, you'll leak memory.

**Avoid by:**
- Store reference to `devToolsView`
- Call `devToolsView.webContents.destroy()` when DevTools closes (listen to `'closed'` event or manage via state)
- Re-create the WebContentsView if user reopens DevTools later

**Source:** [Electron webContents API](https://www.electronjs.org/docs/latest/api/web-contents)

### 2. WebContents Must Be Pristine
**What happens:** The DevTools WebContents cannot have navigated before. If you try to use a WebContentsView that's already loaded a URL, `setDevToolsWebContents()` will fail silently or error.

**Avoid by:** Create a dedicated WebContentsView solely for DevTools; don't reuse an existing view.

### 3. Bounds Management with WebContentsView
**What happens:** Unlike BrowserView (deprecated), WebContentsView doesn't auto-resize with window. If you don't update bounds on resize, DevTools will clip or overflow.

**Avoid by:**
- Listen to window `'resize'` event in main process
- Recalculate and call `devToolsView.setBounds()`
- **OR** use React layout (PanelGroup) and render a DOM element that Electron can attach to (use IPC to send bounds from renderer to main)

### 4. Panel Nesting Requirements
**What happens:** react-resizable-panels requires Panel elements to be direct DOM children of their parent PanelGroup. If you insert wrapper divs, layout breaks.

**Avoid by:** Keep structure flat:
```tsx
<PanelGroup direction="vertical">
  <Panel>{/* content */}</Panel>
  <PanelResizeHandle />
  <Panel>
    {/* Nested group is OK as content */}
    <PanelGroup direction="horizontal">
      {/* ... */}
    </PanelGroup>
  </Panel>
</PanelGroup>
```

**Source:** [react-resizable-panels README](https://github.com/bvaughn/react-resizable-panels)

### 5. BaseWindow vs BrowserWindow
**What happens:** WebContentsView works best with BaseWindow (Electron's newer, lighter API). If you're using BrowserWindow, you can still use WebContentsView, but the APIs differ slightly.

**Avoid by:** Check your current implementation. If using BaseWindow, you're good. If using BrowserWindow, use `win.contentView.addChildView()` (not `win.addBrowserView()`).

**Source:** [WebContentsView API](https://www.electronjs.org/docs/latest/api/web-contents-view)

## Implementation Checklist

- [ ] Create `devToolsView` as WebContentsView in main process
- [ ] Call `browserView.webContents.setDevToolsWebContents(devToolsView.webContents)`
- [ ] Add `devToolsView` as child to main window's contentView
- [ ] Position `devToolsView` at bottom via `setBounds()` or IPC coordination
- [ ] Update AppShell.tsx: add outer vertical PanelGroup
- [ ] Add bottom Panel (collapsible, minSize 15%, defaultSize 30%)
- [ ] Implement toggle via IPC: `openDevTools()` / `closeDevTools()` + view visibility
- [ ] Store panel collapse state in settings (use existing settingsStore pattern)
- [ ] Handle window resize: recalculate devToolsView bounds or rely on PanelGroup
- [ ] Test: open/close DevTools, resize window, persist layout across restarts
- [ ] Cleanup: destroy `devToolsView.webContents` when no longer needed

## Open Questions

**Q: Can we use the same WebContentsView for multiple browser tabs' DevTools?**
**A:** NO. Each webContents can only have one DevTools target at a time. If you have tab switching, you'll need to:
- Either create a DevTools view per tab (memory heavy)
- Or dynamically call `setDevToolsWebContents()` + `openDevTools()` when switching tabs (recommended)

**Q: How does this work with multiple browser panes in right panel?**
**A:** Your right panel already supports multiple panes (browser + planning). Each browser pane would have its own `webContents`. The DevTools dock shows DevTools for whichever browser pane is active. You'll need state management to track "active browser pane" and swap DevTools target accordingly.

**Q: Can DevTools be shown for the entire Electron app (renderer + main process)?**
**A:** Partially. `webContents.openDevTools()` shows DevTools for a specific renderer process. For main process debugging, use `--inspect` flag or remote debugging. You cannot combine both in a single DevTools instance via this method.

**Q: Performance impact of always-on DevTools WebContentsView?**
**A:** Minimal when collapsed/hidden. DevTools WebContents is lightweight until actively opened. Consider lazy initialization: only create `devToolsView` when user first opens DevTools.

## react-resizable-panels: Nested Layout Confirmed

**Pattern:** Nest PanelGroups by placing a PanelGroup inside a Panel's children.

**Example structure (from documentation):**
```tsx
// Outer group: vertical (top/bottom)
<PanelGroup direction="vertical">
  <Panel>
    {/* Inner group: horizontal (left/center/right) */}
    <PanelGroup direction="horizontal">
      <Panel>{/* sidebar */}</Panel>
      <PanelResizeHandle />
      <Panel>{/* center */}</Panel>
      <PanelResizeHandle />
      <Panel>{/* right */}</Panel>
    </PanelGroup>
  </Panel>
  <PanelResizeHandle />
  <Panel>{/* bottom dock */}</Panel>
</PanelGroup>
```

**Confidence:** HIGH — The library's documentation explicitly lists "nestable groups" as a feature for "complex IDE or dashboard layouts."

**Source:** [react-resizable-panels npm](https://www.npmjs.com/package/react-resizable-panels)

## Chrome DevTools Protocol (CDP) Alternative

**Use case:** If you wanted a fully custom DevTools UI (not recommended).

**Approach:**
1. Attach Debugger to webContents: `browserView.webContents.debugger.attach('1.3')`
2. Send CDP commands: `debugger.sendCommand('Network.enable')`
3. Listen to events: `debugger.on('message', (event, method, params) => {})`
4. Build custom UI in React (enormous effort)

**Why not:**
- Electron's native DevTools is Chrome's actual DevTools (best-in-class)
- CDP is for instrumentation (automation, monitoring), not UI rendering
- You'd be rebuilding thousands of hours of Chrome DevTools engineering

**When to use CDP:**
- Custom debugging features (e.g., network request logging in your app's UI)
- Automation/testing (e.g., coverage collection)
- Performance monitoring dashboards

**Confidence for custom UI:** LOW (don't do this)
**Confidence for CDP instrumentation:** MEDIUM (valid for specific use cases)

**Source:** [Electron Debugger API](https://www.electronjs.org/docs/latest/api/debugger)

## Testing Strategy

1. **Unit test:** Panel collapse/expand logic (existing pattern from sidebar/right panel)
2. **Integration test:** IPC handlers for DevTools toggle
3. **Manual test:**
   - Open DevTools, verify it renders in bottom dock
   - Resize window, verify DevTools view scales correctly
   - Close/reopen DevTools, verify no memory leaks (check Task Manager)
   - Switch browser tabs (if multi-tab support added), verify DevTools updates target
   - Persist layout, restart app, verify dock state restored

## Recommended Implementation Order

1. **Phase 1: Basic DevTools WebContentsView** (main process)
   - Create devToolsView on demand
   - Call setDevToolsWebContents
   - Add to window, position via setBounds
   - IPC handler for toggle

2. **Phase 2: React Layout Integration** (renderer)
   - Wrap existing layout in outer vertical PanelGroup
   - Add bottom Panel (collapsible)
   - Connect toggle to IPC

3. **Phase 3: Polish**
   - Bounds management on window resize
   - Settings persistence (dock height, collapsed state)
   - Keyboard shortcut (Cmd+Alt+I or similar)
   - Status bar indicator (DevTools active/inactive)

4. **Phase 4: Multi-pane support** (if needed)
   - Track active browser pane
   - Swap DevTools target on pane switch
   - Visual indicator of which pane is being inspected

## Example: Full Flow

**Main Process (simplified):**
```typescript
let devToolsView: WebContentsView | null = null;

ipcMain.handle('devtools:toggle', (event, browserViewId) => {
  const browserView = getBrowserViewById(browserViewId); // your lookup

  if (!devToolsView) {
    devToolsView = new WebContentsView();
    mainWindow.contentView.addChildView(devToolsView);
  }

  if (browserView.webContents.isDevToolsOpened()) {
    browserView.webContents.closeDevTools();
    devToolsView.setVisible(false);
  } else {
    browserView.webContents.setDevToolsWebContents(devToolsView.webContents);
    browserView.webContents.openDevTools({ mode: 'detach' });

    // Position at bottom
    const { width, height } = mainWindow.getBounds();
    devToolsView.setBounds({
      x: 0,
      y: height - 300,
      width,
      height: 300
    });
    devToolsView.setVisible(true);
  }
});
```

**Renderer (React):**
```tsx
function DevToolsToggleButton() {
  const activeBrowserId = useAppStore(s => s.activeBrowserPaneId);

  const toggle = () => {
    window.breadcrumbAPI.invoke('devtools:toggle', activeBrowserId);
  };

  return <button onClick={toggle}>Toggle DevTools</button>;
}
```

## Sources

**HIGH confidence:**
- [Electron webContents API](https://www.electronjs.org/docs/latest/api/web-contents)
- [Electron WebContentsView API](https://www.electronjs.org/docs/latest/api/web-contents-view)
- [Electron Debugger API](https://www.electronjs.org/docs/latest/api/debugger)
- [react-resizable-panels npm](https://www.npmjs.com/package/react-resizable-panels)
- [react-resizable-panels GitHub](https://github.com/bvaughn/react-resizable-panels)

**MEDIUM confidence:**
- [WebContentsView Implementation Article](https://developer.mamezou-tech.com/en/blogs/2024/03/06/electron-webcontentsview/)
- [Electron WebContentsView App Structure](https://developer.mamezou-tech.com/en/blogs/2024/08/28/electron-webcontentsview-app-structure/)
- [LogRocket React Panel Layouts](https://blog.logrocket.com/essential-tools-implementing-react-panel-layouts/)

**LOW confidence (community discussions, not official docs):**
- [GitHub Issue: Docked DevTools for webview](https://github.com/electron/electron/issues/11627)
- [GitHub Issue: Add option to open devtools docked](https://github.com/electron/electron/issues/5094)
- [react-resizable-panels nested layout discussion](https://github.com/bvaughn/react-resizable-panels/discussions/314)
