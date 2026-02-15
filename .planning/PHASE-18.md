# Phase 18: Workspace Persistence & Session Restore

**Status:** in_progress
**Beads Epic:** breadcrumb-uhk
**Created:** 2026-02-14

## Objective

Save and restore the full workspace state across app restarts — open terminal tabs, pane splits, working directories, active project, browser URLs, and tab order. When the user relaunches Breadcrumb, they should pick up exactly where they left off, with all terminals, browsers, and layout intact (minus live PTY scrollback history, which requires a follow-up phase).

## Scope

**In scope:**
- Persist open tabs (terminal, browser, breadcrumb, welcome) with their order and metadata
- Persist active tab selection
- Persist terminal pane structure per tab (splits, directions, active pane)
- Persist per-pane working directory and custom labels
- Persist active project selection
- Restore terminal sessions on launch (re-create PTY processes at saved CWDs)
- Restore browser tabs to their saved URLs
- Restore right panel pane configuration (already partially done)
- Auto-save workspace state on changes (debounced)
- Graceful handling of stale state (missing directories, changed projects)

**Out of scope:**
- Terminal scrollback history persistence (requires `@xterm/addon-serialize`, separate phase)
- Per-project workspace isolation (multiple independent workspace states)
- Workspace switching UI (save/load named workspaces)
- Cloud sync of workspace state
- Running process restoration (can't resume a `node` process)
- Editor file tabs (no editor yet)

## Constraints

- Use electron-store for persistence (same as existing settings)
- Follow existing IPC patterns (preload API → ipcMain handler → store)
- Auto-save must be debounced (300ms) to avoid thrashing disk
- Restore must be non-blocking — show UI immediately, restore terminals progressively
- Handle missing/stale data gracefully (project dir deleted, etc.)
- No new dependencies needed
- All changes must pass TypeScript strict mode

## Research Summary

**Overall Confidence:** HIGH

Use the existing `persistLayout` pattern (300ms debounced timeout → IPC → electron-store). electron-store handles atomic writes. Extend the schema by adding a `workspace` top-level key alongside `terminal`, `layout`, and `browser`. Restored terminals follow the existing lazy PTY creation flow (mount → resize → create PTY at saved CWD) with no changes to TerminalInstance needed.

### Recommended Stack

| Library | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| electron-store | (installed) | Persistent storage | HIGH |
| zustand + immer | (installed) | Renderer state management | HIGH |

No new dependencies needed.

### Key Patterns

**Debounced save** — Copy the `persistLayout` pattern (appStore.ts:185-202): module-scoped timeout, helper function accepting a getter, 300ms debounce, `window.breadcrumbAPI.setSetting()` for IPC. Call from relevant Zustand actions (addTab, removeTab, addPane, etc.) — NOT from Zustand subscribe.

**Progressive restore** — In AppShell.tsx settingsLoaded useEffect (line 43-77), call `restoreWorkspace()` BEFORE `requestAnimationFrame`. Tabs mount with correct state, TerminalInstance creates PTYs lazily at saved CWDs via existing ResizeObserver flow.

**Fresh sessionIds** — Don't persist `sessionId` values. Restore tab IDs and CWDs, generate fresh `sessionId` per pane on restore (`${tabId}-${Date.now()}`). Stale sessionIds cause IPC collisions.

### Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| Zustand subscribe + debounce | Debounced function from actions | Simpler, no subscription leaks, existing pattern |
| Custom JSON file writes | electron-store | Atomic writes, schema validation, OS-specific paths |
| Eager PTY creation on restore | Lazy creation via ResizeObserver | Avoids dimension mismatches, existing flow handles it |

### Pitfalls

- **Schema defaults critical** — Forgetting `default: {}` on new schema keys causes `undefined.tabs.map()` crashes
- **Don't persist sessionIds** — Old sessionIds reference dead PTYs, cause IPC handler collisions
- **Before-quit flush** — 300ms debounce timeout may not fire if app quits; add `before-quit` handler to flush pending writes
- **Tab ID collisions on restore** — Use saved `tabId` values (like `terminal-1234`); only regenerate `sessionId`

## Tasks

| ID | Title | Status | Complexity | Dependencies |
|----|-------|--------|------------|--------------|
| breadcrumb-uhk.1 | Define WorkspaceSnapshot type and extend electron-store schema | done | Low | - |
| breadcrumb-uhk.2 | Implement debounced workspace auto-save from Zustand actions | done | Medium | uhk.1 |
| breadcrumb-uhk.3 | Implement workspace restore on app startup | done | High | uhk.1 |
| breadcrumb-uhk.4 | Handle edge cases: stale paths, missing projects, before-quit flush | open | Medium | uhk.3 |
| breadcrumb-uhk.5 | Integration testing and TypeScript verification | open | Medium | uhk.4 |

### Task Details

**uhk.1 — Define WorkspaceSnapshot type and extend electron-store schema (Low)**
Create serialization-safe `WorkspaceSnapshot` interface:
- `tabs: SerializedTab[]` — tab ID, type, title, projectId (no functions)
- `activeTabId: string | null`
- `terminalPanes: Record<string, SerializedTabPaneState>` — panes with CWD, customLabel, splitDirection (no sessionId, no processName)
- `activeProjectId: string | null`

Files to modify:
- `desktop/src/renderer/store/appStore.ts` — Add `WorkspaceSnapshot` and `SerializedTab`/`SerializedTabPaneState` types
- `desktop/src/main/settings/SettingsStore.ts` — Add `workspace` key to schema with `default: {}`
- `desktop/src/renderer/store/settingsStore.ts` — Extend `AppSettings` interface with `workspace?: WorkspaceSnapshot`

**uhk.2 — Implement debounced workspace auto-save (Medium)**
Copy the `persistLayout` pattern:
- Add `persistWorkspace` function (module-scoped timeout, 300ms debounce)
- Call from tab/pane mutation actions: `addTab`, `removeTab`, `setActiveTab`, `addPane`, `removePane`, `updatePaneCwd`, `setPaneCustomLabel`
- Build snapshot from `get().tabs`, `get().terminalPanes`, `get().activeTabId`
- Also persist `activeProjectId` from projectsStore (call `persistWorkspace` from `setActiveProject`)
- Filter out transient fields: `processName`, `processLabel`, `lastActivity`, `claudeInstanceNumber`
- Use `window.breadcrumbAPI?.setSetting("workspace", snapshot)` — reuse existing IPC, no new channels needed

**uhk.3 — Implement workspace restore on app startup (High)**
In AppShell.tsx settingsLoaded useEffect:
- Read workspace from `settingsStore` (loaded alongside all other settings)
- Add `restoreWorkspace(snapshot)` action to appStore:
  - Restore `tabs` array with saved tab metadata
  - Restore `activeTabId`
  - Restore `terminalPanes` with fresh `sessionId` per pane (`${tabId}-${Date.now()}`)
  - Keep saved `cwd` and `customLabel` per pane
- Restore `activeProjectId` in projectsStore
- Terminal tabs: TerminalInstance mounts → ResizeObserver → lazy PTY creation at saved CWD
- Browser tabs: pass saved URL as `initialUrl` prop (extend BrowserPanel if needed)
- If no saved workspace, fall back to current default (welcome tab)

**uhk.4 — Handle edge cases (Medium)**
- Validate saved CWDs exist before restore (fall back to project root or home dir)
- Validate saved `activeProjectId` still exists in recent projects
- Handle corrupt/partial workspace JSON (fall back to fresh state)
- Add `before-quit` handler in main process to synchronously flush pending workspace writes
- Handle the case where all saved projects were removed (restore welcome tab)

**uhk.5 — Integration testing and TypeScript verification (Medium)**
- Full save/restore cycle: tabs + splits + CWDs + restart
- Test with multiple projects active
- Test with browser + terminal + planning tabs mixed
- Verify no duplicate sessions on restore
- Verify layout persistence still works alongside workspace persistence
- `tsc --noEmit` passes clean

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Storage backend | electron-store `workspace` key | Consistent with existing patterns, no new deps |
| Save trigger | Debounced function from Zustand actions | Existing `persistLayout` pattern, no subscription leaks |
| IPC approach | Reuse existing `settings:set` channel | No new IPC channels needed; `setSetting("workspace", ...)` works |
| Restore timing | AppShell settingsLoaded useEffect | Existing hook-in point, before component mount |
| Terminal restore | Re-create PTY at saved CWD | Can't serialize PTY state; lazy creation handles it |
| SessionId handling | Generate fresh on restore | Stale IDs cause IPC collisions; CWD is what matters |
| Scrollback | Not included (future phase) | Requires @xterm/addon-serialize, significant complexity |
| Workspace scope | Global (not per-project) | Simpler MVP; per-project isolation is a follow-up |
| Quit safety | `before-quit` handler flushes writes | 300ms debounce may not fire before process exits |

## Completion Criteria

- [ ] App restarts with all previously open terminal tabs restored
- [ ] Terminal pane splits and directions are preserved
- [ ] Each terminal pane opens in its previously saved working directory
- [ ] Active tab selection is preserved across restart
- [ ] Active project is preserved across restart
- [ ] Browser tabs restore to their saved URLs
- [ ] Workspace state auto-saves on every meaningful change (debounced)
- [ ] Missing directories fall back gracefully (no crash, no blank screen)
- [ ] TypeScript strict mode passes with no errors

## Sources

**HIGH confidence:**
- `.planning/research/phase-18-workspace-persistence.md` — full implementation research
- Codebase: appStore.ts, settingsStore.ts, SettingsStore.ts, AppShell.tsx, TerminalInstance.tsx
- [electron-store docs](https://github.com/sindresorhus/electron-store) — schema, atomic writes

**MEDIUM confidence:**
- Zustand docs — subscribe patterns (not used, in favor of existing debounce)
