# Phase 14: Browser Implementation

**Status:** not_started
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

## Research Summary

Run `/bc:plan PHASE-14` to research this phase and populate this section.

## Recommended Approach

**Architecture overview:**

The WebContentsView lives in the main process, overlaid on top of the BrowserWindow. The renderer's BrowserPanel calculates its content area bounds (below the nav chrome) and sends those to the main process via IPC. The main process positions the WebContentsView to exactly overlay that area. When the user resizes panels, collapses the sidebar, or resizes the window, the renderer re-sends updated bounds.

**Key components:**

1. **Main process: BrowserViewManager** — Creates/destroys WebContentsView instances, handles navigation, emits events back to renderer, manages DevTools WebContentsView
2. **IPC channels** — `browser:create`, `browser:navigate`, `browser:go-back`, `browser:go-forward`, `browser:reload`, `browser:set-bounds`, `browser:destroy`, `browser:open-devtools`, `browser:close-devtools`, plus event channels for navigation state
3. **Renderer: BrowserPanel** — Existing nav chrome wired to IPC. Uses ResizeObserver + element position to calculate and send bounds. Receives navigation events (URL changes, loading state, title, favicon) via IPC
4. **Bottom dock: DevToolsPanel** — New collapsible panel in AppShell below the main PanelGroup. Toggle via hotkey (Cmd+Shift+I or similar). DevTools WebContentsView gets its own bounds syncing
5. **Preload bridge** — Extend breadcrumbAPI with browser namespace

**Layout with DevTools dock:**
```
┌─────────────────────────────────────────────────────┐
│                  TitleBar (h-11)                     │
├──┬──────────────────────────────────────────────────┤
│AB│ PanelGroup (horizontal)                          │
│  │ ┌──────────┬─┬──────────────┬─┬──────────────┐  │
│  │ │ Sidebar  │ │   Center     │ │ Right Panel  │  │
│  │ │          │ │  (terminals) │ │ ┌──────────┐ │  │
│  │ │          │ │              │ │ │ Browser  │ │  │
│  │ │          │ │              │ │ │ NavChrome│ │  │
│  │ │          │ │              │ │ │ [WebView]│ │  │
│  │ │          │ │              │ │ └──────────┘ │  │
│  │ └──────────┴─┴──────────────┴─┴──────────────┘  │
├──┴──────────────────────────────────────────────────┤
│  DevTools Dock (collapsible, full width)            │
│  [Chrome DevTools for embedded browser]             │
├─────────────────────────────────────────────────────┤
│                 StatusBar (h-6)                      │
└─────────────────────────────────────────────────────┘
```

## Tasks

| ID | Title | Status | Complexity |
|----|-------|--------|------------|
| - | No tasks yet | - | - |

Run `/bc:plan PHASE-14` to break down this phase into tasks.

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Embedding technology | WebContentsView | Modern Electron API, best performance, works with sandbox. `<webview>` is discouraged. |
| Browser lifecycle | Main process managed | WebContentsView is a main process construct — renderer controls via IPC only. |
| Bounds syncing | ResizeObserver + IPC | Renderer observes BrowserPanel content area, sends position/size to main process. Handles all resize scenarios. |
| DevTools location | Bottom dock (app-wide) | Like VS Code's bottom panel. Full width, collapsible, doesn't eat browser viewport. Feels natural for inspecting content above. |
| Session isolation | Separate partition | Browser gets its own session (`persist:browser`) — no cookie/storage leakage to app. |
| Navigation state | Main → Renderer events | Main process emits navigation events via IPC. Renderer updates nav chrome reactively. |
| URL persistence | electron-store | Last visited URL saved to settings, restored on next launch. |

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
