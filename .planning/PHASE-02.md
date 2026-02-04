# Phase 02: Dashboard UI/UX Overhaul

**Status:** not_started
**Beads Epic:** breadcrumb-bly
**Created:** 2026-02-04

## Objective

Full redesign of the Breadcrumb web dashboard to achieve a shipped-product level of quality, inspired by Linear's design language. The current UI is functional but minimal — this phase rethinks layout, navigation, information hierarchy, typography, spacing, animations, and component design from scratch. The goal is a dashboard that looks and feels like a professional SaaS tool, not a developer prototype.

## Scope

**In scope:**
- Complete visual redesign of all 23 existing components
- New layout and navigation patterns (Linear-inspired: minimal chrome, content-focused)
- Design system: tokens (colors, spacing, typography, shadows, radii), reusable primitives
- Smooth animations and transitions (page transitions, expandable sections, hover states)
- Keyboard navigation where appropriate
- Backend/API changes if the redesign requires new data shapes or endpoints
- Mobile responsiveness if achievable within the redesign
- New features where they serve the UX (e.g., better search, inline editing, command palette)

**Out of scope:**
- Changing the core data model (Beads + .planning/ files remain the source of truth)
- Rewriting the daemon lifecycle or file watcher
- Changing the build tooling (Vite stays)

## Constraints

- Must stay within the existing stack: React 18, Vite 6, Tailwind CSS 3, TanStack Query 5
- Dark theme is primary (matches Linear's aesthetic and existing convention)
- Must render correctly in modern browsers (Chrome, Firefox, Safari)
- Performance: initial load under 2s, interactions under 100ms perceived latency

## Research Summary

Run `/bc:plan PHASE-02` to research this phase and populate this section.

## Recommended Approach

Run `/bc:plan PHASE-02` to research and define the approach.

## Tasks

| ID | Title | Status | Complexity |
|----|-------|--------|------------|
| - | No tasks yet | - | - |

Run `/bc:plan PHASE-02` to break down this phase into tasks.

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Design reference | Linear | Clean, fast, keyboard-first, minimal chrome, smooth animations |
| Quality bar | Shipped product | Should be indistinguishable from a real SaaS tool |
| Approach | Full implementation | Design tokens, component library, comprehensive redesign |
| Theme | Dark-first | Matches Linear aesthetic, existing convention, developer preference |

## Completion Criteria

- [ ] Every component redesigned with consistent design tokens (colors, spacing, typography, shadows)
- [ ] Layout rethought: Linear-inspired navigation, content hierarchy, information density
- [ ] Smooth animations on all state transitions (page changes, expansions, hover, loading)
- [ ] Dashboard looks like a shipped product — someone could mistake it for a real SaaS tool
- [ ] Components are reusable primitives that make future features easy to build beautifully
