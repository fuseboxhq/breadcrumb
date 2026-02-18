# Phase 28: Premium UI Overhaul & Theme System

**Status:** complete
**Beads Epic:** breadcrumb-ejz
**Created:** 2026-02-18
**Completed:** 2026-02-18

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
- Inter (sans) and JetBrains Mono (mono) fonts stay
- Must work with Electron's rendering (no browser-specific CSS that breaks in Chromium)

## Research Summary

**Overall Confidence:** HIGH

The current dark-only Dracula theme uses HSL-based CSS variables in `globals.css` with blue-tinted grays and high-saturation purple/cyan accents. Research confirmed: Linear and Vercel both use **achromatic** (no-hue) gray scales, a single muted accent, minimal shadows (borders do elevation), and CSS variable swap for theming. The existing `darkMode: "class"` + CSS variable architecture is correct and needs token replacement, not restructuring.

### Recommended Palette

**Accent:** `#5E6AD2` (Linear's indigo) — desaturated, professional, works in both modes. Light mode text links may need `#4A58C7` for AA contrast.

**Light mode:** `#FFFFFF` background, `#FAFAFA` raised surfaces, `#111111` text, `#E5E5E5` borders — achromatic Vercel pattern.

**Dark mode:** `#0F0F10` background (Linear Midnight), `#1A1A1C` raised surfaces, `#EEEFF1` text, `#2E2E30` borders — achromatic, no blue hue.

### Key Patterns

- **CSS variable swap:** `:root` = light (default), `.dark` = dark overrides. No `dark:` prefix on components using tokens.
- **FOUC prevention:** Inline `<script>` in `<head>` reads `localStorage('breadcrumb-theme')` and sets `.dark` class before React mounts.
- **Dual persistence:** localStorage (FOUC fix) + electron-store (canonical). `nativeTheme.themeSource` syncs OS chrome.
- **Borders over shadows:** 1px borders for elevation, shadows only for floating overlays.
- **Radius:** 6px base (down from 8px) — tighter, Linear-like.
- **Typography:** Keep Inter 13px body. Add `-0.01em` letter-spacing on labels.
- **Motion:** 100ms fast / 150ms normal / 200-250ms slow. Keep existing expo-out easing.

### Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| Theme provider library | Custom hook + inline `<script>` | next-themes is for SSR; Electron has no SSR |
| Per-component `dark:` prefix | CSS variable swap on `.dark` | 40+ components; central swap is cleaner |
| Gray scale generation | Explicit hex values from research | LCH generation is overkill for static tokens |
| Accent color shades | 3 variants: base, hover, pressed | No need for 10-stop scale |

### Pitfalls

- **Blue-tinted dark grays** (current `228 10% 7%`): Replace with achromatic `#0F0F10`
- **Glow shadows**: Remove entirely — not Linear/Vercel pattern
- **Text contrast in light mode**: `#888888` on white fails AA; use `#666666`+ for body text
- **`transition: all`**: Specify properties explicitly to avoid layout jank
- **Hardcoded `class="dark"`** in `index.html`: Replace with inline script
- **Git diff viewer**: Has hardcoded dark theme — needs light mode CSS block
- **Sonner toaster**: Hardcoded `theme="dark"` — bind to active theme

### Design Guidance

The `frontend-design` skill will be active during execution of UI tasks in this phase.

## Tasks

| ID | Title | Status | Complexity | Dependencies |
|----|-------|--------|------------|--------------|
| breadcrumb-ejz.1 | Design tokens & theme infrastructure | done | High | - |
| breadcrumb-ejz.2 | Shell chrome restyling (TitleBar, TabBar, StatusBar) | done | High | breadcrumb-ejz.1 |
| breadcrumb-ejz.3 | Sidebar & navigation restyling | done | Medium | breadcrumb-ejz.1 |
| breadcrumb-ejz.4 | Terminal chrome & xterm theme | done | Medium | breadcrumb-ejz.1 |
| breadcrumb-ejz.5 | Right panel, planning & diff viewer restyling | done | Medium | breadcrumb-ejz.1 |
| breadcrumb-ejz.6 | Modals, overlays, welcome view & final polish | done | High | breadcrumb-ejz.1 |

### Task Details

**breadcrumb-ejz.1 — Design tokens & theme infrastructure**
Rewrite `globals.css` with dual `:root` (light) / `.dark` (dark) palettes using achromatic grays and `#5E6AD2` accent. Update `tailwind.config.ts` token mappings. Add shadow, radius, and spacing tokens. Add inline FOUC-prevention `<script>` to `index.html`. Update CSP for `'unsafe-inline'` scripts. Add `theme` field to electron-store settings schema. Wire `nativeTheme.themeSource` sync via IPC. Create `useTheme` hook / extend settingsStore. Add theme toggle UI to StatusBar or settings. Bind Sonner `<Toaster>` to active theme. (frontend-design skill active)

**breadcrumb-ejz.2 — Shell chrome restyling (TitleBar, TabBar, StatusBar)**
Restyle TitleBar (traffic lights area, title text), TabBar (tab buttons, active indicator, hover, drag states, + button, bug button), StatusBar (background, text, git info), and AppShell layout wrapper. Apply new spacing, border, and color tokens. Ensure both light and dark modes look polished. (frontend-design skill active)

**breadcrumb-ejz.3 — Sidebar & navigation restyling**
Restyle SidebarPanel (all views: files, search, extensions, debug), TreeView (file tree, folder icons, selected/hover states), ProjectSwitcher (dropdown, project list), ExtensionsPanel, and ActivityBar icons. Apply Linear-density spacing (`py-1.5 px-2`). (frontend-design skill active)

**breadcrumb-ejz.4 — Terminal chrome & xterm theme**
Restyle TerminalPanel toolbar, pane tabs, split handles, resize handles, terminal search overlay. Create light and dark xterm.js `ITheme` objects and hot-swap on theme change. Ensure terminal readability in both modes. (frontend-design skill active)

**breadcrumb-ejz.5 — Right panel, planning & diff viewer restyling**
Restyle RightPanel container, BrowserPanel chrome (URL bar, nav buttons), DevToolsDock, PlanningPanel (markdown viewer, status indicators), and Git DiffViewer. Add `[data-theme="light"]` CSS block for diff viewer. (frontend-design skill active)

**breadcrumb-ejz.6 — Modals, overlays, welcome view & final polish**
Restyle CommandPalette (search input, results list, keyboard hints), DebugModal, ContextMenu, WelcomeView (hero, action buttons, recent projects), and toast notifications. Final pixel-level sweep across all components for consistency. Verify no regressions. (frontend-design skill active)

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Theme default | Light | User preference — matches Linear/Vercel convention |
| Theme switching | CSS class on `<html>` + CSS variable swap | `:root` light, `.dark` dark — no `dark:` prefix on components |
| FOUC prevention | Inline `<script>` in `<head>` reads localStorage | Runs before React mount, zero flash |
| Persistence | localStorage + electron-store | localStorage for FOUC, electron-store for canonical |
| OS chrome sync | `nativeTheme.themeSource` | macOS scroll bars/menus match app theme |
| Design language | Linear/Vercel | Achromatic grays, single accent, borders > shadows |
| Accent color | `#5E6AD2` (Linear indigo) | Professional, 55% saturation, works both modes |
| Base radius | 6px (down from 8px) | Tighter, more Linear-like |
| Gray system | Achromatic (no hue) | Removes "AI-generated" blue tint |
| Creative freedom | Full | No restrictions — restructure, restyle, rethink anything |

## Completion Criteria

- [x] Light theme is the default and looks premium/professional
- [x] Dark theme is available via toggle and looks equally polished
- [x] Theme preference persists across app restarts
- [x] Every visible surface (sidebar, tabs, panels, modals, toasts, toolbar) is restyled
- [x] No component looks "AI generated" — everything feels intentionally designed
- [x] Terminal chrome matches the new design language
- [x] Git diff viewer works in both themes
- [x] No functionality regressions

## Completion Notes

Phase completed on 2026-02-18. All 6 tasks finished.

Key outcomes:
- Dual light/dark theme system with CSS variable swap (`:root` = light, `.dark` = dark)
- FOUC prevention via inline `<script>` in `<head>` reading localStorage
- Theme toggle in StatusBar cycling light → dark → system
- All 20+ components migrated from Dracula/dual-accent to single `#5E6AD2` indigo accent
- Achromatic grays (no blue hue) across both themes
- Backward-compat `--dracula-*` CSS variable aliases retained in globals.css for safety
- `nativeTheme.themeSource` synced for macOS chrome matching
- Git diff viewer dynamically switches between light/dark themes
- Zero `accent-secondary` or `dracula-*` references remain in any component file

## Sources

**HIGH confidence:**
- Tailwind CSS v3 dark mode docs (https://v3.tailwindcss.com/docs/dark-mode)
- Electron nativeTheme API (https://www.electronjs.org/docs/latest/tutorial/dark-mode)
- shadcn/ui CSS variable structure (https://vercel.com/academy/shadcn-ui/exploring-globals-css)
- dembrandt.com/explorer — CSS extraction from linear.app
- github.com/2nthony/vercel-css-vars — Vercel CSS variables

**MEDIUM confidence:**
- Linear Midnight theme values (linear.app/changelog/2020-12-04-themes)
- Linear LCH color system (linear.app/now/how-we-redesigned-the-linear-ui)
- Vercel Geist theme switcher (vercel.com/geist/theme-switcher)
- FOUC prevention pattern (cruip.com/implementing-tailwind-css-dark-mode-toggle-with-no-flicker/)
