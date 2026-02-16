# Phase 21: UI/UX Design Polish

**Status:** done
**Beads Epic:** breadcrumb-pq9
**Created:** 2026-02-14
**Completed:** 2026-02-14

## Objective

Elevate the desktop IDE from "functional prototype" to "premium developer tool" by systematically eliminating generic AI-generated aesthetics. The app should feel like Warp or Linear — dark, sleek, confident, with refined typography, intentional color usage, and polished micro-details. Every surface should look hand-crafted by a designer, not auto-generated.

Additionally, soften the overall theme — the current palette is very dark and could benefit from slightly lifted background tones and better contrast layering to reduce visual harshness.

## Scope

**In scope:**
- Soften the theme: lift background darkness, improve contrast layering between surfaces
- Add a teal/cyan secondary accent color to complement purple and break visual monotony
- Refine the Dracula-based color palette — more intentional usage, better hierarchy
- Polish the existing logo/app icon — make it look more professional without a full rebrand
- Redesign the Welcome screen — it's the first impression and currently sets a generic tone
- Overhaul sidebar and navigation chrome — activity bar, sidebar panels, tree views
- Polish status bar, title bar, tab bar — all window chrome
- Typography pass — font sizing, weights, letter-spacing, line-height consistency
- Spacing and alignment audit — consistent padding, margins, and spatial rhythm
- Icon usage — ensure consistent sizing, stroke weights, and purposeful placement
- Micro-interactions — hover states, transitions, focus rings should feel intentional
- Empty states — make "no data" screens feel designed, not placeholder

**Out of scope:**
- Full rebrand / new logo from scratch
- New color palette (evolving, not replacing Dracula)
- Layout or architectural changes (panel structure stays the same)
- New features or functionality
- Component library extraction (that's a future phase)

## Research Summary

**Overall Confidence:** HIGH

Full design audit of current token system + research into premium dark UI patterns from Warp, Linear, Vercel, and Material Design. The current theme is well-structured but needs refinement at the token level and more intentional application throughout components.

### Key Findings

**Background is too dark:** Current `#0a0a0f` (4% lightness) is darker than any premium dark tool. Material Design standard is `#121212` (7%), Warp uses `~#1A1A2E`. Recommendation: lift to 7-10% lightness range.

**Accent color strategy:** Add teal/cyan (`#8be9fd` — already in Dracula palette) as a secondary accent alongside purple. Creates "dual accent" system: purple for brand/primary, teal for active states and interactive highlights. This is exactly what Warp does with their teal.

**Typography:** Add Inter as primary sans-serif font (used by Linear, optimized for screens). Limit to 3 font weights: Regular (400), Medium (500), Semibold (600). Current system has good size scale but weights need auditing.

**Spacing:** Current 4px grid is correct. Audit all components to ensure no rogue values (13px, 17px, etc.).

**AI aesthetics to avoid:** Gradient blobs, uniform hover states, inconsistent spacing, purple-everything, emoji as icons, generic card layouts with rounded corners on everything.

### Design Guidance

The `frontend-design` skill will be active during execution of UI tasks in this phase. It provides guidelines for typography, color, motion, spatial composition, and avoiding generic aesthetics.

### Pitfalls

- **Don't over-lift backgrounds** — stay at 7-12% lightness, never exceed 15% or you lose dark mode feel
- **OLED smearing** — never use pure `#000000`, always `#121212` minimum
- **Accent overload** — keep accent colors at <5% of screen real estate
- **Breaking 4px grid** — if 12px isn't enough, jump to 16px, never 14px
- **Weight chaos** — limit to 3 font weights max, never mix adjacent weights (400+500)

## Tasks

| ID | Title | Status | Complexity | Dependencies |
|----|-------|--------|------------|--------------|
| breadcrumb-pq9.1 | Soften theme & refine color tokens | done | Medium | - |
| breadcrumb-pq9.2 | Add teal accent & dual-accent system | done | Medium | pq9.1 |
| breadcrumb-pq9.3 | Typography & spacing system overhaul | done | Medium | pq9.1 |
| breadcrumb-pq9.4 | Redesign Welcome screen | done | High | pq9.3 |
| breadcrumb-pq9.5 | Polish sidebar, activity bar & navigation chrome | done | Medium | pq9.3 |
| breadcrumb-pq9.6 | Polish tab bar, status bar & title bar | done | Medium | pq9.5 |
| breadcrumb-pq9.7 | Detail pass — empty states, icons, micro-interactions | done | Medium | pq9.6 |

### Task Details

**pq9.1 — Soften theme & refine color tokens (Medium)**
(frontend-design skill active)
- Lift `--background` from `240 12% 4%` (#0a0a0f) to ~`228 10% 7%` (#101014) range
- Lift `--background-raised` from `240 8% 7%` (#111113) to ~`228 8% 10%` (#171719)
- Lift `--background-overlay` proportionally
- Strengthen `--border` from 14% to ~18% lightness for better surface definition
- Strengthen `--border-strong` proportionally
- Adjust `--muted` and `--secondary` to maintain consistent layering
- Update shadow values to match new depth
- Verify all surfaces still have clear visual hierarchy
- TypeScript check + visual verification

**pq9.2 — Add teal accent & dual-accent system (Medium)**
(frontend-design skill active)
- Define `--accent-secondary` token using Dracula cyan hue but refined for the new background
- Create `--shadow-glow-teal` and `--shadow-glow-teal-strong` variants
- Define usage rules: purple = primary brand/actions, teal = active states/highlights
- Update ActivityBar active indicator to use teal
- Update TabBar active tab underline to use teal (or a teal-purple blend)
- Add teal focus ring variant for interactive elements where purple is too dominant
- Audit all `bg-primary/10` usage — some should become teal accent instead
- Ensure the two accents never appear adjacent without visual separation

**pq9.3 — Typography & spacing system overhaul (Medium)**
(frontend-design skill active)
- Add Inter font to the project (self-hosted or CDN-free for Electron)
- Update `--font-sans` to prioritize Inter: `"Inter", -apple-system, ...`
- Audit all font weight usage across components — limit to 400, 500, 600
- Audit all spacing values — ensure every padding/margin/gap is divisible by 4
- Fix any rogue spacing values
- Verify line-height consistency across all text sizes
- Ensure letter-spacing is appropriate per size (tighter at large, normal at small)

**pq9.4 — Redesign Welcome screen (High)**
(frontend-design skill active)
- Redesign the hero section — remove generic "puzzle" icon aesthetic
- Create a more sophisticated empty workspace message
- Polish quick action cards — better visual hierarchy, more confident layout
- Refine copy — no generic "Get started" text, be specific and useful
- Apply the new teal accent and typography system
- Ensure it feels like opening Warp/Linear for the first time, not a template

**pq9.5 — Polish sidebar, activity bar & navigation chrome (Medium)**
(frontend-design skill active)
- Refine ActivityBar icon sizing, spacing, and active states with new accent system
- Polish SidebarPanel headers — consistent typography, better visual weight
- Refine project cards — better hover states, cleaner active styling
- Polish terminal tree view nodes — icon alignment, text truncation
- Refine sidebar section headers with new typography scale
- Ensure keyboard focus indicators use the refined focus ring system

**pq9.6 — Polish tab bar, status bar & title bar (Medium)**
(frontend-design skill active)
- Refine TitleBar gradient accent line
- Polish TabBar active/inactive states with new accent system
- Improve tab close button visibility/interaction
- Refine StatusBar item spacing and color usage
- Ensure the title bar macOS drag region feels native
- Apply consistent micro-interaction timing across all chrome

**pq9.7 — Detail pass — empty states, icons, micro-interactions (Medium)**
(frontend-design skill active)
- Polish all empty state screens (no extensions, no terminals, no project)
- Audit icon usage for consistent sizing and stroke width
- Refine hover states per element type (buttons lift, cards glow, icons scale)
- Ensure loading skeletons use the refined color tokens
- Verify all transitions feel intentional (no uniform 150ms on everything)
- Final visual verification of every surface in the app

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Visual direction | Warp / Linear | Dark, sleek, premium developer tool aesthetic |
| Background lift | ~7-10% lightness | Material Design standard, avoids OLED smearing |
| Secondary accent | Teal/cyan (#8be9fd family) | Already in Dracula palette, complements purple, Warp uses similar |
| Typography | Inter + system fallbacks | Used by Linear, screen-optimized, open source |
| Font weights | 400, 500, 600 only | Prevents visual chaos, clear hierarchy |
| Spacing grid | 4px | Current system is correct, audit for compliance |
| Logo/branding | Polish existing | Make current concept more professional |
| Design skill | Active on all tasks | Frontend-design skill provides guidelines during execution |

## Completion Criteria

- [x] Theme is noticeably softer — backgrounds lifted to 7-10% lightness range
- [x] Teal accent is present and used intentionally alongside purple
- [x] Welcome screen looks premium and distinctive (not AI-generated)
- [x] Typography uses Inter with consistent weights (400/500/600)
- [x] All spacing values are divisible by 4px
- [x] Color usage is intentional — accent colors serve hierarchy, not decoration
- [x] All chrome (title bar, tab bar, status bar, sidebar) feels cohesive and polished
- [x] Empty states and loading screens look designed
- [ ] A developer seeing the app for the first time would not think "AI made this"

## Sources

**HIGH confidence:**
- [Warp Theme Design Process](https://www.warp.dev/blog/how-we-designed-themes-for-the-terminal-a-peek-into-our-process)
- [Linear UI Redesign](https://linear.app/now/how-we-redesigned-the-linear-ui)
- [Material Design Dark Theme](https://m2.material.io/design/color/dark-theme.html)
- [Vercel Geist Colors](https://vercel.com/geist/colors)
- `.planning/research/phase-21-ui-design.md` — full design research

**MEDIUM confidence:**
- [8pt Grid System Guide](https://www.rejuvenate.digital/news/designing-rhythm-power-8pt-grid-ui-design)
- [Modern Font Stacks](https://github.com/system-fonts/modern-font-stacks)
