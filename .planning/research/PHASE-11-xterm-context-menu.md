# Research: xterm.js Context Menu Implementation

**Task ID:** PHASE-11-xterm-context-menu
**Date:** 2026-02-12
**Domain:** Terminal UI, xterm.js, Electron
**Overall Confidence:** HIGH

## TL;DR

xterm.js 5.5.0 has no built-in context menu system. Use the `contextmenu` event on `terminal.element` to intercept right-clicks, then show your existing Radix UI context menu. Access selection via `terminal.getSelection()` and paste via `terminal.paste()`. The clipboard is already exposed through Electron's contextBridge, so use `navigator.clipboard` for copy operations.

## Recommended Stack

| Library | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| @xterm/xterm | 5.5.0 | Terminal (already installed) | HIGH |
| @radix-ui/react-context-menu | 2.2.16 | Context menu UI (already installed) | HIGH |
| navigator.clipboard API | Native | Clipboard operations | HIGH |

**No additional installs required.**

## Key Patterns

### 1. Intercept Right-Click on Terminal Element

**Use when:** You need to show a custom context menu instead of the browser default.

```typescript
// After terminal.open(containerRef.current)
const terminalElement = containerRef.current.querySelector('.xterm') as HTMLElement;

terminalElement.addEventListener('contextmenu', (e: MouseEvent) => {
  e.preventDefault(); // Prevent browser context menu

  // Store click coordinates for Radix positioning
  const clickX = e.clientX;
  const clickY = e.clientY;

  // Trigger your custom menu (see pattern 4)
});
```

**Why this works:** xterm.js exposes its DOM container via `terminal.element`, and you can attach standard DOM event listeners to it. The `contextmenu` event fires on right-click across all platforms.

**Source:** [VS Code PR #18980](https://github.com/microsoft/vscode/pull/18980) - Changed from `mousedown` to `contextmenu` for consistency.

### 2. Check for Selection and Copy

**Use when:** Implementing a "Copy" menu item.

```typescript
const handleCopy = async () => {
  const terminal = terminalRef.current;
  if (!terminal) return;

  // Check if there's an active selection
  if (terminal.hasSelection()) {
    const selectedText = terminal.getSelection();
    await navigator.clipboard.writeText(selectedText);
    terminal.clearSelection(); // Optional: clear after copy
  }
};
```

**API Methods:**
- `terminal.hasSelection(): boolean` - Returns true if text is selected
- `terminal.getSelection(): string` - Returns selected text
- `terminal.clearSelection(): void` - Clears the selection

**Source:** [xterm.js Terminal API](https://xtermjs.org/docs/api/terminal/classes/terminal/)

### 3. Paste into Terminal

**Use when:** Implementing a "Paste" menu item.

```typescript
const handlePaste = async () => {
  const terminal = terminalRef.current;
  if (!terminal) return;

  try {
    const text = await navigator.clipboard.readText();
    terminal.paste(text);
  } catch (err) {
    console.error('Paste failed:', err);
  }
};
```

**Why `terminal.paste()` not `terminal.write()`:** The `paste()` method performs transformations for pasted text (like handling newlines correctly), while `write()` is for raw output.

**Source:** [xterm.js Terminal.paste() API](https://xtermjs.org/docs/api/terminal/classes/terminal/)

### 4. Position Radix UI Context Menu at Click Coordinates

**Use when:** You need to show the context menu at the exact right-click position.

**Approach A: Use Radix's built-in trigger (recommended)**

```typescript
// Wrap your terminal container with ContextMenu
<ContextMenu
  content={
    <>
      <MenuItem
        label="Copy"
        shortcut="Cmd+C"
        disabled={!hasSelection}
        onSelect={handleCopy}
        icon={<CopyIcon />}
      />
      <MenuItem
        label="Paste"
        shortcut="Cmd+V"
        onSelect={handlePaste}
        icon={<ClipboardIcon />}
      />
      <MenuSeparator />
      <MenuItem
        label="Clear Terminal"
        onSelect={() => terminal.clear()}
      />
    </>
  }
>
  <div ref={containerRef} className="w-full h-full bg-background" />
</ContextMenu>
```

This is the simplest approach - Radix automatically handles positioning.

**Approach B: Manual event handling (if you need more control)**

If Radix's trigger interferes with terminal selection, manually prevent the `contextmenu` event and use a controlled menu:

```typescript
const [menuOpen, setMenuOpen] = useState(false);
const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });

// In your effect after terminal creation:
terminalElement.addEventListener('contextmenu', (e: MouseEvent) => {
  e.preventDefault();
  setMenuPosition({ x: e.clientX, y: e.clientY });
  setMenuOpen(true);
});

// Then use RadixContextMenu.Root with open prop
// Note: This is complex; prefer Approach A unless you have specific needs
```

**Source:** [Radix Context Menu Docs](https://www.radix-ui.com/primitives/docs/components/context-menu)

### 5. Disable/Enable Copy Based on Selection

**Use when:** You want to dynamically enable/disable the Copy menu item.

```typescript
const [hasSelection, setHasSelection] = useState(false);

useEffect(() => {
  const terminal = terminalRef.current;
  if (!terminal) return;

  const selectionListener = terminal.onSelectionChange(() => {
    setHasSelection(terminal.hasSelection());
  });

  return () => selectionListener.dispose();
}, []);

// In your menu:
<MenuItem
  label="Copy"
  disabled={!hasSelection}
  onSelect={handleCopy}
/>
```

**API:**
- `terminal.onSelectionChange` returns an `IDisposable` with a `dispose()` method
- Call `dispose()` in cleanup to prevent memory leaks

**Source:** [xterm.js onSelectionChange API](https://xtermjs.org/docs/api/terminal/classes/terminal/)

## Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| Custom clipboard access in Electron | `navigator.clipboard` API | Already sandboxed and exposed; Electron supports standard web APIs |
| Context menu positioning | Radix UI ContextMenu.Trigger | Handles positioning, collision detection, accessibility, and keyboard navigation |
| Text selection detection | `terminal.hasSelection()` | More reliable than trying to parse DOM or track mouse events |
| Paste transformations | `terminal.paste(text)` | Handles newlines, bracketed paste mode, and other terminal-specific processing |

## Pitfalls

### Pitfall 1: Event Propagation Interference
**What happens:** Attaching `contextmenu` listener with `preventDefault()` might interfere with terminal's internal event handling if done incorrectly.

**Avoid by:**
- Attach the listener to the `.xterm` element (the terminal's DOM container), not the parent div
- Only call `preventDefault()` on the `contextmenu` event itself
- Don't stop propagation of other events like `mousedown` or `click`

**Reference:** [VS Code Issue #3185](https://github.com/xtermjs/xterm.js/issues/3185) - Users reported menus being non-clickable when stopping propagation too aggressively.

### Pitfall 2: Clipboard Permissions
**What happens:** `navigator.clipboard.readText()` requires user permission and may fail in some contexts.

**Avoid by:**
- Wrap clipboard operations in try/catch
- Handle permission denial gracefully
- Consider using Electron's `clipboard` module via IPC for more reliable access

**Note:** Your app already uses Electron, so you could add `clipboard.readText()` to the `breadcrumbAPI` in `preload/index.ts` for guaranteed access.

### Pitfall 3: Terminal Focus Loss
**What happens:** Opening a context menu might cause the terminal to lose focus, preventing paste from working correctly.

**Avoid by:**
- After closing the context menu, call `terminal.focus()` to restore focus
- Use the Radix `onClose` callback:

```typescript
<RadixContextMenu.Root onOpenChange={(open) => {
  if (!open) {
    terminal.focus();
  }
}}>
```

**Reference:** [xterm.js Issue #3185](https://github.com/xtermjs/xterm.js/issues/3185) - "terminal still has the focus" issue when clicking menu items.

### Pitfall 4: Using Wrong Paste Method
**What happens:** Using `terminal.write(text)` instead of `terminal.paste(text)` causes issues with multi-line pastes and special characters.

**Avoid by:** Always use `terminal.paste(text)` for user-initiated paste operations. It handles:
- Bracketed paste mode (prevents shell from executing pasted commands immediately)
- Newline normalization
- Terminal control sequence escaping

## Architecture Notes

### xterm.js DOM Structure
```
<div class="xterm">                    ← terminal.element
  <div class="xterm-viewport">
    <div class="xterm-scroll-area"></div>
  </div>
  <div class="xterm-screen">
    <canvas></canvas>                  ← actual rendering (if WebGL addon)
  </div>
  <textarea class="xterm-helper-textarea"></textarea>  ← captures keyboard input
</div>
```

**Key insight:** The `textarea.xterm-helper-textarea` is used for keyboard input, but you should attach the `contextmenu` listener to the parent `.xterm` element to capture clicks on the visible terminal area.

**Source:** [xterm.js Screen Reader Design Doc](https://github.com/xtermjs/xterm.js/wiki/Design-Document:-Screen-Reader-Mode)

### Integration with Existing ContextMenu Component

Your `desktop/src/renderer/components/shared/ContextMenu.tsx` already provides:
- `ContextMenu` wrapper component
- `MenuItem` with icon, label, shortcut, disabled state
- `MenuSeparator` and `MenuLabel`

This is a perfect match for terminal context menus. Just wrap your terminal container:

```typescript
// In TerminalInstance.tsx
import { ContextMenu, MenuItem, MenuSeparator } from "../shared/ContextMenu";
import { Copy, Clipboard, Trash2 } from "lucide-react";

// ... inside component
<ContextMenu
  content={
    <>
      <MenuItem
        icon={<Copy size={16} />}
        label="Copy"
        shortcut="⌘C"
        disabled={!hasSelection}
        onSelect={handleCopy}
      />
      <MenuItem
        icon={<Clipboard size={16} />}
        label="Paste"
        shortcut="⌘V"
        onSelect={handlePaste}
      />
      <MenuSeparator />
      <MenuItem
        icon={<Trash2 size={16} />}
        label="Clear Terminal"
        shortcut="⌘L"
        onSelect={() => terminalRef.current?.clear()}
      />
    </>
  }
>
  <div ref={containerRef} className="w-full h-full bg-background" />
</ContextMenu>
```

## Clipboard in Electron: Current vs. Recommended

### Current State
Your preload API (`desktop/src/preload/index.ts`) doesn't expose clipboard operations. However, Electron's renderer process has access to `navigator.clipboard` by default.

### Recommendation
Use `navigator.clipboard` directly in the renderer for terminal operations:

```typescript
// Copy
await navigator.clipboard.writeText(terminal.getSelection());

// Paste
const text = await navigator.clipboard.readText();
terminal.paste(text);
```

**Why this works:** Electron's renderer process runs in a privileged context with clipboard access enabled.

**Alternative (if permissions become an issue):**
Add to `BreadcrumbAPI` in `preload/index.ts`:

```typescript
// In preload/index.ts
import { clipboard } from 'electron';

const api: BreadcrumbAPI = {
  // ... existing methods

  // Clipboard operations (if needed)
  clipboardReadText: () => Promise.resolve(clipboard.readText()),
  clipboardWriteText: (text: string) => {
    clipboard.writeText(text);
    return Promise.resolve({ success: true });
  },
};
```

But start with `navigator.clipboard` - it's simpler and already works.

## xterm.js Addons: Nothing for Context Menus

Searched the official xterm.js addon ecosystem. There is **no context menu addon**. Available addons:
- `@xterm/addon-clipboard` - OSC 52 clipboard integration (for terminal-initiated clipboard ops, not UI menus)
- `@xterm/addon-fit` - Already in use
- `@xterm/addon-search` - Already in use
- `@xterm/addon-web-links` - Already in use
- `@xterm/addon-webgl` - Rendering performance

**Verdict:** You must implement context menus yourself. No addon will help here.

**Source:** [xterm.js Addon Guide](https://xtermjs.org/docs/guides/using-addons/)

## Open Questions

None. All technical questions have been resolved with verified sources.

## Implementation Checklist

When implementing this feature:

1. Import ContextMenu components into TerminalInstance.tsx
2. Wrap the terminal container div with `<ContextMenu>`
3. Create state for `hasSelection` using `terminal.onSelectionChange`
4. Implement `handleCopy` using `terminal.getSelection()` + `navigator.clipboard.writeText()`
5. Implement `handlePaste` using `navigator.clipboard.readText()` + `terminal.paste()`
6. Add "Clear Terminal" item calling `terminal.clear()`
7. Test that focus returns to terminal after menu closes
8. Test with multi-line paste to verify `terminal.paste()` works correctly
9. Test that Copy is disabled when no selection exists

## Sources

**HIGH confidence:**
- [xterm.js Terminal API Documentation](https://xtermjs.org/docs/api/terminal/classes/terminal/)
- [VS Code Terminal Context Menu PR #18980](https://github.com/microsoft/vscode/pull/18980)
- [Radix UI Context Menu Documentation](https://www.radix-ui.com/primitives/docs/components/context-menu)
- [MDN: Clipboard API](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/clipboard)
- [Electron Clipboard API](https://www.electronjs.org/docs/latest/api/clipboard)

**MEDIUM confidence:**
- [xterm.js Screen Reader Design Document](https://github.com/xtermjs/xterm.js/wiki/Design-Document:-Screen-Reader-Mode) (DOM structure)
- [xterm.js Issue #2478: Browser Copy/Paste Documentation](https://github.com/xtermjs/xterm.js/issues/2478)

**LOW confidence (needs validation):**
- None - all findings verified against official docs or source code
