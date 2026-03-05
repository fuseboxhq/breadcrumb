# Research: xterm.js Cursor Positioning Pipeline

**Task ID:** breadcrumb-1yi.2
**Date:** 2026-03-05
**Domain:** xterm.js terminal rendering architecture
**Overall Confidence:** HIGH

## TL;DR

The cursor-below-prompter bug is likely caused by **viewport desync during terminal.refresh() or fit() operations**, combined with **flow control backpressure pausing the PTY mid-escape-sequence**. The codebase calls `terminal.refresh()` + `fit()` + manual viewport restoration on pane focus (TerminalInstance.tsx:586-596), which can desync cursorY/viewportY if the refresh triggers while burst output is being processed. The random scroll-to-top bug is a separate issue: browser focus behavior on the hidden xterm textarea element.

## How xterm.js Cursor Positioning Works

### Buffer Coordinate System

xterm.js maintains two buffers (`normal` and `alternate`) with these key properties:

- **cursorX**: Horizontal cursor position, range `[0, Terminal.cols]` (can be beyond last cell)
- **cursorY**: Vertical cursor position relative to buffer viewport, range `[0, Terminal.rows - 1]`
- **baseY**: The line within the buffer where the top of the bottom page is (when fully scrolled down)
- **viewportY**: The line within the buffer where the top of the viewport is
- **length**: Total number of lines in the buffer

**Key relationship:**
```
Absolute cursor line = baseY + cursorY
Screen cursor line = cursorY (when viewportY == baseY)
```

When scrollback exists (viewportY < baseY), the cursor is off-screen below the viewport. This is normal when scrolled up.

### Rendering Pipeline

1. **PTY output → terminal.write(data, callback)**
   - Data added synchronously to input write buffer
   - Parser processes in chunks, taking <16ms per frame to avoid UI blocking
   - Callback fires AFTER parsing completes (used for flow control ACK)

2. **Parser updates internal buffer state**
   - Cursor position (cursorX, cursorY)
   - Viewport position (viewportY, baseY)
   - Cell content, attributes, etc.

3. **Renderer draws to screen**
   - WebGL or Canvas renderer
   - Cursor drawn on separate transparent 2D canvas layer (even with WebGL)
   - Cursor blink managed by separate timer

4. **Screen coordinates calculated**
   ```
   Visual cursor row = cursorY (when at bottom/scrolled to bottom)
   Visual cursor col = cursorX
   ```

### Cursor State Desyncs

**Known causes of cursor position desyncs:**

1. **Resize during escape sequences** (Issue #2217)
   - If `terminal.resize()` happens mid-escape-sequence, saved cursor position can become invalid
   - Fixed in xterm.js 4.0.0 for alt screen, but edge cases remain

2. **Refresh during active parsing**
   - `terminal.refresh(startRow, endRow)` forces re-render of specific rows
   - If called while parser is mid-chunk, can render stale cursor state

3. **FitAddon dimension calculation off-by-one** (Issue #4841)
   - `fitAddon.proposeDimensions()` can return dimensions that don't fully fill container
   - Users report needing to add +1 to cols/rows for correct fit
   - Timing issue: calling `fit()` before `terminal.open()` causes wrong calculations

4. **Flow control pausing mid-sequence**
   - If PTY pauses during a multi-byte escape sequence (e.g., cursor positioning CSI), xterm.js buffer can be in intermediate state
   - Resume can cause cursor to be in unexpected position

5. **Viewport scroll during write operations**
   - Auto-scroll logic checks `buf.baseY === buf.viewportY` to determine if at bottom
   - Race condition: if viewport changes between check and scroll, cursor appears wrong

## Codebase Analysis: Every Code Path Affecting Cursor Position

### 1. **Terminal Creation & Initialization** (TerminalInstance.tsx:290-575)

**Initial resize (line 398):**
```typescript
terminal.resize(dims.cols, dims.rows);
```
- Called once during PTY creation
- Uses `fitAddon.proposeDimensions()` which can have off-by-one errors
- **Hypothesis 1**: If dims are wrong by 1, cursor could be positioned at col/row that doesn't exist visually

**Replay buffer write (line 413):**
```typescript
if (result?.replayBuffer) {
  terminal.write(result.replayBuffer);
}
```
- Replays buffered escape sequences when reconnecting to existing PTY
- No callback → **no flow control during replay**
- **Hypothesis 2**: Replaying 100KB of escape sequences without backpressure could overwhelm parser, causing cursor state to desync

### 2. **PTY Data Flow with Backpressure** (TerminalInstance.tsx:469-481)

```typescript
const wasAtBottom = buf.baseY === buf.viewportY;
terminal.write(event.data, () => {
  window.breadcrumbAPI?.ackTerminalData(sessionId, event.data.length);
});
if (wasAtBottom) {
  terminal.scrollToBottom();
}
```

**Flow:**
- Check if at bottom (BEFORE write starts)
- Write data (async parsing)
- ACK in callback (AFTER parsing completes)
- Scroll to bottom IF was at bottom initially

**Hypothesis 3: Race condition in auto-scroll logic**
- `wasAtBottom` is checked BEFORE write
- Write can take multiple frames for large chunks (Claude Code outputs thousands of lines)
- By the time `scrollToBottom()` is called, baseY/viewportY may have changed
- If viewportY drifted during write, scrollToBottom() scrolls to WRONG position
- Cursor appears below visible area

### 3. **Pane Focus Handling** (TerminalInstance.tsx:581-601)

```typescript
useEffect(() => {
  if (isActive) {
    requestAnimationFrame(() => {
      const terminal = terminalRef.current;
      if (terminal) {
        const buf = terminal.buffer.active;
        const savedViewportY = buf.viewportY;

        terminal.refresh(0, terminal.rows - 1);
        fit();
        focusTerminal();

        if (buf.viewportY !== savedViewportY) {
          terminal.scrollLines(savedViewportY - buf.viewportY);
        }
      }
    });
  }
}, [isActive, fit, focusTerminal]);
```

**Hypothesis 4: Refresh triggers viewport change that desyncs cursor**
- `terminal.refresh(0, terminal.rows - 1)` forces full screen re-render
- If parser is mid-chunk when refresh fires, cursor could be at intermediate position
- `fit()` can change terminal dimensions, triggering SIGWINCH to PTY
- SIGWINCH can cause TUI apps (Claude Code) to redraw, sending cursor positioning sequences
- Those sequences arrive WHILE we're restoring viewportY
- Result: cursor ends up at wrong position

**Hypothesis 5: FitAddon dimension changes during focus**
- `fit()` calls `fitAddon.proposeDimensions()` which can return slightly different values than current dims
- If cols/rows change even by 1, `terminal.resize()` is called (line 202)
- Resize triggers buffer reflow for horizontal changes
- Reflow can move cursor to unexpected position if it was at edge of screen

### 4. **Shell Integration OSC Handlers** (useShellIntegration.ts:54-120)

```typescript
const cursorLine = terminal.buffer.active.cursorY + terminal.buffer.active.baseY;
```

**OSC 133 handlers read cursor position for command block tracking:**
- Type A (prompt start): `cursorY + baseY`
- Type B (prompt end): `cursorY + baseY`
- Type C (command start): `cursorY + baseY`
- Type D (command end): `cursorY + baseY`

**Hypothesis 6: OSC sequences arrive during viewport manipulation**
- If OSC 133:A arrives while `terminal.refresh()` or `fit()` is running, the recorded `promptStartLine` could be wrong
- Later, if the UI tries to scroll to that prompt line, cursor appears in wrong place
- **LOW confidence** — OSC handlers don't write cursor positioning sequences, only read

### 5. **Resize Handling with Debounce** (TerminalInstance.tsx:500-547)

**Complex resize logic with multiple debounce paths:**

1. Vertical-only resize: immediate (line 520-523)
2. Horizontal resize with large buffer (>200 lines): 100ms debounce (line 526-540)
3. Small buffer or both: immediate (line 543-545)

**Hypothesis 7: Debounced horizontal resize desyncs cursor**
- Large buffer horizontal resize is debounced at 100ms
- During that 100ms, PTY is still writing data at OLD dimensions
- xterm.js buffer has OLD cols, but viewport might be at NEW width
- Cursor positioning escape sequences from PTY use OLD cols
- Result: cursor appears at wrong column

**Evidence from code:**
```typescript
// Line 530-534: Apply row change immediately, DEFER cols change
if (rowsChanged) {
  terminal.resize(terminal.cols, dims.rows);  // Old cols, new rows
  window.breadcrumbAPI?.resizeTerminal(sessionId, terminal.cols, dims.rows);
}
// Line 535-539: Cols change happens 100ms later
horizontalResizeTimer = setTimeout(() => {
  terminal.resize(dims.cols, terminal.rows);  // New cols
  window.breadcrumbAPI?.resizeTerminal(sessionId, dims.cols, terminal.rows);
}, 100);
```

During that 100ms window, terminal has NEW rows but OLD cols. PTY has NEW rows and OLD cols (from first resize IPC). If Claude Code outputs cursor positioning sequences during this window, cursor could land at wrong position.

### 6. **Manual Viewport Scrolling** (TerminalInstance.tsx:595-596)

```typescript
if (buf.viewportY !== savedViewportY) {
  terminal.scrollLines(savedViewportY - buf.viewportY);
}
```

**Hypothesis 8: scrollLines doesn't update cursor, only viewport**
- `scrollLines(delta)` changes viewportY by delta
- Does NOT change cursorY or baseY
- If cursor was visible before scroll, it might be off-screen after
- **Needs verification** — does scrollLines affect cursor rendering position?

## Flow Control & Backpressure Impact

### Current Implementation (PHASE-33)

**Backend (TerminalService.ts):**
- High watermark: 100K unacked chars → pause PTY
- Low watermark: 5K unacked chars → resume PTY
- ACK happens in frontend `terminal.write()` callback

**Frontend (TerminalInstance.tsx:473):**
```typescript
terminal.write(event.data, () => {
  window.breadcrumbAPI?.ackTerminalData(sessionId, event.data.length);
});
```

### Potential Cursor Issues from Flow Control

**Hypothesis 9: PTY paused mid-escape-sequence**

Escape sequence for cursor positioning:
```
\x1b[<row>;<col>H    (CSI H - Cursor Position)
```

If PTY output is:
```
\x1b[10;50H         (move cursor to row 10, col 50)
Some text here
```

And PTY pauses AFTER sending `\x1b[10;` but BEFORE `;50H`:
1. xterm.js parser receives partial sequence `\x1b[10;`
2. Parser is in intermediate state, cursor not yet moved
3. Front-end ACKs the partial data
4. PTY resumes, sends `;50H`
5. Parser completes sequence, moves cursor

**BUT:** If `terminal.refresh()` or `fit()` happens during step 2-3, cursor could be rendered at wrong position because parser state is incomplete.

**Confidence:** MEDIUM — xterm.js parser should buffer incomplete sequences, but edge cases exist

## Viewport Scroll-to-Top Bug (Separate Issue)

### Root Cause: Browser Focus Behavior

From [xterm.js Issue #1981](https://github.com/xtermjs/xterm.js/issues/1981):

> "When xterm textarea is scrolled above the window viewport, clicking on the textarea will jump halfway up the viewport."

**Mechanism:**
1. xterm.js uses a hidden textarea element for input
2. When textarea receives focus, browser scrolls it into view (center of screen)
3. This is native browser behavior for focused form elements

**Current Mitigation in Codebase (TerminalInstance.tsx:214-220):**
```typescript
const focusTerminal = useCallback(() => {
  const textarea = containerRef.current?.querySelector<HTMLTextAreaElement>('.xterm-helper-textarea');
  if (textarea) {
    textarea.focus({ preventScroll: true });  // ← Prevents browser scroll
  } else {
    terminalRef.current?.focus();
  }
}, []);
```

**Hypothesis 10: preventScroll not working in all scenarios**
- `preventScroll: true` has limited browser support (Firefox, Edge, Safari)
- If browser doesn't support it, viewport jumps to center textarea
- **Alternatively:** Some code path calls `terminal.focus()` directly instead of `focusTerminal()`

**Needs verification:** Grep for all `.focus()` calls to ensure they use `preventScroll`

## Specific Hypotheses for Cursor-Below-Prompter Bug

### HYPOTHESIS A: Refresh + Fit During Active Write (HIGH CONFIDENCE)

**Mechanism:**
1. Claude Code outputs thousands of lines rapidly
2. `terminal.write(data, callback)` is processing chunks
3. User clicks into terminal pane, triggering focus effect (line 581)
4. Focus effect calls `terminal.refresh(0, terminal.rows - 1)` + `fit()`
5. Refresh re-renders screen while parser is mid-chunk
6. Cursor position in buffer is at line N, but viewport is being adjusted
7. Result: cursor rendered below visible viewport

**Evidence:**
- Focus effect explicitly calls refresh + fit (TerminalInstance.tsx:590-591)
- Auto-scroll logic checks `wasAtBottom` BEFORE write, scrolls AFTER (line 472-478)
- Timing race: if fit() changes dimensions during write, cursor could be at wrong position relative to new rows

**Fix approach:**
1. Don't call `terminal.refresh()` on focus — xterm.js already re-renders when DOM becomes visible
2. If refresh is necessary, check if terminal.write() is active (parser busy)
3. Defer refresh until write callback completes

### HYPOTHESIS B: FitAddon Off-by-One Error (MEDIUM CONFIDENCE)

**Mechanism:**
1. `fitAddon.proposeDimensions()` returns { cols: 159, rows: 49 }
2. Actual available space could fit { cols: 160, rows: 50 }
3. xterm.js buffer thinks it has 49 rows, but content needs 50
4. Cursor ends up at row 50 (one below visible area)

**Evidence:**
- [xterm.js Issue #4841](https://github.com/xtermjs/xterm.js/issues/4841): "FitAddon resizes incorrectly"
- Users report needing to add +1 to both cols and rows for correct fit
- Timing issue: calling fit() before open() causes wrong calculations

**Fix approach:**
1. Add +1 to proposed dimensions (workaround from Issue #4841)
2. Verify fit() is never called before terminal.open()
3. Check if containerRef.current has non-zero dimensions before proposeDimensions()

### HYPOTHESIS C: Debounced Horizontal Resize Creates Dimension Mismatch (MEDIUM CONFIDENCE)

**Mechanism:**
1. Terminal has 160 cols, 50 rows
2. User resizes pane horizontally (e.g., drag split handle)
3. Vertical resize applied immediately: terminal.resize(160, 45) + PTY SIGWINCH
4. Horizontal resize debounced 100ms: terminal.resize(140, 45) happens LATER
5. During 100ms window, PTY outputs cursor positioning sequences for 160 cols
6. xterm.js buffer has 160 cols, but viewport is being reflowed for 140
7. Cursor lands at col 150 which doesn't exist in 140-col layout

**Evidence:**
- Horizontal resize with large buffer has 100ms debounce (line 535-539)
- Row change applied immediately (line 531-533)
- PTY gets two SIGWINCH signals 100ms apart

**Fix approach:**
1. Apply both row AND col resize together atomically (no split)
2. Only debounce the entire resize operation, not cols separately
3. OR: Don't send SIGWINCH until BOTH cols and rows are final

### HYPOTHESIS D: Replay Buffer Overwhelms Parser (LOW CONFIDENCE)

**Mechanism:**
1. Tab merge moves pane to different tab (new xterm.js instance)
2. TerminalInstance replays 100KB buffer via `terminal.write(result.replayBuffer)` (line 413)
3. No callback provided → no flow control during replay
4. Parser processes 100KB without ACK/backpressure
5. Parser falls behind, cursor state desyncs

**Evidence:**
- Replay buffer write has no callback (line 413)
- Normal writes have ACK callback (line 473)
- 100KB is at the high-water mark for flow control

**Fix approach:**
1. Add callback to replay buffer write
2. Split replay buffer into chunks with ACKs between
3. OR: Reduce MAX_REPLAY_BUFFER to safer size (e.g., 50KB)

## Known xterm.js Issues Related to Cursor Positioning

### Issue #1434: Cursor at Wrong Column Position
- Cursor points to `terminal.cols` instead of `terminal.cols - 1`
- After refresh, cursor appears in first column when it should be at end
- **Status:** Closed, but edge cases remain

### Issue #2020: CSI Sequences Put Cursor in Odd State
- Certain CSI sequences can put `buffer.x` into faulty state
- Cursor off during screen refreshes
- **Relevant to:** Hypothesis A (refresh during write)

### Issue #1981: Viewport Scrolling Jumps When Focused
- Browser scrolls hidden textarea to center of screen on focus
- **Fixed in xterm.js:** `focus({ preventScroll: true })` API
- **Codebase already uses this** (line 217)
- **But:** May not work in all browsers

### Issue #4841: FitAddon Resizes Incorrectly
- `fit()` doesn't utilize all available space
- Users need to add +1 to cols/rows
- Timing issue: fit() before open() fails
- **Relevant to:** Hypothesis B (FitAddon off-by-one)

### Issue #2217: Saved Cursor Position on Resize (Alt Screen)
- Fixed in xterm.js 4.0.0
- Resize while alt screen active could corrupt saved cursor position
- **Relevant to:** Claude Code uses alt screen mode

## Recommended Fix Approach

### Priority 1: Remove Unnecessary Refresh on Focus (HIGH CONFIDENCE)

**Change TerminalInstance.tsx:581-601:**

```typescript
useEffect(() => {
  if (isActive) {
    requestAnimationFrame(() => {
      const terminal = terminalRef.current;
      if (terminal) {
        // REMOVE terminal.refresh() — xterm.js re-renders automatically when visible
        fit();
        focusTerminal();
        // REMOVE viewport restoration — fit() should preserve scroll position
      }
    });
  }
}, [isActive, fit, focusTerminal]);
```

**Rationale:**
- xterm.js already re-renders when DOM becomes visible
- `terminal.refresh()` during active write can cause cursor desync
- Viewport restoration with `scrollLines()` can fight auto-scroll logic

### Priority 2: Fix Horizontal Resize Debounce (MEDIUM CONFIDENCE)

**Change TerminalInstance.tsx:500-547:**

Apply cols and rows atomically, debounce entire resize operation:

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

      // Vertical resize is cheap, horizontal is expensive with large buffer
      const bufferLength = terminal.buffer.normal.length;
      const debounceMs = (colsChanged && bufferLength > 200) ? 100 : 0;

      clearTimeout(horizontalResizeTimer);
      horizontalResizeTimer = setTimeout(() => {
        if (destroyed) return;
        // Apply BOTH cols and rows together atomically
        terminal.resize(dims.cols, dims.rows);
        window.breadcrumbAPI?.resizeTerminal(sessionId, dims.cols, dims.rows);
      }, debounceMs);
    } catch { /* ignore */ }
  }, 80);
};
```

**Rationale:**
- Eliminates 100ms window where terminal has old cols but new rows
- PTY receives single SIGWINCH with final dimensions
- Cursor positioning sequences from PTY match terminal dimensions

### Priority 3: Add Callback to Replay Buffer Write (LOW CONFIDENCE)

**Change TerminalInstance.tsx:412-414:**

```typescript
if (result?.replayBuffer) {
  terminal.write(result.replayBuffer, () => {
    // ACK replay buffer after parsing completes
    window.breadcrumbAPI?.ackTerminalData(sessionId, result.replayBuffer.length);
  });
}
```

**Rationale:**
- Ensures flow control applies to replay buffer
- Prevents parser overload during reconnection
- Matches normal write pattern

### Priority 4: Verify FitAddon Dimensions (MEDIUM CONFIDENCE)

**Add check in TerminalInstance.tsx fit() function:**

```typescript
const fit = useCallback(() => {
  const fitAddon = fitAddonRef.current;
  const terminal = terminalRef.current;
  if (!fitAddon || !terminal) return;

  try {
    const dims = fitAddon.proposeDimensions();
    if (dims && dims.cols > 0 && dims.rows > 0) {
      // FitAddon workaround from Issue #4841: verify dimensions fill container
      const container = containerRef.current;
      if (container) {
        const { clientWidth, clientHeight } = container;
        // If container is non-zero but dims are suspiciously small, skip resize
        if (clientWidth > 100 && clientHeight > 100 && (dims.cols < 10 || dims.rows < 5)) {
          console.warn('FitAddon returned invalid dimensions, skipping resize');
          return;
        }
      }

      if (dims.cols !== terminal.cols || dims.rows !== terminal.rows) {
        terminal.resize(dims.cols, dims.rows);
        window.breadcrumbAPI?.resizeTerminal(sessionId, dims.cols, dims.rows);
      }
    }
  } catch {
    // Ignore resize errors during teardown
  }
}, [sessionId]);
```

**Rationale:**
- Detects FitAddon calculation errors before they cause cursor issues
- Prevents resize to invalid dimensions
- Logs warnings for debugging

## Open Questions

1. **Does xterm.js buffer incomplete escape sequences correctly during flow control pauses?**
   - Need to test: pause PTY mid-CSI sequence, verify cursor doesn't move until complete
   - Read xterm.js parser source code for buffering logic

2. **Can terminal.refresh() be called safely during terminal.write()?**
   - xterm.js docs don't specify thread-safety or reentrancy
   - Need to check if refresh waits for parser or interrupts it

3. **Does scrollLines() affect cursor rendering or only viewport?**
   - Test: set cursor to row 10, scroll viewport up 5 lines, check if cursor still at row 10 (absolute) or row 5 (relative)

4. **Is the cursor-below-prompter bug more common with WebGL renderer than Canvas?**
   - WebGL renders cursor on separate 2D canvas layer
   - Canvas renderer draws cursor directly
   - Timing difference could expose race conditions

5. **Do OSC 133 sequences interact badly with viewport manipulation?**
   - OSC handlers read cursorY+baseY to record prompt line numbers
   - If viewport changes while OSC handler runs, recorded positions could be wrong
   - Need to trace OSC handler execution timing relative to fit()/refresh()

## Sources

**HIGH confidence:**
- [xterm.js IBuffer API Documentation](https://xtermjs.org/docs/api/terminal/interfaces/ibuffer/)
- [xterm.js Flow Control Guide](https://xtermjs.org/docs/guides/flowcontrol/)
- [xterm.js GitHub Discussion #4392: Cursor Position Access](https://github.com/xtermjs/xterm.js/discussions/4392)
- [xterm.js GitHub Issue #1981: Viewport Scrolling Jumps](https://github.com/xtermjs/xterm.js/issues/1981)
- [xterm.js GitHub Issue #4841: FitAddon Resizes Incorrectly](https://github.com/xtermjs/xterm.js/issues/4841)
- Direct codebase audit: TerminalInstance.tsx, useShellIntegration.ts, TerminalService.ts

**MEDIUM confidence:**
- [xterm.js GitHub Issue #1434: Cursor at Wrong Column Position](https://github.com/xtermjs/xterm.js/issues/1434)
- [xterm.js GitHub Issue #2020: CSI Sequences Cursor Positioning](https://github.com/xtermjs/xterm.js/issues/2020)
- [xterm.js GitHub Issue #2217: Saved Cursor Position on Resize](https://github.com/xtermjs/xterm.js/pull/2217)
- [xterm.js GitHub Issue #216: Viewport Should Only Scroll on Input](https://github.com/xtermjs/xterm.js/issues/216)
- [xterm.js Supported Terminal Sequences](https://xtermjs.org/docs/api/vtfeatures/)

**LOW confidence (needs validation):**
- Hypothesis D (replay buffer overwhelming parser) — not confirmed by any external source
- OSC 133 interaction with viewport (Hypothesis 6) — speculative
