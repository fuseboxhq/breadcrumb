# Research: xterm.js Auto-Scrolling and Manual Scroll Detection

**Date:** 2026-02-19
**Domain:** Terminal UI / xterm.js
**Overall Confidence:** HIGH

## TL;DR

xterm.js auto-scrolls to bottom on output by default, BUT only when the user hasn't manually scrolled up. It auto-scrolls on user input (configurable via `scrollOnUserInput`). The `onScroll` event exists but had issues before v5.0—older versions only fired on programmatic scrolls, not user scrolling. Use `buffer.active.baseY === buffer.active.viewportY` to detect if scrolled to bottom. Alternate screen buffers disable scrollback entirely (scrollback forced to 0).

## Key Findings

### 1. Auto-Scroll on New Output

**Default Behavior:**
- xterm.js does NOT auto-scroll to bottom when new data arrives if the user has scrolled up
- It DOES auto-scroll to bottom on user input (keypress) by default
- This matches gnome-terminal behavior: don't interrupt users reading scrollback

**What Can Break It:**
- Setting viewport element height directly via CSS breaks auto-scroll on `write()`
- **Solution:** Use nested flexboxes with `margin-top: auto` instead of direct height manipulation
- Issue #934 documents this: direct DOM manipulation of internal viewport elements interferes with scroll detection

**Confidence:** HIGH (verified in official GitHub issues and documentation)

### 2. onScroll Event

**API:**
```typescript
terminal.onScroll: IEvent<number>
```
- Event value is the new viewport position (number)
- Returns IDisposable to stop listening

**Critical Limitation (Pre-v5.0):**
- In xterm.js v4.9.0 and earlier, `onScroll` only fired when terminal scrolled due to new data
- Did NOT fire on manual user scrolling (mouse wheel, scrollbar drag)
- **Fixed in v5.0:** PR #3205 made `onScroll` fire for all scroll movements (breaking change)

**Workaround for Older Versions:**
- Poll buffer properties manually to detect scroll position changes
- No built-in event for user scroll in v4.x

**Confidence:** HIGH (verified in GitHub issue #3201 and official docs)

### 3. Buffer Properties for Scroll Detection

**Pattern:**
```typescript
const isAtBottom = terminal.buffer.active.baseY === terminal.buffer.active.viewportY;
```

**Properties:**
- `buffer.active.baseY`: Line where the top of the bottom page is (when fully scrolled down)
- `buffer.active.viewportY`: Line where the top of the viewport currently is
- When `viewportY < baseY`, user has scrolled up by `(baseY - viewportY)` lines
- When `viewportY === baseY`, viewport is at bottom

**Other Buffer Properties:**
- `buffer.active.length`: Total line count in buffer
- `buffer.active.type`: "normal" or "alternate"
- `buffer.active.cursorX`, `buffer.active.cursorY`: Cursor position

**Confidence:** HIGH (verified in official IBuffer API documentation)

### 4. scrollToBottom() Method

**API:**
```typescript
terminal.scrollToBottom(): void
```

**Related Methods:**
- `scrollToTop()`: Scroll to top of buffer
- `scrollLines(amount: number)`: Scroll by line count (negative = up)
- `scrollPages(pageCount: number)`: Scroll by page count
- `scrollToLine(line: number)`: Scroll to specific 0-based line

**Confidence:** HIGH (verified in official Terminal class documentation)

### 5. Alternate Screen Buffer Behavior

**Standard Behavior:**
- Alternate screen buffer should NOT allow scrolling (per xterm spec)
- Alt buffer is exactly the size of the display with no scrollback
- xterm.js now enforces scrollback = 0 in alt buffer mode

**Historical Issues:**
- Earlier versions allowed scrollback in alt buffer, causing duplicate content when scrolling
- Issue #802 fixed this by forcing scrollback to 0 in alt buffer
- Users who want scrollback in alt buffer (like iTerm's feature) are out of luck—closed as out-of-scope

**Behavior in TUI Apps (like Claude Code):**
- When using alternate buffer (common for full-screen TUI apps), scrolling is disabled
- Wheel events may be passed to the running process instead
- If Claude Code uses alt buffer, you can't scroll the terminal output at all

**Confidence:** HIGH (verified in GitHub issues #802, #3607, and xterm spec references)

### 6. Known write() Auto-Scroll Issues

**Issue #934: Auto scroll stops when viewport height is set**
- Setting CSS height on internal viewport element breaks auto-scroll
- Root cause: Direct DOM manipulation interferes with internal scroll detection
- **Solution:** Use flexbox layout instead (`display: flex` + `margin-top: auto`)

**Issue #216: Viewport behavior on PTY writes**
- Desired behavior: Don't auto-scroll on output when user has scrolled up
- This is now standard behavior in xterm.js

**No other major write() auto-scroll bugs found**
- The main issue is configuration-related (viewport height manipulation)

**Confidence:** HIGH (verified in GitHub issues)

## Configuration Options

### Terminal Options (ITerminalOptions)

```typescript
{
  scrollOnUserInput: boolean,        // Default: true - scroll to bottom on keypress
  scrollback: number,                // Default: 1000 - lines retained when scrolled out
  scrollSensitivity: number,         // Scroll speed multiplier
  fastScrollSensitivity: number,     // Scroll speed with Alt key held
  smoothScrollDuration: number,      // Animation duration in ms (0 = instant)
  scrollOnEraseInDisplay: boolean    // ED2 pushes to scrollback (PuTTY behavior)
}
```

**Confidence:** HIGH (verified in official ITerminalOptions documentation)

## Recommended Patterns

### Detect If User Has Scrolled Up

```typescript
function isScrolledToBottom(terminal: Terminal): boolean {
  return terminal.buffer.active.baseY === terminal.buffer.active.viewportY;
}
```

### Auto-Scroll on New Output (If at Bottom)

```typescript
// Before writing new output
const wasAtBottom = terminal.buffer.active.baseY === terminal.buffer.active.viewportY;

terminal.write(newData);

// Scroll to bottom only if user was already there
if (wasAtBottom) {
  terminal.scrollToBottom();
}
```

### Listen for Scroll Events (v5.0+)

```typescript
const disposable = terminal.onScroll((position: number) => {
  const isAtBottom = terminal.buffer.active.baseY === terminal.buffer.active.viewportY;
  console.log('Scrolled to position:', position, 'At bottom:', isAtBottom);
});

// Cleanup
disposable.dispose();
```

### Prevent Auto-Scroll on User Input

```typescript
const terminal = new Terminal({
  scrollOnUserInput: false  // Don't auto-scroll to bottom on keypress
});
```

## Pitfalls

### Don't Manipulate Viewport DOM Directly

**What happens:** Auto-scroll on `write()` breaks completely

**Avoid by:** Use flexbox layout (`display: flex` + `margin-top: auto`) instead of setting height on viewport element directly

### onScroll Doesn't Fire on User Scroll (Pre-v5.0)

**What happens:** Event listeners miss manual scrolling in xterm.js v4.x

**Avoid by:**
- Upgrade to v5.0+ (breaking change, requires migration)
- Poll buffer properties manually in v4.x
- Use buffer comparison pattern instead of relying on events

### Alternate Buffer Disables Scrollback

**What happens:** If your app uses alternate screen buffer (full-screen TUI), users can't scroll terminal history

**Avoid by:**
- Don't use alternate buffer if you need scrollback
- Be aware that scrolling behavior changes completely in alt buffer mode
- Consider if your TUI actually needs alternate buffer (vim uses it, but log viewers shouldn't)

### Comparing viewportY Without Checking baseY

**What happens:** False positives when checking scroll position without accounting for buffer state

**Avoid by:** Always compare `baseY === viewportY` for bottom detection, not just checking viewportY alone

## Open Questions

None—all questions resolved with HIGH confidence.

## Sources

**HIGH confidence:**
- [xterm.js Terminal API Documentation](https://xtermjs.org/docs/api/terminal/classes/terminal/)
- [xterm.js IBuffer Interface](https://xtermjs.org/docs/api/terminal/interfaces/ibuffer/)
- [xterm.js ITerminalOptions Interface](https://xtermjs.org/docs/api/terminal/interfaces/iterminaloptions/)
- [Issue #3201: onScroll doesn't emit when user is scrolling](https://github.com/xtermjs/xterm.js/issues/3201)
- [Issue #934: Auto scroll not working when viewport height is set](https://github.com/xtermjs/xterm.js/issues/934)
- [Issue #802: alternate screen buffer has a bad scrollback experience](https://github.com/xtermjs/xterm.js/issues/802)
- [Issue #3607: Scrollback emulation in alternative buffer](https://github.com/xtermjs/xterm.js/issues/3607)

**MEDIUM confidence:**
- [Issue #1824: Make scroll-to-bottom on input behaviour configurable](https://github.com/xtermjs/xterm.js/issues/1824)
- [Issue #216: Viewport should only scroll down on input, not when the pty writes](https://github.com/xtermjs/xterm.js/issues/216)
- [Issue #3864: onScroll event does not get fired on user scroll](https://github.com/xtermjs/xterm.js/issues/3864)
