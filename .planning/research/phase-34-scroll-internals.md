# Research: xterm.js Scroll & Viewport Internals

**Task ID:** breadcrumb-1yi.1
**Date:** 2026-03-05
**Domain:** xterm.js / Terminal Emulation
**Overall Confidence:** HIGH

## TL;DR

xterm.js tracks scroll position with two key buffer properties: `buffer.active.baseY` (top of bottom page when fully scrolled) and `buffer.active.viewportY` (current top of viewport). The viewport can jump to position 0 (scroll to top) during buffer switches, when `refresh()` is called, or when `fit()` triggers internal viewport sync operations. Our codebase has a **scroll position restoration pattern in the pane activation hook** (lines 581-601 of TerminalInstance.tsx) that may be racing with internal xterm.js viewport operations, and the `terminal.refresh()` call combined with `fit()` can cause transient scroll position resets.

## How xterm.js Manages Scroll Position

### Core Architecture

**Buffer Model:**
- `buffer.active.viewportY` — Line index where the top of the viewport currently sits
- `buffer.active.baseY` — Line index where the top of the **bottom page** sits (when fully scrolled down)
- `buffer.active.length` — Total line count in the buffer
- When `viewportY === baseY`, the viewport is at the bottom (normal terminal state)
- When `viewportY < baseY`, user has scrolled up by `(baseY - viewportY)` lines

**Internal Viewport Management:**
- `Viewport.ts` manages scrolling through a private `_latestYDisp` field that tracks scroll position
- The `_sync()` method reconciles dimensions and position, **suppressing scroll event handlers during dimensional changes**
- Buffer switching (normal ↔ alternate) **explicitly resets `_latestYDisp` to undefined** to prevent "alt buffer contaminating normal buffer scroll position"

**Confidence:** HIGH — verified via xterm.js source code and official API docs

### Operations That Can Reset Scroll Position

1. **Buffer Switching (Alternate Screen)**
   - When entering/exiting alternate screen buffer (used by vim, less, tmux, Claude Code TUI mode), xterm.js **resets scroll state**
   - Alternate buffer has `scrollback = 0` by design (xterm spec compliance)
   - **Impact:** If Claude Code uses alternate screen, scroll behavior changes entirely

2. **`terminal.refresh(startRow, endRow)`**
   - Forces re-render of specified rows
   - Can cause **transient viewport position changes** during the refresh operation
   - Our code calls `terminal.refresh(0, terminal.rows - 1)` on pane activation (line 590)

3. **`FitAddon.fit()`**
   - Triggers viewport `queueSync()` which schedules position updates at next animation frame
   - Resize events can cause **scroll position shifts** when terminal dimensions change
   - Known issue: fit() can cover the scrollbar or cause width calculation issues affecting scroll state

4. **`terminal.clear()` and `terminal.reset()`**
   - `clear()` uses shell escape sequences (ED2 or similar) — behavior depends on `scrollOnEraseInDisplay` option
   - `reset()` performs full terminal reset (RIS '\x1bc') which **resets all state including scroll**
   - Ghost scrollbar issue: DOM element sized for scrollbar isn't truncated after clear, showing phantom scroll range

5. **Focus Events (Fixed in v5.x)**
   - In older versions, focusing the xterm textarea could trigger unexpected scroll jumps
   - **Fixed in xterm.js via "Prevent scroll on focus" commit (2019)**
   - Our code uses `textarea.focus({ preventScroll: true })` as additional safeguard (line 217)

**Confidence:** HIGH — verified via GitHub issues and xterm.js source

### How `terminal.write()` Interacts With Scroll

**Auto-Scroll Behavior:**
- xterm.js **does NOT auto-scroll** to bottom when new data arrives if user has manually scrolled up
- **Does auto-scroll** on user input (keypress) by default — controlled by `scrollOnUserInput` option
- This matches tmux/gnome-terminal behavior: don't interrupt users reading scrollback

**Our Implementation (Lines 469-481):**
```typescript
const buf = terminal.buffer.active;
const wasAtBottom = buf.baseY === buf.viewportY;
terminal.write(event.data, () => {
  window.breadcrumbAPI?.ackTerminalData(sessionId, event.data.length);
});
if (wasAtBottom) {
  terminal.scrollToBottom();
}
```

**Analysis:** This is **correct** — saves position, writes data, restores scroll-to-bottom only if user was already there. Matches best practice.

**Confidence:** HIGH — verified via xterm.js docs and VS Code source patterns

### What Happens During Idle (No PTY Activity)

**Expected Behavior:**
- xterm.js **should not change scroll position** during idle periods
- No timers, no automatic scroll operations
- Viewport state is frozen until next write or user interaction

**Potential Idle-Related Triggers:**
1. **Browser visibility change** — if page is hidden then shown, browser may trigger layout recalculations
2. **ResizeObserver firing spuriously** — window resize or CSS changes can fire observers even when container size didn't change
3. **React re-renders** — if component unmounts/remounts, terminal state may be lost (but our code guards against this)

**Our Code Analysis:**
- ResizeObserver on containerRef (line 550) fires on any size change, triggers fit() after 80ms debounce
- No visibility change listeners
- No setInterval or idle timers affecting scroll
- **Hypothesis:** Browser idle optimizations or React re-renders may trigger ResizeObserver → fit() → viewport sync → scroll position corruption

**Confidence:** MEDIUM — no direct evidence of idle-triggered bugs, but ResizeObserver is a plausible suspect

## Code Paths in Our Codebase That Touch Scroll Position

### 1. Auto-Scroll on PTY Output (TerminalInstance.tsx:469-481)

**What it does:** After writing PTY data to terminal, scrolls to bottom **only if user was already at bottom**.

**Code:**
```typescript
const wasAtBottom = buf.baseY === buf.viewportY;
terminal.write(event.data, () => { /* ack */ });
if (wasAtBottom) {
  terminal.scrollToBottom();
}
```

**Risk Level:** **LOW** — this is correct implementation matching xterm.js best practices.

---

### 2. Scroll Position Restoration on Pane Activation (TerminalInstance.tsx:581-601)

**What it does:** When pane becomes active (tab switch or focus), saves scroll position, calls `refresh()` + `fit()`, then restores position if it changed.

**Code:**
```typescript
useEffect(() => {
  if (isActive) {
    requestAnimationFrame(() => {
      const terminal = terminalRef.current;
      if (terminal) {
        const buf = terminal.buffer.active;
        const savedViewportY = buf.viewportY;

        terminal.refresh(0, terminal.rows - 1);  // ← Forces re-render
        fit();                                    // ← Triggers viewport sync
        focusTerminal();

        if (buf.viewportY !== savedViewportY) {
          terminal.scrollLines(savedViewportY - buf.viewportY);
        }
      }
    });
  }
}, [isActive, fit, focusTerminal]);
```

**Risk Level:** **HIGH** — This is the **most likely culprit** for scroll-to-top bugs.

**Issues:**
1. **`terminal.refresh()` can cause transient scroll position changes** — the saved `viewportY` is captured BEFORE refresh, but the buffer state may be stale
2. **`fit()` triggers async viewport sync** via `queueSync()` — the restoration check happens synchronously but fit()'s effects are async
3. **Race condition:** If fit() or refresh() triggers a viewport sync that completes AFTER the `scrollLines()` restoration, the restoration is overwritten
4. **Reading buffer.active.viewportY during active operations** — if refresh/fit are modifying viewport state, the comparison may see intermediate values

---

### 3. Horizontal Resize Debounce (TerminalInstance.tsx:527-540)

**What it does:** Debounces horizontal resize (expensive due to line reflow) for terminals with large buffers (>200 lines).

**Code:**
```typescript
const bufferLength = terminal.buffer.normal.length;
if (colsChanged && bufferLength > 200) {
  clearTimeout(horizontalResizeTimer);
  horizontalResizeTimer = setTimeout(() => {
    terminal.resize(dims.cols, terminal.rows);
    window.breadcrumbAPI?.resizeTerminal(sessionId, dims.cols, terminal.rows);
  }, 100);
}
```

**Risk Level:** **LOW** — resize operations shouldn't reset scroll to top, but FitAddon has known scroll position issues.

---

### 4. ResizeObserver Triggering fit() (TerminalInstance.tsx:501-548)

**What it does:** Observes container size changes, debounces to 80ms, then calls fit() to resize terminal.

**Risk Level:** **MEDIUM** — If ResizeObserver fires spuriously during idle (browser optimization, CSS recalc), it triggers fit() which can affect scroll position.

**Potential Issue:** No scroll position preservation around fit() calls in the resize handler — only the pane activation hook attempts restoration.

---

### 5. Shell Integration OSC Handlers (useShellIntegration.ts:54-120)

**What it does:** Reads `terminal.buffer.active.cursorY` and `baseY` to track command boundaries (OSC 133).

**Risk Level:** **NONE** — Read-only operations, no scroll manipulation.

## Hypotheses for Scroll-to-Top Bug

### Hypothesis 1: Race Between Pane Activation Hook and fit() Viewport Sync

**Likelihood:** HIGH
**Confidence:** MEDIUM

**Mechanism:**
1. User switches to a terminal pane (or pane becomes visible after idle)
2. `isActive` effect fires (line 581)
3. Inside `requestAnimationFrame`:
   - Save `viewportY` (e.g., scrolled to line 500 in a 2000-line buffer)
   - Call `terminal.refresh()` — triggers internal viewport update
   - Call `fit()` — queues async viewport sync via `queueSync()`
   - Check `buf.viewportY !== savedViewportY` — may see intermediate value
   - Call `scrollLines()` to restore
4. **Async viewport sync completes AFTER restoration** — resets position to 0 or another value

**Evidence:**
- xterm.js Viewport.ts explicitly mentions "suppress scroll event handlers during dimensional changes"
- fit() uses `queueSync()` which schedules updates at next animation frame
- Our restoration logic is synchronous but fit() effects are async

**Recommended Fix:**
- Move scroll position restoration **after** fit() completes
- Use `terminal.onResize` event or delay restoration to next frame
- Or: Remove `refresh()` call entirely — xterm.js should handle re-rendering on activation

---

### Hypothesis 2: Spurious ResizeObserver During Idle Triggering fit()

**Likelihood:** MEDIUM
**Confidence:** LOW

**Mechanism:**
1. Terminal is idle, user is scrolled up reading output
2. Browser triggers layout recalculation (CSS change, window resize, visibility change)
3. ResizeObserver fires even though container dimensions didn't actually change
4. Resize handler calls fit() after 80ms debounce
5. fit() triggers viewport sync which **may reset scroll position** if dimensions calculation is off

**Evidence:**
- ResizeObserver can fire for reasons other than size changes (CSS changes, display property toggles)
- FitAddon has known issues with scroll position during resize (GitHub issues #1284, #3867)

**Recommended Fix:**
- Add scroll position preservation in the resize handler (save before fit, restore after)
- Check if dimensions actually changed before calling fit()
- Add logging to detect spurious ResizeObserver fires

---

### Hypothesis 3: Buffer Switching (Alternate Screen) Resetting Scroll

**Likelihood:** LOW
**Confidence:** HIGH

**Mechanism:**
1. Claude Code or another TUI enters alternate screen buffer mode
2. xterm.js resets `_latestYDisp` to prevent scroll contamination
3. User exits alternate screen
4. Scroll position in normal buffer is lost or reset

**Evidence:**
- xterm.js Viewport.ts explicitly resets scroll on buffer switch
- Alternate screen is used by vim, less, tmux, and potentially Claude Code TUI

**Recommended Fix:**
- Detect buffer switches via `terminal.buffer.active.type` ("normal" vs "alternate")
- Manually preserve scroll position across buffer switches (save on exit alt, restore on return to normal)
- Or: Document this as expected behavior if Claude Code uses alt screen

---

### Hypothesis 4: terminal.refresh() Causing Transient Scroll Reset

**Likelihood:** MEDIUM
**Confidence:** MEDIUM

**Mechanism:**
1. Pane activation calls `terminal.refresh(0, terminal.rows - 1)` to force re-render
2. Refresh operation temporarily resets viewport position during rendering
3. Buffer properties read during refresh show stale or intermediate values
4. Restoration logic sees no change (because it read mid-refresh state) or restores to wrong value

**Evidence:**
- xterm.js docs don't specify scroll behavior of refresh()
- Our code reads `buf.viewportY` immediately after calling refresh() — may be stale

**Recommended Fix:**
- Remove `terminal.refresh()` call — xterm.js should handle re-rendering automatically
- If refresh is needed, delay scroll position read until next frame
- Use `terminal.onRender` event to detect when refresh completes

---

## Known xterm.js Issues Related to Scroll Position

### Issue #1981: Viewport Scrolling Jumps When Textarea is Focused

**Status:** FIXED (2019)
**Details:** Clicking on xterm textarea when scrolled off-screen caused browser to center element
**Fix:** "Prevent scroll on focus" commit
**Relevance:** Our code already uses `textarea.focus({ preventScroll: true })` — not applicable

---

### Issue #934: Auto Scroll Not Working When Viewport Height is Set

**Status:** Known Issue
**Details:** Setting CSS height on viewport element breaks auto-scroll
**Solution:** Use flexbox layout instead of direct height manipulation
**Relevance:** Our code uses flexbox (`className="w-full h-full"`) — not applicable

---

### Issue #1284, #3867: FitAddon Covers Scrollbar

**Status:** Known Issue
**Details:** Calling fit() can cause scrollbar to be covered or width calculations to be incorrect
**Relevance:** Potentially related to scroll position issues during resize

---

### Issue #3584: Fit Addon Resizes Erratically Moving Up and Down

**Status:** Known Issue
**Details:** fit() can cause rapid resize oscillations when calculating dimensions
**Relevance:** Could be related to scroll position jumping

---

### Issue #4959: Scrolling Up and Down With Mouse Wheel is Off By 1 Pixel

**Status:** Known Issue (2024)
**Details:** Repeated mouse wheel scrolling causes scrollTop to drift, eventually scrolling last line out of view
**Relevance:** LOW — user reports scroll-to-top, not 1-pixel drift

---

## Recommended Fix Approach

### Priority 1: Fix Pane Activation Scroll Restoration Race Condition

**Problem:** The pane activation hook (lines 581-601) reads buffer position, calls refresh/fit, then attempts restoration — but fit() is async and may complete after restoration.

**Solution:**

1. **Remove `terminal.refresh()` call** — xterm.js should handle re-rendering when pane becomes visible
2. **Preserve scroll position around fit()** using async callback:

```typescript
useEffect(() => {
  if (isActive) {
    requestAnimationFrame(() => {
      const terminal = terminalRef.current;
      if (terminal) {
        const buf = terminal.buffer.active;
        const savedViewportY = buf.viewportY;

        // Remove refresh() — not needed
        // terminal.refresh(0, terminal.rows - 1);

        fit();
        focusTerminal();

        // Restore scroll position after next frame (fit effects complete)
        requestAnimationFrame(() => {
          const currentY = terminal.buffer.active.viewportY;
          if (currentY !== savedViewportY) {
            terminal.scrollLines(savedViewportY - currentY);
          }
        });
      }
    });
  }
}, [isActive, fit, focusTerminal]);
```

**Confidence:** HIGH — eliminates race condition by delaying restoration until fit() completes

---

### Priority 2: Add Scroll Position Preservation to Resize Handler

**Problem:** ResizeObserver → fit() has no scroll position preservation. If fit() causes scroll position changes, they're not corrected.

**Solution:**

Add scroll preservation to the resize handler (around line 512):

```typescript
const handleResize = () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (destroyed) return;
    tryOpen();
    if (!ptyCreated) {
      tryCreatePty();
      return;
    }
    try {
      const dims = fitAddon.proposeDimensions();
      if (!dims || dims.cols <= 0 || dims.rows <= 0) return;

      const colsChanged = dims.cols !== terminal.cols;
      const rowsChanged = dims.rows !== terminal.rows;
      if (!colsChanged && !rowsChanged) return;

      // Save scroll position before fit operations
      const buf = terminal.buffer.active;
      const savedViewportY = buf.viewportY;

      // ... existing resize logic ...

      // Restore scroll position if fit caused a jump
      requestAnimationFrame(() => {
        const currentY = terminal.buffer.active.viewportY;
        if (currentY !== savedViewportY) {
          terminal.scrollLines(savedViewportY - currentY);
        }
      });
    } catch { /* ignore */ }
  }, 80);
};
```

**Confidence:** MEDIUM — defensive fix, may not be necessary if Priority 1 resolves the issue

---

### Priority 3: Detect and Log Spurious Scroll Position Changes

**Problem:** Without observability, it's hard to diagnose when scroll position resets occur.

**Solution:**

Add an `onScroll` listener during development to log unexpected scroll resets:

```typescript
// In terminal creation (after line 329)
const scrollDisposable = terminal.onScroll((position) => {
  const buf = terminal.buffer.active;
  const isAtBottom = buf.baseY === buf.viewportY;
  if (buf.viewportY === 0 && !isAtBottom && buf.length > terminal.rows) {
    console.warn('[TerminalInstance] Unexpected scroll to top detected', {
      sessionId,
      position,
      viewportY: buf.viewportY,
      baseY: buf.baseY,
      length: buf.length,
      stack: new Error().stack,
    });
  }
});

// Add to cleanup (line 558)
scrollDisposable.dispose();
```

**Confidence:** HIGH — provides diagnostic data to confirm fixes

---

## Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| Scroll position tracking | `buffer.active.viewportY` and `baseY` | Public API, guaranteed stable across versions |
| Auto-scroll logic | Check `viewportY === baseY` before `scrollToBottom()` | Matches tmux/xterm behavior, respects user scroll |
| Focus without scroll | `textarea.focus({ preventScroll: true })` | Browser API, prevents viewport jumps |
| Buffer switch detection | `buffer.active.type` ("normal" or "alternate") | Public API for detecting alt screen mode |

## Pitfalls

### Reading buffer.active Properties During Active Operations

**What happens:** If you read `buffer.active.viewportY` while `refresh()` or `fit()` are executing, you may see stale or intermediate values.

**Avoid by:** Read buffer properties in `requestAnimationFrame` callbacks **after** operations complete, or use xterm.js event listeners (`onScroll`, `onResize`).

---

### Assuming fit() is Synchronous

**What happens:** `FitAddon.fit()` queues viewport sync operations that complete at next animation frame. Code immediately after fit() sees pre-sync state.

**Avoid by:** Delay operations that depend on fit() results to the next frame using `requestAnimationFrame`.

---

### Calling terminal.refresh() Unnecessarily

**What happens:** Forces a re-render that can cause transient scroll position changes. xterm.js handles rendering automatically.

**Avoid by:** Only call `refresh()` if you've manually modified buffer content outside of PTY writes. For visibility changes, xterm.js handles it.

---

### Not Handling Alternate Screen Buffer Mode

**What happens:** When TUIs enter alternate screen (vim, less, Claude Code), scroll behavior changes entirely (scrollback disabled). When exiting, normal buffer scroll position may be lost.

**Avoid by:** Detect buffer switches via `buffer.active.type` and preserve scroll position manually if needed.

---

## Open Questions

**Q: Does Claude Code use alternate screen buffer mode?**
**Status:** Unknown — needs testing. If it does, scroll position loss on buffer switch is expected behavior.

**Q: Can we reproduce scroll-to-top by triggering ResizeObserver without actual size change?**
**Status:** Needs testing — add logging to ResizeObserver handler to detect spurious fires.

**Q: Does terminal.refresh() have documented scroll position side effects?**
**Status:** Not documented in xterm.js API docs — may be implementation detail. Removing it is safest.

## Sources

**HIGH confidence:**
- [xterm.js Viewport.ts (GitHub)](https://github.com/xtermjs/xterm.js/blob/master/src/browser/Viewport.ts) — Internal scroll management
- [xterm.js IBuffer API (Official Docs)](https://xtermjs.org/docs/api/terminal/interfaces/ibuffer/) — baseY, viewportY properties
- [xterm.js Terminal API (Official Docs)](https://xtermjs.org/docs/api/terminal/classes/terminal/) — scrollToBottom(), scrollLines(), refresh()
- [Issue #1981: Viewport scrolling jumps when xterm textarea is focused](https://github.com/xtermjs/xterm.js/issues/1981) — FIXED
- [Buffer API Issue #1994](https://github.com/xtermjs/xterm.js/issues/1994) — viewportY/baseY documentation
- Direct codebase audit: `TerminalInstance.tsx`, `useShellIntegration.ts`, `TerminalPanel.tsx`

**MEDIUM confidence:**
- [Issue #934: Auto scroll not working when viewport height is set](https://github.com/xtermjs/xterm.js/issues/934) — CSS height issues
- [Issue #1284: Fit addon covers scrollbar](https://github.com/xtermjs/xterm.js/issues/1284) — FitAddon scroll position issues
- [Issue #3867: fitAddon.fit() will cover the scroll bar](https://github.com/xtermjs/xterm.js/issues/3867) — FitAddon behavior
- [Issue #3584: fit addon resizes erratically moving up and down](https://github.com/xtermjs/xterm.js/issues/3584) — FitAddon instability
- [Issue #2638: clear command clears scrollback but doesn't update DOM element height](https://github.com/xtermjs/xterm.js/issues/2638) — clear() behavior
- [Issue #3201: onScroll doesn't emit when user is scrolling](https://github.com/xtermjs/xterm.js/issues/3201) — Event behavior
- Previous research: `.planning/research/xterm-scroll-behavior.md` — Auto-scroll patterns
