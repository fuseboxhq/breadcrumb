# Research: Electron WebContentsView API for Embedded Browser

**Date:** 2026-02-13
**Domain:** Electron Desktop Application
**Electron Version:** 33.0.0 (project uses ^33.0.0)
**Overall Confidence:** HIGH

## TL;DR

Use WebContentsView (not the deprecated BrowserView) to embed web content in BaseWindow. WebContentsView requires Electron 30+. Create it with secure webPreferences, add to `win.contentView.addChildView()`, and explicitly call `view.webContents.close()` on cleanup to avoid memory leaks. All navigation and DevTools methods are accessed via `view.webContents`.

## Recommended API Pattern

```javascript
const { BaseWindow, WebContentsView } = require('electron')
const { session } = require('electron')

// 1. Create isolated session for browser
const browserSession = session.fromPartition('persist:browser')

// 2. Create WebContentsView with secure webPreferences
const browserView = new WebContentsView({
  webPreferences: {
    nodeIntegration: false,        // CRITICAL: disable Node.js
    contextIsolation: true,         // CRITICAL: isolate context
    sandbox: true,                  // Enable Chromium sandbox
    webSecurity: true,              // Enable same-origin policy
    partition: 'persist:browser',   // Isolated session
    devTools: true                  // Allow DevTools
  }
})

// 3. Add to window's contentView
win.contentView.addChildView(browserView)

// 4. Set bounds (position/size)
browserView.setBounds({ x: 0, y: 0, width: 800, height: 600 })

// 5. Navigate
browserView.webContents.loadURL('https://example.com')

// 6. Cleanup on window close
win.on('closed', () => {
  browserView.webContents.close() // CRITICAL: prevent memory leak
})
```

## Key Patterns

### Creating and Adding to Window

**Modern API (Electron 30+):**
```javascript
const { BaseWindow, WebContentsView } = require('electron')

const win = new BaseWindow({ width: 800, height: 600 })
const view = new WebContentsView()

// Add to window's contentView (NOT win.addBrowserView)
win.contentView.addChildView(view)
```

**Source:** Official Electron WebContentsView docs

### Setting Bounds

```javascript
// Set position and size
view.setBounds({ x: 0, y: 0, width: 800, height: 600 })

// Get current bounds
const bounds = view.getBounds()

// Handle window resize (no auto-resize in WebContentsView)
win.on('resize', () => {
  const winBounds = win.getBounds()
  view.setBounds({
    x: 0,
    y: 0,
    width: winBounds.width,
    height: winBounds.height
  })
})
```

**Important:** WebContentsView removed `setAutoResize()` method. You must manually handle resize events.

**Source:** Electron migration guide

### Navigation Methods

All navigation is via `view.webContents`:

```javascript
// Load URL (returns Promise)
await view.webContents.loadURL('https://example.com', {
  httpReferrer: 'https://referrer.com',
  userAgent: 'Custom User Agent',
  extraHeaders: 'X-Custom-Header: value'
})

// Load local file
await view.webContents.loadFile('index.html', {
  search: '?query=value',
  hash: '#section'
})

// Reload
view.webContents.reload()
view.webContents.reloadIgnoringCache()

// Navigation history (NEW API - old goBack/goForward deprecated)
if (view.webContents.navigationHistory.canGoBack()) {
  view.webContents.navigationHistory.goBack()
}

if (view.webContents.navigationHistory.canGoForward()) {
  view.webContents.navigationHistory.goForward()
}
```

**Source:** Electron webContents API docs

### Navigation Events

```javascript
// Navigation started (any frame including main)
view.webContents.on('did-start-navigation', (event, url, isInPlace, isMainFrame, frameProcessId, frameRoutingId) => {
  console.log('Navigation started:', url)
})

// Main frame navigation completed
view.webContents.on('did-navigate', (event, url, httpResponseCode, httpStatusText) => {
  console.log('Navigation completed:', url, httpResponseCode)
})

// Navigation failed
view.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
  console.error('Load failed:', errorCode, errorDescription, validatedURL)
})

// Page title updated
view.webContents.on('page-title-updated', (event, title, explicitSet) => {
  console.log('Title:', title, 'Explicit:', explicitSet)
})

// Loading indicators
view.webContents.on('did-start-loading', () => {
  console.log('Loading started (spinner visible)')
})

view.webContents.on('did-stop-loading', () => {
  console.log('Loading stopped (spinner hidden)')
})

// New window requests (open in external browser)
view.webContents.setWindowOpenHandler(({ url }) => {
  require('electron').shell.openExternal(url)
  return { action: 'deny' }
})
```

**Source:** Electron webContents events documentation

### Opening DevTools

```javascript
// Open DevTools
view.webContents.openDevTools({
  mode: 'detach',    // 'left' | 'right' | 'bottom' | 'undocked' | 'detach'
  activate: true,    // Bring to foreground (default: true)
  title: 'Browser DevTools'  // Custom title for undocked/detach
})

// Close DevTools
view.webContents.closeDevTools()

// Check if DevTools is open
const isOpen = view.webContents.isDevToolsOpened()

// Toggle
if (isOpen) {
  view.webContents.closeDevTools()
} else {
  view.webContents.openDevTools({ mode: 'detach' })
}
```

**Source:** Electron webContents API docs

### Session Isolation

```javascript
const { session } = require('electron')

// Create persistent isolated session
const browserSession = session.fromPartition('persist:browser')
console.log('User agent:', browserSession.getUserAgent())

// Pass to WebContentsView via partition
const view = new WebContentsView({
  webPreferences: {
    partition: 'persist:browser'  // Uses browserSession
  }
})

// OR create in-memory session (no persist: prefix)
const tempSession = session.fromPartition('temp-browser')

// Important: Session options must be set at creation time
// You cannot modify session configuration after first use
```

**Partition types:**
- `persist:name` - Persistent session, stored on disk
- `name` - In-memory session, cleared on app exit
- Empty string or omitted - Uses default session

**Source:** Electron session API docs

### Cleanup and Lifecycle

```javascript
// CRITICAL: WebContentsView does NOT auto-cleanup webContents
win.on('closed', () => {
  // Must explicitly close to prevent memory leak
  view.webContents.close()

  // Then remove from parent
  win.contentView.removeChildView(view)
})

// Or when removing view while window is open
function removeView(view) {
  view.webContents.close()  // Close first
  win.contentView.removeChildView(view)  // Then remove
}
```

**Why this matters:** Unlike BrowserWindow, WebContentsView's webContents are NOT automatically destroyed when the view is removed or window is closed. This causes memory leaks.

**Source:** Electron BaseWindow docs, GitHub issue #42884

## Security Configuration

### webPreferences for Embedded Browser

```javascript
const view = new WebContentsView({
  webPreferences: {
    // CRITICAL SECURITY SETTINGS
    nodeIntegration: false,        // Disable Node.js in renderer
    contextIsolation: true,         // Isolate from Electron APIs
    sandbox: true,                  // Enable Chromium OS-level sandbox
    webSecurity: true,              // Enable same-origin policy

    // SESSION ISOLATION
    partition: 'persist:browser',   // Isolated session storage

    // DEVTOOLS
    devTools: true,                 // Allow DevTools (can disable for production)

    // ADDITIONAL SECURITY
    allowRunningInsecureContent: false,
    webviewTag: false,              // Disable <webview> tag

    // OPTIONAL: Preload script (still has Node access even with nodeIntegration: false)
    // preload: path.join(__dirname, 'preload.js')
  }
})
```

**Defaults (Electron 20+):**
- `nodeIntegration`: `false`
- `contextIsolation`: `true`
- `sandbox`: `true`

**Security note:** Even with `nodeIntegration: false`, a preload script still has access to Node.js APIs. Only use preload if necessary and validate all inputs.

**Source:** Electron webPreferences, Process Sandboxing, Context Isolation docs

## Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| Auto-resize view on window resize | Window resize event + `setBounds()` | No `setAutoResize()` in WebContentsView |
| Multiple isolated browsers | `session.fromPartition()` | Proper session isolation, separate cookies/storage |
| Opening external links | `setWindowOpenHandler()` | Prevents navigation, opens in system browser |
| Memory management | Explicit `webContents.close()` | No auto-cleanup like BrowserWindow |

## Pitfalls

### 1. Memory Leaks from Missing Cleanup
**What happens:** WebContents remain in memory after view removal or window close.

**Avoid by:** Always call `view.webContents.close()` before removing view or on window close.

```javascript
win.on('closed', () => {
  view.webContents.close()  // MUST call this
})
```

### 2. Using Deprecated BrowserView API
**What happens:** Deprecation warnings, future compatibility issues.

**Avoid by:** Use WebContentsView (Electron 30+) instead of BrowserView. Update imports and window attachment:
- OLD: `win.addBrowserView(view)`
- NEW: `win.contentView.addChildView(view)`

### 3. Missing Window Resize Handling
**What happens:** View doesn't resize when window is resized.

**Avoid by:** WebContentsView removed `setAutoResize()`. Manually handle resize:

```javascript
win.on('resize', () => {
  const bounds = win.getBounds()
  view.setBounds({ x: 0, y: 0, width: bounds.width, height: bounds.height })
})
```

### 4. Insecure webPreferences
**What happens:** Embedded web content can access Node.js APIs or Electron internals.

**Avoid by:** Always set:
```javascript
{
  nodeIntegration: false,
  contextIsolation: true,
  sandbox: true,
  webSecurity: true
}
```

### 5. Session Leakage Between Views
**What happens:** Multiple embedded browsers share cookies/storage with default session.

**Avoid by:** Use isolated partition: `partition: 'persist:browser'`

### 6. Deprecated Navigation API
**What happens:** Using `goBack()`, `goForward()` directly on webContents (deprecated).

**Avoid by:** Use new `navigationHistory` API:
```javascript
view.webContents.navigationHistory.goBack()
view.webContents.navigationHistory.canGoBack()
```

## Migration from BrowserView

If migrating from BrowserView, here are the key changes:

| Old (BrowserView) | New (WebContentsView) |
|-------------------|----------------------|
| `new BrowserView()` | `new WebContentsView()` |
| `win.addBrowserView(view)` | `win.contentView.addChildView(view)` |
| `win.removeBrowserView(view)` | `win.contentView.removeChildView(view)` |
| `win.getBrowserViews()` | `win.contentView.children` |
| `view.setAutoResize(options)` | Manual resize handling with `win.on('resize')` |
| Auto cleanup | Manual `view.webContents.close()` |

## View Class Methods (Inherited)

WebContentsView inherits from View, providing these methods:

```javascript
// Child management
view.addChildView(childView, index)      // Add child at index
view.removeChildView(childView)           // Remove child
view.children                             // Array of child views (read-only)

// Layout
view.setBounds({ x, y, width, height })   // Set position/size
view.getBounds()                          // Get current bounds

// Appearance
view.setBackgroundColor('#FF0000')        // Hex, RGB, RGBA, HSL, named CSS colors
view.setBorderRadius(8)                   // Border radius in pixels
view.setVisible(true)                     // Show/hide
view.getVisible()                         // Check visibility
```

**Source:** Electron View class docs

## Open Questions

None. All key APIs are documented and verified.

## Sources

**HIGH confidence (Official Electron docs):**
- [WebContentsView API](https://www.electronjs.org/docs/latest/api/web-contents-view)
- [webContents API](https://www.electronjs.org/docs/latest/api/web-contents)
- [View Class API](https://www.electronjs.org/docs/latest/api/view)
- [BaseWindow API](https://www.electronjs.org/docs/latest/api/base-window)
- [WebPreferences Object](https://www.electronjs.org/docs/latest/api/structures/web-preferences)
- [Session API](https://www.electronjs.org/docs/latest/api/session)
- [Migrating from BrowserView to WebContentsView](https://www.electronjs.org/blog/migrate-to-webcontentsview)
- [Process Sandboxing](https://www.electronjs.org/docs/latest/tutorial/sandbox)
- [Context Isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation)
- [Security Tutorial](https://www.electronjs.org/docs/latest/tutorial/security)

**MEDIUM confidence (Community resources with Electron backing):**
- [WebContentsView Implementation Blog](https://developer.mamezou-tech.com/en/blogs/2024/03/06/electron-webcontentsview/)
- [WebContentsView App Structure](https://developer.mamezou-tech.com/en/blogs/2024/08/28/electron-webcontentsview-app-structure/)

**Issues referenced (for pitfalls):**
- [GitHub Issue #42884 - WebContentsView.destroy() request](https://github.com/electron/electron/issues/42884)
- [GitHub Issue #26929 - WebContents close documentation](https://github.com/electron/electron/issues/26929)
