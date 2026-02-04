# Phase 02: Dashboard UI/UX Overhaul

**Status:** in_progress
**Beads Epic:** breadcrumb-bly
**Created:** 2026-02-04

## Objective

Full redesign of the Breadcrumb web dashboard to shipped-product quality, inspired by Linear's design language. Rethink layout, navigation, information hierarchy, typography, spacing, animations, and component design from scratch. Every component gets rebuilt with a cohesive design system.

## Research Summary

**Overall Confidence:** HIGH

Use Motion (formerly Framer Motion) for animations, Radix UI for headless accessible primitives, Lucide for icons, Inter for typography, and a comprehensive Tailwind theme config as the design token layer. The existing stack (React 18, Vite 6, Tailwind 3, TanStack Query 5) stays — new libraries are additive.

### Recommended Stack

| Library | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| motion | 12.x | Layout animations, AnimatePresence, spring physics, stagger | HIGH |
| @radix-ui/react-* | latest | Headless accessible primitives (Tooltip, DropdownMenu, Dialog, Select) | HIGH |
| lucide-react | latest | Clean, consistent icon set (same aesthetic as Linear) | HIGH |
| Inter font | variable | Primary UI typeface — Linear's default, excellent for dense UIs | HIGH |
| @tailwindcss/typography | latest | Prose styling for markdown content in phase viewer | HIGH |
| clsx | latest | Conditional class composition (replaces string template literals) | HIGH |

### Key Patterns

- **Design tokens via Tailwind theme**: Define all colors, spacing, typography, shadows, radii, and transitions in `tailwind.config.js`. Use semantic color names (`surface`, `border`, `text-primary`, `text-secondary`, `accent`) not raw gray-XXX values.
- **Motion layout prop**: Add `layout` to any component that changes size/position on re-render. Motion auto-animates the transition.
- **AnimatePresence for route/tab transitions**: Wrap content areas in `<AnimatePresence mode="wait">` with keyed `motion.div` children.
- **Stagger children for lists**: Use `transition: { staggerChildren: 0.05 }` on parent variants, child variants for enter/exit.
- **Radix + Tailwind**: Style Radix primitives entirely with Tailwind classes via `className`. Use `data-[state=open]:` and `data-[highlighted]:` variants for interactive states.
- **Collapsible sidebar**: Linear-style — icon-only collapsed mode, smooth width transition, persistent across sessions via localStorage.

### Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| Dropdown menus | @radix-ui/react-dropdown-menu | Keyboard nav, focus management, portal rendering, screen reader support |
| Tooltips | @radix-ui/react-tooltip | Collision-aware positioning, delay groups, accessible |
| Dialogs/modals | @radix-ui/react-dialog | Focus trapping, scroll lock, portal, accessible |
| Select components | @radix-ui/react-select | Custom styling with full accessibility |
| Animations | motion | Spring physics, layout animations, exit animations — CSS can't do this well |
| Class composition | clsx | Avoids buggy string template conditionals |

### Pitfalls

- **Motion bundle size**: Import `motion` from `"motion/react"` (tree-shakeable) not the full `"motion"` package
- **Radix Portal z-index**: Radix portals render at document root — set explicit z-index in Tailwind to avoid stacking issues
- **AnimatePresence + keys**: Every direct child of AnimatePresence needs a unique `key` prop or exit animations won't fire
- **Inter font loading flash**: Use `font-display: swap` and preload the variable font to avoid FOIT
- **Tailwind v3 dark mode**: Use `darkMode: 'class'` in config since the app is always dark — avoids media query overhead
- **Motion + React.StrictMode**: Double-mount in dev can cause animation glitches — this is normal, doesn't affect prod

## Tasks

| ID | Title | Status | Complexity | Dependencies |
|----|-------|--------|------------|--------------|
| bly.1 | Install dependencies and build design system tokens | done | Medium | - |
| bly.2 | Rebuild UI primitive components with Radix and design tokens | done | Medium | bly.1 |
| bly.3 | Redesign app shell and sidebar navigation | done | High | bly.1 |
| bly.4 | Redesign project dashboard | done | Medium | bly.3 |
| bly.5 | Redesign phase detail view | open | High | bly.3 |
| bly.6 | Add animations and page transitions | open | Medium | bly.4, bly.5 |
| bly.7 | Visual QA and final polish pass | open | Low | bly.6 |

### Task Details

**bly.1 — Install dependencies and build design system tokens**
- Install: motion, @radix-ui/react-tooltip, @radix-ui/react-dropdown-menu, @radix-ui/react-dialog, @radix-ui/react-select, lucide-react, clsx, @tailwindcss/typography
- Add Inter font (Google Fonts CDN or self-hosted woff2)
- Build tailwind.config.js: semantic color palette (surface, border, text-*, accent-*), typography scale, spacing, shadows, radii, transitions
- Add CSS custom properties layer for dynamic token overrides
- Set `darkMode: 'class'` in config
- **Done when**: `pnpm build` succeeds, Inter renders, Tailwind tokens available

**bly.2 — Rebuild UI primitive components**
- Redesign: Button (variants: primary, secondary, ghost, danger), Badge (status colors), Card (surface + border), Tooltip (Radix), ProgressBar (new style), Spinner, SearchInput, EmptyState
- All use design tokens — no raw color values
- Use clsx for conditional classes
- **Done when**: Component storybook-style test page renders all variants

**bly.3 — Redesign app shell and sidebar navigation**
- New layout: sidebar (collapsible icon-only mode) + header + content area
- ProjectSwitcher as Radix DropdownMenu in sidebar header
- PhaseList redesigned: tighter, better info density, ready badges, hover states
- Sidebar collapse state persisted to localStorage
- Back-to-dashboard click on logo/project name
- **Done when**: Sidebar collapses smoothly, phases show/select, project switches work

**bly.4 — Redesign project dashboard**
- ProjectStateCard: cleaner layout, better typography
- PhaseProgressGrid: cards with hover interaction, status-colored accents
- ReadyTasksPanel: compact list with priority indicators
- Overall grid layout: responsive, balanced information density
- **Done when**: Dashboard renders with real data, cards are interactive, layout is balanced

**bly.5 — Redesign phase detail view**
- ContentTabBar: Linear-style underline tabs with smooth indicator animation
- PhasePlanTab: Better markdown rendering with @tailwindcss/typography prose styles
- PhaseTasksTab: Redesigned TaskCard, better filter bar, epic overview
- ResearchTab: Expandable documents with syntax highlighting
- PhaseDetailView: Status header, progress summary, tab navigation
- **Done when**: All three tabs render correctly, tasks filter/sort, research expands

**bly.6 — Add animations and page transitions**
- AnimatePresence on dashboard ↔ phase detail transitions
- Tab content transitions (fade + slide)
- List stagger on phase list, task list, dashboard cards
- Layout animation on sidebar collapse/expand
- Loading skeletons with shimmer animation (replace Spinner where appropriate)
- Hover micro-interactions on cards and buttons
- **Done when**: All major state transitions are animated, no janky pops

**bly.7 — Visual QA and final polish pass**
- Audit all spacing for consistency (4px grid)
- Check all hover/focus/active states
- Verify text truncation with long content
- Test empty states across all views
- Check color contrast ratios
- Test at different viewport widths
- Performance audit: no unnecessary re-renders, animations at 60fps
- **Done when**: No visual inconsistencies, app feels polished and complete

### Dependency Graph

```
bly.1 (Design tokens + deps)
├── bly.2 (UI primitives)
├── bly.3 (App shell + sidebar)
│   ├── bly.4 (Dashboard)  ───┐
│   └── bly.5 (Phase detail) ─┤
│                              ├── bly.6 (Animations)
│                              │   └── bly.7 (Polish)
```

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Animation library | Motion (framer-motion) | Layout animations, AnimatePresence, spring physics — CSS can't replicate this |
| UI primitives | Radix UI | Headless, accessible, works with Tailwind, no style opinions |
| Icons | Lucide React | Clean, consistent, tree-shakeable, same aesthetic as Linear |
| Typography | Inter (variable) | Linear's typeface, excellent readability at all sizes, variable weight support |
| Design tokens | Tailwind theme config | Centralized, type-safe via config, generates atomic utility classes |
| Class composition | clsx | Cleaner than template literals, handles undefined/false values |
| Prose styling | @tailwindcss/typography | Consistent markdown rendering without custom CSS |
| Color strategy | Semantic names (surface/border/accent) | Decouples from raw values, enables future theming |
| Dark mode | `darkMode: 'class'` | App is always dark — skip media query overhead |

## Completion Criteria

- [ ] Every component redesigned with consistent design tokens (colors, spacing, typography, shadows)
- [ ] Layout rethought: Linear-inspired navigation, content hierarchy, information density
- [ ] Smooth animations on all state transitions (page changes, expansions, hover, loading)
- [ ] Dashboard looks like a shipped product — someone could mistake it for a real SaaS tool
- [ ] Components are reusable primitives that make future features easy to build beautifully

## Sources

**HIGH confidence:**
- Motion docs: motion.dev/docs/react-layout-animations (layout prop, AnimatePresence, stagger)
- Radix Primitives: radix-ui.com/primitives/docs/components (Tooltip, DropdownMenu, Dialog, Select)
- Tailwind CSS v3: v3.tailwindcss.com/docs/theme (theme config, custom colors, dark mode)
- Tailwind Typography: tailwindcss.com/docs/typography-plugin

**MEDIUM confidence:**
- Linear design patterns: observed from linear.app UI (sidebar, animations, color palette, typography)
