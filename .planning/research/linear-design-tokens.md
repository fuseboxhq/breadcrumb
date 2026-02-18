# Research: Linear & Vercel Design Tokens for Premium Developer Tool UI

**Date:** 2026-02-18
**Context:** PHASE-28 Premium UI Overhaul — replacing Dracula theme with Linear/Vercel-inspired dual light/dark system
**Overall Confidence:** MEDIUM-HIGH (verified core values; some values inferred from authoritative extractors)

---

## TL;DR

Linear uses a near-monochromatic gray palette with a single muted indigo accent (`#5E6AD2`), Inter as the typeface, 13-14px body text at high density, and extremely restrained use of color. Vercel uses a strictly neutral gray scale (no hue), a blue accent (`#0070F3`), and their own Geist Sans font. For Breadcrumb: use Linear's structural approach (neutral grays, single accent, 4px base radius, subtle borders) with a blue-leaning accent rather than Dracula's purple. Light mode is the default per PHASE-28 constraints.

---

## Confirmed Color Tokens

### Linear — Confirmed Hex Values

Source: dembrandt.com design token extractor (authoritative CSS extraction tool) + linear.app/brand official page.

| Token | Hex | Role |
|-------|-----|------|
| Accent / Indigo | `#5E6AD2` | Primary brand accent, interactive elements |
| Dark background | `#1D1D1F` | App background (dark mode) |
| Surface dark | `#2E2E30` | Raised surface, sidebar (dark mode) |
| Neutral gray | `#8B8B8B` | Secondary text, icons, placeholders |
| Light background | `#F7F8F8` | App background (light mode) |
| Nordic Gray | `#222326` | Dark brand color (brand docs) |
| Mercury White | `#F4F5F8` | Light brand color (brand docs) |

**Midnight theme values** (confirmed from Linear's theme changelog):

| Role | Hex |
|------|-----|
| Background | `#0F0F10` |
| Text | `#EEEFF1` |
| Surface | `#151516` |
| Accent (theme) | `#D25E65` |

**Design philosophy confirmed:** Linear generates themes in LCH color space from 3 variables (base color, accent, contrast). The default dark theme uses a near-black base with the `#5E6AD2` indigo accent. Text colors are near-white (`#EEEFF1`) not pure white.

---

### Vercel Geist — Confirmed Hex Values

Source: github.com/2nthony/vercel-css-vars (CSS variable extraction from Vercel's live site).

**Gray scale (used for surfaces, borders, text hierarchy):**

| Token | Hex | Role |
|-------|-----|------|
| `--accents-1` | `#FAFAFA` | Lightest gray, page background |
| `--accents-2` | `#EAEAEA` | Subtle surface, hover |
| `--accents-3` | `#999999` | Placeholder text |
| `--accents-4` | `#888888` | Secondary text |
| `--accents-5` | `#666666` | Muted text |
| `--accents-6` | `#444444` | Strong muted |
| `--accents-7` | `#333333` | Dark surface (dark mode hover) |
| `--accents-8` | `#111111` | Near-black, dark background |
| `--geist-white` | `#FFFFFF` | White |
| `--geist-black` | `#000000` | Black |

**Accent (blue — Vercel's primary brand):**

| Token | Hex | Role |
|-------|-----|------|
| `--geist-success-lighter` | `#D3E5FF` | Lightest blue tint |
| `--geist-success-light` | `#3291FF` | Hover/interactive blue |
| `--geist-success` | `#0070F3` | Primary blue (CTA, links) |
| `--geist-success-dark` | `#0761D1` | Active/pressed blue |

**Semantic colors:**

| Token | Hex | Role |
|-------|-----|------|
| `--geist-error` | `#EE0000` | Error/destructive |
| `--geist-error-light` | `#FF1A1A` | Error light |
| `--geist-warning` | `#F5A623` | Warning |
| `--geist-violet` | `#7928CA` | Purple accent (secondary) |
| `--geist-cyan` | `#50E3C2` | Teal/cyan accent |

**Geist uses purely achromatic grays** — no blue tint in neutrals, unlike many design systems. This is key to its premium feel.

---

## Recommended Accent Color for Breadcrumb

**Use `#5E6AD2` (Linear's indigo-blue) as the primary accent.**

Rationale:
- Confirmed as Linear's actual extracted brand accent
- Blue-leaning enough to feel "developer tool" (not too purple/Dracula)
- Sits between purple and blue — works in both light and dark modes
- PHASE-28 brief says "refined blue or blue-gray — professional, neutral, Linear-aligned"
- Alternative: Vercel's `#0070F3` — purer blue, more enterprise-feeling. Use this if the design feels too purple.

Avoid: anything from the Dracula palette (`#BD93F9` purple, `#8BE9FD` cyan) — these are the exact colors being replaced.

---

## Light Mode Palette (recommended for Breadcrumb)

Based on Linear + Vercel patterns, adapted for a neutral gray-first light theme:

| Token | Hex | Role |
|-------|-----|------|
| `--background` | `#FFFFFF` | Page/app background |
| `--background-raised` | `#FAFAFA` | Sidebar, panel backgrounds |
| `--background-overlay` | `#F5F5F5` | Hovered surfaces, input backgrounds |
| `--foreground` | `#111111` | Primary text |
| `--foreground-secondary` | `#444444` | Secondary text, labels |
| `--foreground-muted` | `#888888` | Placeholder, disabled |
| `--border` | `#E5E5E5` | Default border |
| `--border-strong` | `#D4D4D4` | Emphasized border, dividers |
| `--accent` | `#5E6AD2` | Interactive, links, active states |
| `--accent-foreground` | `#FFFFFF` | Text on accent |

These map cleanly to Vercel's accents-1 through accents-8 system.

---

## Dark Mode Palette (recommended for Breadcrumb)

Evolved from existing tokens but neutralized (remove hue from grays, reduce purple saturation):

| Token | Hex | Role |
|-------|-----|------|
| `--background` | `#0F0F10` | App background (Linear's Midnight) |
| `--background-raised` | `#1A1A1C` | Sidebar, elevated panels |
| `--background-overlay` | `#252527` | Dropdowns, modals, popovers |
| `--foreground` | `#EEEFF1` | Primary text (Linear's confirmed value) |
| `--foreground-secondary` | `#8B8B8B` | Secondary text (Linear's confirmed gray) |
| `--foreground-muted` | `#555558` | Muted/disabled text |
| `--border` | `#2E2E30` | Default border (Linear's confirmed surface) |
| `--border-strong` | `#3D3D40` | Emphasized border |
| `--accent` | `#5E6AD2` | Same accent in both modes |
| `--accent-foreground` | `#FFFFFF` | Text on accent |

**Critical change from current:** Remove the hue from the background (`228 10% 7%` → pure dark). Linear and Vercel use achromatic darks, not blue-tinted ones.

---

## Typography

### Font Choices

| Category | Font | Rationale |
|----------|------|-----------|
| UI sans-serif | Inter (keep) | Confirmed: Linear uses Inter; Vercel uses their own Geist Sans but Inter is their stated influence. Inter is the industry standard for dev tools. |
| Monospace | JetBrains Mono (keep) | Correct choice for terminal/code — no change needed |
| Display headings | Inter Display weight 600-700 | Linear added Inter Display for headings in their redesign |

The existing font stack is correct. No change needed.

### Type Scale (Linear/Vercel pattern)

Vercel's type scale uses these size points for UI: 12px, 13px, 14px, 16px, 20px, 24px.

For a dense developer tool (Linear pattern):

| Role | Size | Weight | Line Height | Usage |
|------|------|--------|-------------|-------|
| Caption / meta | 11px | 400 | 16px | Timestamps, byte counts |
| Small label | 12px | 500 | 16px | Tab labels, status badges |
| Body / default | 13px | 400 | 20px | Primary UI text (keep existing) |
| Body strong | 13px | 600 | 20px | Section headers, emphasis |
| UI label | 14px | 400 | 20px | Panel headers, button text |
| Heading small | 14px | 600 | 20px | Sidebar section titles |
| Heading medium | 16px | 600 | 24px | Modal titles, panel names |
| Heading large | 20px | 700 | 28px | Page headings, welcome screen |
| Display | 24px-32px | 700-800 | 1.2 | Marketing/onboarding only |

**Key insight:** Linear is dense at 13px body. The existing `font-size: 13px` body is correct. Letter spacing on labels: `-0.01em` to `-0.02em` for tighter optical fit at small sizes (common in Linear/Vercel UI labels).

---

## Spacing & Density

Linear is known for **higher density than most apps** — less padding than Notion or Linear's competitors. Vercel's dashboard is slightly more airy.

### Spacing Scale (8px base, 4px half-step)

| Token | Value | Usage |
|-------|-------|-------|
| `space-1` | 4px | Tight gaps, icon-to-label spacing |
| `space-2` | 8px | Default padding in dense components |
| `space-3` | 12px | Comfortable padding |
| `space-4` | 16px | Standard padding, section gaps |
| `space-5` | 20px | Generous padding |
| `space-6` | 24px | Panel/section breathing room |
| `space-8` | 32px | Major section gaps |
| `space-12` | 48px | Page-level vertical rhythm |

### Component Density (Linear pattern)

- **Sidebar items:** `py-1.5 px-2` (6px vertical, 8px horizontal) — very tight
- **Buttons (compact):** `py-1 px-3` (4px / 12px)
- **Buttons (default):** `py-1.5 px-4` (6px / 16px)
- **Input fields:** `py-2 px-3` (8px / 12px)
- **List items:** `py-2 px-3` (8px vertical) — slightly roomier than sidebar

---

## Borders & Shadows

### Border Radius

Linear uses very small radii (tight, not bubbly):

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-xs` | 3px | Badges, tags, inline chips |
| `--radius-sm` | 4px | Buttons, inputs, small cards |
| `--radius` | 6px | Cards, dropdowns, command palette |
| `--radius-lg` | 8px | Modals, panels |
| `--radius-xl` | 12px | Large overlays, sheets |

**Change from current:** Reduce from 8px base to 6px base. Linear feels tighter than current Breadcrumb.

### Shadow System

Linear and Vercel use minimal shadows — borders do most of the elevation work. Shadows are very subtle.

```css
/* Elevation system — use borders primarily, shadows sparingly */
--shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.08);         /* slight depth */
--shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.08);
--shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06);
--shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05);
--shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.1), 0 8px 10px rgba(0, 0, 0, 0.04);

/* For dark mode — increase opacity */
--shadow-sm-dark: 0 1px 3px rgba(0, 0, 0, 0.4), 0 1px 2px rgba(0, 0, 0, 0.3);
--shadow-md-dark: 0 4px 6px rgba(0, 0, 0, 0.4), 0 2px 4px rgba(0, 0, 0, 0.3);
--shadow-lg-dark: 0 10px 15px rgba(0, 0, 0, 0.5), 0 4px 6px rgba(0, 0, 0, 0.4);
```

**Remove:** Glow/neon shadows (`box-shadow: 0 0 12px hsl(purple / 0.3)`) — these are a Dracula pattern, not Linear/Vercel.

### Border Pattern

Linear uses 1px borders extensively instead of shadows for elevation:

```css
/* Light mode: very subtle borders */
border: 1px solid #E5E5E5;   /* default */
border: 1px solid #D4D4D4;   /* emphasized (hover, active) */

/* Dark mode */
border: 1px solid #2E2E30;   /* default (Linear's confirmed surface color) */
border: 1px solid #3D3D40;   /* emphasized */
```

---

## Micro-Interactions & Motion

### Transition Timing

Linear and Vercel both use:
- **Fast:** 100ms — immediate feedback (checkbox toggle, button press)
- **Normal:** 150ms — standard hover state transitions
- **Slow:** 200-250ms — enter/exit of small overlays, dropdowns
- **Panel:** 300ms — larger panel slides, sheet animations

Easing: `ease-out` for enter animations, `ease-in-out` for transforms. The existing `cubic-bezier(0.16, 1, 0.3, 1)` (expo-out) is excellent for panel slides — keep it.

### Hover States

Linear's hover pattern for interactive items:

```css
/* Light mode */
.interactive-item:hover {
  background-color: #F5F5F5;   /* subtle, barely perceptible shift */
  transition: background-color 150ms ease-out;
}

/* Dark mode */
.interactive-item:hover {
  background-color: #252527;   /* slightly lighter than surface */
  transition: background-color 150ms ease-out;
}
```

**Pattern:** Never use opacity for hover — always use a concrete background color. Opacity hovers look cheap.

### Focus Ring

Linear and Vercel both use the standard accessible pattern:

```css
:focus-visible {
  outline: 2px solid #5E6AD2;   /* accent color */
  outline-offset: 2px;
  border-radius: 4px;           /* match element radius */
  transition: outline-offset 100ms ease-out;
}
```

The existing focus ring implementation in globals.css is correct. Just update the accent color.

### Active States

```css
.button:active {
  transform: scale(0.97);   /* subtle press */
  transition: transform 80ms ease-out;
}
```

Linear uses scale(0.97) not scale(0.95) — subtlety matters.

---

## Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| Dark/light theme switching | Tailwind `dark:` class variant (already set up) | Zero flash, already configured in project |
| Gray scale generation | Use the explicit hex values from this doc | LCH generation is for dynamic theming, not static tokens |
| Shadow system | Single semantic variable per elevation level | Multiple shadow layers per variable is over-engineering |
| Accent color shades | Generate 3 variants: base, hover (+10% brightness), pressed (-10%) | Don't need a full 10-stop scale for one accent |
| Typography scale | Inter variable font with numeric weight (e.g., `font-weight: 550`) | Variable font allows fractional weights — use them |

---

## Pitfalls

### Blue-Tinted Dark Grays
**What happens:** The current system uses `228 10% 7%` (HSL with a blue hue) for backgrounds, giving a subtle blue cast. This reads as "custom/AI-generated theme" vs. professional tool.
**Avoid by:** Using achromatic darks (`#0F0F10`, `#1A1A1C`) — no hue component. Linear and Vercel both use achromatic neutrals.

### Glow Shadows on Non-Accent Elements
**What happens:** Purple glow on cards/panels makes the UI feel like a gaming app, not a developer tool.
**Avoid by:** Remove all glow shadows. Reserve glow only for the single accent color on primary CTA buttons, if used at all.

### Over-Saturated Accent
**What happens:** Using `#7928CA` (Vercel's violet) or `#BD93F9` (Dracula purple) for interactive elements creates high visual tension.
**Avoid by:** Stick to `#5E6AD2` — it's desaturated enough to be calm at 60% saturation, not 89% like Dracula purple.

### Text Contrast in Light Mode
**What happens:** Using `#888888` for secondary text on white fails WCAG AA (3.5:1 ratio, need 4.5:1 for normal text).
**Avoid by:** Use `#666666` minimum for secondary text on white. `#888888` is only safe for large text or decorative elements. For body secondary text: use `#555555` or darker.

### Transition on `all`
**What happens:** `transition: all 150ms` catches layout properties causing jank.
**Avoid by:** Always specify: `transition: color, background-color, border-color, box-shadow, opacity, transform 150ms ease-out`.

### Radius Inconsistency
**What happens:** Mixing 8px, 12px, 16px, and 20px radius values on same-level components looks accidental.
**Avoid by:** Follow the strict token hierarchy — only use `--radius-xs` through `--radius-xl`, never hardcode values.

---

## What Changes vs. Current globals.css

| Current | New | Reason |
|---------|-----|--------|
| Background: `228 10% 7%` (blue-tinted) | `#0F0F10` (achromatic) | Remove hue cast |
| Accent: `#BD93F9` (Dracula purple, 89% sat) | `#5E6AD2` (Linear indigo, 55% sat) | Calmer, more professional |
| Secondary accent: `#5EC4D8` (Dracula cyan) | Remove or use as success color only | Two accents = visual noise |
| Glow shadows | Remove entirely | Not Linear/Vercel pattern |
| Border: `228 5% 18%` | `#2E2E30` (achromatic) | Remove hue cast |
| Base radius: 8px | 6px | Tighter, more Linear-like |
| Dark only | Light default + dark toggle | PHASE-28 requirement |
| Inter Variable | Inter Variable | Keep (correct choice) |
| JetBrains Mono | JetBrains Mono | Keep (correct choice) |

---

## Open Questions

1. **Final accent decision:** `#5E6AD2` (Linear indigo) vs `#0070F3` (Vercel blue). Linear indigo is more distinctive; Vercel blue reads as more "enterprise." Recommend `#5E6AD2` but this is a subjective call. **Decide during design pass, not code.**

2. **Light mode sidebar background:** Whether sidebar should be white (`#FFFFFF`) or slightly off-white (`#FAFAFA`). Linear uses off-white; Vercel dashboard uses near-white. `#FAFAFA` is safer — white sidebar can look flat.

3. **Accent in light mode:** `#5E6AD2` on white has 4.6:1 contrast ratio — barely passes AA for normal text. Acceptable for UI elements (buttons, links) but consider `#4A58C7` (5.8:1) for any text links.

---

## Sources

**HIGH confidence (authoritative extractors and official docs):**
- dembrandt.com/explorer — Automated CSS extraction from linear.app confirming `#5E6AD2`, `#1D1D1F`, `#2E2E30`, `#8B8B8B`, `#F7F8F8`
- linear.app/brand — Official Linear brand page confirming `#F4F5F8` (Mercury White) and `#222326` (Nordic Gray)
- github.com/2nthony/vercel-css-vars — Extracted Vercel CSS variables with complete hex values
- vercel.com/geist/typography — Official Geist typography documentation

**MEDIUM confidence (community analysis, verified against multiple sources):**
- linear.app/changelog/2020-12-04-themes — Midnight theme `#0F0F10` background value
- linear.app/now/how-we-redesigned-the-linear-ui — LCH color system, three-variable approach
- linear.style — Linear style guide dark mode values (`--bg: #121212`, accent `#848CD0`)
- typ.io/s/2jmp — Linear.app Inter typography analysis (12px / 14px / 15px / 62px scale)

**LOW confidence (single-source or unverified):**
- Specific Inter Display usage for headings in Linear (mentioned in multiple articles but not confirmed with CSS extraction)
- Scale(0.97) for active button states (pattern observation, not extracted)
