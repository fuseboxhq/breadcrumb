# Phase 08: Desktop IDE Visual & UX Overhaul

**Status:** in_progress
**Beads Epic:** breadcrumb-5sc
**Created:** 2026-02-11

## Objective

Transform the Breadcrumb desktop IDE from its current scaffolded state (white placeholder screens, generic styling) into a polished, production-grade developer environment with a distinctive Warp-like dark aesthetic. Every panel, interaction, and state should feel intentional and refined — loading skeletons, empty states, hover effects, micro-animations, and proper visual hierarchy throughout. The goal is an IDE that looks and feels like a shipping product, not a prototype.

## Research Summary

**Overall Confidence:** HIGH

Overhaul the entire renderer with a cohesive dark design system inspired by Warp and Dracula. Foundation is a proper token system (colors, typography, spacing, shadows, motion) applied via CSS custom properties + Tailwind. Shell chrome gets depth via glow effects, glassmorphism on overlays, and rounded corners (8-12px). All panels get proper empty/loading/error states. Add cmdk for command palette, Sonner for toasts, and a custom status bar.

### Recommended Stack

| Library | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| cmdk | latest | Command palette component (unstyled, composable) | HIGH |
| match-sorter | latest | Fuzzy search for command palette | HIGH |
| sonner | latest | Toast notifications (2-3KB, zero deps) | HIGH |
| @radix-ui/react-dialog | latest | Modal/overlay primitives (bundled with cmdk) | HIGH |

### Key Patterns

**Color system:** Deep dark backgrounds (#0a0a0f → #111113 → #1a1a1f), Dracula-inspired accents (purple #bd93f9, pink #ff79c6, green #50fa7b, cyan #8be9fd). Single vibrant accent for primary actions.

**Typography:** JetBrains Mono 13px for terminal, system fonts for UI chrome. Scale: 11px (status) → 13px (body) → 15px (headings) → 18px+ (welcome hero).

**Spacing:** 8px base unit. Grid: 4, 8, 12, 16, 24, 32, 48, 64px.

**Motion:** ease-out for enters/hovers (150ms micro, 200ms default, 300ms panels). Never animate backdrop-filter.

**Visual hierarchy:** Active panels get accent border + subtle glow. Inactive at 50-60% opacity. Tab indicators via 2px accent underline.

**Distinctive elements (NOT VS Code):** Rounded corners (8-12px), glassmorphism on overlays (backdrop-blur 10-12px), glow effects on active elements, gradient accents, opacity-based hierarchy.

### Design Guidance

The `frontend-design` skill will be active during execution of UI tasks in this phase. It provides guidelines for typography, color, motion, spatial composition, and avoiding generic aesthetics.

### Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| Command palette | cmdk | Focus trapping, keyboard nav, composable, proven at Linear/Vercel |
| Fuzzy search | match-sorter | Deterministic ranking, simpler than fuse.js for command lists |
| Toast notifications | sonner | 2-3KB, zero setup, global `toast()` API, dark theme built-in |
| Modal/overlay focus | @radix-ui/react-dialog | Accessible focus trap, ESC handling, portal rendering |
| Color palette | Dracula theme values | WCAG AA tested, proven readability on dark backgrounds |

### Pitfalls

- **Accent = Secondary bug**: Current tokens have accent identical to secondary — must fix in task 1
- **Hard-coded colors**: Terminal, planner, extensions all use hard-coded hex/Tailwind colors — migrate to tokens
- **backdrop-filter perf**: Only use glassmorphism on overlay UI (command palette, modals), never on persistent panels
- **White flash on load**: Set `background-color: #0a0a0f` on `<html>` element, not just via Tailwind class
- **Glow overuse**: Only glow active/focused elements — multiple simultaneous glows look amateur
- **Focus indicators**: Never remove outline without replacement. Use `:focus-visible` with 2px outline at 3:1 contrast

## Scope

**In scope:**
- Design token system: color palette, typography scale, spacing system, shadows, border radii, motion curves
- Full visual overhaul of all panels: welcome screen, terminal, browser, planner, extensions sidebar
- Shell chrome refinement: title bar, activity bar, sidebar, tab bar, resize handles
- UX improvements: loading states, empty states, error states, skeleton screens
- Micro-interactions: hover effects, transitions, focus indicators, active states
- Keyboard navigation and focus management
- Toast/notification system for feedback (Sonner)
- Status bar at bottom of IDE
- Command palette (Cmd+K / Ctrl+K) via cmdk
- Responsive panel behavior at different sizes

**Out of scope:**
- New functional panels or features (no new tab types, no editor)
- Backend/main process changes (purely renderer-side, except Cmd+K global shortcut)
- Extension system UI beyond the existing sidebar panel
- Theming system or light mode (dark mode only for now)
- Accessibility audit (do basics right but full a11y is a future phase)

## Constraints

- **Frontend design skill active** — follow design thinking process for all UI tasks
- Warp-like aesthetic: deep dark backgrounds (#0a0a0f range), subtle gradients, vibrant accent colors
- Must not look like a VS Code clone — own visual identity
- Tailwind CSS with design tokens via CSS custom properties (existing pattern)
- React + Zustand for state (existing pattern)
- lucide-react for icons (existing)
- Minimal new dependencies: cmdk, match-sorter, sonner only
- All visual changes in `desktop/src/renderer/` — main process only for Cmd+K shortcut

## Tasks

| ID | Title | Status | Complexity | Dependencies |
|----|-------|--------|------------|--------------|
| breadcrumb-5sc.1 | Design token system & global styles foundation | done | High | - |
| breadcrumb-5sc.2 | Shell chrome overhaul — title bar, activity bar, tab bar, sidebar | open | High | .1 |
| breadcrumb-5sc.3 | Welcome screen & workspace content polish | open | Medium | .1 |
| breadcrumb-5sc.4 | Panel visual overhaul — terminal, browser, planner, extensions | open | High | .1 |
| breadcrumb-5sc.5 | Command palette with cmdk and global keybinding | open | High | .1 |
| breadcrumb-5sc.6 | Status bar & toast notification system | open | Medium | .1 |
| breadcrumb-5sc.7 | Micro-interactions, loading states & polish pass | open | High | .2, .4 |

### Task Details

**breadcrumb-5sc.1 — Design token system & global styles foundation**
Rebuild the entire color system in globals.css and tailwind.config.ts. Fix the broken accent=secondary bug. Define full Dracula-inspired dark palette (background depths, foreground hierarchy, accent colors, semantic colors). Add typography scale, spacing tokens, shadow/elevation system, border-radius tokens, and animation/transition definitions. Set dark background on `<html>` to prevent white flash. This is the foundation everything else builds on. *(frontend-design skill active)*

**breadcrumb-5sc.2 — Shell chrome overhaul**
Redesign TitleBar (depth, subtle shadow, better project name display), ActivityBar (glow on active, rounded buttons, tooltips), TabBar (accent underline on active tab, better close buttons, proper inactive state), SidebarPanel (header distinction, content area refinement, scrollbar styling), and PanelResizeHandle (visible grab affordance). Apply 8-12px rounded corners throughout. *(frontend-design skill active)*

**breadcrumb-5sc.3 — Welcome screen & workspace content polish**
Transform the welcome view into a branded hero screen with the Breadcrumb identity. Polished quick-action cards with hover effects, subtle gradients, icon treatment. Add keyboard shortcuts hints. Style the "no tab selected" state. *(frontend-design skill active)*

**breadcrumb-5sc.4 — Panel visual overhaul**
Restyle all content panels: Terminal (themed xterm colors from tokens, refined toolbar, split handle styling), Browser (polished nav bar, styled placeholder with illustration), Planner (phase cards with gradient progress bars, better status badges, styled empty state), Extensions (refined cards, status indicator dots, capability badges). Replace all hard-coded colors with theme tokens. *(frontend-design skill active)*

**breadcrumb-5sc.5 — Command palette with cmdk**
Install cmdk + match-sorter. Build command palette overlay with glassmorphism backdrop. Register Cmd+K/Ctrl+K via Electron globalShortcut → IPC → renderer toggle. Create CommandRegistry that aggregates commands from panels and extensions. Style with Dracula theme, keyboard navigation, result grouping by category, recent commands. *(frontend-design skill active)*

**breadcrumb-5sc.6 — Status bar & toast notification system**
Add persistent status bar at bottom of IDE (git branch, active terminal count, extension status, cursor position context). Install Sonner, configure with dark theme, bottom-right position, 3-toast stack limit. Define toast patterns: success (4s), error (8s), with action buttons. Wire toast calls into extension system and terminal events. *(frontend-design skill active)*

**breadcrumb-5sc.7 — Micro-interactions, loading states & polish pass**
Add skeleton loading screens for all async panels (planner, extensions). Define empty state illustrations/messaging for each panel. Add error state patterns. Refine all hover/focus/active transitions (150ms ease-out). Add focus-visible rings throughout. Keyboard navigation for activity bar, tab bar, sidebar. Final consistency pass: verify no hard-coded colors remain, all states covered, no white flashes. *(frontend-design skill active)*

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Aesthetic direction | Warp-like dark + Dracula palette | Deep darks, vibrant accents, proven readability, distinctive |
| Design tokens | CSS custom properties via Tailwind | Existing pattern, extend with full system |
| Primary accent | Purple #bd93f9 | Dracula purple — distinctive, not VS Code blue |
| Command palette | cmdk + match-sorter | Battle-tested at Linear/Vercel, unstyled for full design control |
| Toast system | Sonner | 2-3KB, global API, dark theme built-in |
| Overlay effects | Glassmorphism (backdrop-blur 10-12px) | Modern, distinctive, only on transient overlays |
| Terminal font | JetBrains Mono 13px | Industry standard for terminal, great readability |
| Spacing system | 8px base unit | Clean grid, consistent spacing throughout |
| Border radius | 8-12px on cards/panels | Rounded = modern feel, distinct from VS Code's boxy aesthetic |
| Motion | CSS transitions, ease-out, 150-300ms | Performant, no animation library needed |

## Completion Criteria

- [ ] Design token system defined and applied: colors, typography, spacing, shadows, motion
- [ ] Welcome screen is a polished, branded landing with smooth quick-action cards
- [ ] Terminal panel has refined chrome, proper resize handles, split indicators
- [ ] Browser panel looks intentional with styled nav bar and placeholder state
- [ ] Planner panel has polished phase cards, progress visualization, empty state
- [ ] Extensions sidebar shows extensions with proper cards, status badges, capability chips
- [ ] Activity bar, sidebar, tab bar all have refined hover/active states and transitions
- [ ] Status bar at bottom shows useful context (git branch, terminal count, etc.)
- [ ] Command palette works (Cmd+K) with fuzzy search
- [ ] Loading skeletons, empty states, and error states exist for all async panels
- [ ] Toast notification system works for user feedback
- [ ] All interactions have proper hover, focus, and active states with smooth transitions
- [ ] No white/unstyled flashes on any screen

## Sources

**HIGH confidence:**
- [Dracula Theme](https://draculatheme.com/) — Color palette values
- [Sonner](https://sonner.emilkowal.ski/) — Toast notification library
- [cmdk](https://cmdk.paco.me/) — Command palette component
- [VS Code UX Guidelines](https://code.visualstudio.com/api/ux-guidelines/notifications) — IDE notification patterns
- [match-sorter](https://github.com/kentcdodds/match-sorter) — Fuzzy search

**MEDIUM confidence:**
- [One Dark Theme](https://github.com/atom/one-dark-syntax) — Alternative color values
- Warp terminal visual patterns (observed, not documented)
- [Glassmorphism CSS](https://css.glass/) — Backdrop blur patterns
