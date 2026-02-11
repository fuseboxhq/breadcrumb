# Research: Modern Terminal IDE Visual Design Patterns

**Task:** PHASE-08 - Desktop IDE Visual & UX Overhaul
**Date:** 2026-02-11
**Domain:** UI/UX Design for Terminal IDEs
**Overall Confidence:** MEDIUM-HIGH

## TL;DR

Build a distinctive dark-themed Electron IDE using deep backgrounds (#0a0a0f to #282c34 range), vibrant accent colors (#bd93f9, #ff79c6, #61afef), subtle gradients with backdrop-blur glassmorphism, and consistent 8px-based spacing. Use JetBrains Mono at 13px with 1.2 line-height for terminal content. Differentiate from VS Code through rounded corners (8-12px), glow effects on active elements, and smooth ease-out transitions (150-300ms). Key: gradients + blur + glow = modern terminal aesthetic.

## Recommended Stack

| Library | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| JetBrains Mono | latest | Terminal font | HIGH |
| Cascadia Code | latest | Alternative UI font | MEDIUM |
| lucide-react | existing | Icon system | HIGH |
| Tailwind CSS | existing | Utility framework with tokens | HIGH |

**Current Setup:**
Already using Tailwind CSS with CSS custom properties. Extend with design token system.

## Color Systems

### 1. Deep Dark Backgrounds

Modern terminal IDEs use very dark backgrounds to reduce eye strain and make vibrant accent colors pop.

**Recommended Background Palette:**
```css
/* Primary backgrounds */
--bg-deepest: #0a0a0f;      /* Main canvas, deepest depth */
--bg-deep: #141419;          /* Secondary surfaces */
--bg-elevated: #1a1a22;      /* Cards, panels */
--bg-subtle: #21212b;        /* Hover states */
```

**Reference Values from Popular Themes:**

- **One Dark:** `#282c34` (background), `#abb2bf` (foreground)
- **Dracula:** `#282a36` (background), `#f8f8f2` (foreground)
- **Warp Default:** Deep darks in #0a-#14 range

**Confidence:** HIGH (verified from official theme specs)

### 2. Accent Colors

Warp's innovation: single accent color that themes the entire UI beyond just text highlighting.

**Recommended Accent System:**
```css
/* Primary accents - choose one as main brand */
--accent-purple: #bd93f9;    /* Dracula purple */
--accent-pink: #ff79c6;      /* Dracula pink */
--accent-blue: #61afef;      /* One Dark blue */
--accent-cyan: #56b6c2;      /* One Dark cyan */

/* Semantic colors */
--success: #98c379;          /* One Dark green */
--error: #e06c75;            /* One Dark red */
--warning: #e5c07b;          /* One Dark yellow */
--info: #61afef;             /* One Dark blue */
```

**Usage Pattern:**
- Tab indicators: accent color with 100% opacity
- Active panel borders: accent with subtle glow
- Hover states: accent with 10-20% opacity background
- Focus rings: accent with 2px outline

**Confidence:** HIGH (from Dracula spec and One Dark implementations)

### 3. Foreground & Text Colors

**Text Hierarchy:**
```css
--text-primary: #f8f8f2;     /* Main text - Dracula white */
--text-secondary: #abb2bf;   /* Secondary text - One Dark */
--text-tertiary: #636d83;    /* Disabled, hints */
--text-comment: #5c6370;     /* Comments, low priority */
```

**Confidence:** HIGH (from official theme specifications)

### 4. Gradient Techniques

Warp's key differentiator: gradients add depth without being overwhelming.

**Recommended Gradient Patterns:**
```css
/* Subtle background gradients */
.bg-gradient-dark {
  background: linear-gradient(
    135deg,
    #0a0a0f 0%,
    #141419 50%,
    #0a0a0f 100%
  );
}

/* Accent gradients for special elements */
.accent-gradient {
  background: linear-gradient(
    90deg,
    var(--accent-purple) 0%,
    var(--accent-pink) 100%
  );
}

/* Vertical gradients (Warp supports) */
.vertical-gradient {
  background: linear-gradient(
    to bottom,
    rgba(255, 255, 255, 0.05) 0%,
    transparent 100%
  );
}
```

**Where to Use:**
- Welcome screen header
- Active tab indicators
- Command palette header
- Status bar background

**Confidence:** MEDIUM (based on Warp blog post about gradient support)

### 5. UI Surface Design

Warp's approach: overlay opposite color on background for depth.

**For Dark Themes:**
```css
/* UI surfaces use white overlay on dark background */
.ui-surface {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
}

.ui-surface-hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.15);
}

.ui-surface-active {
  background: rgba(255, 255, 255, 0.12);
  border-color: var(--accent-color);
}
```

**Confidence:** HIGH (from Warp design blog post)

## Typography

### 1. Terminal Content Font

**Primary Recommendation: JetBrains Mono**
```css
.terminal-content {
  font-family: 'JetBrains Mono', 'Cascadia Code', 'Fira Code', monospace;
  font-size: 13px;
  line-height: 1.2;
  font-weight: 400;
}
```

**Rationale:**
- Designed specifically for IDEs and all-day coding
- Tall x-height for readability at small sizes
- Generous character proportions
- Official recommendation: 13px size, 1.2 line-height

**Alternative: Cascadia Code**
- Microsoft's modern terminal font
- Balanced, friendly, rounded aesthetic
- Optional ligatures
- Performs well in Windows environments

**Confidence:** HIGH (from JetBrains official specs and best practices articles)

### 2. UI Chrome Typography

**For UI elements (not code):**
```css
.ui-text {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 13px;
  line-height: 1.5;
  font-weight: 400;
}

.ui-text-small {
  font-size: 11px;
  line-height: 1.4;
}

.ui-text-large {
  font-size: 15px;
  line-height: 1.5;
  font-weight: 500;
}
```

**Hierarchy:**
- Tab labels: 13px, 500 weight
- Sidebar items: 13px, 400 weight
- Status bar: 11px, 400 weight
- Panel headers: 15px, 500 weight

**Confidence:** MEDIUM (based on general IDE best practices)

### 3. Typography Scale

```css
:root {
  --text-xs: 11px;    /* Status bar, meta info */
  --text-sm: 12px;    /* Secondary UI text */
  --text-base: 13px;  /* Primary UI and terminal */
  --text-lg: 15px;    /* Panel headers */
  --text-xl: 18px;    /* Welcome screen */
  --text-2xl: 24px;   /* Large headings */
}
```

**Confidence:** HIGH (standard practice across design systems)

## Spatial Design

### 1. Spacing System (8px Base)

Most design systems use 8px base units for consistency across screens.

**Recommended Token System:**
```css
:root {
  /* Base unit: 8px = 0.5rem */
  --space-0: 0;
  --space-1: 4px;      /* 0.25rem - tight gaps */
  --space-2: 8px;      /* 0.5rem - default gap */
  --space-3: 12px;     /* 0.75rem - comfortable gap */
  --space-4: 16px;     /* 1rem - section spacing */
  --space-6: 24px;     /* 1.5rem - large spacing */
  --space-8: 32px;     /* 2rem - panel padding */
  --space-12: 48px;    /* 3rem - major sections */
  --space-16: 64px;    /* 4rem - hero spacing */
}
```

**Usage Guidelines:**
- Between small related elements: 4-8px
- Between UI sections: 12-16px
- Panel padding: 16-24px
- Major section gaps: 32-48px

**Confidence:** HIGH (from Atlassian, USWDS, and other design system specs)

### 2. Border Radius System

Modern terminals use rounded corners to feel friendly and contemporary.

**Recommended Values:**
```css
:root {
  --radius-sm: 4px;     /* Small elements, chips */
  --radius-md: 8px;     /* Cards, buttons, inputs */
  --radius-lg: 12px;    /* Panels, major containers */
  --radius-xl: 16px;    /* Welcome screen cards */
  --radius-full: 9999px; /* Pills, circular avatars */
}
```

**Critical Pattern: Nested Border Radius**
```
outer-radius = inner-radius + padding

Example:
- Outer container: 12px radius, 8px padding
- Inner container: 4px radius (12px - 8px)
```

This maintains smooth curvature in nested elements.

**Where to Apply:**
- Panels: 12px
- Cards: 8-12px
- Buttons: 6-8px
- Tabs: 6px top corners only
- Status bar items: 4px
- Input fields: 6px

**Confidence:** HIGH (from Frontend Masters and nested radius guides)

### 3. Panel & Container Padding

**Consistent Padding Patterns:**
```css
/* Tight containers */
.panel-tight {
  padding: var(--space-3); /* 12px */
}

/* Default panels */
.panel {
  padding: var(--space-4); /* 16px */
}

/* Spacious panels */
.panel-spacious {
  padding: var(--space-6); /* 24px */
}

/* Welcome screen / hero */
.hero {
  padding: var(--space-8); /* 32px */
}
```

**Confidence:** HIGH (standard design system practice)

## Motion & Animation

### 1. Transition Duration

**Recommended Timing:**
```css
:root {
  --duration-fast: 150ms;      /* Micro-interactions */
  --duration-base: 200ms;      /* Default transitions */
  --duration-slow: 300ms;      /* Panel animations */
  --duration-slower: 500ms;    /* Major transitions */
}
```

**Usage:**
- Button hover: 150ms
- Tab switching: 200ms
- Panel slide in/out: 300ms
- Modal fade in: 300ms
- Toast notifications: 200ms enter, 500ms exit

**Confidence:** MEDIUM-HIGH (from CSS best practices and UX research)

### 2. Timing Functions

**Best Practices by Use Case:**

```css
/* Entering elements - start slow, speed up */
.enter {
  transition-timing-function: ease-out;
}

/* Exiting elements - start fast, slow down */
.exit {
  transition-timing-function: ease-in;
}

/* Hover states - balanced */
.hover {
  transition-timing-function: ease-in-out;
}

/* Linear for continuous animations */
.continuous {
  transition-timing-function: linear;
}
```

**Key Principle:**
- **ease-out** for introductions, hover states (most common)
- **ease-in** for exits, dismissals
- **ease-in-out** for balanced, symmetrical movements
- **linear** for loading spinners, progress bars

**Example Implementation:**
```css
.button {
  transition: all 150ms ease-out;
}

.modal-exit {
  transition: opacity 300ms ease-in;
}

.tab-indicator {
  transition: transform 200ms ease-out;
}
```

**Confidence:** HIGH (from CSS-Tricks, Smashing Magazine best practices)

### 3. Micro-Interactions

**Hover Effects:**
```css
.interactive:hover {
  background: rgba(255, 255, 255, 0.08);
  transform: translateY(-1px);
  transition: all 150ms ease-out;
}
```

**Active/Pressed States:**
```css
.interactive:active {
  transform: scale(0.98);
  transition: transform 100ms ease-out;
}
```

**Focus States:**
```css
.interactive:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: 2px;
  transition: outline-offset 150ms ease-out;
}
```

**Confidence:** MEDIUM-HIGH (based on Warp architecture and UI animation guides)

### 4. Loading Skeleton Shimmer

**Recommended Implementation:**
```css
@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

.skeleton {
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.05) 0%,
    rgba(255, 255, 255, 0.1) 50%,
    rgba(255, 255, 255, 0.05) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s linear infinite;
}
```

**Duration:** 1.5-2 seconds is optimal (not too fast, not too slow)

**Confidence:** HIGH (from multiple skeleton loading implementation guides)

## Visual Hierarchy

### 1. Active vs Inactive Panels

**Opacity-Based Hierarchy:**
```css
/* Active panel */
.panel-active {
  opacity: 1;
  border-color: var(--accent-color);
  box-shadow: 0 0 0 1px var(--accent-color),
              0 0 12px rgba(var(--accent-rgb), 0.3);
}

/* Inactive panel */
.panel-inactive {
  opacity: 0.6;
  border-color: rgba(255, 255, 255, 0.1);
}

/* Inactive panel hover */
.panel-inactive:hover {
  opacity: 0.8;
  border-color: rgba(255, 255, 255, 0.15);
  transition: opacity 200ms ease-out;
}
```

**2026 Trend:** Use opacity 50-60% for inactive states, not just color changes.

**Confidence:** HIGH (from design system opacity standards and 2026 trends)

### 2. Tab Bar Active Indicators

**Modern Pattern:**
```css
.tab {
  position: relative;
  padding: 8px 16px;
  color: var(--text-secondary);
  transition: color 200ms ease-out;
}

.tab-active {
  color: var(--text-primary);
}

/* Animated underline indicator */
.tab-active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--accent-color);
  transition: transform 200ms ease-out;
}

/* Optional: Add subtle glow for active tab */
.tab-active {
  box-shadow: 0 0 8px rgba(var(--accent-rgb), 0.2);
}
```

**Alternative: Top accent bar** (Warp style)
```css
.tab-active::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(
    90deg,
    var(--accent-purple),
    var(--accent-pink)
  );
}
```

**Confidence:** HIGH (from navigation tab best practices and Warp docs)

### 3. Sidebar Item States

**State System:**
```css
.sidebar-item {
  padding: 8px 12px;
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  transition: all 150ms ease-out;
}

.sidebar-item:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-primary);
}

.sidebar-item-active {
  background: rgba(var(--accent-rgb), 0.15);
  color: var(--accent-color);
  font-weight: 500;
}

.sidebar-item:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: -2px;
}
```

**Confidence:** MEDIUM-HIGH (standard practice from UX patterns)

## Distinctive Elements

### 1. Glassmorphism (Blur Effects)

What makes modern terminals NOT look like VS Code: backdrop-blur and translucency.

**Core Properties:**
```css
.glass-panel {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px) saturate(150%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

/* For dark mode (adjust for darker backgrounds) */
.glass-dark {
  background: rgba(17, 25, 40, 0.75);
  backdrop-filter: blur(12px) saturate(120%);
  border: 1px solid rgba(255, 255, 255, 0.08);
}
```

**Optimal Values:**
- **Blur radius:** 10-20px (typically 10-12px for performance)
- **Opacity:** 10-40% (5-10% for very subtle effects)
- **Saturate:** 120-150% to maintain visual interest

**Where to Use:**
- Command palette
- Context menus
- Toast notifications
- Modal overlays
- Floating panels

**Performance Warning:** backdrop-filter is GPU-intensive. Don't animate it. Use static values.

**Confidence:** HIGH (from multiple 2026 glassmorphism guides and best practices)

### 2. Glow Effects

**Active Element Glow:**
```css
.glow-accent {
  box-shadow:
    0 0 8px rgba(var(--accent-rgb), 0.3),
    0 0 16px rgba(var(--accent-rgb), 0.15);
}

/* Stacked glow (more dramatic) */
.glow-strong {
  box-shadow:
    0 0 4px rgba(var(--accent-rgb), 0.4),
    0 0 8px rgba(var(--accent-rgb), 0.3),
    0 0 16px rgba(var(--accent-rgb), 0.2),
    0 0 24px rgba(var(--accent-rgb), 0.1);
}

/* Hover glow transition */
.glow-hover {
  box-shadow: 0 0 0 rgba(var(--accent-rgb), 0);
  transition: box-shadow 200ms ease-out;
}

.glow-hover:hover {
  box-shadow: 0 0 12px rgba(var(--accent-rgb), 0.4);
}
```

**Where to Use:**
- Active tab indicators
- Focus states on inputs
- Primary action buttons (subtle)
- Terminal cursor
- Notification badges

**Caution:** Glows need dark backgrounds to work. Use sparingly to maintain premium feel.

**Confidence:** HIGH (from CSS glow effect tutorials and terminal aesthetics)

### 3. Subtle Gradients Everywhere

**Panel Headers:**
```css
.panel-header {
  background: linear-gradient(
    to bottom,
    rgba(255, 255, 255, 0.05),
    transparent
  );
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}
```

**Card Backgrounds:**
```css
.card {
  background: linear-gradient(
    135deg,
    rgba(var(--accent-rgb), 0.05) 0%,
    transparent 50%
  );
}
```

**Button Hover:**
```css
.button:hover {
  background: linear-gradient(
    to bottom,
    rgba(255, 255, 255, 0.15),
    rgba(255, 255, 255, 0.08)
  );
}
```

**Confidence:** MEDIUM (based on Warp gradient support and modern UI trends)

### 4. Rounded Corners Everywhere

VS Code is boxy. Modern terminals are soft.

**Application:**
- Panels: 12px radius
- Cards: 8-12px radius
- Buttons: 6-8px radius
- Inputs: 6px radius
- Code blocks: 8px radius
- Images/avatars: 8px or full circle

**Exception:** Window edges (0px) for native feel.

**Confidence:** HIGH (clear differentiator in modern terminal IDEs)

### 5. Shadow Depth System

**Layered Elevation:**
```css
:root {
  /* Subtle shadows for dark mode */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 8px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 8px 16px rgba(0, 0, 0, 0.5);
  --shadow-xl: 0 16px 32px rgba(0, 0, 0, 0.6);
}

/* Apply based on elevation */
.z-1 { box-shadow: var(--shadow-sm); }
.z-2 { box-shadow: var(--shadow-md); }
.z-3 { box-shadow: var(--shadow-lg); }
.z-4 { box-shadow: var(--shadow-xl); }
```

**Usage:**
- Cards on background: shadow-sm
- Floating panels: shadow-md
- Modals: shadow-lg
- Command palette: shadow-xl

**Confidence:** HIGH (standard practice for elevation systems)

## Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| Custom focus management | :focus-visible pseudo-class | Browser-native, respects user preferences, WCAG compliant |
| Manual color contrast checks | Dracula/One Dark tested palettes | These themes meet WCAG 2.1 Level AA (4.5:1 contrast) |
| Custom animation library | CSS transitions with timing functions | GPU-accelerated, performant, no bundle bloat |
| Nested radius calculations | CSS calc() with token variables | Automatic, maintainable: `calc(var(--outer-radius) - var(--padding))` |
| Complex shadow stacking | Pre-defined shadow tokens | Consistent elevation system, easier to maintain |

## Key Patterns

### Pattern 1: Active Panel Indicator
**Use when:** User has multiple panels/tabs open and needs clear focus indication

```css
.panel {
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 200ms ease-out;
}

.panel[data-active="true"] {
  border-color: var(--accent-color);
  box-shadow:
    0 0 0 1px var(--accent-color),
    0 0 12px rgba(var(--accent-rgb), 0.3),
    0 8px 24px rgba(0, 0, 0, 0.4);
  opacity: 1;
}

.panel[data-active="false"] {
  opacity: 0.6;
}
```

### Pattern 2: Command Palette with Glassmorphism
**Use when:** Building overlay UI elements like command palette, context menus

```css
.command-palette {
  position: fixed;
  top: 20%;
  left: 50%;
  transform: translateX(-50%);
  width: 600px;
  max-height: 400px;

  background: rgba(17, 25, 40, 0.85);
  backdrop-filter: blur(12px) saturate(120%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-lg);
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.05),
    0 24px 48px rgba(0, 0, 0, 0.6);

  animation: fade-in 200ms ease-out;
}

@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}
```

### Pattern 3: Tab Bar with Gradient Indicator
**Use when:** Building tab navigation

```tsx
// React component example
<div className="tab-bar">
  {tabs.map(tab => (
    <button
      key={tab.id}
      className={cn(
        "relative px-4 py-2 text-sm",
        "transition-colors duration-200 ease-out",
        tab.active
          ? "text-primary font-medium"
          : "text-secondary hover:text-primary"
      )}
    >
      {tab.label}
      {tab.active && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-pink-500" />
      )}
    </button>
  ))}
</div>
```

### Pattern 4: Skeleton Loading
**Use when:** Loading async content (extensions list, phase data)

```css
.skeleton {
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.04) 0%,
    rgba(255, 255, 255, 0.08) 50%,
    rgba(255, 255, 255, 0.04) 100%
  );
  background-size: 200% 100%;
  border-radius: var(--radius-md);
  animation: shimmer 1.5s linear infinite;
}

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

/* Usage */
.skeleton-text {
  height: 1em;
  margin-bottom: 0.5em;
}

.skeleton-card {
  height: 120px;
  width: 100%;
}
```

### Pattern 5: Interactive Card Hover
**Use when:** Welcome screen quick actions, extension cards

```css
.interactive-card {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-lg);
  padding: var(--space-6);

  transition: all 200ms ease-out;
  cursor: pointer;
}

.interactive-card:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}

.interactive-card:active {
  transform: translateY(0);
  transition-duration: 100ms;
}
```

## Pitfalls

### Pitfall 1: Over-using Backdrop-Filter
**What happens:** Performance degradation, janky animations, high GPU usage

**Avoid by:**
- Limit backdrop-filter to overlay UI only (modals, command palette, context menus)
- Never animate backdrop-filter values
- Use static blur values only
- Test on lower-end hardware
- Consider disabling blur on devices with <8GB RAM

### Pitfall 2: Insufficient Contrast on Dark Backgrounds
**What happens:** Text becomes unreadable, fails WCAG guidelines

**Avoid by:**
- Use tested color palettes (Dracula, One Dark) that meet WCAG 2.1 Level AA
- Text on dark backgrounds: minimum #abb2bf (One Dark) or #f8f8f2 (Dracula)
- Never use gray text below #666 on dark backgrounds
- Test with browser DevTools contrast checker
- For accent colors on dark: ensure 3:1 minimum contrast for UI elements

### Pitfall 3: Inconsistent Border Radius in Nested Elements
**What happens:** Visual awkwardness, corners don't align smoothly

**Avoid by:**
- Apply the formula: `inner-radius = outer-radius - padding`
- Use CSS custom properties: `--inner-radius: calc(var(--outer-radius) - var(--padding));`
- Example: Outer container has 12px radius and 8px padding → Inner element gets 4px radius
- Document this pattern in your design system

### Pitfall 4: Slow Transition Durations
**What happens:** UI feels sluggish, unresponsive, annoying

**Avoid by:**
- Micro-interactions (hover, focus): 100-150ms max
- Standard transitions: 200ms default
- Panel animations: 300ms max
- Never exceed 500ms unless it's a special effect
- Use ease-out for most transitions (feels snappier than ease-in-out)

### Pitfall 5: Removing Focus Indicators
**What happens:** Keyboard navigation becomes impossible, fails accessibility

**Avoid by:**
- Always use `:focus-visible` for custom focus styles
- Never set `outline: none` without replacement
- Minimum 2px outline, 2px offset
- Use accent color for focus indicators
- Ensure 3:1 contrast ratio per WCAG 2.1
- Test keyboard navigation thoroughly

### Pitfall 6: Overusing Glow Effects
**What happens:** UI looks amateur, like a 2000s website, loses premium feel

**Avoid by:**
- Glow only on active/focused elements
- Use subtle opacity (0.2-0.4 max)
- Limit to 1-2 layers of glow
- Reserve strong glows for primary actions only
- Never glow everything simultaneously

### Pitfall 7: White Backgrounds/Flashes During Loading
**What happens:** Jarring flash when panels load, breaks dark mode immersion

**Avoid by:**
- Set default background to `--bg-deepest` on root/body
- All panels should have explicit dark background
- Use skeleton screens during loading (not blank white)
- Preload critical UI elements
- Test with slow network throttling

## Open Questions

1. **Custom window chrome:** Should we use a custom titlebar (frameless window) or native OS chrome? Custom gives more control but adds complexity.

2. **Animation library:** All research points to pure CSS transitions being sufficient. But should we consider Framer Motion for complex animations (command palette entry, panel transitions)? Need to balance bundle size vs developer experience.

3. **Icon style:** lucide-react is already in use, but should we mix in custom icons for distinctive elements? Or maintain consistency with one icon set?

4. **Light mode:** Research focused on dark themes only. If light mode is added later, will need separate research for light theme best practices (different opacity values, shadow strengths, etc.).

5. **Theming system:** Should we build a theme switcher now or hardcode the dark theme? Warp's accent color approach is elegant but requires architecture planning.

## Sources

### HIGH Confidence:
- [Warp Custom Themes Documentation](https://docs.warp.dev/terminal/appearance/custom-themes) - Color system structure
- [Warp Theme Design Blog](https://www.warp.dev/blog/how-we-designed-themes-for-the-terminal-a-peek-into-our-process) - Design principles
- [Dracula Theme Specification](https://draculatheme.com/spec) - Exact color values
- [JetBrains Mono Official Page](https://www.jetbrains.com/lp/mono/) - Typography specs
- [CSS :focus-visible MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/:focus-visible) - Accessibility
- [CSS Ease-Out Timing Functions - CSS-Tricks](https://css-tricks.com/ease-out-in-ease-in-out/) - Animation timing
- [Sara Soueidan Focus Indicators Guide](https://www.sarasoueidan.com/blog/focus-indicators/) - Accessibility best practices

### MEDIUM Confidence:
- [Ghostty Terminal Features](https://ghostty.org/docs/features/theme) - Theme system approach
- [Dark Glassmorphism 2026 Article](https://medium.com/@developer_89726/dark-glassmorphism-the-aesthetic-that-will-define-ui-in-2026-93aa4153088f) - Glassmorphism trends
- [Atlassian Design System Spacing](https://atlassian.design/foundations/spacing/) - Spacing tokens
- [One Dark Theme GitHub](https://github.com/Binaryify/OneDark-Pro) - Color values
- [Nested Border Radius - Frontend Masters](https://frontendmasters.com/blog/the-classic-border-radius-advice-plus-an-unusual-trick/) - Spatial design
- [Skeleton Loading Best Practices](https://codewithbilal.medium.com/how-to-create-a-skeleton-loading-shimmer-effect-with-pure-css-7f9041ec9134) - Loading states
- [Tab Navigation Design Patterns](https://uxdworld.com/2022/10/05/tabs-navigation-design-best-practices/) - Tab indicators

### LOW Confidence (needs validation):
- [Warp Terminal GitHub Themes](https://github.com/warpdotdev/themes) - Repository structure only (couldn't access theme files)
- [Zed Editor Themes](https://zed.dev/docs/themes) - Theme customization concepts
- [2026 UI Design Trends](https://theorangebyte.com/visual-hierarchy-web-design/) - General trend observations

### Additional Context:
- [It's FOSS: Ghostty Themes](https://itsfoss.com/ghostty-themes/) - Popular themes
- [Best Coding Fonts 2026](https://lexingtonthemes.com/blog/best-coding-fonts-2026) - Typography recommendations
- [CSS Glow Effects](https://cssbud.com/css-generator/css-glow-generator/) - Glow techniques
- [Design System Spacing - Basics](https://blog.designary.com/p/spacing-systems-and-scales-ui-design) - Spacing theory
- [How Warp Works](https://www.warp.dev/blog/how-warp-works) - Architecture approach
