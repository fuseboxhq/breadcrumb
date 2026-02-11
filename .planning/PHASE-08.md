# Phase 08: Desktop IDE Visual & UX Overhaul

**Status:** not_started
**Beads Epic:** breadcrumb-5sc
**Created:** 2026-02-11

## Objective

Transform the Breadcrumb desktop IDE from its current scaffolded state (white placeholder screens, generic styling) into a polished, production-grade developer environment with a distinctive Warp-like dark aesthetic. Every panel, interaction, and state should feel intentional and refined — loading skeletons, empty states, hover effects, micro-animations, and proper visual hierarchy throughout. The goal is an IDE that looks and feels like a shipping product, not a prototype.

## Scope

**In scope:**
- Design token system: color palette, typography scale, spacing system, shadows, border radii, motion curves
- Full visual overhaul of all panels: welcome screen, terminal, browser, planner, extensions sidebar
- Shell chrome refinement: title bar, activity bar, sidebar, tab bar, resize handles
- UX improvements: loading states, empty states, error states, skeleton screens
- Micro-interactions: hover effects, transitions, focus indicators, active states
- Keyboard navigation and focus management
- Toast/notification system for feedback
- Status bar at bottom of IDE
- Command palette (Cmd+K / Ctrl+K)
- Context menus (right-click)
- Responsive panel behavior at different sizes

**Out of scope:**
- New functional panels or features (no new tabs types, no editor)
- Backend/main process changes (purely renderer-side)
- Extension system UI beyond the existing sidebar panel
- Theming system or light mode (dark mode only for now)
- Accessibility audit (do basics right but full a11y is a future phase)

## Constraints

- **Frontend design skill active** — follow design thinking process for all UI tasks (purpose, tone, constraints, differentiation)
- Warp-like aesthetic: deep dark backgrounds (#0a0a0f range), subtle gradients, vibrant accent colors, modern terminal feel
- Must not look like a VS Code clone — own visual identity
- Tailwind CSS with design tokens via CSS custom properties (existing pattern)
- React + Zustand for state (existing pattern)
- lucide-react for icons (existing)
- No new heavy UI libraries — build custom components, keep bundle lean
- All changes in `desktop/src/renderer/` — no main process modifications

## Research Summary

Run `/bc:plan PHASE-08` to research this phase and populate this section.

## Recommended Approach

Run `/bc:plan PHASE-08` to research and define the approach.

## Tasks

| ID | Title | Status | Complexity |
|----|-------|--------|------------|
| - | No tasks yet | - | - |

Run `/bc:plan PHASE-08` to break down this phase into tasks.

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Aesthetic direction | Warp-like dark minimal | Deep darks, subtle gradients, vibrant accents — distinctive, not a VS Code clone |
| Design tokens | CSS custom properties via Tailwind | Already in use, extend with full token system |
| Component approach | Custom components, no UI library | Keep bundle lean, full control over aesthetics |
| Motion | CSS transitions + minimal JS animation | Performant, no animation library needed |
| Icons | lucide-react (existing) | Already used, consistent icon set |

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
