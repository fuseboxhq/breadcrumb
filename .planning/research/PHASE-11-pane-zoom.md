# Research: Terminal Pane Zoom/Maximize Functionality

**Date:** 2026-02-12
**Domain:** Terminal UI, split pane management, xterm.js, React
**Overall Confidence:** HIGH

## TL;DR

Use **Cmd+Shift+Enter** (macOS) / **Ctrl+Shift+Enter** (Windows/Linux) as the keyboard shortcut following iTerm2 and Warp conventions. Store zoom state in Zustand as `zoomedPane: { tabId: string, paneId: string } | null`. When zoomed, conditionally render ONLY the zoomed pane (not hide siblings) to avoid React component unmounting issues. Use CSS transitions on opacity and transform for smooth 150-200ms animations. Double-click on PanelResizeHandle to toggle zoom. Call `fitAddon.fit()` after zoom/restore to resize xterm.js dimensions. Visual indicator: show a "Maximize/Restore" icon in the pane toolbar when multiple panes exist, with state reflected in the icon.

## Recommended Stack

| Library | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| react-resizable-panels | 2.1.7 | Already in use for split panes | HIGH |
| zustand | 5.0.0 | Already in use for app state | HIGH |
| @xterm/addon-fit | 0.10.0 | Already in use for terminal resize | HIGH |
| lucide-react | 0.563.0 | Already in use for icons (Maximize2, Minimize2) | HIGH |

**No additional dependencies needed.** All necessary libraries are already installed.

## How Popular Terminals Handle Zoom/Maximize

### iTerm2 (macOS)
**Shortcut:** `Cmd+Shift+Enter`
**Behavior:** Current pane expands to fill entire tab, hiding all other panes. Pressing again restores all panes to original sizes.
**Visual Indicator:** None documented — behavior is instant and silent.
**Transition:** Instantaneous (no animation).
**Source:** [iTerm2 Documentation](https://iterm2.com/documentation-one-page.html), [iTerm2 Shortcuts Gist](https://gist.github.com/squarism/ae3613daf5c01a98ba3a)

### Warp (Modern Terminal)
**Shortcut:** `Cmd+Shift+Enter` (macOS), `Ctrl+Shift+Enter` (Windows/Linux)
**Behavior:** Toggle maximize pane — expands one pane within a tab.
**Visual Indicator:** Full-screen icon appears in tab bar when pane is maximized.
**Transition:** Not documented, but likely smooth given Warp's design focus.
**Source:** [Warp Split Panes Docs](https://docs.warp.dev/terminal/windows/split-panes), [Warp Pane Zoom Indicator Issue #5041](https://github.com/warpdotdev/Warp/issues/5041)

### tmux (Terminal Multiplexer)
**Shortcut:** `Ctrl+b z`
**Behavior:** Toggle zoom on current pane — expands to full window, pressing again restores.
**Visual Indicator:** "Z" suffix appears after window title when zoomed.
**Transition:** Instantaneous.
**Source:** [tmux Zoom Panes Guide](https://sgeb.io/posts/tmux-zoom-panes/), [tmuxai.dev - Maximize a Pane](https://tmuxai.dev/tmux-maximize-pane/)

### VS Code (IDE Terminal)
**Shortcut:** No native shortcut — requires extensions.
**Behavior:** Extensions like "Maximize Terminal" add keybindings for opening/closing a maximized terminal.
**Visual Indicator:** Varies by extension.
**Transition:** Not documented.
**Note:** VS Code does NOT have built-in pane zoom — only global UI zoom and font size adjustment.
**Source:** [VS Code Issue #69704](https://github.com/microsoft/vscode/issues/69704), [Maximize Terminal Extension](https://marketplace.visualstudio.com/items?itemName=samueltscott.maximizeterminal)

### Terminator (Linux GTK Terminal)
**Shortcut:** Not standardized, but supports both "zoom" (hides others + scales font) and "maximize" (hides others, keeps font size).
**Behavior:** Zoom = hide siblings and increase font. Maximize = hide siblings, keep font.
**Source:** [Terminator man page](https://man.archlinux.org/man/terminator.1.en)

## Key Patterns

### Pattern 1: Zustand State for Zoom
**Use when:** Tracking which pane is zoomed across the app (including sidebar).

```typescript
// In appStore.ts (extend existing AppState)
export interface AppState {
  // ... existing state
  zoomedPane: { tabId: string; paneId: string } | null;
}

export interface AppActions {
  // ... existing actions
  togglePaneZoom: (tabId: string, paneId: string) => void;
  clearPaneZoom: () => void;
}

// Implementation
togglePaneZoom: (tabId, paneId) =>
  set((state) => {
    const current = state.zoomedPane;
    // If same pane is clicked, restore (clear zoom)
    if (current?.tabId === tabId && current?.paneId === paneId) {
      state.zoomedPane = null;
    } else {
      // Zoom this pane
      state.zoomedPane = { tabId, paneId };
    }
  }),

clearPaneZoom: () =>
  set((state) => {
    state.zoomedPane = null;
  }),
```

**Why this structure:**
- Simple null check: `if (zoomedPane?.tabId === tabId && zoomedPane?.paneId === paneId)` determines if current pane is zoomed
- Tab switching can clear zoom if desired: `if (zoomedPane?.tabId !== activeTabId) clearPaneZoom()`
- Sidebar can read this state to show visual indicators

**Confidence:** HIGH
**Source:** Existing appStore pattern from PHASE-10 research, Zustand immer middleware best practices

### Pattern 2: Conditional Rendering (NOT Hiding)
**Use when:** Rendering zoomed vs. normal split pane layout.

**AVOID: Hiding with CSS**
```typescript
// ❌ BAD: Causes layout issues and doesn't trigger xterm resize
<div style={{ display: zoomedPane?.paneId === pane.id ? 'block' : 'none' }}>
  <TerminalInstance sessionId={pane.sessionId} ... />
</div>
```

**RECOMMENDED: Conditional rendering**
```typescript
// ✅ GOOD: Clean separation, avoids PanelGroup when zoomed
{zoomedPane?.tabId === tabId ? (
  // Render ONLY the zoomed pane
  <div className="h-full w-full">
    <TerminalInstance
      sessionId={panes.find(p => p.id === zoomedPane.paneId)?.sessionId}
      isActive={true}
      workingDirectory={workingDirectory}
      onCwdChange={(cwd) => handleCwdChange(zoomedPane.paneId, cwd)}
    />
  </div>
) : panes.length === 1 ? (
  // Single pane (no zoom, no split)
  <TerminalInstance ... />
) : (
  // Split panes (normal view)
  <PanelGroup direction={splitDirection}>
    {panes.map((pane, index) => (
      // ... existing split pane rendering
    ))}
  </PanelGroup>
)}
```

**Why conditional rendering:**
- Avoids unmounting/remounting TerminalInstance when zooming (sessionId stays stable)
- TerminalInstance's ResizeObserver will fire when container size changes
- No `display: none` issues with xterm.js FitAddon
- Clean separation of concerns

**Confidence:** HIGH
**Source:** React best practices, existing TerminalPanel.tsx pattern

### Pattern 3: xterm.js Resize After Zoom
**Use when:** Zooming or restoring a pane — terminal needs to recalculate dimensions.

```typescript
// In TerminalPanel.tsx
const zoomedPane = useAppStore((s) => s.zoomedPane);
const togglePaneZoom = useAppStore((s) => s.togglePaneZoom);

const handleToggleZoom = useCallback((paneId: string) => {
  togglePaneZoom(tabId, paneId);

  // IMPORTANT: Defer fit() to next frame after React re-renders
  requestAnimationFrame(() => {
    // The TerminalInstance's ResizeObserver will handle this automatically
    // No manual intervention needed if using ResizeObserver pattern
  });
}, [tabId, togglePaneZoom]);
```

**Current implementation already handles this:**
The existing TerminalInstance.tsx uses a debounced ResizeObserver (80ms) that calls `fitAddon.fit()` when container size changes. When switching from split view to zoomed view, the ResizeObserver fires automatically because the container's bounding box changes.

**No manual fit() call needed** — trust the ResizeObserver.

**Confidence:** HIGH
**Source:** Existing TerminalInstance.tsx lines 222-240 (ResizeObserver implementation)

### Pattern 4: Double-Click on PanelResizeHandle
**Use when:** User wants to toggle zoom by double-clicking the divider between panes.

```typescript
// In TerminalPanel.tsx
<PanelResizeHandle
  onDoubleClick={() => {
    // Zoom the FIRST pane adjacent to this handle
    // (Or use logic to determine which pane to zoom)
    togglePaneZoom(tabId, panes[index].id);
  }}
  className={`
    group relative transition-default
    ${splitDirection === "horizontal"
      ? "w-[3px] bg-transparent hover:bg-primary/30 active:bg-primary/50"
      : "h-[3px] bg-transparent hover:bg-primary/30 active:bg-primary/50"
    }
  `}
>
  {/* Existing divider visual */}
</PanelResizeHandle>
```

**UX consideration:**
Double-clicking a divider is ambiguous (which pane should zoom?). **Better UX:** Double-click on the pane header/toolbar button.

**Alternative (recommended):**
Add a "Maximize" button to the pane toolbar (next to the pane tabs in the top bar).

**Confidence:** MEDIUM (pattern works, but UX is unclear)
**Source:** [Mantine Split Pane onDoubleClick pattern](https://gfazioli.github.io/mantine-split-pane/)

### Pattern 5: CSS Transitions for Smooth Zoom Animation
**Use when:** Adding polish to zoom/restore transitions.

```typescript
// In TerminalPanel.tsx
<div
  className={`
    h-full transition-all duration-200 ease-in-out
    ${zoomedPane?.paneId === pane.id
      ? 'scale-100 opacity-100'
      : zoomedPane
        ? 'scale-95 opacity-0 pointer-events-none'
        : 'scale-100 opacity-100'
    }
  `}
>
  <TerminalInstance ... />
</div>
```

**⚠️ CAUTION:** Animating layout properties (width, height) is expensive and causes layout thrashing.

**Recommended approach:**
- Use `opacity` and `transform: scale()` for visual smoothness
- Transition duration: **150-200ms** (feels responsive, not sluggish)
- Use `ease-in-out` or `cubic-bezier(0.4, 0, 0.2, 1)` for natural motion
- Avoid animating `height`, `width`, or `position` (use conditional rendering instead)

**Confidence:** MEDIUM (conditional rendering is instant, animations are optional polish)
**Source:** [Josh Comeau CSS Transitions Guide](https://www.joshwcomeau.com/animation/css-transitions/), [MDN Using CSS Transitions](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Transitions/Using)

### Pattern 6: Keyboard Shortcut Handler
**Use when:** Implementing Cmd+Shift+Enter for zoom toggle.

```typescript
// In TerminalPanel.tsx (add to existing keyboard handler useEffect)
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    const meta = e.metaKey || e.ctrlKey;

    // ... existing shortcuts (Cmd+D, Cmd+Shift+D, etc.)

    // Cmd+Shift+Enter — toggle zoom on active pane
    if (meta && e.shiftKey && e.key === "Enter") {
      e.preventDefault();
      const currentActive = useAppStore.getState().terminalPanes[tabId]?.activePane;
      if (currentActive) {
        togglePaneZoom(tabId, currentActive);
      }
      return;
    }
  };

  document.addEventListener("keydown", handler);
  return () => document.removeEventListener("keydown", handler);
}, [tabId, togglePaneZoom]);
```

**Confidence:** HIGH
**Source:** iTerm2 and Warp conventions, existing keyboard handler pattern in TerminalPanel.tsx

## Visual Indicators

### Recommended Approach: Toolbar Button + Icon
Add a "Maximize" button to the pane toolbar (the bar at the top with pane tabs).

```typescript
// In TerminalPanel.tsx toolbar section (around line 184)
<div className="flex items-center gap-0.5">
  {panes.length > 1 && (
    <button
      onClick={() => {
        const currentActive = useAppStore.getState().terminalPanes[tabId]?.activePane;
        if (currentActive) {
          togglePaneZoom(tabId, currentActive);
        }
      }}
      className="p-1 text-foreground-muted hover:text-foreground-secondary hover:bg-muted/50 rounded-md transition-default"
      title={zoomedPane?.tabId === tabId
        ? "Restore panes (⌘⇧↵)"
        : "Maximize active pane (⌘⇧↵)"}
    >
      {zoomedPane?.tabId === tabId ? (
        <Minimize2 className="w-3.5 h-3.5" />
      ) : (
        <Maximize2 className="w-3.5 h-3.5" />
      )}
    </button>
  )}

  {/* Existing toggle direction and add pane buttons */}
</div>
```

**Icon choices (lucide-react):**
- `Maximize2` — square with arrows pointing outward (zoom in)
- `Minimize2` — square with arrows pointing inward (restore)
- Alternative: `Maximize` and `Minimize` (simpler square icons)

**Why toolbar button:**
- Discoverable (visible in the UI)
- Clear intent (clicking a button is obvious)
- Consistent with split direction and add pane buttons

**Why NOT on pane divider:**
- Dividers are thin (3px) — hard to target
- Ambiguous which pane to zoom

**Why NOT in pane content:**
- xterm.js owns the viewport — overlays are intrusive
- Right-click context menu is a better secondary action

**Confidence:** HIGH
**Source:** Warp design (shows maximize icon in tab bar), VS Code terminal toolbar patterns

### Additional Indicator: Pane Header Label
When zoomed, show "(Zoomed)" or a breadcrumb-style indicator next to the pane tabs.

```typescript
// In pane tab button
<span className="truncate">
  {label}
  {zoomedPane?.paneId === pane.id && (
    <span className="ml-1 text-2xs text-primary">(Zoomed)</span>
  )}
</span>
```

**Confidence:** MEDIUM (nice-to-have, not critical)

## Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| Manual panel size calculation | react-resizable-panels imperative API | Already handles layout constraints, min/max sizes, and collapse logic |
| Custom resize debouncing | ResizeObserver with setTimeout (existing pattern) | Already implemented in TerminalInstance.tsx (80ms debounce) |
| Zoom state in component local state | Zustand global state | Sidebar needs to know zoom state; local state won't work |
| CSS height/width animations | Conditional rendering + opacity/transform | Layout animations are janky; conditional rendering is instant |
| Custom keyboard event handling | Extend existing useEffect handler | Already handles Cmd+D, Cmd+Shift+D, etc. — add zoom shortcut there |

## Pitfalls

### Pitfall 1: Hiding Panes with CSS Instead of Conditional Rendering
**What happens:** Using `display: none` or `visibility: hidden` on panes doesn't trigger ResizeObserver, so xterm.js won't resize when toggling back. You'll see a squashed terminal or no output.

**Avoid by:**
- Use conditional rendering (`{zoomedPane ? <ZoomedView /> : <SplitView />}`)
- Trust ResizeObserver to handle dimension changes
- Don't manually call `fitAddon.fit()` — let the observer do its job

**Confidence:** HIGH
**Source:** Existing TerminalInstance.tsx implementation (lines 242-243), xterm.js FitAddon documentation

### Pitfall 2: Not Clearing Zoom State on Tab Switch
**What happens:** User zooms a pane in Tab 1, switches to Tab 2, and Tab 2's panes are hidden because `zoomedPane` still points to Tab 1's pane.

**Avoid by:**
- Clear zoom when switching tabs: `if (zoomedPane?.tabId !== activeTabId) clearPaneZoom()`
- OR: Keep zoom state tab-scoped (zoom persists when switching back to Tab 1)
- Decision: **Tab-scoped zoom is better UX** (don't clear on switch)

**Implementation:**
```typescript
// In TerminalPanel.tsx conditional rendering
{zoomedPane?.tabId === tabId && zoomedPane?.paneId ? (
  // Render zoomed pane
) : (
  // Render split panes
)}
```

This check ensures zoom only applies to the current tab.

**Confidence:** HIGH

### Pitfall 3: Forgetting to Handle Single Pane Case
**What happens:** When there's only one pane, showing a "Maximize" button is confusing (nothing to maximize).

**Avoid by:**
- Only show maximize button when `panes.length > 1`
- Disable zoom toggle when single pane

**Confidence:** HIGH
**Source:** Warp and iTerm2 behavior (zoom only makes sense with splits)

### Pitfall 4: Race Condition Between Zoom Toggle and Resize
**What happens:** User toggles zoom, but React hasn't re-rendered yet, so the ResizeObserver fires with stale dimensions.

**Avoid by:**
- Use `requestAnimationFrame` after state changes (or don't — React 18 batches updates automatically)
- Trust the ResizeObserver's debounce (80ms) to handle rapid changes
- No manual intervention needed

**Confidence:** MEDIUM (unlikely to occur with current implementation)

### Pitfall 5: Animating Layout Properties Causes Jank
**What happens:** Animating `width`, `height`, or `flex-grow` triggers layout recalculation on every frame (expensive).

**Avoid by:**
- Use `opacity` and `transform` for visual transitions (GPU-accelerated)
- OR: Skip animations entirely (instant zoom like iTerm2)
- Keep transitions under 200ms

**Confidence:** HIGH
**Source:** [Josh Comeau Performance Guide](https://www.joshwcomeau.com/animation/css-transitions/), browser rendering pipeline best practices

### Pitfall 6: Double-Click on Divider Ambiguity
**What happens:** User double-clicks divider between Pane A and Pane B — which should zoom?

**Avoid by:**
- Don't use divider double-click for zoom toggle
- Use toolbar button or keyboard shortcut instead
- If implementing divider double-click, pick a consistent rule (e.g., always zoom the pane to the left/top)

**Confidence:** MEDIUM
**Source:** Usability heuristics (ambiguous interactions reduce discoverability)

## Implementation Checklist

- [ ] **State Management:** Add `zoomedPane: { tabId, paneId } | null` to appStore
- [ ] **Actions:** Add `togglePaneZoom(tabId, paneId)` and `clearPaneZoom()` to appStore
- [ ] **Conditional Rendering:** Update TerminalPanel.tsx to render zoomed pane OR split panes (not both)
- [ ] **Keyboard Shortcut:** Add Cmd+Shift+Enter handler in existing useEffect
- [ ] **Toolbar Button:** Add Maximize2/Minimize2 icon button next to split controls
- [ ] **Visual Indicator:** Show button only when `panes.length > 1`
- [ ] **Icon Toggle:** Switch icon based on `zoomedPane?.tabId === tabId`
- [ ] **Tab Scoping:** Ensure zoom state only affects current tab (`zoomedPane?.tabId === tabId`)
- [ ] **No Manual Resize:** Trust ResizeObserver to handle xterm.js fit
- [ ] **Optional: Right-Click Menu:** Add "Maximize Pane" to context menu (PHASE-11 scope)
- [ ] **Optional: CSS Transition:** Add subtle opacity/transform animation (150ms)

## State Management Architecture

### Current Structure (From PHASE-10)
```typescript
// appStore.ts
export interface TabPaneState {
  panes: TerminalPane[];
  activePane: string;
  splitDirection: "horizontal" | "vertical";
}

export interface AppState {
  terminalPanes: Record<string, TabPaneState>; // keyed by tabId
  // ... other state
}
```

### Extend with Zoom State
```typescript
export interface AppState {
  terminalPanes: Record<string, TabPaneState>;
  zoomedPane: { tabId: string; paneId: string } | null; // NEW
  // ... other state
}

export interface AppActions {
  // ... existing pane actions
  togglePaneZoom: (tabId: string, paneId: string) => void; // NEW
  clearPaneZoom: () => void; // NEW
}
```

**Why NOT nested in TabPaneState:**
- Zoom is a **temporary UI state**, not pane metadata
- Zoom affects rendering logic globally (sidebar might show "Zoomed" indicator)
- Easier to clear on tab close: `clearPaneZoom()` vs. iterating all tabs

**Confidence:** HIGH
**Source:** Existing appStore architecture from PHASE-10 research, Zustand best practices

## UI/UX Decisions

### Keyboard Shortcut: Cmd+Shift+Enter
**Why this shortcut:**
- ✅ Used by iTerm2 (macOS standard)
- ✅ Used by Warp (modern cross-platform terminal)
- ✅ Mnemonic: "Enter" = go full-screen
- ✅ Not conflicting with existing shortcuts in TerminalPanel.tsx

**Alternative shortcuts considered:**
- `Cmd+Shift+M` — used by some apps for "Maximize", but less common
- `Cmd+Shift+Z` — conflicts with "Redo" in many apps
- `Cmd+Z` — conflicts with "Undo"

**Recommendation:** Use `Cmd+Shift+Enter` (macOS) and `Ctrl+Shift+Enter` (Windows/Linux).

**Confidence:** HIGH

### Transition Style: Instant or Animated?
**iTerm2 and tmux:** Instant (no animation)
**Warp:** Likely animated (design-focused app)
**VS Code:** Not applicable (no native pane zoom)

**Recommendation:**
- **Phase 1:** Instant (conditional rendering, no CSS transitions)
- **Phase 2 (optional polish):** Add 150ms opacity fade

**Why instant first:**
- Simpler implementation (no CSS transition bugs)
- Matches iTerm2 (familiar to power users)
- Avoids animation jank during testing

**Confidence:** HIGH

### Visual Indicator: Button vs. Breadcrumb vs. Badge
**Options:**
1. **Toolbar button** (Maximize2/Minimize2 icon) — RECOMMENDED
2. **Pane tab badge** (e.g., "Pane 1 (Zoomed)")
3. **Breadcrumb** (top of viewport, like Warp's tab bar indicator)

**Recommendation:** Toolbar button (option 1).

**Why:**
- Discoverable (visible, clickable)
- Consistent with existing split controls
- No additional UI clutter

**Confidence:** HIGH
**Source:** Warp design patterns, VS Code terminal toolbar

### Double-Click Target: Divider vs. Pane Header
**Divider double-click:**
- ❌ Ambiguous (which pane to zoom?)
- ❌ Hard to target (3px wide)
- ✅ Natural gesture (divider controls layout)

**Pane header double-click:**
- ✅ Clear intent (zoom the pane you clicked)
- ✅ Large click target (entire tab button)
- ❌ Might conflict with tab selection

**Recommendation:**
- **Primary action:** Toolbar button + keyboard shortcut
- **Secondary (optional):** Double-click pane tab to toggle zoom
- **Avoid:** Double-click on divider

**Confidence:** MEDIUM (toolbar button is sufficient, double-click is nice-to-have)

## Open Questions

1. **Should zoom persist across app restarts?**
   - Likely NO — zoom is temporary UI state, not persistent preference
   - Pane layout (split direction, sizes) might persist, but zoom should reset
   - Decision: Don't persist zoom state

2. **Should zooming a pane also maximize the Terminal tab (hide sidebar)?**
   - No — zoom is tab-scoped, not window-scoped
   - User can manually hide sidebar with existing toggle
   - Keep zoom scoped to pane layout only

3. **Should there be a visual transition when zooming?**
   - Phase 1: No (instant, like iTerm2)
   - Phase 2 (polish): Optional 150ms opacity fade
   - Decision: Instant first, polish later

4. **Should right-click context menu include "Maximize Pane"?**
   - Yes — but defer to PHASE-11 context menu task
   - Toolbar button + keyboard shortcut are sufficient for initial implementation

5. **Should zoom state affect split direction toggle?**
   - No — split direction is metadata, zoom is temporary UI state
   - Changing split direction while zoomed should restore panes in the new direction

## Example Implementation

### Step 1: Extend appStore
```typescript
// appStore.ts (add to existing state and actions)
export interface AppState {
  // ... existing state
  zoomedPane: { tabId: string; paneId: string } | null;
}

export interface AppActions {
  // ... existing actions
  togglePaneZoom: (tabId: string, paneId: string) => void;
  clearPaneZoom: () => void;
}

// In create() implementation
togglePaneZoom: (tabId, paneId) =>
  set((state) => {
    const current = state.zoomedPane;
    if (current?.tabId === tabId && current?.paneId === paneId) {
      state.zoomedPane = null; // Restore
    } else {
      state.zoomedPane = { tabId, paneId }; // Zoom
    }
  }),

clearPaneZoom: () =>
  set((state) => {
    state.zoomedPane = null;
  }),
```

### Step 2: Update TerminalPanel Conditional Rendering
```typescript
// TerminalPanel.tsx (replace existing pane rendering logic around line 207)
const zoomedPane = useAppStore((s) => s.zoomedPane);
const togglePaneZoom = useAppStore((s) => s.togglePaneZoom);

return (
  <div className="flex flex-col h-full bg-background">
    {/* Terminal toolbar — existing code */}
    <div className="h-8 flex items-center justify-between px-2 bg-background-raised border-b border-border shrink-0">
      {/* Existing pane tabs */}

      <div className="flex items-center gap-0.5">
        {/* NEW: Maximize button (only show when multiple panes) */}
        {panes.length > 1 && (
          <button
            onClick={() => {
              const currentActive = useAppStore.getState().terminalPanes[tabId]?.activePane;
              if (currentActive) {
                togglePaneZoom(tabId, currentActive);
              }
            }}
            className="p-1 text-foreground-muted hover:text-foreground-secondary hover:bg-muted/50 rounded-md transition-default"
            title={zoomedPane?.tabId === tabId ? "Restore panes (⌘⇧↵)" : "Maximize active pane (⌘⇧↵)"}
          >
            {zoomedPane?.tabId === tabId ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>
        )}

        {/* Existing toggle direction and add pane buttons */}
      </div>
    </div>

    {/* Terminal panes — NEW CONDITIONAL RENDERING */}
    <div className="flex-1 min-h-0">
      {zoomedPane?.tabId === tabId ? (
        // ZOOMED: Render only the zoomed pane
        <TerminalInstance
          sessionId={panes.find(p => p.id === zoomedPane.paneId)?.sessionId || ""}
          isActive={true}
          workingDirectory={workingDirectory}
          onCwdChange={(cwd) => handleCwdChange(zoomedPane.paneId, cwd)}
        />
      ) : panes.length === 1 ? (
        // SINGLE PANE: No split
        <TerminalInstance
          sessionId={panes[0].sessionId}
          isActive={true}
          workingDirectory={workingDirectory}
          onCwdChange={(cwd) => handleCwdChange(panes[0].id, cwd)}
        />
      ) : (
        // SPLIT PANES: Normal view
        <PanelGroup direction={splitDirection}>
          {panes.map((pane, index) => (
            // ... existing split pane rendering
          ))}
        </PanelGroup>
      )}
    </div>
  </div>
);
```

### Step 3: Add Keyboard Shortcut
```typescript
// TerminalPanel.tsx (add to existing useEffect keyboard handler around line 98)
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    const meta = e.metaKey || e.ctrlKey;

    // ... existing shortcuts (Cmd+D, Cmd+Shift+D, Cmd+W, etc.)

    // NEW: Cmd+Shift+Enter — toggle zoom
    if (meta && e.shiftKey && e.key === "Enter") {
      e.preventDefault();
      const currentActive = useAppStore.getState().terminalPanes[tabId]?.activePane;
      if (currentActive) {
        togglePaneZoom(tabId, currentActive);
      }
      return;
    }
  };

  document.addEventListener("keydown", handler);
  return () => document.removeEventListener("keydown", handler);
}, [tabId, addPane, removePane, navigatePane, navigateToPaneNumber, togglePaneZoom]);
```

### Step 4: Import Icons
```typescript
// TerminalPanel.tsx (add to existing imports around line 5)
import { Plus, SplitSquareVertical, Rows3, X, Terminal, FolderOpen, Maximize2, Minimize2 } from "lucide-react";
```

## Testing Checklist

- [ ] Zoom single pane in 2-pane split → only zoomed pane visible
- [ ] Restore from zoom → both panes visible again
- [ ] Cmd+Shift+Enter toggles zoom on active pane
- [ ] Toolbar button toggles zoom on active pane
- [ ] Icon switches from Maximize2 to Minimize2 when zoomed
- [ ] Zoom button hidden when only 1 pane exists
- [ ] xterm.js resizes correctly when zooming (ResizeObserver handles it)
- [ ] Switch tabs while zoomed → zoom state persists for original tab
- [ ] Close zoomed pane → zoom state clears
- [ ] Split direction toggle while zoomed → works correctly

## Performance Considerations

### ResizeObserver Debouncing
The existing TerminalInstance.tsx already implements an 80ms debounce on resize events (line 239). This is sufficient for zoom transitions.

**No changes needed.**

**Confidence:** HIGH
**Source:** Existing implementation in TerminalInstance.tsx

### React Re-render Optimization
Conditional rendering (`{zoomedPane ? <A /> : <B />}`) does NOT unmount TerminalInstance because the `sessionId` prop remains stable. React will reuse the existing instance.

**Key optimization:**
- Don't pass `zoomedPane` as a prop to TerminalInstance
- Read zoom state only in TerminalPanel (parent component)
- TerminalInstance only re-renders when `isActive` or `sessionId` changes

**Confidence:** HIGH
**Source:** React reconciliation algorithm, existing TerminalPanel architecture

### CSS Transition Performance
If adding animations (optional), use GPU-accelerated properties:
- ✅ `opacity`
- ✅ `transform: scale()`
- ❌ `width`, `height`, `flex-grow` (triggers layout)

**Confidence:** HIGH
**Source:** [Josh Comeau CSS Performance Guide](https://www.joshwcomeau.com/animation/css-transitions/)

## Sources

**HIGH confidence:**
- [iTerm2 Documentation](https://iterm2.com/documentation-one-page.html) — Zoom feature behavior
- [iTerm2 Shortcuts Gist](https://gist.github.com/squarism/ae3613daf5c01a98ba3a) — Cmd+Shift+Enter shortcut
- [Warp Split Panes Docs](https://docs.warp.dev/terminal/windows/split-panes) — Maximize pane shortcut
- [tmux Zoom Panes Guide](https://sgeb.io/posts/tmux-zoom-panes/) — Ctrl+b z behavior
- [react-resizable-panels GitHub](https://github.com/bvaughn/react-resizable-panels) — Imperative API, collapse/expand
- [xterm-addon-fit npm](https://www.npmjs.com/package/xterm-addon-fit) — FitAddon usage
- [Zustand Immer Middleware](https://zustand.docs.pmnd.rs/integrations/immer-middleware) — State management patterns
- Existing codebase: TerminalPanel.tsx, appStore.ts, TerminalInstance.tsx

**MEDIUM confidence:**
- [Warp Pane Zoom Indicator Issue #5041](https://github.com/warpdotdev/Warp/issues/5041) — Visual indicator design
- [VS Code Issue #69704](https://github.com/microsoft/vscode/issues/69704) — Lack of native pane maximize
- [Mantine Split Pane](https://gfazioli.github.io/mantine-split-pane/) — onDoubleClick pattern
- [Josh Comeau CSS Transitions Guide](https://www.joshwcomeau.com/animation/css-transitions/) — Animation best practices
- [MDN Using CSS Transitions](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Transitions/Using) — CSS transition specs
- [React useResizeObserver Best Practices](https://www.dhiwise.com/post/mastering-resize-observer-react-best-practices) — Debouncing patterns

**LOW confidence (not used in recommendations):**
- [Terminator man page](https://man.archlinux.org/man/terminator.1.en) — Linux GTK terminal zoom behavior (different paradigm)
- [VS Code Maximize Terminal Extension](https://marketplace.visualstudio.com/items?itemName=samueltscott.maximizeterminal) — Third-party workaround
