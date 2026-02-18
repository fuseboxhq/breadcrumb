# Phase 28: Premium UI Overhaul & Theme System

**Status:** not_started
**Beads Epic:** breadcrumb-ejz
**Created:** 2026-02-18

## Objective

Strip the current Dracula-based dark theme and replace it with a premium, Linear/Vercel-inspired design system that supports both light and dark modes. Light theme is the default. The overhaul covers every surface — color palette, typography, spacing, component structure, layout density, and motion — to eliminate the "AI-generated" aesthetic and deliver a polished, professional developer tool that feels intentionally designed.

## Scope

**In scope:**
- New dual-theme design system (light default, dark toggle) with CSS variables
- Complete color palette redesign — neutral grays, single refined accent color, semantic colors
- Typography audit and refinement (size scale, weight hierarchy, line heights)
- Spacing and density pass across all components (Linear-style generous whitespace)
- Component restructuring where needed for visual cohesion
- Theme toggle UI + persistence in settings store
- TabBar, sidebar, toolbar, command palette, modals, panels — every surface
- Terminal chrome (toolbar, pane tabs, split handles) restyling
- Status bar, title bar, breadcrumb panel, right panel styling
- Git diff viewer theme support for both modes
- Toast/notification styling for both themes
- Border, shadow, and elevation system overhaul
- Motion/animation refinement (subtle, not flashy)
- Welcome view redesign

**Out of scope:**
- xterm.js terminal rendering internals (color schemes can change, but no custom renderer)
- New features or functionality — this is purely visual/structural
- Extension marketplace UI (doesn't exist yet)
- Mobile/responsive layouts (desktop Electron app)

## Constraints

- Frontend design skill active — follow design thinking process for UI tasks
- Must maintain all existing functionality — no regressions
- Tailwind CSS stays as the styling framework
- CSS variables remain the theming mechanism (already well-structured)
- `darkMode: "class"` already in Tailwind config — leverage it
- Inter (sans) and JetBrains Mono (mono) fonts stay unless research finds better alternatives
- Must work with Electron's rendering (no browser-specific CSS that breaks in Chromium)

## Research Summary

Run `/bc:plan PHASE-28` to research this phase and populate this section.

## Recommended Approach

**Design system first, then sweep.** Build the new theme tokens (light + dark palettes, spacing scale, shadow system, border system) in CSS variables, then systematically restyle every component group. Theme toggle wired into settings with persistence. Each task targets a component group to keep PRs reviewable.

Accent color recommendation: a refined blue or blue-gray — professional, neutral, Linear-aligned. Final decision during planning research.

## Tasks

| ID | Title | Status | Complexity |
|----|-------|--------|------------|
| - | No tasks yet | - | - |

Run `/bc:plan PHASE-28` to break down this phase into tasks.

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Theme default | Light | User preference — matches Linear/Vercel convention |
| Theme switching | CSS class on `<html>` + Tailwind `dark:` variants | Already configured (`darkMode: "class"`), zero-JS flash |
| Design language | Linear/Vercel | Clean, minimal, lots of whitespace, subtle borders, neutral palette |
| Accent color | TBD during planning | Will be chosen to complement both light and dark palettes |
| Creative freedom | Full | No restrictions — restructure, restyle, rethink anything needed |

## Completion Criteria

- [ ] Light theme is the default and looks premium/professional
- [ ] Dark theme is available via toggle and looks equally polished
- [ ] Theme preference persists across app restarts
- [ ] Every visible surface (sidebar, tabs, panels, modals, toasts, toolbar) is restyled
- [ ] No component looks "AI generated" — everything feels intentionally designed
- [ ] Terminal chrome matches the new design language
- [ ] Git diff viewer works in both themes
- [ ] No functionality regressions
