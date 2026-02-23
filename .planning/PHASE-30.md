# Phase 30: Light Mode Overhaul

**Status:** complete
**Completed:** 2026-02-20
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

**Overall Confidence:** HIGH

This is a CSS-only change. The existing theme architecture uses CSS custom properties with HSL values in `:root` (light) and `.dark` (dark). All components reference these via `hsl(var(--name))` through Tailwind utilities. The xterm.js terminal theme reads these CSS vars dynamically at runtime (`getTerminalTheme()` in `TerminalInstance.tsx`), so changing `:root` values propagates to everything automatically.

### Key Findings

**Current light palette problems:**
- Background layers: `#FFFFFF` → `#FAFAFA` → `#F5F5F5` — only 2-4% luminance steps, barely distinguishable
- All colors are pure achromatic (0 saturation) — clinical, cold
- Borders `#E6E6E6` also achromatic — no warmth
- Shadows use pure black rgba — harsh on warm surfaces
- Zero hue in any surface or text color

**Target palette direction (warm stone family):**
- Introduce 20-40 hue (yellow-amber range) with 3-8% saturation into all grays
- Background layers need 3-5% luminance steps that are *visible*
- Borders get 2-4% warm saturation
- Shadows shift from `rgba(0,0,0)` to `rgba(120,80,40)` with lower opacity for warmth
- Secondary/muted text gets slight warm undertone

**Reference colors (Tailwind stone palette as starting point):**
- `stone-50`: `#FAFAF9` (hsl 40 6% 98%) — good base background
- `stone-100`: `#F5F5F4` (hsl 60 5% 96%) — raised surface
- `stone-200`: `#E7E5E4` (hsl 20 6% 90%) — border/overlay
- `stone-300`: `#D6D3D1` (hsl 24 6% 83%) — strong border
- `stone-400`: `#A8A29E` (hsl 24 6% 64%) — muted text
- `stone-700`: `#44403C` (hsl 30 6% 25%) — secondary text
- `stone-900`: `#1C1917` (hsl 24 10% 10%) — primary text

### Design Guidance

The `frontend-design` skill will be active during execution of UI tasks in this phase. It provides guidelines for typography, color, motion, spatial composition, and avoiding generic aesthetics.

### Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| WCAG contrast checking | WebAIM contrast checker formula | Need to verify AA (4.5:1 normal text, 3:1 large/UI) |
| Color warmth guessing | Tailwind stone palette as reference | Well-tested warm neutral family |
| Shadow warmth | Brown-tinted rgba instead of pure black | `rgba(120, 80, 40, 0.06)` reads warmer than `rgba(0, 0, 0, 0.08)` |

### Pitfalls

- **Over-saturating**: Too much warmth (>10% saturation) makes grays look muddy/yellow. Stay at 3-8%.
- **Terminal readability**: ANSI colors on warm background need testing — green-on-cream can wash out.
- **Accent contrast**: Indigo `#5E6AD2` must still have sufficient contrast on warmer backgrounds (currently 3.4:1 on white — borderline for AA large text, should improve on slightly darker warm bg).
- **Selection color**: xterm selection uses `--background-overlay` + 50% alpha. Warm overlay on warm background may be invisible — needs explicit testing.
- **Bright ANSI colors**: Current bright colors are hardcoded in `FALLBACK_THEME` — may need a light-specific set for readability on warm bg.

## Recommended Approach

The overhaul is purely CSS variable changes in the `:root` block of `globals.css`, plus light-mode-specific selectors (git diff viewer, scrollbars). The xterm terminal reads CSS vars dynamically, so no component changes needed.

**However**, the xterm `FALLBACK_THEME` and bright ANSI colors are hardcoded in `TerminalInstance.tsx` — we may need to add a light-mode ANSI palette there since bright colors that work on `#0F0F0F` dark bg won't necessarily work on warm cream bg.

## Tasks

| ID | Title | Status | Complexity | Dependencies |
|----|-------|--------|------------|--------------|
| breadcrumb-m53.1 | Design warm light palette and update core CSS variables | done | High | - |
| breadcrumb-m53.2 | Warm up terminal xterm ANSI colors and selection for light mode | done | Medium | .1 |
| breadcrumb-m53.3 | Update git diff viewer, scrollbars, and focus indicators for warm palette | done | Low | .1 |
| breadcrumb-m53.4 | Verify contrast ratios and visual polish across all surfaces | done | Medium | .1 |

### Task Details

**breadcrumb-m53.1: Design warm light palette and update core CSS variables** (frontend-design skill active)
- Replace all `:root` CSS variables in `globals.css` with warm stone-family colors
- Background layers: `--background` warm off-white (~hsl 40 6% 98%), `--background-raised` (~hsl 40 5% 96%), `--background-overlay` (~hsl 30 5% 92%)
- Foreground: `--foreground` warm near-black (~hsl 24 10% 10%), `--foreground-secondary` warm dark gray (~hsl 30 6% 25%), `--foreground-muted` warm mid-gray (~hsl 24 6% 45%)
- Surface tokens: `--card`, `--popover`, `--secondary`, `--muted` — all updated with warmth
- Borders: `--border` warm gray (~hsl 20 6% 88%), `--border-strong` (~hsl 24 6% 80%)
- Input background: match `--border` for visual consistency
- Shadows: replace `rgba(0,0,0,...)` with `rgba(120,80,40,...)` at lower opacity for warmth
- Legacy dracula colors: adjust for readable contrast on warm bg
- Test across all visible surfaces: sidebar, tab bar, toolbar, status bar, modals, panels

**breadcrumb-m53.2: Warm up terminal xterm ANSI colors and selection for light mode**
- Add light-mode ANSI bright colors to `TerminalInstance.tsx` (the current hardcoded brights are for dark bg)
- Either: detect theme and swap ANSI palette, or use CSS variables for ANSI colors
- Selection background needs to be visible on warm bg — test `--background-overlay` + alpha
- Cursor color should contrast well against warm terminal bg
- Test with: colored `ls` output, git status, syntax-highlighted code, Claude Code output

**breadcrumb-m53.3: Update git diff viewer, scrollbars, and focus indicators for warm palette**
- Update `[data-component="git-diff-view"][data-theme="light"]` diff colors
- `--diff-content-bg` already references `--background` so it updates automatically, but verify add/del line overlays still read well on warm bg
- Scrollbar thumb: currently uses `--foreground-muted` at 20% — may need adjustment on warm bg
- Focus ring: uses `--ring` (accent) — verify contrast on warm surfaces

**breadcrumb-m53.4: Verify contrast ratios and visual polish across all surfaces** (frontend-design skill active)
- Manually verify WCAG AA contrast for every text/background pair:
  - `--foreground` on `--background` (need 7:1 for AAA, 4.5:1 minimum)
  - `--foreground-secondary` on `--background-raised`
  - `--foreground-muted` on `--background` (AA is 4.5:1)
  - `--accent` on `--background` (3:1 minimum for UI components)
- Test all states: hover, active, focus, disabled
- Test mixed surfaces: modal on top of sidebar, tooltip on toolbar, etc.
- Final visual pass: screenshot every major view in light mode, compare with dark mode for cohesion
- Fix any contrast failures or visual inconsistencies

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Palette family | Warm stone/cream (hue 20-40, sat 3-8%) | User preference: warm & soft, Linear/Notion inspired |
| Accent color | Keep `#5E6AD2` | Consistent brand across modes |
| Terminal warmth | Subtle cream tint via CSS vars | `getTerminalTheme()` reads CSS vars — no component changes for base colors |
| ANSI bright colors | Light-specific palette in TerminalInstance | Dark-mode brights are too vivid for light backgrounds |
| Shadow warmth | Brown-tinted rgba | `rgba(120,80,40,0.06)` instead of `rgba(0,0,0,0.08)` |
| Surface layering | 3-4% luminance steps with warmth | Current 2% achromatic steps are invisible; warm + wider steps fix both |
| Implementation | CSS variables only (+ minor xterm ANSI) | Existing architecture propagates everywhere automatically |

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

## Sources

**HIGH confidence:**
- Direct codebase audit: `globals.css` (lines 14-103), `TerminalInstance.tsx` (lines 37-113), `tailwind.config.ts`
- Tailwind CSS stone palette: well-tested warm neutral reference colors
- WCAG 2.1 AA contrast requirements: 4.5:1 normal text, 3:1 large text/UI components

**MEDIUM confidence:**
- Linear app light mode visual reference (warm gray surfaces, subtle borders)
- Notion light mode visual reference (warm off-white, soft shadows)
