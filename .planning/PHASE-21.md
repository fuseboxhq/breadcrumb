# Phase 21: UI/UX Design Polish

**Status:** not_started
**Beads Epic:** breadcrumb-pq9
**Created:** 2026-02-14

## Objective

Elevate the desktop IDE from "functional prototype" to "premium developer tool" by systematically eliminating generic AI-generated aesthetics. The app should feel like Warp or Linear — dark, sleek, confident, with refined typography, intentional color usage, and polished micro-details. Every surface should look hand-crafted by a designer, not auto-generated.

Additionally, soften the overall theme — the current palette is very dark and could benefit from slightly lifted background tones and better contrast layering to reduce visual harshness.

## Scope

**In scope:**
- Soften the theme: lift background darkness, improve contrast layering between surfaces
- Refine the Dracula-based color palette — more intentional usage, better hierarchy, less "every accent everywhere"
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

## Constraints

- Frontend design skill active — follow design thinking process for UI tasks
- Keep the existing Tailwind design token system — refine values, don't restructure
- Warp/Linear aesthetic: dark, sleek, premium — avoid playful or bubbly
- No new dependencies unless absolutely necessary (prefer CSS/Tailwind solutions)
- Changes must be behavior-preserving — visual only
- Must work on macOS (primary platform)

## Research Summary

Run `/bc:plan PHASE-21` to research this phase and populate this section.

## Recommended Approach

Surface-by-surface polish starting from the most impactful areas (theme softening, welcome screen, sidebar) and working outward. Each task should address a cohesive visual surface so changes are reviewable and coherent.

Suggested order:
1. Theme foundation — soften backgrounds, refine color token values, fix contrast
2. Typography & spacing system — establish consistent scale
3. Welcome screen redesign — first impression matters most
4. Sidebar & activity bar polish
5. Tab bar, status bar, title bar chrome
6. Detail pass — empty states, icons, micro-interactions

Run `/bc:plan PHASE-21` to research and break down into tasks.

## Tasks

| ID | Title | Status | Complexity |
|----|-------|--------|------------|
| - | No tasks yet | - | - |

Run `/bc:plan PHASE-21` to break down this phase into tasks.

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Visual direction | Warp / Linear | Dark, sleek, premium developer tool aesthetic |
| Color palette | Refine Dracula, don't replace | Colors are good, usage needs to be more intentional |
| Theme darkness | Soften | Current theme is very dark — lift backgrounds slightly |
| Logo/branding | Polish existing | Make current concept more professional |
| Design skill | Active | Frontend-design skill provides guidelines during execution |

## Completion Criteria

- [ ] Theme is noticeably softer — backgrounds lifted, contrast layering improved
- [ ] Welcome screen looks premium and distinctive (not AI-generated)
- [ ] Typography is consistent — no arbitrary font sizes, weights, or spacing
- [ ] Color usage is intentional — accent colors serve hierarchy, not decoration
- [ ] All chrome (title bar, tab bar, status bar, sidebar) feels cohesive and polished
- [ ] Empty states and loading screens look designed
- [ ] A developer seeing the app for the first time would not think "AI made this"
