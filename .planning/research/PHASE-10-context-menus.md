# Research: Context Menus for React + Electron Desktop App

**Date:** 2026-02-12
**Domain:** React UI Components, Electron Desktop UX
**Overall Confidence:** HIGH

## TL;DR

Use `@radix-ui/react-context-menu` standalone. It's battle-tested, accessible, tree-shakeable (107KB unpacked), supports all required features, and uses Floating UI for robust positioning. Don't build custom positioning logic — viewport edge cases are complex and Radix handles them correctly.

## Recommended Stack

| Library | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| @radix-ui/react-context-menu | 2.2.16 | Context menu primitive | HIGH |
| (No additional deps needed) | - | Already using Tailwind + Zustand | HIGH |

**Install:**
```bash
npm install @radix-ui/react-context-menu
```

**Bundle Impact:**
- Unpacked size: 107KB (smaller than @szhsin/react-menu at 163KB)
- Tree-shakeable: ships only what you use
- Zero runtime dependencies beyond React
- Already using `cmdk` (component library), so adding Radix is consistent with existing patterns

## Key Patterns

### Basic Context Menu Structure

**Use when:** Right-click actions on sidebar items (terminals, projects, panes)

```tsx
import * as ContextMenu from "@radix-ui/react-context-menu";

function TerminalItem({ terminal }) {
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <div className="px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer">
          {terminal.name}
        </div>
      </ContextMenu.Trigger>

      <ContextMenu.Portal>
        <ContextMenu.Content
          className="min-w-[180px] bg-popover border border-border-strong rounded-lg shadow-lg p-1 animate-fade-in"
          sideOffset={5}
        >
          <ContextMenu.Item className="px-2 py-1.5 text-sm rounded hover:bg-primary/10 outline-none cursor-pointer">
            Rename Terminal
          </ContextMenu.Item>
          <ContextMenu.Item className="px-2 py-1.5 text-sm rounded hover:bg-primary/10 outline-none cursor-pointer">
            Split Horizontally
          </ContextMenu.Item>
          <ContextMenu.Separator className="h-px bg-border my-1" />
          <ContextMenu.Item className="px-2 py-1.5 text-sm rounded hover:bg-destructive/10 text-destructive outline-none cursor-pointer">
            Close Terminal
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
```

### Nested Submenus

**Use when:** Multi-level actions (e.g., "Move to Project → [project list]")

```tsx
<ContextMenu.Sub>
  <ContextMenu.SubTrigger className="px-2 py-1.5 text-sm rounded hover:bg-primary/10 outline-none cursor-pointer flex items-center justify-between">
    Move to Project
    <ChevronRight className="w-3 h-3 ml-2" />
  </ContextMenu.SubTrigger>
  <ContextMenu.Portal>
    <ContextMenu.SubContent
      className="min-w-[180px] bg-popover border border-border-strong rounded-lg shadow-lg p-1"
      sideOffset={8}
    >
      {projects.map(project => (
        <ContextMenu.Item key={project.id} onSelect={() => moveToProject(project.id)}>
          {project.name}
        </ContextMenu.Item>
      ))}
    </ContextMenu.SubContent>
  </ContextMenu.Portal>
</ContextMenu.Sub>
```

### Disabled & Checked States

```tsx
<ContextMenu.CheckboxItem
  checked={isPinned}
  onCheckedChange={setPinned}
  className="px-2 py-1.5 text-sm rounded hover:bg-primary/10 outline-none cursor-pointer flex items-center gap-2"
>
  <ContextMenu.ItemIndicator>
    <Check className="w-3 h-3" />
  </ContextMenu.ItemIndicator>
  Pin to Top
</ContextMenu.CheckboxItem>

<ContextMenu.Item disabled className="px-2 py-1.5 text-sm text-foreground-muted cursor-not-allowed">
  Copy Path (No path available)
</ContextMenu.Item>
```

### Styling with Tailwind (Dracula Theme)

The app already uses a Dracula-inspired design system. Context menus should follow these patterns:

```tsx
// Content wrapper
className="min-w-[180px] bg-background-overlay border border-border-strong rounded-lg shadow-lg p-1 animate-fade-in"

// Menu items
className="px-2 py-1.5 text-sm rounded transition-default outline-none cursor-pointer
  data-[highlighted]:bg-primary/10 data-[highlighted]:text-foreground
  data-[disabled]:text-foreground-muted data-[disabled]:cursor-not-allowed"

// Destructive actions
className="... data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive"

// Separators
className="h-px bg-border my-1"
```

**Key insight:** Radix exposes `data-[highlighted]`, `data-[disabled]`, and `data-[side]` attributes that update at runtime. Use these for styling, not `:hover` or `:focus` (which don't work correctly with keyboard navigation).

## Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| Custom positioning with `getBoundingClientRect()` | Radix's Floating UI integration | Edge cases: viewport boundaries, scroll containers, nested scrolling, RTL layouts, collision detection on multiple axes, transform origins for animations |
| Manual keyboard navigation (arrow keys, Enter, Escape) | Radix's built-in navigation | Roving tabindex, typeahead search, disabled item skipping, submenu navigation (→/←), proper ARIA roles |
| Touch/long-press detection | Radix's `ContextMenu.Trigger` | Cross-platform touch handling is complex; Radix handles 300ms+ long-press threshold correctly |
| Closing on outside click | Radix's Portal + dismissal logic | Must handle: click outside, Escape key, focus loss, opening another menu, scroll events |

**The positioning problem is deceptively hard.** A naive implementation:
```tsx
// ❌ Breaks on: scrolled containers, viewport edges, nested transforms
const [pos, setPos] = useState({ x: 0, y: 0 });
const handleContextMenu = (e) => {
  e.preventDefault();
  setPos({ x: e.pageX, y: e.pageY });
};
```

What you'd need to handle:
1. **Viewport boundaries:** If menu would overflow, flip to opposite side
2. **Scroll containers:** Use `e.clientX/Y` + scroll offset, not `e.pageX/Y`
3. **Collision on both axes:** If can't fit on preferred side, try opposite, then resize
4. **Transform origins:** For animations, calculate origin based on final position
5. **Available space calculations:** Measure menu height before positioning (requires render → measure → reposition)
6. **Submenus:** Recursively handle nested positioning with parent awareness

Radix's Floating UI integration does all of this. Don't reimplement.

## Pitfalls

### 1. Radix Position Tracking on Re-Click

**What happens:** When right-clicking a second time in a different location, the context menu may re-open anchored to the first click location, not the new one (known issue in Radix v2.x).

**Avoid by:**
- Use `onOpenChange` to reset state if needed
- For sidebar items, this is less problematic (items don't move)
- Monitor [radix-ui/primitives#2611](https://github.com/radix-ui/primitives/issues/2611) for fixes

```tsx
<ContextMenu.Root onOpenChange={(open) => {
  if (!open) {
    // Reset any position-dependent state
  }
}}>
```

### 2. Animation Exit Blocking Repositioning

**What happens:** If you apply exit animations to the closed state, users can't reposition the menu correctly.

**Avoid by:**
- Only animate entry (fade-in, scale-up)
- Use `data-[state]` attributes for conditional animations
- Keep exit animations fast (<150ms) or omit them

```tsx
// ✅ Good: Animate entry only
className="animate-fade-in data-[state=open]:animate-fade-in"

// ❌ Bad: Long exit animation blocks repositioning
className="data-[state=closed]:animate-fade-out duration-500"
```

### 3. iOS Touch Dismissal Bug

**What happens:** On iOS, after long-pressing to open the menu, if the user touches outside and moves their finger slightly before lifting, the menu doesn't close.

**Avoid by:**
- This is a Radix bug ([#1727](https://github.com/radix-ui/primitives/issues/1727))
- Electron apps run on desktop, so iOS Safari isn't a concern
- Non-issue for this project

### 4. Portal Styling in Nested Containers

**What happens:** If parent has `position: relative`, non-portalled menus can break positioning.

**Avoid by:**
- Always use `<ContextMenu.Portal>` (it's already in the examples above)
- Portal renders outside the DOM hierarchy, avoiding stacking context issues
- If you need to constrain portal to a specific container, use `container` prop

### 5. Keyboard Navigation Conflicts

**What happens:** If the sidebar already handles arrow keys (e.g., for tree navigation), Radix's menu navigation can conflict.

**Avoid by:**
- Radix only captures keys when the menu is open
- Use `onEscapeKeyDown`, `onPointerDownOutside` to handle custom close logic
- The sidebar tree navigation and context menu navigation are separate states — no conflict

## VS Code & Electron Context Menu Patterns

### How VS Code Does It

VS Code uses **custom HTML/CSS context menus**, not native Electron menus. Why?

1. **Consistency:** Native menus look different on macOS/Windows/Linux
2. **Rich content:** Native menus can't render icons, badges, or custom layouts
3. **Extension API:** Custom menus are easier to extend programmatically
4. **Positioning control:** Native menus have limited positioning options

VS Code's Monaco editor and sidebar both use custom DOM-based context menus with similar patterns to Radix (portals, collision detection, keyboard navigation).

### Native vs Custom in Electron

**Native Electron Menus (`electron.Menu`):**
- **Pros:** OS-native appearance, built-in accessibility, no maintenance
- **Cons:** Limited styling, no rich content, positioning constraints, different on each OS
- **Use for:** Top-level application menu, system tray menus

**Custom React Menus (Radix, etc.):**
- **Pros:** Full styling control, consistent cross-platform, rich content (icons, badges), animation support
- **Cons:** Must handle accessibility manually (Radix does this), slightly larger bundle
- **Use for:** In-app context menus (sidebar, tabs, content areas)

**Recommendation for Breadcrumb:** Use custom React context menus (Radix). The app already has a custom design system (Dracula theme), and consistency with the existing UI is more valuable than native OS appearance.

### Electron Integration

No special Electron integration needed. Radix context menus work identically in Electron and web environments. Just ensure:

```tsx
// Prevent Electron's default context menu (if you have one)
// In main process (if you registered one):
// mainWindow.webContents.on('context-menu', (e) => e.preventDefault());

// In React, Radix's ContextMenu.Trigger already calls e.preventDefault()
```

## Positioning Edge Cases (Handled by Radix)

Radix uses Floating UI for positioning. It automatically handles:

### Viewport Boundary Collisions

```tsx
<ContextMenu.Content
  side="right"              // Preferred side
  align="start"             // Preferred alignment
  avoidCollisions={true}    // Auto-flip on collision (default: true)
  collisionPadding={8}      // Minimum distance from viewport edge
  sideOffset={5}            // Gap between trigger and content
  alignOffset={0}           // Alignment adjustment
/>
```

**What happens:**
1. Menu tries to render on `side="right"`, aligned to `align="start"`
2. If it would overflow the viewport, Floating UI checks alternative sides
3. If no side fits, it resizes the menu and positions where there's most space
4. Exposes `data-side` attribute for styling based on final position

### Scroll Containers

If the trigger is inside a scrollable container:
- Radix tracks scroll events and repositions automatically
- Set `hideWhenDetached={true}` to hide the menu if the trigger scrolls out of view
- Use `sticky="partial"` to keep the menu on screen even when trigger scrolls away

```tsx
<ContextMenu.Content
  sticky="partial"          // Keep menu visible when trigger scrolls
  hideWhenDetached={false}  // Don't hide on scroll (default: false)
/>
```

### Transform Origins for Animations

Radix exposes `--radix-context-menu-content-transform-origin` CSS variable:

```css
@keyframes scale-in {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

[data-radix-context-menu-content] {
  transform-origin: var(--radix-context-menu-content-transform-origin);
  animation: scale-in 150ms ease-out;
}
```

This ensures the menu scales from the click point, not the center.

### Collision Detection Props

| Prop | Default | Use Case |
|------|---------|----------|
| `avoidCollisions` | `true` | Disable for debugging or forced positions |
| `collisionBoundary` | viewport | Set to custom element to constrain within a specific container |
| `collisionPadding` | `0` | Add breathing room from edges (recommend `8` for desktop) |
| `sticky` | `"partial"` | Keep menu on screen when trigger moves/scrolls |
| `hideWhenDetached` | `false` | Hide menu if trigger leaves collision boundary |

## Comparison: Radix vs Alternatives

### @radix-ui/react-context-menu (RECOMMENDED)

**Pros:**
- Battle-tested (used by shadcn/ui, Vercel, Linear, etc.)
- Full accessibility (WAI-ARIA, keyboard nav, screen readers)
- Floating UI integration (robust positioning)
- Tree-shakeable, small bundle (107KB unpacked)
- Composable API (Portal, Sub, Separator, CheckboxItem, etc.)
- Active maintenance (v2.2.16 as of Feb 2026)

**Cons:**
- Unstyled (you write all CSS) — **not a con for this project** (we want custom Dracula styling)
- Position tracking bug on re-click ([#2611](https://github.com/radix-ui/primitives/issues/2611))
- Animation exit can block repositioning (solved by animating entry only)

**Verdict:** Best choice for this project. Consistent with existing `cmdk` usage pattern, full control over styling, production-ready.

### @szhsin/react-menu

**Pros:**
- Lightweight API
- Includes optional default styles
- Supports hover menus (not just right-click)

**Cons:**
- Larger bundle (163KB unpacked vs 107KB for Radix)
- Less composable (monolithic `<Menu>` component)
- Fewer examples in production apps
- Styling via `className` props only (less flexible than Radix's primitive approach)

**Verdict:** Good for rapid prototyping, but Radix is more robust for production.

### @base-ui/react (Base UI by MUI)

**Pros:**
- Modern API (newer than Radix)
- Built by the MUI team (credible maintainers)
- Composable primitives similar to Radix

**Cons:**
- Very new (v1.1.0) — less battle-tested
- Smaller ecosystem (fewer examples, community resources)
- No significant advantages over Radix for this use case

**Verdict:** Promising, but Radix is the safer choice in 2026.

### Custom Implementation

**Pros:**
- Zero dependencies
- Full control

**Cons:**
- 200+ lines to implement correctly (positioning, keyboard nav, accessibility)
- High maintenance burden
- Easy to miss edge cases (see "Don't Hand-Roll" section)

**Verdict:** Not worth it. Radix is 107KB and handles everything correctly.

## Implementation Checklist

Before building context menus, ensure:

- [ ] Install `@radix-ui/react-context-menu`
- [ ] Create a shared `ContextMenu` component that wraps Radix primitives with Dracula styling
- [ ] Define `data-[highlighted]` and `data-[disabled]` styles in Tailwind or global CSS
- [ ] Use `ContextMenu.Portal` for all menus (avoid stacking context issues)
- [ ] Set `collisionPadding={8}` for breathing room from viewport edges
- [ ] Animate entry only (not exit) to avoid repositioning bugs
- [ ] Test keyboard navigation (arrow keys, Enter, Escape, typeahead)
- [ ] Test with long item lists (scrolling within menu)
- [ ] Test with nested submenus (→ to open, ← to close)

## Open Questions

None. Radix is well-documented and production-ready.

## Sources

**HIGH confidence:**
- [Context Menu – Radix Primitives](https://www.radix-ui.com/primitives/docs/components/context-menu) (official docs)
- [Radix UI react-context-menu – npm](https://bundlephobia.com/package/@radix-ui/react-context-menu) (bundle size)
- [Radix UI GitHub Issues](https://github.com/radix-ui/primitives/issues) (known issues #2611, #2572, #1727)
- [Electron Context Menu Tutorial](https://www.electronjs.org/docs/latest/tutorial/context-menu) (official Electron docs)

**MEDIUM confidence:**
- [How to Display Context Menus in Electron Applications](https://developer.mamezou-tech.com/en/blogs/2025/01/07/build-context-menu-in-electron-app/) (Electron best practices)
- [Radix UI vs Base UI vs Headless UI Comparison](https://www.subframe.com/tips/headless-ui-vs-radix) (ecosystem comparison)
- [Creating a React context menu – LogRocket Blog](https://blog.logrocket.com/creating-react-context-menu/) (custom implementation patterns)
- [React Menu library (szhsin)](https://szhsin.github.io/react-menu/) (alternative library)
- [Base UI Context Menu](https://base-ui.com/react/components/context-menu) (alternative library)

**LOW confidence (needs validation):**
- VS Code uses custom DOM context menus (inferred from Monaco editor patterns, not verified in VS Code source)
- Warp terminal context menu implementation (no public documentation found)
