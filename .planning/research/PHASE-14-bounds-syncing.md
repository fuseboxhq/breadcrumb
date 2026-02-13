# Research: WebContentsView Bounds Syncing Patterns

**Task ID:** PHASE-14
**Date:** 2026-02-13
**Domain:** Electron WebContentsView bounds synchronization
**Overall Confidence:** HIGH

## TL;DR

Use ResizeObserver in the renderer to track the BrowserPanel's content area, call getBoundingClientRect to get absolute position, send bounds via IPC (ipcRenderer.invoke), and apply in main process with setBounds. Throttle updates to ~16ms (one frame) using requestAnimationFrame for performance. Handle the setBounds race condition by delaying the initial setBounds call by ~50ms after WebContentsView creation. For visibility control, move the WebContentsView out of view (y: -10000) or remove/re-add it since there's no built-in hide() API. Always account for devicePixelRatio when calculating bounds — Electron's setBounds expects DIP (device-independent pixels), not physical pixels.

## Recommended Stack

| Library | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| ResizeObserver | Native API | Track DOM element size changes | HIGH |
| getBoundingClientRect | Native API | Get element position relative to viewport | HIGH |
| requestAnimationFrame | Native API | Throttle bounds updates to frame rate | HIGH |
| ipcRenderer.invoke | Electron API | Async IPC for bounds updates | HIGH |
| WebContentsView.setBounds | Electron API | Position overlay view | HIGH |

## Key Patterns

### 1. ResizeObserver Setup in Renderer

**Use when:** Need to track BrowserPanel content area size/position changes

```typescript
// BrowserPanel.tsx
import { useEffect, useRef } from 'react';

export function BrowserPanel() {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contentRef.current) return;

    let rafId: number | null = null;

    const resizeObserver = new ResizeObserver((entries) => {
      // Throttle with requestAnimationFrame - only update once per frame
      if (rafId) return;

      rafId = requestAnimationFrame(() => {
        rafId = null;

        for (const entry of entries) {
          const rect = entry.target.getBoundingClientRect();

          // Send bounds to main process
          window.breadcrumbAPI.browser.setBounds({
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          });
        }
      });
    });

    resizeObserver.observe(contentRef.current);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Navigation chrome */}
      <div className="h-10 border-b">...</div>

      {/* Content area for WebContentsView */}
      <div ref={contentRef} className="flex-1" />
    </div>
  );
}
```

**Why this pattern:**
- ResizeObserver fires before paint, giving you early notification of size changes
- requestAnimationFrame throttles updates to screen refresh rate (~60fps = 16ms)
- Prevents excessive IPC calls during rapid resizing
- Math.round() ensures integer pixel values (required by setBounds)

### 2. IPC Pattern: Renderer → Main

**Use when:** Sending bounds updates from renderer to main process

```typescript
// preload/index.ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('breadcrumbAPI', {
  browser: {
    setBounds: (bounds: { x: number; y: number; width: number; height: number }) =>
      ipcRenderer.invoke('browser:set-bounds', bounds),
  },
});

// main/ipc/browserIpc.ts
import { ipcMain } from 'electron';

ipcMain.handle('browser:set-bounds', async (event, bounds) => {
  const view = BrowserViewManager.getActiveView();
  if (!view) return;

  // Apply bounds to WebContentsView
  view.setBounds(bounds);
});
```

**Why invoke() pattern:**
- Modern async IPC (returns Promise)
- Cleaner than send/on pattern
- Allows error handling in renderer
- Better than sendSync (which blocks renderer)

### 3. Handling devicePixelRatio

**Use when:** Working with high-DPI displays (Retina, 4K)

```typescript
// ResizeObserver callback
const rect = entry.target.getBoundingClientRect();

// IMPORTANT: Electron's setBounds expects DIP (device-independent pixels)
// getBoundingClientRect already returns CSS pixels (DIP), not physical pixels
// So NO conversion needed - just use the rect values directly

window.breadcrumbAPI.browser.setBounds({
  x: Math.round(rect.x),
  y: Math.round(rect.y),
  width: Math.round(rect.width),
  height: Math.round(rect.height),
});

// WRONG: Don't divide by devicePixelRatio
// const dpr = window.devicePixelRatio;
// x: Math.round(rect.x / dpr) // ❌ This is incorrect
```

**Key insight:**
- `getBoundingClientRect()` returns CSS pixels (DIP)
- Electron's `setBounds()` expects DIP
- No conversion needed in most cases
- Only convert if you're working with physical screen coordinates from Electron's screen API

### 4. WebContentsView Initialization Pattern

**Use when:** Creating and positioning a new WebContentsView

```typescript
// main/browser/BrowserViewManager.ts
import { WebContentsView } from 'electron';

class BrowserViewManager {
  private view: WebContentsView | null = null;
  private mainWindow: BrowserWindow;

  async createView() {
    this.view = new WebContentsView({
      webPreferences: {
        partition: 'persist:browser', // Session isolation
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
      },
    });

    // Add to window
    this.mainWindow.contentView.addChildView(this.view);

    // Load URL
    await this.view.webContents.loadURL('https://google.com');

    // IMPORTANT: Delay initial setBounds to avoid race condition
    // The native view needs ~25-50ms to fully initialize
    setTimeout(() => {
      if (this.view && this.pendingBounds) {
        this.view.setBounds(this.pendingBounds);
      }
    }, 50);
  }

  setBounds(bounds: Rectangle) {
    if (!this.view) {
      // Store bounds to apply after initialization
      this.pendingBounds = bounds;
      return;
    }

    this.view.setBounds(bounds);
  }
}
```

**Why this pattern:**
- Avoids race condition where setBounds is called before view is ready
- 50ms delay is conservative (25ms minimum observed)
- Store pending bounds to apply after initialization completes

### 5. Visibility Control (No Built-in Hide API)

**Use when:** Need to hide WebContentsView without destroying it

```typescript
// Option A: Move off-screen (preserves state, fast)
function hideView(view: WebContentsView) {
  view.setBounds({ x: -10000, y: -10000, width: 1, height: 1 });
}

function showView(view: WebContentsView, bounds: Rectangle) {
  view.setBounds(bounds);
}

// Option B: Remove from parent (more thorough, slower)
function hideView(view: WebContentsView, window: BrowserWindow) {
  window.contentView.removeChildView(view);
}

function showView(view: WebContentsView, window: BrowserWindow, bounds: Rectangle) {
  window.contentView.addChildView(view);
  // Delay setBounds to avoid race condition
  setTimeout(() => view.setBounds(bounds), 50);
}

// Option C: Set zero size (may affect page lifecycle)
function hideView(view: WebContentsView) {
  const currentBounds = view.getBounds(); // Store for restore
  view.setBounds({ ...currentBounds, width: 0, height: 0 });
}
```

**Recommendation:** Use Option A (off-screen) for temporary hiding. Use Option B (remove) when panel is closed for extended time to free resources.

### 6. Z-Order Control

**Use when:** Multiple WebContentsViews overlap or need to control stacking

```typescript
// WebContentsView has no built-in z-index API
// Z-order is determined by the order in the child view list

function bringToFront(view: WebContentsView, window: BrowserWindow) {
  // Remove and re-add at the end (top of z-stack)
  window.contentView.removeChildView(view);
  window.contentView.addChildView(view); // Added at end = on top
}

function sendToBack(view: WebContentsView, window: BrowserWindow) {
  // Remove and re-add at position 0 (bottom of z-stack)
  window.contentView.removeChildView(view);
  window.contentView.addChildView(view, 0); // Index 0 = back
}
```

### 7. Update Triggers and Timing

**Update bounds when:**

1. **ResizeObserver fires** (element size changes)
2. **Panel collapse/expand** (layout changes)
3. **Sidebar toggle** (horizontal space changes)
4. **Window resize** (entire layout reflows)
5. **Initial render** (component mounts)

**Timing strategy:**

```typescript
// Combine all triggers with single ResizeObserver
// It will fire for ALL layout changes affecting the element

useEffect(() => {
  const resizeObserver = new ResizeObserver((entries) => {
    // Already throttled with requestAnimationFrame
    updateBounds(entries);
  });

  resizeObserver.observe(contentRef.current);

  // Manual trigger for immediate positioning
  const rect = contentRef.current.getBoundingClientRect();
  window.breadcrumbAPI.browser.setBounds({
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  });

  return () => resizeObserver.disconnect();
}, []);
```

## Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| Manual window resize listener | ResizeObserver | Catches all size changes (CSS, flexbox, JS), not just window resize. Fires before paint. |
| Custom debounce logic | requestAnimationFrame | Syncs with screen refresh rate, prevents layout thrashing, simpler than custom timers |
| Manual devicePixelRatio conversion | Use rect values directly | getBoundingClientRect already returns DIP; setBounds expects DIP. Conversion introduces bugs. |
| Custom visibility toggle | Off-screen positioning | No built-in hide() API; off-screen is simplest and preserves page state |
| Synchronous IPC (sendSync) | invoke() pattern | Blocks renderer, causes jank. invoke() is async and modern. |

## Pitfalls

### 1. Race Condition on WebContentsView Creation

**What happens:** Calling `setBounds()` immediately after creating a WebContentsView fails silently. The bounds are ignored, and the view appears at (0,0) with default size.

**Avoid by:** Delay initial `setBounds()` by 50ms using `setTimeout()`. Store pending bounds and apply after delay. This gives the native view time to initialize.

**Source:** [Electron Issue #37330](https://github.com/electron/electron/issues/37330) - Confirmed bug across Electron 20-27.

### 2. Infinite ResizeObserver Loop

**What happens:** Modifying an element's size inside its own ResizeObserver callback triggers another resize event, creating an infinite loop. Browser logs "ResizeObserver loop completed with undelivered notifications".

**Avoid by:** Wrap size modifications in `requestAnimationFrame()` to defer them until after the current frame. Or gate updates by comparing previous/expected sizes.

### 3. devicePixelRatio Over-Correction

**What happens:** Developers divide `getBoundingClientRect()` values by `window.devicePixelRatio`, causing WebContentsView to appear at wrong position/size on high-DPI displays.

**Avoid by:** Use rect values directly. Both `getBoundingClientRect()` and `setBounds()` work in DIP (CSS pixels), not physical pixels. No conversion needed.

### 4. Missing Bounds on Panel Collapse

**What happens:** When the right panel is collapsed, the BrowserPanel unmounts, but the WebContentsView remains visible, overlaying other UI.

**Avoid by:** Either destroy the WebContentsView on unmount, or move it off-screen with `setBounds({ x: -10000, y: -10000, width: 1, height: 1 })`. Clean up in useEffect return.

### 5. Z-Order Overlap with Other UI

**What happens:** WebContentsView overlays ALL renderer UI, including modals, dropdowns, and tooltips. It's a native overlay, not part of the DOM z-index stack.

**Avoid by:** Design UI so critical elements (command palette, modals) don't overlap the browser area. Or temporarily hide WebContentsView when showing overlays. Consider using BrowserWindow-level UI for critical overlays.

### 6. IPC Flood During Rapid Resize

**What happens:** ResizeObserver fires many times per second during window resize, flooding IPC channel with bounds updates, causing lag.

**Avoid by:** Throttle with `requestAnimationFrame()` — only send one update per frame (~60fps). Cancel pending rAF on new observer callback.

### 7. Forgetting Session Isolation

**What happens:** Embedded browser shares cookies/localStorage with the main app if you don't specify a partition. This leaks authentication state and can cause security issues.

**Avoid by:** Always set `partition: 'persist:browser'` in WebContentsView webPreferences. This isolates the browser's session from the app.

### 8. Wrong Coordinate Space on Multi-Monitor

**What happens:** On multi-monitor setups, getBoundingClientRect returns viewport-relative coordinates. If the window spans monitors with different scaling, bounds can be incorrect.

**Avoid by:** Use viewport-relative coordinates (getBoundingClientRect) and let Electron handle monitor scaling. Don't manually adjust for screen.getAllDisplays() scale factors unless you're positioning relative to screen edges.

## Performance Considerations

### Debounce vs Throttle for Bounds Updates

**Recommendation: Throttle with requestAnimationFrame**

- **Debouncing** (wait until resizing stops) causes jarring jumps — WebContentsView lags behind the panel edge, then snaps into place when resize stops.
- **Throttling** (limit to X updates/sec) provides smooth tracking during resize. Using `requestAnimationFrame` throttles to screen refresh rate (60fps = ~16ms), which is perfect for visual updates.
- **Implementation:** Check if rAF is already pending before scheduling a new one. This naturally throttles to one update per frame.

```typescript
let rafId: number | null = null;

const resizeObserver = new ResizeObserver((entries) => {
  if (rafId !== null) return; // Already scheduled for this frame

  rafId = requestAnimationFrame(() => {
    rafId = null;
    updateBounds(entries);
  });
});
```

### When to Skip Updates

Skip bounds update if:
1. **WebContentsView not yet created** — store bounds to apply later
2. **Bounds haven't changed** — compare with previous bounds before IPC call
3. **Component is unmounting** — check refs and cleanup flags

### Memory Management

- **Disconnect ResizeObserver** in useEffect cleanup
- **Cancel pending rAF** in cleanup
- **Destroy WebContentsView** when panel is permanently closed (not just hidden)
- **Use WeakMap** if tracking multiple views to avoid memory leaks

## Reference Implementation

Based on [mamezou-tech/electron-example-browserview](https://github.com/mamezou-tech/electron-example-browserview):

**Main process pattern:**
```javascript
// Window resize handler
win.on('resize', () => {
  const bounds = win.getBounds();
  const navHeight = process.platform !== 'win32' ? 60 : 40;

  views.forEach(view => {
    view.setBounds({
      x: 0,
      y: navHeight,
      width: bounds.width,
      height: bounds.height - navHeight,
    });
  });
});
```

**Key takeaway:** They handle resize in main process based on window events. For our use case (React panels with dynamic layout), ResizeObserver in renderer is more appropriate since the browser area changes independently of window size.

## Open Questions

1. **WebContentsView visibility API:** No built-in hide/show methods exist. Moving off-screen works but feels hacky. Is there a better pattern? Should we request this feature from Electron?

2. **Multi-monitor DPI handling:** What happens when dragging window between monitors with different scale factors? Does getBoundingClientRect + setBounds handle this automatically, or do we need screen.on('display-metrics-changed') handlers?

3. **DevTools dock interaction:** When DevTools opens as a bottom dock, it changes the available height. Do we need separate bounds syncing for the DevTools WebContentsView, or can we reuse the same ResizeObserver pattern?

4. **Title bar height on different platforms:** macOS uses 22px traffic lights, Windows/Linux have different title bar heights. Does this affect getBoundingClientRect's top coordinate? Should we account for platform differences?

## Sources

**HIGH confidence:**
- [WebContentsView API Documentation | Electron](https://www.electronjs.org/docs/latest/api/web-contents-view)
- [Inter-Process Communication | Electron](https://www.electronjs.org/docs/latest/tutorial/ipc)
- [ResizeObserver API | MDN](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver)
- [Element.getBoundingClientRect() | MDN](https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect)
- [mamezou-tech/electron-example-browserview | GitHub](https://github.com/mamezou-tech/electron-example-browserview) - Reference implementation

**MEDIUM confidence:**
- [Best Practices for Resize Observer React | DHiWise](https://www.dhiwise.com/post/mastering-resize-observer-react-best-practices)
- [Debounce vs. Throttle in React | Medium](https://medium.com/@arulvalananto/debounce-vs-throttle-decoding-the-duel-578ec68dcc42)
- [Display Object | Electron](https://www.electronjs.org/docs/latest/api/structures/display) - For devicePixelRatio info
- [Migrating from BrowserView to WebContentsView | Electron Blog](https://www.electronjs.org/blog/migrate-to-webcontentsview)

**LOW confidence (needs validation):**
- Z-order control via addChildView index parameter - documented but not extensively tested in production apps
- Off-screen positioning as visibility workaround - common pattern but not officially recommended
- 50ms delay for setBounds race condition - empirically derived, may vary by system

**Known Issues:**
- [Race condition with BrowserView.setBounds | Electron Issue #37330](https://github.com/electron/electron/issues/37330) - Confirmed bug, workaround required
- [BaseWindow resize event not emitted | Electron Issue #44521](https://github.com/electron/electron/issues/44521) - Related timing issue
- [Support z-ordering for BrowserView | Electron Issue #15899](https://github.com/electron/electron/issues/15899) - No built-in z-index API
- [WebContentsView visibility issues | Electron Issue #44590](https://github.com/electron/electron/issues/44590) - No hide/show API
