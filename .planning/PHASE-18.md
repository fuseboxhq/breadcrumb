# Phase 18: Workspace Persistence & Session Restore

**Status:** not_started
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
- Auto-save must be debounced (300ms+) to avoid thrashing disk
- Restore must be non-blocking — show UI immediately, restore terminals progressively
- Handle missing/stale data gracefully (project dir deleted, etc.)
- No new dependencies needed
- All changes must pass TypeScript strict mode

## Research Summary

**Overall Confidence:** HIGH

### Current Persistence State

| Feature | Persisted? | Location |
|---------|-----------|----------|
| Terminal settings (font, cursor) | Yes | electron-store `terminal.*` |
| Panel sizes (sidebar, center, right) | Yes | electron-store `layout.panelSizes` |
| Right panel panes (browser/planning) | Yes | electron-store `layout.rightPanel` |
| Browser last URL | Yes | electron-store `browser.lastUrl` |
| Recent projects list | Yes | electron-store via projectIpc |
| **Tab state (tabs[], activeTabId)** | **No** | appStore.ts (Zustand memory) |
| **Terminal pane splits** | **No** | appStore.terminalPanes (memory) |
| **Pane CWDs & labels** | **No** | TerminalPane fields (memory) |
| **Active project** | **No** | projectsStore.activeProjectId (memory) |

### Key Files

- **appStore.ts** — Master Zustand store: `tabs: WorkspaceTab[]`, `activeTabId`, `terminalPanes: Record<string, TabPaneState>`
- **projectsStore.ts** — `projects: Project[]`, `activeProjectId`
- **settingsStore.ts** — Renderer-side settings with `loadSettings()` / `updateLayoutSetting()`
- **SettingsStore.ts** (main) — electron-store wrapper with `get()`/`set()` methods
- **settingsIpc.ts** — IPC handlers for `settings:get-all`, `settings:set`
- **AppShell.tsx** — Layout restore on mount (lines 43-77), hook-in point for session restore
- **TerminalService.ts** — `createSession()` creates PTY, `sessions` Map is in-memory only
- **TerminalInstance.tsx** — Creates xterm + PTY lazily on first stable resize

### Architecture Approach

Extend the existing electron-store persistence pattern:
1. Add a `workspace` key to the settings schema
2. On workspace changes (tab add/remove, pane split, project switch), debounce-save the snapshot
3. On startup, after settings load, restore tabs and progressively create terminal sessions
4. Terminal sessions are re-created (new PTY at saved CWD) — scrollback is lost but position is preserved

## Tasks

| ID | Title | Status | Complexity |
|----|-------|--------|------------|
| breadcrumb-uhk.1 | Define WorkspaceSnapshot type and extend electron-store schema | pending | Low |
| breadcrumb-uhk.2 | Add workspace save/load IPC channels and preload API | pending | Low |
| breadcrumb-uhk.3 | Implement auto-save: debounced workspace snapshot on state changes | pending | Medium |
| breadcrumb-uhk.4 | Implement session restore: tabs, panes, and progressive terminal creation | pending | High |
| breadcrumb-uhk.5 | Handle edge cases: stale paths, missing projects, corrupt state | pending | Medium |
| breadcrumb-uhk.6 | Integration testing and polish | pending | Medium |

### Task Details

**uhk.1 — Define WorkspaceSnapshot type and extend electron-store schema (Low)**
- Create `WorkspaceSnapshot` interface capturing: tabs, activeTabId, terminalPanes, activeProjectId
- Extend `AppSettings` type in settingsStore.ts with `workspace?: WorkspaceSnapshot`
- Add `workspace` key to electron-store schema in main process SettingsStore.ts
- Keep the type serialization-safe (no functions, no circular refs)

**uhk.2 — Add workspace save/load IPC channels and preload API (Low)**
- Add `workspace:save` and `workspace:load` IPC channels to the channel constants
- Register handlers in settingsIpc.ts (or new workspaceIpc.ts)
- `workspace:save` writes to electron-store under `workspace` key
- `workspace:load` reads from electron-store, returns `WorkspaceSnapshot | null`
- Expose via preload API: `saveWorkspace(state)`, `loadWorkspace()`

**uhk.3 — Implement auto-save: debounced workspace snapshot on state changes (Medium)**
- In appStore.ts, subscribe to relevant state changes (tabs, activeTabId, terminalPanes)
- In projectsStore.ts, subscribe to activeProjectId changes
- On any change, debounce (300ms) and call `window.breadcrumbAPI?.saveWorkspace(snapshot)`
- Build snapshot from current Zustand state: tabs array, active tab, pane structure with CWDs/labels
- Filter out transient state (zoomed pane, process detection results)

**uhk.4 — Implement session restore: tabs, panes, and progressive terminal creation (High)**
- In AppShell.tsx, after settings load, call `loadWorkspace()`
- Restore tabs array and activeTabId into appStore
- Restore activeProjectId into projectsStore
- For terminal tabs: restore pane structure, then let TerminalInstance mount normally — it will create PTY at the saved CWD
- For browser tabs: restore with saved URL (extend beyond single `lastUrl`)
- For breadcrumb/welcome tabs: restore as-is
- Show tabs immediately, terminals populate progressively as PTYs connect
- Restore right panel state (already works, just verify)

**uhk.5 — Handle edge cases: stale paths, missing projects, corrupt state (Medium)**
- Validate saved CWDs exist before restoring terminals (fall back to home dir)
- Validate saved projectIds still exist in recent projects
- Handle corrupt/partial workspace JSON gracefully (fall back to fresh state)
- Handle app crash during save (atomic write or backup)
- Clean up orphaned session IDs that don't match restored tabs

**uhk.6 — Integration testing and polish (Medium)**
- Full save/restore cycle: open tabs, split panes, restart app, verify state
- Test with multiple projects active
- Test with browser + terminal + planning tabs mixed
- Verify no duplicate terminal sessions on restore
- Verify layout persistence still works correctly alongside workspace persistence
- TypeScript strict mode pass

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Storage backend | electron-store (same as settings) | Consistent with existing patterns, no new deps |
| Save trigger | Zustand subscribe + debounce | Captures all state changes without manual save |
| Restore timing | After settings load in AppShell | Existing hook-in point, settings already loaded |
| Terminal restore | Re-create PTY at saved CWD | Can't serialize PTY state; fresh shell is sufficient |
| Scrollback | Not included (future phase) | Requires @xterm/addon-serialize, significant complexity |
| Workspace scope | Global (not per-project) | Simpler MVP; per-project isolation is a follow-up |

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

- Research: Explore agent analysis of appStore.ts, projectsStore.ts, settingsStore.ts, SettingsStore.ts, AppShell.tsx, TerminalService.ts, TerminalInstance.tsx
- Previous persistence patterns from PHASE-08, PHASE-17
