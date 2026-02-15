# Research: Workspace/Session Persistence

**Date:** 2026-02-15
**Domain:** Electron desktop app persistence (electron-store + Zustand)
**Overall Confidence:** HIGH

## TL;DR

Use the existing `persistLayout` pattern (300ms debounced timeout → IPC → electron-store). electron-store handles atomic writes automatically, so no crash-safety concerns. Extend the existing schema by adding a `workspace` top-level key alongside `terminal`, `layout`, and `browser`. Restored terminals can follow the existing lazy PTY creation flow (mount → resize → create PTY at saved CWD).

## Recommended Stack

| Library | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| electron-store | 11.0.2 | Persistent storage (already in use) | HIGH |
| zustand | 5.0.0 | Renderer state (already in use) | HIGH |
| zustand/middleware/immer | - | Immutable state updates | HIGH |

**Already installed** — no new dependencies needed.

## Key Patterns

### 1. Schema Extension (electron-store)

**Current pattern** (SettingsStore.ts lines 40-106):
```typescript
export interface AppSettings {
  terminal: TerminalSettings;
  layout: LayoutSettings;
  browser: BrowserSettings;
  // ADD: workspace: WorkspaceSettings;
}

const schema = {
  terminal: { type: "object", properties: {...}, default: {} },
  layout: { type: "object", properties: {...}, default: {} },
  browser: { type: "object", properties: {...}, default: {} },
  // ADD: workspace: { type: "object", properties: {...}, default: {} },
};
```

**Just add the new key** — electron-store schema is a plain object. No special migration needed if you provide a `default` value. Existing stores will merge the default on first access.

**Confidence:** HIGH (verified in codebase at SettingsStore.ts:40-106)

### 2. Debounced Auto-Save (Zustand → electron-store)

**Current pattern** (appStore.ts lines 185-202):
```typescript
let persistLayoutTimeout: ReturnType<typeof setTimeout> | null = null;

function persistLayout(getLayout: () => LayoutState) {
  if (persistLayoutTimeout) clearTimeout(persistLayoutTimeout);
  persistLayoutTimeout = setTimeout(() => {
    const layout = getLayout();
    const settingsPayload = {
      rightPanel: { /* ... */ },
      panelSizes: layout.panelSizes,
    };
    window.breadcrumbAPI?.setSetting("layout", settingsPayload);
    persistLayoutTimeout = null;
  }, 300);
}
```

**Called from action functions** (lines 429, 442, 455, 467, 473):
```typescript
setRightPanelOpen: (isOpen) =>
  set((state) => {
    // ... mutate state ...
    persistLayout(() => get().layout);
  }),
```

**Pattern:**
1. Module-scoped `timeout` variable (not in state)
2. Helper function accepts a getter (uses `get()` from action scope)
3. 300ms debounce collapses rapid changes
4. Call `window.breadcrumbAPI.setSetting()` for IPC → main process → electron-store

**DO NOT use Zustand's subscribe API** — the existing pattern is simpler and avoids subscription leaks. Just call `persistWorkspace(() => get().tabs, () => get().terminalPanes)` from relevant actions.

**Confidence:** HIGH (existing pattern works well)

### 3. Progressive Terminal Restoration

**Current PTY creation flow** (TerminalInstance.tsx lines 285-326):

```typescript
// PTY is created LAZILY on the first stable resize, NOT eagerly.
// This avoids dimension mismatches and resize storms.

let ptyCreated = false;
let resizeTimer: ReturnType<typeof setTimeout> | undefined;

const tryCreatePty = () => {
  if (ptyCreated || destroyed || !resolvedCwd) return;
  const dims = fitAddon.proposeDimensions();
  if (dims && dims.cols > 0 && dims.rows > 0) {
    ptyCreated = true;
    terminal.resize(dims.cols, dims.rows);
    window.breadcrumbAPI?.createTerminal({
      id: sessionId,
      name: sessionId,
      workingDirectory: resolvedCwd,  // <-- CWD passed here
      cols: dims.cols,
      rows: dims.rows,
    });
  }
};

// ResizeObserver triggers tryCreatePty on first layout
const handleResize = () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (!ptyCreated) {
      tryCreatePty();  // Creates PTY with actual dimensions
      return;
    }
    // ... existing resize logic ...
  }, 80);
};
```

**For restored terminals:**
- Set `cwd` in `TerminalPane` state when restoring workspace
- Pass `workingDirectory` prop to `<TerminalInstance>`
- Lazy PTY creation uses that CWD automatically (line 320)
- **No changes to TerminalInstance needed** — existing flow handles it

**Confidence:** HIGH (verified in TerminalInstance.tsx:285-326)

### 4. AppShell Initialization Order

**Current sequence** (AppShell.tsx lines 42-77):

```typescript
const layoutRestoredRef = useRef(false);

useEffect(() => {
  if (!settingsLoaded || layoutRestoredRef.current) return;
  layoutRestoredRef.current = true;

  const savedPanelSizes = layoutSettings.panelSizes;
  const savedPanes = layoutSettings.rightPanel.panes.map(...);

  // 1. Restore Zustand state
  restoreLayout({
    rightPanel: { isOpen: ..., panes: savedPanes },
    panelSizes: savedPanelSizes,
    devToolsDockOpen: false,
  });

  // 2. Restore panel sizes imperatively (after tick for PanelGroup mount)
  requestAnimationFrame(() => {
    panelGroupRef.current?.setLayout([...]);
  });
}, [settingsLoaded]);
```

**Hooks in App.tsx** (lines 12-18):
```typescript
useEffect(() => {
  loadSettings();  // Fetches electron-store → settingsStore
  const cleanup = window.breadcrumbAPI?.onSettingsChanged(() => {
    loadSettings();
  });
  return () => cleanup?.();
}, [loadSettings]);
```

**Initialization order:**
1. App.tsx mounts → `loadSettings()` fires
2. settingsStore fetches from electron-store via IPC
3. `settingsLoaded` becomes true
4. AppShell's useEffect sees `settingsLoaded` → restores layout
5. Components mount with restored state

**For workspace restore:**
- Add `restoreWorkspace(savedWorkspace)` to the same useEffect
- Call BEFORE `requestAnimationFrame` so tabs/panes mount with correct state
- Terminal components will see restored CWD and create PTYs on first resize

**Confidence:** HIGH (verified in AppShell.tsx:42-77 and App.tsx:12-18)

## Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| Zustand subscribe + debounce | Debounced function called from actions | Simpler, no subscription leaks, existing pattern |
| Custom JSON file writes | electron-store | Atomic writes, schema validation, OS-specific paths |
| Eager PTY creation on restore | Lazy creation via ResizeObserver | Avoids dimension mismatches, existing flow handles it |

## Pitfalls

### Schema Defaults Are Critical
**What happens:** If you add `workspace` to `AppSettings` type but forget the schema default, electron-store will return `undefined` and renderer code will crash on `workspace.tabs.map(...)`.

**Avoid by:** Always add a `default: {}` or `default: []` to new schema keys. Check `SettingsStore.ts` schema (lines 40-101) for examples.

### Don't Persist SessionIds Directly
**What happens:** Restored `sessionId: "tab-1-12345"` references a PTY that no longer exists. Creating a new terminal with the same ID causes IPC handler collisions.

**Avoid by:** Restore CWD and layout only. Generate fresh sessionIds on restore (use `${tabId}-${Date.now()}`). The lazy PTY creation will use the saved CWD.

### Debounce Timeout Must Not Trigger on Unmount
**What happens:** User closes app → Zustand action fires → `persistWorkspace` schedules 300ms timeout → app quits before timeout fires → workspace not saved.

**Avoid by:**
- 300ms is already fast enough for normal usage
- Electron's `before-quit` event could flush pending writes
- OR: Use Zustand's `subscribe` with `fireImmediately: false` and flush synchronously on quit

**Current behavior:** Layout persist uses 300ms timeout (line 201). Works because layout changes are infrequent. Workspace changes (tab switches, splits) are more frequent but still <1/sec in normal usage.

**Recommendation:** Start with 300ms debounce (same as layout). If lost-on-quit becomes an issue, add a `before-quit` flush.

### Terminal Tab IDs vs Pane SessionIds
**What happens:** Tabs have `tabId` (stable, user-visible), panes have `sessionId` (PTY identifier). Restoring a workspace restores tabs/panes, but must generate NEW sessionIds.

**Avoid by:**
- Restore `tabId` as-is (it's just a string like "terminal-1")
- Generate new `sessionId` on restore: `${tabId}-${Date.now()}`
- Store `cwd` in the persisted pane data, NOT sessionId

**Confidence:** HIGH (verified in appStore.ts TerminalPane interface, lines 24-37)

## Implementation Checklist

- [ ] Extend `AppSettings` interface with `workspace: WorkspaceSettings`
- [ ] Add `workspace` schema to SettingsStore.ts with proper defaults
- [ ] Create `WorkspaceSettings` type (tabs, terminalPanes per tab)
- [ ] Add `persistWorkspace` function (copy `persistLayout` pattern)
- [ ] Call `persistWorkspace` from tab/pane mutation actions (addTab, removeTab, addPane, etc.)
- [ ] Add `restoreWorkspace` action to appStore
- [ ] Call `restoreWorkspace` in AppShell's settings-loaded useEffect
- [ ] Test: create tabs/splits → restart → verify restore
- [ ] Test: change CWD → restart → verify restored terminal opens in saved CWD
- [ ] Test: rapid splits → verify debounce works (only one write per 300ms)

## Open Questions

**Q: Should we persist browser tab URLs?**
- Browser tabs already persist `lastUrl` in BrowserSettings (SettingsStore.ts:30-32)
- Workspace restore could repopulate browser tabs with saved URLs
- **Needs decision:** Single browser URL (current) vs per-tab URLs?

**Q: Should we persist terminal scrollback?**
- xterm.js has `terminal.buffer` but no built-in serialization
- Restoring scrollback requires capturing buffer lines on quit
- **Recommendation:** Don't persist scrollback in v1. Start fresh on restore.

**Q: What about unsaved terminal input?**
- PTY processes own the input buffer, not the renderer
- Restoring half-typed commands requires PTY state capture
- **Recommendation:** Don't restore. User can see the CWD and re-type.

## Sources

**HIGH confidence:**
- [GitHub - sindresorhus/electron-store](https://github.com/sindresorhus/electron-store) — atomic writes verified
- Codebase files: SettingsStore.ts, appStore.ts, TerminalInstance.tsx, AppShell.tsx, App.tsx

**MEDIUM confidence:**
- [Zustand Slices Pattern](https://zustand.docs.pmnd.rs/guides/slices-pattern) — verified subscribe pattern (not used in favor of existing debounce)
- [Zustand subscribeWithSelector](https://zustand.docs.pmnd.rs/middlewares/subscribe-with-selector) — available but not needed
- [Working with Zustand - TkDodo](https://tkdodo.eu/blog/working-with-zustand) — best practices

**LOW confidence (needs validation):**
- None — all findings verified against codebase or official docs.
