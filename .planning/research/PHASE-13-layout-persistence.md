# Research: Layout State Persistence for IDE Panel System

**Task ID:** PHASE-13-layout-persistence
**Date:** 2026-02-12
**Domain:** Electron desktop app, React state management, layout persistence
**Overall Confidence:** HIGH

## TL;DR

Use the existing settingsStore pattern with a new `layout` namespace. Store panel sizes using react-resizable-panels' `onLayout` callback (not `autoSaveId` — we need cross-process persistence). Debounce writes with a simple timeout pattern (300-500ms). Keep layout state in appStore for runtime, sync to disk via IPC on debounced changes. Restore layout on app startup by reading from settings and applying via imperative PanelGroup API.

## Recommended Stack

| Library | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| react-resizable-panels | 2.1.9 | Panel layout (already installed) | HIGH |
| electron-store | 11.0.2 | Disk persistence (already installed) | HIGH |
| zustand | 5.0.0 | Runtime state (already installed) | HIGH |
| zustand/middleware/immer | 5.0.0 | Immutable updates (already in use) | HIGH |

**Install:**
Already installed — no new dependencies needed.

## Key Patterns

### Pattern 1: Layout State in appStore (Runtime)

**Use when:** Managing layout state during the session

```typescript
// In appStore.ts (extend existing AppState)
export interface LayoutState {
  rightPanel: {
    isOpen: boolean;
    panes: Array<{
      id: string;
      type: 'browser' | 'planning';
      size: number; // percentage
    }>;
  };
  panelSizes: {
    sidebar: number;    // percentage
    center: number;     // percentage
    rightPanel: number; // percentage
  };
}

// Default values
const DEFAULT_LAYOUT: LayoutState = {
  rightPanel: {
    isOpen: false,
    panes: [],
  },
  panelSizes: {
    sidebar: 18,
    center: 82,
    rightPanel: 0,
  },
};
```

**Why:** Keep runtime layout state in Zustand for reactive UI updates. Don't use Zustand persist middleware — it uses localStorage, not electron-store.

### Pattern 2: Debounced Persistence via IPC

**Use when:** Panel resize events fire (avoid writing on every pixel drag)

```typescript
// In appStore.ts
let persistLayoutTimeout: NodeJS.Timeout | null = null;

const persistLayout = (layout: LayoutState) => {
  if (persistLayoutTimeout) {
    clearTimeout(persistLayoutTimeout);
  }

  persistLayoutTimeout = setTimeout(() => {
    window.breadcrumbAPI?.setSetting('layout', layout);
    persistLayoutTimeout = null;
  }, 300); // 300ms debounce
};

// In actions
setPanelSizes: (sizes: Partial<LayoutState['panelSizes']>) =>
  set((state) => {
    state.layout.panelSizes = { ...state.layout.panelSizes, ...sizes };
    persistLayout(state.layout);
  }),
```

**Why:** Debouncing prevents disk thrashing during resize. 300ms is the sweet spot (user doesn't notice, but reduces writes 10-100x). electron-store has atomic writes, so no corruption risk if process crashes mid-write.

**Source:** [Debounce best practices](https://dmitripavlutin.com/react-throttle-debounce/), [electron-store atomic writes](https://github.com/sindresorhus/electron-store)

### Pattern 3: react-resizable-panels Integration

**Use when:** Connecting PanelGroup to state management

```typescript
// In AppShell.tsx
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import { useAppStore } from '../../store/appStore';

export function AppShell() {
  const { layout, setPanelSizes } = useAppStore();
  const panelGroupRef = useRef<ImperativePanelGroupHandle>(null);

  // Restore layout on mount
  useEffect(() => {
    if (panelGroupRef.current && layout.panelSizes) {
      panelGroupRef.current.setLayout([
        layout.panelSizes.sidebar,
        layout.panelSizes.center,
        layout.panelSizes.rightPanel,
      ]);
    }
  }, []); // Only on mount

  // Capture layout changes (debounced internally by Pattern 2)
  const handleLayout = (sizes: number[]) => {
    setPanelSizes({
      sidebar: sizes[0],
      center: sizes[1],
      rightPanel: sizes[2],
    });
  };

  return (
    <PanelGroup
      ref={panelGroupRef}
      direction="horizontal"
      onLayout={handleLayout}
    >
      {/* Panels... */}
    </PanelGroup>
  );
}
```

**Why:** DON'T use `autoSaveId` — it persists to localStorage, not electron-store. We need cross-process persistence via IPC. Use `onLayout` callback + imperative `setLayout()` API instead.

**Source:** [react-resizable-panels API](https://github.com/bvaughn/react-resizable-panels)

### Pattern 4: Settings Store Schema Extension

**Use when:** Adding layout to the settings schema (main process)

```typescript
// In main/settings/SettingsStore.ts
export interface LayoutSettings {
  rightPanel: {
    isOpen: boolean;
    panes: Array<{ id: string; type: string; size: number }>;
  };
  panelSizes: {
    sidebar: number;
    center: number;
    rightPanel: number;
  };
}

export interface AppSettings {
  terminal: TerminalSettings;
  layout: LayoutSettings; // NEW
}

const schema = {
  terminal: { /* existing */ },
  layout: {
    type: "object" as const,
    properties: {
      rightPanel: {
        type: "object" as const,
        properties: {
          isOpen: { type: "boolean" as const, default: false },
          panes: {
            type: "array" as const,
            items: { type: "object" as const },
            default: [],
          },
        },
        default: { isOpen: false, panes: [] },
      },
      panelSizes: {
        type: "object" as const,
        properties: {
          sidebar: { type: "number" as const, default: 18, minimum: 12, maximum: 40 },
          center: { type: "number" as const, default: 82, minimum: 30, maximum: 100 },
          rightPanel: { type: "number" as const, default: 0, minimum: 0, maximum: 60 },
        },
        default: { sidebar: 18, center: 82, rightPanel: 0 },
      },
    },
    default: {},
  },
};
```

**Why:** Follow existing pattern from terminal settings. electron-store validates against schema and provides defaults. Constraints (min/max) prevent users from creating unusable layouts.

### Pattern 5: Merging Persisted State with Defaults

**Use when:** Loading settings on app startup (handle missing keys gracefully)

```typescript
// In settingsStore.ts (renderer)
loadSettings: async () => {
  const all = await window.breadcrumbAPI?.getSettings() as unknown as AppSettings | undefined;

  const DEFAULT_LAYOUT: LayoutSettings = {
    rightPanel: { isOpen: false, panes: [] },
    panelSizes: { sidebar: 18, center: 82, rightPanel: 0 },
  };

  set({
    settings: {
      terminal: { ...DEFAULT_TERMINAL_SETTINGS, ...(all?.terminal || {}) },
      layout: {
        ...DEFAULT_LAYOUT,
        ...(all?.layout || {}),
        // Deep merge for nested objects
        rightPanel: {
          ...DEFAULT_LAYOUT.rightPanel,
          ...(all?.layout?.rightPanel || {})
        },
        panelSizes: {
          ...DEFAULT_LAYOUT.panelSizes,
          ...(all?.layout?.panelSizes || {})
        },
      },
    },
    loaded: true,
  });
},
```

**Why:** Handles missing keys (new settings), corrupted data (partial objects), and version migrations gracefully. Always fall back to sane defaults.

## Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| Custom localStorage persistence | electron-store via IPC | Cross-process sync, atomic writes, validation, platform-specific paths |
| Manual debounce implementation | Simple setTimeout pattern | Edge cases (unmount, rapid state changes) are tricky. Keep it simple. |
| Redux for layout state | Extend existing Zustand appStore | Already installed, simpler API, less boilerplate |
| Custom merge logic for nested objects | Spread operator + defaults | Readable, predictable, works with Immer middleware |

## Architecture Decisions

### Decision 1: Layout State Lives in appStore (Not Separate Store)

**Rationale:** Layout state is tightly coupled with panel visibility (rightPanel.isOpen affects render tree). Keeping it in appStore avoids sync issues. If you need to access layout from multiple components, use Zustand selectors.

**Pattern:**
```typescript
// Selector hooks
export const useRightPanelOpen = () => useAppStore((s) => s.layout.rightPanel.isOpen);
export const usePanelSizes = () => useAppStore((s) => s.layout.panelSizes);
```

### Decision 2: Debounce in Store Actions (Not React Components)

**Rationale:** Debounce logic in Zustand actions is cleaner and testable. Component just calls action. No need for useCallback/useMemo/useRef dance.

**Anti-pattern:**
```typescript
// DON'T DO THIS (component-level debounce)
const handleResize = useMemo(
  () => debounce((sizes) => setPanelSizes(sizes), 300),
  []
);
```

**Correct pattern:**
```typescript
// DO THIS (store-level debounce)
setPanelSizes: (sizes) => {
  set((state) => { state.layout.panelSizes = sizes; });
  persistLayout(get().layout); // Debounced internally
}
```

### Decision 3: Don't Use autoSaveId

**Rationale:** `autoSaveId` persists to localStorage (browser API). Electron apps need electron-store (file system) for cross-process access. Main process can't read localStorage.

### Decision 4: Restore Layout Imperatively (Not Declaratively)

**Rationale:** react-resizable-panels doesn't support controlled mode (passing `sizes` prop). Must use imperative API: `panelGroupRef.current.setLayout(sizes)`.

**Pattern:**
```typescript
useEffect(() => {
  if (panelGroupRef.current) {
    panelGroupRef.current.setLayout([18, 82, 0]);
  }
}, []); // Only on mount
```

## Pitfalls

### Pitfall 1: Race Condition on Initial Load

**What happens:** Component renders before settings load → default layout applied → settings load → layout jumps.

**Avoid by:** Wait for `settingsLoaded` flag before rendering PanelGroup.

```typescript
const settingsLoaded = useSettingsStore((s) => s.loaded);
if (!settingsLoaded) return <Spinner />;
```

**Confidence:** HIGH (common Electron app issue)

### Pitfall 2: Infinite Loop with onLayout

**What happens:** `onLayout` fires → update state → re-render → `onLayout` fires again.

**Avoid by:** Debounce prevents rapid re-saves. Also, only call `setLayout()` once on mount (not in useEffect dependency array).

```typescript
// WRONG - infinite loop
useEffect(() => {
  panelGroupRef.current?.setLayout([...layout.panelSizes]);
}, [layout.panelSizes]); // Re-runs on every layout change

// CORRECT - only on mount
useEffect(() => {
  panelGroupRef.current?.setLayout([...layout.panelSizes]);
}, []); // Empty deps
```

**Confidence:** HIGH (documented react-resizable-panels behavior)

### Pitfall 3: Stale State in Debounced Callback

**What happens:** Debounce captures state in closure → state changes → setTimeout fires with old state → wrong data saved.

**Avoid by:** Use `get()` inside timeout to read latest state.

```typescript
// WRONG
const persistLayout = (layout: LayoutState) => {
  setTimeout(() => {
    window.breadcrumbAPI?.setSetting('layout', layout); // Stale!
  }, 300);
};

// CORRECT
const persistLayout = () => {
  setTimeout(() => {
    const currentLayout = get().layout; // Fresh!
    window.breadcrumbAPI?.setSetting('layout', currentLayout);
  }, 300);
};
```

**Confidence:** HIGH (classic JavaScript closure issue)

### Pitfall 4: Not Cleaning Up Timeout on Unmount

**What happens:** Component unmounts → timeout fires → tries to update unmounted component → React warning (memory leak).

**Avoid by:** Clear timeout in useEffect cleanup (if using component-level debounce).

```typescript
useEffect(() => {
  return () => {
    if (persistLayoutTimeout) {
      clearTimeout(persistLayoutTimeout);
    }
  };
}, []);
```

**Note:** If debounce is in Zustand store (recommended), this isn't needed — store persists across component lifecycles.

**Confidence:** MEDIUM (only relevant if using component-level debounce)

## Open Questions

1. **Should right panel pane sizes be percentages or pixels?**
   - Recommendation: Percentages (react-resizable-panels default). Handles window resize gracefully.
   - Validation needed: Test on different screen sizes.

2. **Should we persist right panel "which panes are open" separately from "pane sizes"?**
   - Recommendation: Yes. `panes` array tracks open content, `panelSizes` tracks layout. User might close browser but want to restore it to same size later.
   - Confidence: MEDIUM (depends on UX preference)

3. **How to handle invalid persisted data (corrupted JSON, wrong types)?**
   - Recommendation: electron-store validates against schema. If validation fails, it uses defaults. No extra code needed.
   - Confidence: HIGH (built-in feature)

## Implementation Checklist

- [ ] Extend `AppSettings` interface with `layout` field (main + renderer)
- [ ] Add `layout` to electron-store schema with defaults and constraints
- [ ] Add `LayoutState` to `AppState` in appStore.ts
- [ ] Add actions: `setPanelSizes`, `setRightPanelOpen`, `addRightPanelPane`, `removeRightPanelPane`
- [ ] Implement debounced `persistLayout()` helper in appStore
- [ ] Update `loadSettings()` to merge layout with defaults
- [ ] Add `PanelGroup` refs to AppShell.tsx
- [ ] Implement `onLayout` handler (calls `setPanelSizes`)
- [ ] Implement layout restoration in `useEffect` (calls `setLayout()`)
- [ ] Add `settingsLoaded` guard before rendering panels
- [ ] Test: Resize panels → restart app → sizes restored
- [ ] Test: Open right panel → close app → reopen → panel state restored
- [ ] Test: Delete settings file → app uses defaults without crashing

## Sources

**HIGH confidence:**
- [react-resizable-panels GitHub](https://github.com/bvaughn/react-resizable-panels)
- [react-resizable-panels npm](https://www.npmjs.com/package/react-resizable-panels)
- [Zustand persist middleware docs](https://zustand.docs.pmnd.rs/middlewares/persist)
- [electron-store GitHub](https://github.com/sindresorhus/electron-store)

**MEDIUM confidence:**
- [React debounce best practices](https://dmitripavlutin.com/react-throttle-debounce/)
- [Debounce window resize](https://medium.com/geekculture/debounce-handle-browser-resize-like-a-pro-994cd522e14b)
- [VS Code layout persistence discussion](https://github.com/microsoft/vscode/issues/138263)

**LOW confidence (needs validation):**
- [LogRocket panel layouts article](https://blog.logrocket.com/essential-tools-implementing-react-panel-layouts/) — general overview, not specific to our stack
