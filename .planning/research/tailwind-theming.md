# Research: Tailwind CSS Light/Dark Theme System

**Date:** 2026-02-18
**Domain:** Tailwind CSS v3, CSS Variables, Electron, React/Zustand
**Overall Confidence:** HIGH

---

## TL;DR

The project already has `darkMode: "class"` configured and CSS variables in `globals.css`. The right move for Phase 28 is: keep the `.dark` class on `<html>`, redefine both `:root` (light) and `.dark` (dark) CSS variable blocks in `globals.css`, use the CSS variable approach throughout (not `dark:` prefix), persist via `electron-store` through the existing `settingsStore`, and eliminate FOUC by injecting a tiny inline `<script>` in `index.html`'s `<head>` before the Vite bundle loads.

---

## Recommended Stack

| Tool | Version | Purpose | Confidence |
|------|---------|---------|------------|
| Tailwind CSS | ^3.4.14 (existing) | Utility classes — keep as-is | HIGH |
| CSS custom properties | native | Theme token carrier — `hsl(var(--x))` pattern | HIGH |
| Zustand settingsStore | ^5.0.0 (existing) | Theme preference state | HIGH |
| electron-store | ^11.0.2 (existing) | Persistence to disk | HIGH |
| `nativeTheme.themeSource` | Electron built-in | Sync OS-level chrome with in-app theme | MEDIUM |

No new packages are needed. Everything required already exists in the project.

---

## 1. How `darkMode: "class"` Works in v3

**Verified from:** Tailwind v3 official docs

`darkMode: "class"` tells Tailwind to activate `dark:` utilities when a `.dark` class exists on any ancestor element. In practice this always goes on `<html>`.

The current `index.html` already has `<html class="dark">` hardcoded. For dual-theme support, the class becomes dynamic — set by JavaScript before React boots.

Tailwind v3 configuration is already correct:
```typescript
// tailwind.config.ts — no change needed
const config: Config = {
  darkMode: "class",
  // ...
};
```

The `.dark` class on `<html>` activates all `dark:bg-gray-900` style utilities. Without the class, the element uses the default (light) styles.

**Note on Tailwind v4:** The project is on v3 (^3.4.14). In v4, `darkMode: "class"` moves to a CSS directive (`@custom-variant dark (&:where(.dark, .dark *))`). Do not upgrade to v4 during this phase — it would require a full migration of the config file.

---

## 2. CSS Variable Approach vs. `dark:` Prefix — Which to Use

**Decision: CSS variables only. Do not use `dark:` prefix.**

### Why CSS variables win for a large design system

The project already uses this pattern: `background: "hsl(var(--background))"` in `tailwind.config.ts`. All 40+ color tokens are already CSS variables. This is the right call and should be extended, not abandoned.

**The CSS variable approach:**
```css
/* globals.css */
:root {
  /* Light theme defaults */
  --background: 0 0% 100%;
  --foreground: 0 0% 9%;
  --border: 0 0% 89%;
  /* ... all tokens */
}

.dark {
  /* Dark theme overrides */
  --background: 228 10% 7%;
  --foreground: 0 0% 95%;
  --border: 228 5% 18%;
  /* ... all tokens */
}
```

Components use semantic tokens, never hard-coded colors:
```tsx
// This works for both themes automatically — no dark: prefix
<div className="bg-background text-foreground border border-border">
```

**The `dark:` prefix approach (avoid for this system):**
```tsx
// Requires duplicating every color decision at every usage site
<div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700">
```

**Why `dark:` prefix is wrong here:**
- The project has 40+ components. Touching every `className` string is hundreds of changes.
- It duplicates the color system into component code instead of centralizing it in CSS.
- It makes the design system less portable — tokens cannot be composed.
- Linear and Vercel both use CSS variables, not `dark:` prefix, for their design systems.
- shadcn/ui (the closest architectural reference) uses the CSS variable approach exclusively.

**When `dark:` prefix IS appropriate:** One-off overrides that cannot be expressed as a token (rare edge cases), or for properties that aren't color-related (e.g., `dark:hidden`).

### Confirmed by: Linear's approach

Linear migrated to a CSS variable token system with LCH color space. Their three core variables (`base`, `accent`, `contrast`) generate the full palette. The principle is the same: centralized tokens, not per-element dark variants.

### Confirmed by: Vercel's Geist approach

Vercel uses class-based toggling (`.light-theme` / `.dark-theme` on `<html>`) with CSS variables per class. Their localStorage key is `"zeit-theme"` with values `"light"`, `"dark"`, `"system"`.

### Confirmed by: shadcn/ui

shadcn/ui (which originated this project's token structure) uses `:root` for light, `.dark` for dark, with the exact `hsl(var(--token))` pattern already in this codebase.

---

## 3. CSS Variable Structure: `:root` vs `.dark` vs `[data-theme]`

**Decision: Use `:root` for light (default), `.dark` class for dark.**

### The three patterns

**Pattern A — `:root` and `.dark` class (recommended):**
```css
:root {
  --background: 0 0% 100%;   /* light */
}
.dark {
  --background: 228 10% 7%;  /* dark override */
}
```
Advantages: Matches what `darkMode: "class"` expects. Already what shadcn/ui and the existing codebase structure assumes. Zero ambiguity about which class drives both Tailwind utilities and CSS variables.

**Pattern B — Both under `[data-theme]`:**
```css
[data-theme="light"] { --background: 0 0% 100%; }
[data-theme="dark"]  { --background: 228 10% 7%; }
```
Disadvantages: Tailwind's `dark:` prefix would not respond to this automatically (it watches `.dark`, not `[data-theme]`). Requires custom variant config or abandoning `dark:` prefix entirely. Not worth the divergence.

**Pattern C — `:root` only, overrides in media query:**
```css
:root { --background: 0 0% 100%; }
@media (prefers-color-scheme: dark) { :root { --background: 228 10% 7%; } }
```
Disadvantages: No user override capability. The system preference wins always.

**Use Pattern A.** The existing `tailwind.config.ts` uses `darkMode: "class"`, making `.dark` on `<html>` the trigger for both CSS variable overrides and Tailwind `dark:` utilities simultaneously. This is the natural fit.

### The light theme `:root` block

Since the current app is dark-only with all tokens defined in `:root`, the migration path is:

1. Move current `:root` values into `.dark` block (dark theme).
2. Define a new `:root` block with the new light theme values.
3. The `.dark` class on `<html>` drives which set is active.

---

## 4. Handling FOUC in Electron

**The FOUC problem in Electron:** When the app loads, React is not mounted yet. If the theme is determined by JavaScript after React mounts, the user sees the wrong theme for ~50-150ms before the correct class is applied.

**Electron-specific context:** Unlike a browser, Electron has no server-side rendering. The renderer process loads `index.html`, then Vite's bundle executes `main.tsx` and mounts React. The window is shown to the user before React has mounted.

### Current state: Partial solution

The current `index.html` hardcodes `class="dark"` on `<html>` and has inline CSS `background-color: #101014`. This prevents white flash for dark-only mode. When adding light mode, this breaks — the hardcoded `class="dark"` will always show dark first regardless of preference.

### The correct fix: Inline script in `<head>`

Place a synchronous script in `<head>` that reads the preference and sets the class before any CSS or JS loads:

```html
<!-- index.html -->
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <!-- ... other meta tags ... -->
    <style>
      /* Prevent flash: set both theme defaults here */
      html { background-color: #ffffff; }
      html.dark { background-color: #101014; }
    </style>
    <script>
      // This runs synchronously before the DOM paints.
      // electron-store is not accessible here — use localStorage.
      (function() {
        try {
          var theme = localStorage.getItem('breadcrumb-theme');
          if (theme === 'dark') {
            document.documentElement.classList.add('dark');
          } else if (theme === 'light') {
            document.documentElement.classList.remove('dark');
          } else {
            // 'system' or no preference — check OS
            var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            if (prefersDark) {
              document.documentElement.classList.add('dark');
            }
          }
        } catch (e) {
          // localStorage unavailable — default to light (no class)
        }
      })();
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

**Why inline `<script>` in `<head>`, not `<body>` or React:**
- Scripts in `<head>` execute synchronously before the browser paints anything
- By the time the `<body>` is rendered, the correct class is already on `<html>`
- React does not need to manage the initial class — it only manages subsequent toggles
- The Vite module bundle (`main.tsx`) is deferred — this runs before it

**Electron CSP warning:** The current CSP is `script-src 'self'`. Inline scripts require `'unsafe-inline'` or a nonce. Since this app is a local Electron app (no remote content, no XSS risk from the network), `'unsafe-inline'` is acceptable here. The existing `style-src 'self' 'unsafe-inline'` already uses `'unsafe-inline'` for styles, so this is consistent.

Updated CSP for `index.html`:
```html
<meta
  http-equiv="Content-Security-Policy"
  content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' https://fonts.gstatic.com;"
/>
```

**Alternative if CSP must be strict:** Use `nativeTheme` to set the class before the window is shown. In `createMainWindow.ts`, read from electron-store and pass the theme class via `webContents.executeJavaScript` before the window is visible. This is more complex and has a different race condition surface.

---

## 5. Persistence: localStorage vs electron-store

**Decision: Use both — localStorage for FOUC prevention, electron-store as the canonical store.**

### Why both

| Storage | Role | Timing |
|---------|------|--------|
| `localStorage` | Fast inline script reads theme before React mounts — prevents FOUC | Synchronous, before any JS loads |
| `electron-store` | Canonical persistence, survives profile wipes, accessible from main process | Async IPC, after React mounts |

The existing `settingsStore.ts` in the renderer already reads from electron-store via IPC. Add `theme: 'light' | 'dark' | 'system'` to `AppSettings`.

### Write path on theme change

When the user toggles theme in the UI:
1. Update `document.documentElement.classList` immediately (no flash)
2. Write to `localStorage.setItem('breadcrumb-theme', theme)` (FOUC prevention for next load)
3. Call `window.breadcrumbAPI.setSetting('theme', theme)` (canonical persistence)
4. Call `window.breadcrumbAPI.setNativeTheme(theme)` to sync `nativeTheme.themeSource`

### Read path on startup

1. Inline `<script>` in `<head>` reads `localStorage` and sets `.dark` class before React mounts
2. React mounts; `settingsStore.loadSettings()` runs and fetches from electron-store
3. If electron-store disagrees with localStorage (edge case: profile wipe), reconcile by applying electron-store value and updating localStorage

### electron-store schema addition

```typescript
// In main/settings/SettingsStore.ts
export interface AppSettings {
  // ...existing fields...
  theme: 'light' | 'dark' | 'system';
}

// In schema:
theme: {
  type: "string" as const,
  enum: ["light", "dark", "system"],
  default: "light",
}
```

---

## 6. nativeTheme Integration

`nativeTheme.themeSource` controls Electron's OS-level dark mode. This affects:
- Native OS chrome elements (menus, dialogs, file pickers, scroll bars on macOS)
- The CSS `prefers-color-scheme` media query inside the renderer

**Set it in the main process when theme changes:**

```typescript
// In settingsIpc.ts — add a new handler
ipcMain.handle('theme:set', (_, theme: 'light' | 'dark' | 'system') => {
  nativeTheme.themeSource = theme;
  return { success: true };
});
```

**Expose it via preload:**
```typescript
// In preload/index.ts
setNativeTheme: (theme: 'light' | 'dark' | 'system') =>
  ipcRenderer.invoke('theme:set', theme),
```

**Why this matters:** Without `nativeTheme.themeSource`, the macOS title bar, scroll bars, and system dialogs will stay dark even when the app UI switches to light mode. This looks broken.

---

## 7. Theme Toggle React Pattern

Use a dedicated hook that is the single source of truth for toggling:

```typescript
// src/renderer/hooks/useTheme.ts
// Source: Derived from project patterns + research above

export type Theme = 'light' | 'dark' | 'system';

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    // Initialize from localStorage (already applied by inline script)
    return (localStorage.getItem('breadcrumb-theme') as Theme) ?? 'light';
  });

  const setTheme = useCallback(async (newTheme: Theme) => {
    const isDark =
      newTheme === 'dark' ||
      (newTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    // 1. Apply immediately to DOM
    document.documentElement.classList.toggle('dark', isDark);

    // 2. Persist to localStorage (for next-load FOUC prevention)
    localStorage.setItem('breadcrumb-theme', newTheme);

    // 3. Persist to electron-store (canonical)
    await window.breadcrumbAPI.setSetting('theme', newTheme);

    // 4. Sync native OS chrome
    await window.breadcrumbAPI.setNativeTheme(newTheme);

    setThemeState(newTheme);
  }, []);

  return { theme, setTheme };
}
```

Integrate into `settingsStore` using the existing Zustand pattern rather than a separate hook — this keeps theme preference alongside other settings and benefits from the existing IPC plumbing.

---

## 8. Sonner Toaster Theme Binding

The `App.tsx` hardcodes `theme="dark"` on the `<Toaster>`. When light mode is active, this will show dark toast styling incorrectly.

Bind it to the active theme:

```tsx
// In App.tsx
const theme = useThemeStore((s) => s.theme);
const resolvedTheme = theme === 'system'
  ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  : theme;

<Toaster theme={resolvedTheme} ... />
```

---

## Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| CSS variable color generation | Stick with `hsl(var(--x))` pattern already in use | Already works; don't add a color library |
| Theme provider library (next-themes, etc.) | Custom hook + inline script | next-themes is built for SSR; Electron has no SSR, adds unnecessary abstraction |
| Per-component `dark:` class toggling | CSS variable swap on `.dark` | 40+ components would each need changes; CSS variables swap everything at once |
| `window.matchMedia` listener complexity | Single `useEffect` on system theme | Only needed for `system` preference mode |

---

## Pitfalls

### Pitfall 1: Hardcoded `class="dark"` in index.html
**What happens:** After adding light mode, the user always sees dark theme on first render, then it flashes to light.
**Avoid by:** Remove the hardcoded `class="dark"`. Let the inline `<script>` set it dynamically. The `<style>` block in `<head>` handles the background color for both themes before JS runs.

### Pitfall 2: Not syncing `nativeTheme.themeSource`
**What happens:** macOS scroll bars, title bar text, and system menus stay dark when app UI is light. Looks broken on macOS.
**Avoid by:** Call `nativeTheme.themeSource = theme` in the main process whenever theme changes. Add it to the settings IPC layer.

### Pitfall 3: localStorage key collision
**What happens:** If another Electron app on the same machine uses `localStorage.setItem('theme', ...)`, preferences bleed across apps. Electron partitions storage by app by default, but worth using a namespaced key.
**Avoid by:** Use `'breadcrumb-theme'` as the localStorage key, not generic `'theme'` or `'dark-mode'`.

### Pitfall 4: Transition flash on initial page load
**What happens:** CSS `transition` on `background-color` causes an animated flash from default to actual theme on load.
**Avoid by:** Suppress transitions during initial mount. Add a `no-transitions` class to `<html>` in the inline script, remove it after first paint:
```javascript
document.documentElement.classList.add('no-transitions');
// ... set theme class ...
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    document.documentElement.classList.remove('no-transitions');
  });
});
```
And in CSS: `.no-transitions * { transition: none !important; }`

### Pitfall 5: Tailwind `dark:` prefix on components that use CSS variables
**What happens:** If someone adds `dark:bg-gray-900` to a component that also uses `bg-background` (which is already a CSS variable), they get conflicting/doubled rules.
**Avoid by:** Enforce a rule: no `dark:` prefix on any component using CSS variable tokens. Reserve `dark:` only for edge cases that cannot be expressed as tokens (e.g., `dark:hidden`).

### Pitfall 6: electron-store `theme` field missing from existing settings
**What happens:** Old settings files without `theme` key will load as `undefined`, not the default `'light'`. The schema default handles this if specified correctly.
**Avoid by:** Set `default: "light"` in the electron-store schema for the `theme` field.

### Pitfall 7: Git diff viewer hardcoded dark theme
**What happens:** The diff viewer has `[data-component="git-diff-view"][data-theme="dark"]` hardcoded in `globals.css`. It will look wrong in light mode.
**Avoid by:** Add a `[data-component="git-diff-view"][data-theme="light"]` block to `globals.css` with appropriate light palette values during the diff viewer styling pass.

---

## Open Questions

1. **System theme change while app is open:** If the user is on `'system'` preference and changes their OS theme while the app is running, should the app respond in real time? Requires a `window.matchMedia` event listener. Not clearly required by Phase 28 spec — probably yes for polish, but needs a decision.

2. **xterm.js terminal theme:** xterm.js has its own color scheme config (the `theme` option passed to `Terminal`). Switching the app theme needs to update the xterm color scheme too. This requires passing new theme options to existing terminal instances, which may require destroying and recreating them or using `terminal.options.theme = ...`. Verify whether xterm supports hot-swapping theme in v5.

3. **Accent color for light theme:** The Phase 28 spec leaves this as TBD. The existing `--primary: 265 89% 78%` (Dracula purple) works for dark mode but is too light for light mode backgrounds. A darker purple (e.g., `265 89% 60%`) or a shift to blue will be needed for sufficient contrast in light mode.

---

## Sources

**HIGH confidence (official docs, verified):**
- Tailwind CSS v3 dark mode docs: https://v3.tailwindcss.com/docs/dark-mode
- Tailwind CSS dark mode (current): https://tailwindcss.com/docs/dark-mode
- Electron nativeTheme API: https://www.electronjs.org/docs/latest/tutorial/dark-mode
- shadcn/ui CSS variable structure: https://vercel.com/academy/shadcn-ui/exploring-globals-css

**MEDIUM confidence (official but inspected/scraped):**
- Vercel Geist theme switcher implementation: https://vercel.com/geist/theme-switcher
- Linear UI redesign — LCH color system and CSS variable approach: https://linear.app/now/how-we-redesigned-the-linear-ui
- FOUC prevention with inline head script: https://cruip.com/implementing-tailwind-css-dark-mode-toggle-with-no-flicker/
- Tailwind v4 CSS variable dark mode discussion: https://github.com/tailwindlabs/tailwindcss/discussions/15083

**LOW confidence (search results, not deeply verified):**
- Tailwind v4 migration: darkMode moves from JS config to `@custom-variant` CSS directive (not relevant until v4 upgrade)
