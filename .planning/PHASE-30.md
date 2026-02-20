# Phase 30: Light Mode Overhaul

**Status:** not_started
**Beads Epic:** breadcrumb-m53
**Created:** 2026-02-20

## Objective

The current light mode is blindingly white — pure `#FFFFFF` background with barely-there `#FAFAFA` raised surfaces. There's almost zero visual layering or warmth. This phase is a full overhaul of the light theme to create a warm, soft, premium feel inspired by Linear and Notion's light modes. The result should feel like a completely different (better) app in light mode while maintaining the same design language as the polished dark mode.

## Scope

**In scope:**
- Rethink all light mode CSS variables: backgrounds, surfaces, borders, text colors, shadows
- Warm off-white/cream base palette (stone/warm gray family instead of pure achromatic)
- Distinct surface layering: background → raised → overlay should be visually obvious
- Warmer terminal background (subtle cream tint, not harsh white)
- Warmer xterm.js light theme colors (cursor, selection, ANSI palette)
- Updated shadows with warm tones (not pure black)
- Border colors with warmth (not pure gray)
- Git diff viewer light theme update
- Scrollbar styling for light mode
- All modal/dialog/overlay surfaces
- Sidebar, tab bar, status bar, toolbar surfaces
- Input fields, buttons, and interactive element states

**Out of scope:**
- Dark mode changes (it's already good)
- Accent color changes (keeping indigo `#5E6AD2`)
- Component layout or structural changes
- New components or features
- Typography changes (Inter + JetBrains Mono stay)

## Constraints

- Frontend design skill active — follow design thinking process for UI tasks
- Must only modify CSS variables in `:root` block of `globals.css` (and any light-mode-specific selectors)
- Dark mode (`.dark` class) must remain completely untouched
- All existing AA contrast ratios must be maintained or improved
- Accent color `#5E6AD2` stays the same across both modes
- Follow existing CSS variable architecture — no structural changes to the theme system
- Terminal readability is paramount — warm tint must be subtle enough for code

## Inspiration

- **Linear light mode**: Clean warm grays, subtle borders, premium layered surfaces
- **Notion light mode**: Warm off-white, soft shadows, approachable and content-focused
- Warm stone/cream palette family (think `stone-50` to `stone-200` range in Tailwind)

## Research Summary

Run `/bc:plan PHASE-30` to research this phase and populate this section.

## Recommended Approach

The overhaul is purely CSS variable changes in the `:root` block of `globals.css`, plus any light-mode-specific selectors (git diff viewer, scrollbars). No component code changes needed — the existing CSS variable architecture means changing the variables automatically updates the entire app.

Key color direction:
- Base background: warm off-white like `#FAF9F7` or `#FAFAF8` (slight yellow/stone warmth)
- Raised surfaces: slightly cooler warm like `#F5F4F2` (visible layer separation)
- Overlay/hover: `#EFEEE C` range
- Borders: warm gray like `#E4E2DF` instead of pure `#E6E6E6`
- Shadows: use `rgba(0, 0, 0, 0.04)` with warm undertone instead of pure black
- Text: keep near-black primary, but warm up secondary/muted text slightly

## Tasks

| ID | Title | Status | Complexity |
|----|-------|--------|------------|
| - | No tasks yet | - | - |

Run `/bc:plan PHASE-30` to break down this phase into tasks.

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Palette family | Warm stone/cream | User preference: warm & soft, Linear/Notion inspired |
| Accent color | Keep `#5E6AD2` | Consistent brand across modes |
| Terminal warmth | Subtle cream tint | User wants warm terminal, but code readability comes first |
| Implementation | CSS variables only | Existing architecture supports full theme swap via `:root` vars |
| Scope | Full overhaul | Every surface, border, shadow rethought for warmth |

## Completion Criteria

- [ ] Light mode feels warm, soft, and premium — not blindingly white
- [ ] Clear visual layering between background, raised surfaces, and overlays
- [ ] Terminal is subtly warm but code remains perfectly readable
- [ ] All surfaces (sidebar, tabs, modals, toolbars) feel cohesive
- [ ] Shadows have warmth — not pure black rgba
- [ ] Borders are warm gray, not cold/achromatic
- [ ] Git diff viewer light theme matches the warm palette
- [ ] AA contrast ratios maintained for all text/background combinations
- [ ] Dark mode is completely unchanged
