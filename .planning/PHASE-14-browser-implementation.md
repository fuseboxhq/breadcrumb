# Phase 14: Browser Implementation

**Status:** complete
**Beads Epic:** breadcrumb-ahr
**Created:** 2026-02-12

## Objective

Build a fully functional embedded browser in the right panel using Electron's WebContentsView API. The primary use case is previewing localhost dev servers (e.g., localhost:3000) alongside the terminal — see your code run without leaving the IDE. The browser should also handle general web browsing (docs, Stack Overflow) gracefully. Additionally, integrate Chrome DevTools as a collapsible bottom dock panel across the full app width, giving developers instant access to inspect the embedded browser content.

## Scope

**In scope:**
- WebContentsView creation and lifecycle management in the main process
- IPC bridge for browser operations (create, navigate, resize, destroy, events)
- Bounds syncing: keep WebContentsView aligned with the BrowserPanel's DOM position/size
- Navigation chrome: URL bar, back/forward/reload, loading indicator, security badge
- Navigation events: did-navigate, did-fail-load, page-title-updated, favicon, loading states
- Error pages: custom styled error page for failed loads (connection refused, DNS failure, etc.)
- DevTools as a collapsible bottom dock panel (full app width, below center + right panel)
- DevTools toggle hotkey and button
- Session isolation: browser runs in a separate partition (no cookie leakage to app)
- Persist last URL across restarts
- Responsive to panel resizing (WebContentsView reflows when right panel is resized)

**Out of scope:**
- Multi-tab browser (single embedded view per browser pane — tabs are a future enhancement)
- Bookmarks / browsing history UI
- Download management
- Extensions/ad blocking in the embedded browser
- Print functionality
- Custom user agent string configuration
- Drag-to-rearrange browser panes

## Constraints

- Frontend design skill active — follow design thinking process for UI tasks
- Must use WebContentsView (modern Electron API), not deprecated `<webview>` tag
- Must work with the existing right panel system from PHASE-13 (browser pane renders inside RightPanel)
- Must preserve existing security posture: contextIsolation, sandbox, no nodeIntegration
- Bounds syncing needs to handle: right panel resize, sidebar collapse/expand, window resize, panel collapse/expand
- DevTools bottom dock is a new layout zone — must integrate with AppShell's existing PanelGroup without breaking terminal/right panel
- WebContentsView is a main process construct overlaid on the window — renderer only controls position/size via IPC
- The existing BrowserPanel.tsx has navigation UI chrome that should be preserved and wired up
- Project uses Electron 33.0.0 (WebContentsView requires 30+, confirmed compatible)
- Use `navigationHistory.goBack()`/`goForward()` (not deprecated `goBack()`/`goForward()`)

## Research Summary

**Overall Confidence:** HIGH

Three research documents cover the full technical surface area. All key APIs are verified against official Electron docs.

### WebContentsView API (PHASE-14-webcontentsview.md)

- **Creation:** `new WebContentsView({ webPreferences })` → `win.contentView.addChildView(view)`
- **Navigation:** All via `view.webContents` — `loadURL()`, `reload()`, `navigationHistory.goBack()`/`goForward()`
- **Events:** `did-navigate`, `did-fail-load`, `page-title-updated`, `did-start-loading`, `did-stop-loading`
- **Security:** `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`, `partition: 'persist:browser'`
- **Cleanup:** MUST call `view.webContents.close()` — no auto-cleanup (memory leak risk)
- **DevTools:** `view.webContents.openDevTools({ mode: 'detach' })`, `setDevToolsWebContents()` for inline rendering
- **External links:** `setWindowOpenHandler()` → `shell.openExternal(url)`, `return { action: 'deny' }`

### Bounds Syncing (PHASE-14-bounds-syncing.md)

- **Pattern:** ResizeObserver on content div → `getBoundingClientRect()` → IPC `invoke` → main `setBounds()`
- **Throttling:** `requestAnimationFrame` (one update per frame, ~16ms). NOT debounce (causes jarring jumps)
- **DPI:** No conversion needed — `getBoundingClientRect()` returns DIP, `setBounds()` expects DIP
- **Race condition:** Delay initial `setBounds()` by 50ms after WebContentsView creation
- **Visibility:** Move off-screen (`y: -10000`) when panel collapsed — no native hide API
- **Z-order:** Determined by `addChildView` order (last = top). Re-add to change order.
- **Critical pitfall:** WebContentsView overlays ALL DOM — command palette, modals must not overlap browser area, or temporarily hide the view

### DevTools Dock (PHASE-14-devtools-dock.md)

- **Inline rendering:** Use `setDevToolsWebContents(devToolsView.webContents)` + `openDevTools({ mode: 'detach' })`
- **DevTools WebContents must be pristine** — never navigated before. Create dedicated view.
- **Layout:** Nest existing horizontal PanelGroup inside an outer vertical PanelGroup. Bottom panel = collapsible DevTools dock.
- **Toggle:** Imperative `Panel.collapse()`/`expand()` + IPC to main for `openDevTools()`/`closeDevTools()`
- **Lazy init:** Only create DevTools WebContentsView when user first opens DevTools
- **Lifecycle:** Closing DevTools doesn't destroy WebContents. Must manage manually.

### Design Guidance

The `frontend-design` skill will be active during execution of UI tasks in this phase.

### Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| Auto-resize on window resize | ResizeObserver + rAF | Catches all layout changes, not just window resize |
| Session management | `partition: 'persist:browser'` | Proper isolation, no cookie leakage |
| External link handling | `setWindowOpenHandler()` | Prevents navigation, opens system browser |
| DevTools UI | `setDevToolsWebContents()` | Native Chrome DevTools rendering |
| Panel math | react-resizable-panels (nested) | Already installed, handles edge cases |
| Memory management | Explicit `webContents.close()` | No auto-cleanup in WebContentsView |

### Pitfalls

- **Memory leaks:** WebContentsView does NOT auto-destroy webContents. Call `.close()` on cleanup.
- **setBounds race condition:** 50ms delay needed after creation before first setBounds call.
- **Z-order overlay:** WebContentsView renders above ALL DOM elements. Must hide when command palette/modals open.
- **DevTools pristine requirement:** DevTools WebContentsView must never have navigated before `setDevToolsWebContents()`.
- **Deprecated nav API:** Use `navigationHistory.goBack()` not `webContents.goBack()`.
- **Panel nesting:** react-resizable-panels Panels must be direct children of PanelGroup (no wrapper divs between).

## Recommended Approach

**Architecture overview:**

The WebContentsView lives in the main process, overlaid on top of the BrowserWindow. The renderer's BrowserPanel calculates its content area bounds (below the nav chrome) and sends those to the main process via IPC. The main process positions the WebContentsView to exactly overlay that area. When the user resizes panels, collapses the sidebar, or resizes the window, the renderer re-sends updated bounds.

**Key components:**

1. **Main process: BrowserViewManager** — Creates/destroys WebContentsView instances, handles navigation, emits events back to renderer, manages DevTools WebContentsView
2. **IPC channels** — `browser:create`, `browser:navigate`, `browser:go-back`, `browser:go-forward`, `browser:reload`, `browser:set-bounds`, `browser:destroy`, `browser:open-devtools`, `browser:close-devtools`, `browser:set-devtools-bounds`, plus event channels for navigation state
3. **Renderer: BrowserPanel** — Existing nav chrome wired to IPC. Uses ResizeObserver + getBoundingClientRect to calculate and send bounds. Receives navigation events (URL, loading, title) via IPC
4. **Bottom dock: DevToolsPanel** — New collapsible panel in AppShell below the main PanelGroup. Toggle via hotkey. DevTools WebContentsView gets its own bounds syncing via the same ResizeObserver pattern
5. **Preload bridge** — Extend breadcrumbAPI with `browser` namespace

**Layout with DevTools dock:**
```
┌─────────────────────────────────────────────────────┐
│                  TitleBar (h-11)                     │
├──┬──────────────────────────────────────────────────┤
│AB│ PanelGroup (vertical — outer)                    │
│  │ ┌──────────────────────────────────────────────┐ │
│  │ │ Panel (top — main content)                   │ │
│  │ │ PanelGroup (horizontal — inner)              │ │
│  │ │ ┌────────┬─┬────────────┬─┬──────────────┐  │ │
│  │ │ │Sidebar │ │  Center    │ │ Right Panel  │  │ │
│  │ │ │        │ │ (terminals)│ │ ┌──────────┐ │  │ │
│  │ │ │        │ │            │ │ │ Browser  │ │  │ │
│  │ │ │        │ │            │ │ │ NavChrome│ │  │ │
│  │ │ │        │ │            │ │ │[WebCView]│ │  │ │
│  │ │ │        │ │            │ │ └──────────┘ │  │ │
│  │ │ └────────┴─┴────────────┴─┴──────────────┘  │ │
│  │ ├──────────────────────────────────────────────┤ │
│  │ │ Panel (bottom — DevTools dock, collapsible)  │ │
│  │ │ [Chrome DevTools WebContentsView]            │ │
│  │ └──────────────────────────────────────────────┘ │
├──┴──────────────────────────────────────────────────┤
│                 StatusBar (h-6)                       │
└─────────────────────────────────────────────────────┘
```

## Tasks

| ID | Title | Status | Complexity | Depends On |
|----|-------|--------|------------|------------|
| breadcrumb-ahr.1 | Browser IPC channels & preload bridge | done | Medium | — |
| breadcrumb-ahr.2 | BrowserViewManager — WebContentsView lifecycle | done | High | ahr.1 |
| breadcrumb-ahr.3 | BrowserPanel bounds syncing & visibility | done | High | ahr.2 |
| breadcrumb-ahr.4 | Navigation chrome wiring & loading states | done | Medium | ahr.3 |
| breadcrumb-ahr.5 | DevTools bottom dock layout | done | Medium | ahr.3 |
| breadcrumb-ahr.6 | DevTools WebContentsView integration | done | High | ahr.5 |
| breadcrumb-ahr.7 | Polish, persistence & error pages | done | Medium | ahr.4, ahr.6 |

### Task Details

**ahr.1 — Browser IPC channels & preload bridge**
Define all browser-related IPC channels in `shared/types/index.ts`. Add browser namespace to preload's `breadcrumbAPI`: `create`, `navigate`, `goBack`, `goForward`, `reload`, `setBounds`, `destroy`, `openDevTools`, `closeDevTools`, `setDevToolsBounds`. Add event listeners for navigation state: `onNavigate`, `onLoadingChange`, `onTitleChange`, `onError`. Create `browserIpc.ts` scaffold in main process with `ipcMain.handle()` stubs for all channels.

**ahr.2 — BrowserViewManager — WebContentsView lifecycle** (frontend-design skill active)
Create `BrowserViewManager` class in main process (`main/browser/BrowserViewManager.ts`). Manages a single WebContentsView instance. `create()`: instantiate with secure webPreferences (`nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`, `partition: 'persist:browser'`), add to `win.contentView.addChildView()`, 50ms delay before initial `setBounds()`. `destroy()`: call `webContents.close()`, remove from parent. Wire navigation events (`did-navigate`, `did-fail-load`, `page-title-updated`, `did-start-loading`, `did-stop-loading`) to emit IPC events to renderer. Implement `setWindowOpenHandler()` → `shell.openExternal()`. Wire all IPC handlers in `browserIpc.ts` to call BrowserViewManager methods.

**ahr.3 — BrowserPanel bounds syncing & visibility**
In `BrowserPanel.tsx`, add a `contentRef` on the area below nav chrome. Use ResizeObserver + `getBoundingClientRect()` → `requestAnimationFrame` throttled IPC `browser:setBounds` call. On mount: trigger `browser:create` IPC. On unmount: move view off-screen (`y: -10000`) or `browser:destroy`. Handle right panel collapse → hide WebContentsView. Handle right panel expand → show WebContentsView at correct bounds. Handle command palette/modal open → temporarily hide view (z-order overlay issue).

**ahr.4 — Navigation chrome wiring & loading states** (frontend-design skill active)
Wire existing BrowserPanel nav buttons to IPC: back → `browser:goBack`, forward → `browser:goForward`, reload → `browser:reload`, URL submit → `browser:navigate`. Listen for IPC events: `onNavigate` → update URL bar and security indicator, `onLoadingChange` → spinner animation on reload button, `onTitleChange` → update pane header. Add `canGoBack`/`canGoForward` state to enable/disable nav buttons. Wire external link button to `shell.openExternal()` via IPC. Add custom error page component for `did-fail-load` (connection refused, DNS failure, etc.).

**ahr.5 — DevTools bottom dock layout** (frontend-design skill active)
Wrap AppShell's existing horizontal PanelGroup inside an outer vertical PanelGroup. Add bottom Panel: `collapsible`, `collapsedSize={0}`, `defaultSize={0}` (starts collapsed). Add `devToolsDockRef` (ImperativePanelHandle) for imperative collapse/expand. Add `devToolsDockOpen` state to `appStore.layout`. Wire `useEffect([devToolsDockOpen])` to collapse/expand. Add `onLayout` callback on outer PanelGroup for persistence. Create `DevToolsDock` component that renders a content ref div (for DevTools WebContentsView bounds) with a header bar showing close button. Add toggle hotkey (`Cmd+Option+I`).

**ahr.6 — DevTools WebContentsView integration**
In `BrowserViewManager`, add DevTools lifecycle: `openDevTools()` → lazy-create pristine WebContentsView, call `setDevToolsWebContents()`, `openDevTools({ mode: 'detach' })`, add to window. `closeDevTools()` → `closeDevTools()`, destroy devtools view, remove from window. Wire IPC handlers: `browser:openDevTools`, `browser:closeDevTools`, `browser:setDevToolsBounds`. In `DevToolsDock` component, add ResizeObserver on content area → IPC `browser:setDevToolsBounds` (same pattern as browser bounds). Sync visibility with dock panel collapse/expand state.

**ahr.7 — Polish, persistence & error pages** (frontend-design skill active)
Add `lastBrowserUrl` to settings store schema (electron-store). On browser navigate → persist URL. On browser create → restore last URL (default: `https://localhost:3000`). Add custom styled error page component (Dracula theme) for connection refused, DNS failure, timeout. Dracula theme for DevTools dock header, resize handle. Status bar: show browser URL or loading state. Hide WebContentsView when command palette opens (listen for open/close). Accessibility: aria-labels on nav buttons, keyboard navigation in URL bar. Test all bounds scenarios: resize, collapse, expand, window resize.

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Embedding technology | WebContentsView | Modern Electron API (30+), best performance, works with sandbox. `<webview>` is discouraged. |
| Browser lifecycle | Main process managed | WebContentsView is a main process construct — renderer controls via IPC only. |
| Bounds syncing | ResizeObserver + rAF + IPC | Catches all layout changes. rAF throttles to frame rate. No conversion needed (DIP→DIP). |
| Bounds throttling | requestAnimationFrame | Smooth tracking during resize. Debounce causes jumps. |
| Visibility control | Off-screen positioning | Move to `y: -10000` when hidden. No native hide API. Fast, preserves page state. |
| setBounds race condition | 50ms delay after creation | Known Electron bug. Store pending bounds, apply after delay. |
| DevTools rendering | `setDevToolsWebContents()` | Native Chrome DevTools inline in a dedicated WebContentsView. No CDP reinvention. |
| DevTools location | Bottom dock (app-wide) | Like VS Code's bottom panel. Full width, collapsible. Nested vertical PanelGroup. |
| DevTools lifecycle | Lazy init, destroy on close | Only create WebContentsView when user first opens DevTools. Destroy on close to free memory. Re-create on reopen. |
| Layout nesting | Outer vertical PanelGroup | Wraps existing horizontal PanelGroup. Bottom panel = DevTools dock. Library supports nesting. |
| Session isolation | `persist:browser` partition | Persistent but isolated. No cookie/storage leakage to app. |
| Navigation API | `navigationHistory.goBack()` | New API. Old `goBack()`/`goForward()` deprecated in Electron 33. |
| External links | `setWindowOpenHandler()` | Intercept `window.open`, open in system browser, deny in-app. |
| IPC pattern | `ipcRenderer.invoke()` | Modern async IPC. Returns Promise. Better than sendSync. |

## Completion Criteria

- [ ] WebContentsView renders web content inside the right panel's browser pane
- [ ] Navigation chrome works: URL bar, back/forward/reload, loading indicator
- [ ] Bounds sync correctly on: panel resize, sidebar toggle, window resize, right panel collapse/expand
- [ ] DevTools opens in a collapsible bottom dock panel with hotkey toggle
- [ ] Error pages render for connection failures (localhost not running, DNS errors)
- [ ] Session isolation: browser uses separate partition from app
- [ ] Last URL persists across app restarts
- [ ] WebContentsView is properly destroyed when browser pane is closed
- [ ] Follows Dracula design system

## Sources

**HIGH confidence (Official Electron docs):**
- [WebContentsView API](https://www.electronjs.org/docs/latest/api/web-contents-view)
- [webContents API](https://www.electronjs.org/docs/latest/api/web-contents)
- [View Class API](https://www.electronjs.org/docs/latest/api/view)
- [Session API](https://www.electronjs.org/docs/latest/api/session)
- [ResizeObserver API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver)
- [react-resizable-panels](https://github.com/bvaughn/react-resizable-panels)

**MEDIUM confidence:**
- [WebContentsView Implementation Blog](https://developer.mamezou-tech.com/en/blogs/2024/03/06/electron-webcontentsview/)
- [Electron setBounds race condition #37330](https://github.com/electron/electron/issues/37330)
