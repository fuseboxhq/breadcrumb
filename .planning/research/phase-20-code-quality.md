# Phase 20 Research: Code Quality & Codebase Health Review

**Date:** 2026-02-14
**Confidence:** HIGH — this is a codebase audit, no external research needed

## Audit Findings Summary

Full-codebase audit across main process, preload, renderer, shared types, and config.

### 1. Dead Code & Unused Exports

| File | Issue |
|------|-------|
| `src/shared/types/planned.ts` (273 lines) | Large file of planned types — many may be unused |
| `src/main/extensions/types.ts` | Several exported interfaces only used within extensions module (ContributedView, ContributedViewContainer, ContributedConfiguration, ContributedKeybinding) — not imported elsewhere |
| `src/main/git/GitService.ts:6` | `GitProvider` type exported but never imported outside this file |
| `src/renderer/components/tabs/TabBar.tsx` | `browser` and `breadcrumb` icon mappings in TAB_ICONS — documented as "no longer used in center" |
| `src/renderer/store/appStore.ts` | `icon?: string` on WorkspaceTab — never populated or used |

### 2. Type Safety Issues

| File | Issue |
|------|-------|
| `src/main/extensions/ExtensionManager.ts:275,280` | `as Record<string, unknown>` casts for manifest parsing — should use type guards |
| `src/main/extensions/extensionHostWorker.ts:133` | `globalThis as Record<string, unknown>` — should use proper type augmentation |
| `src/preload/index.ts:65` | Settings typed as `Record<string, unknown>` — should use AppSettings |
| `src/preload/index.ts:73` | Planning phase detail typed as `Record<string, unknown> \| null` — should use PhaseDetail |
| `src/preload/index.ts:74` | Beads tasks typed as `Array<Record<string, unknown>>` — should use BeadsTask[] |
| `src/renderer/components/extensions/ExtensionsPanel.tsx:25` | `capabilities: Record<string, unknown>` — too loose |

### 3. Duplicated Logic

| Pattern | Locations | Fix |
|---------|-----------|-----|
| `folderName()` / `folderFromCwd()` | SidebarPanel.tsx, TerminalPanel.tsx, appStore.ts | Extract to shared utility |
| ResizeObserver with rAF throttling | BrowserPanel.tsx, DevToolsDock.tsx (identical), TerminalInstance.tsx (no throttling) | Extract to shared hook |
| IPC `{ success, error }` try/catch pattern | browserIpc.ts (22x), terminalIpc.ts, settingsIpc.ts, handlers.ts, projectIpc.ts | Extract wrapper function |
| Event subscription cleanup pattern | BrowserPanel.tsx, TerminalInstance.tsx, App.tsx | Already consistent enough — low priority |

### 4. Inconsistent Patterns

| Category | Issue |
|----------|-------|
| Event handler naming | Mix of `cleanup`, `unsubscribe`, unnamed returns across components |
| Loading state | Sometimes local useState, sometimes Zustand store — no clear guideline |
| Collapsed/expanded naming | `collapsed` vs `open` for same concept |
| Error handling in renderer | BrowserPanel has error UI, PlanningPanel has ErrorAlert, Terminal prints to buffer — different patterns |

### 5. Overly Complex Code

| File | Lines | Issue |
|------|-------|-------|
| `src/renderer/components/sidebar/SidebarPanel.tsx:376-443` | 67 lines | Terminal tree-building logic — deeply nested, should extract |
| `src/renderer/components/terminal/TerminalPanel.tsx:154-216` | 62 lines | Single keyboard handler with 8+ keybinds — should decompose |
| `src/renderer/components/planning/PlanningPanel.tsx:514-734` | 220 lines | PhaseDetailView renders 7+ sections — should split |
| `src/renderer/components/command/CommandPalette.tsx:90-264` | 174 lines | 23 hardcoded command definitions inline — should extract |
| `src/main/terminal/TerminalService.ts` | 671 lines | Large service class — acceptable for now |
| `src/main/planning/PlanningService.ts` | 479 lines | Large but well-structured — acceptable |

### 6. TODO/FIXME/HACK Comments

| File | Issue |
|------|-------|
| `src/renderer/components/terminal/TerminalInstance.tsx:129-132` | Fragile settingsRef pattern documented but not marked |
| `src/renderer/components/terminal/TerminalPanel.tsx:73-75` | Race condition fix documented but no formal marker |
| `src/renderer/components/browser/BrowserPanel.tsx:178-181` | WebContentsView off-screen workaround — architectural debt |
| `src/renderer/components/layout/AppShell.tsx:99` | DevTools always starts closed — intentional but uncommented |

### 7. IPC Channel Pattern

The IPC handlers follow a consistent `{ success: boolean, error?: string }` pattern, but it's repeated manually ~40 times across 6 files. A wrapper like `wrapIpcHandler` would eliminate boilerplate while preserving the pattern.

### 8. Store Architecture

`appStore.ts` manages tabs, panes, layout, sidebar view, and workspace persistence in one store. While Zustand supports this, it's becoming a "god object." However, splitting it is architectural restructuring (out of scope). The moderate approach: keep the store unified but ensure internal organization is clean.

## Recommended Task Breakdown

1. **Dead code & unused types removal** — Safest changes, no behavior impact
2. **Type safety hardening** — Replace Record<string, unknown> with proper types, remove unsafe casts
3. **Extract shared utilities** — folderName, ResizeObserver hook, IPC handler wrapper
4. **Simplify complex components** — Extract command definitions, break down large render functions
5. **Standardize patterns & clean up comments** — Naming conventions, TODO resolution
6. **Final verification** — TypeScript check, manual testing
