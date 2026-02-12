# Research: Terminal Pane State Management with Zustand

**Date:** 2026-02-12
**Domain:** State management, Zustand patterns, React lifecycle
**Overall Confidence:** HIGH

## TL;DR

Create a dedicated `terminalPanesStore.ts` using Zustand's `create()` with a nested `Record<tabId, TabPaneState>` structure. Use the immer middleware for clean nested updates. Key panes by tabId (not by individual paneId) to maintain the tab-level grouping. Clean up tab state in the existing `removeTab` action using a new `clearTabPanes` action. Track all metadata (CWD, split direction, active pane) in the store for sidebar consumption.

## Recommended Stack

| Library | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| zustand | ^5.0.0 | State management (already installed) | HIGH |
| immer | ^10.x | Nested state updates middleware | HIGH |

**Install:**
```bash
npm install immer
```

## Store Architecture

### Recommended Pattern: Single Global Store with Nested Records

**Use `appStore` extension, NOT a separate store.**

Rationale:
- Tab state is already in `appStore`
- Pane state is **logically owned by tabs**
- Keeps all workspace state centralized
- Avoids synchronization issues between stores
- Simpler selector patterns (`useAppStore` already imported everywhere)

### Data Structure

```typescript
// Add to appStore.ts
import { immer } from 'zustand/middleware/immer'

export interface TerminalPane {
  id: string;
  sessionId: string;
  cwd: string;
  lastActivity?: number;
  shellPid?: number;
}

export interface TabPaneState {
  panes: TerminalPane[];
  activePane: string;
  splitDirection: "horizontal" | "vertical";
}

export interface AppState {
  // ... existing state
  terminalPanes: Record<string, TabPaneState>; // keyed by tabId
}

export interface AppActions {
  // ... existing actions

  // Pane management
  initializeTabPanes: (tabId: string, workingDirectory?: string) => void;
  addPane: (tabId: string, direction?: "horizontal" | "vertical") => void;
  removePane: (tabId: string, paneId: string) => void;
  setActivePane: (tabId: string, paneId: string) => void;
  toggleSplitDirection: (tabId: string) => void;
  updatePaneCwd: (tabId: string, paneId: string, cwd: string) => void;
  updatePaneMetadata: (tabId: string, paneId: string, updates: Partial<TerminalPane>) => void;
  clearTabPanes: (tabId: string) => void;
}

export const useAppStore = create<AppStore>()(
  immer((set, get) => ({
    // ... existing state
    terminalPanes: {},

    // ... existing actions

    // IMPORTANT: Modify removeTab to clean up panes
    removeTab: (id) =>
      set((state) => {
        const newTabs = state.tabs.filter((t) => t.id !== id);
        const newActiveId =
          state.activeTabId === id
            ? newTabs[newTabs.length - 1]?.id || null
            : state.activeTabId;

        // Clean up panes when removing tab
        delete state.terminalPanes[id];

        state.tabs = newTabs;
        state.activeTabId = newActiveId;
      }),

    initializeTabPanes: (tabId, workingDirectory) =>
      set((state) => {
        if (!state.terminalPanes[tabId]) {
          state.terminalPanes[tabId] = {
            panes: [
              {
                id: "pane-1",
                sessionId: `${tabId}-1`,
                cwd: workingDirectory || "",
                lastActivity: Date.now(),
              },
            ],
            activePane: "pane-1",
            splitDirection: "horizontal",
          };
        }
      }),

    addPane: (tabId, direction) =>
      set((state) => {
        const tabState = state.terminalPanes[tabId];
        if (!tabState) return;

        if (direction) {
          tabState.splitDirection = direction;
        }

        const id = `pane-${Date.now()}`;
        const sessionId = `${tabId}-${Date.now()}`;

        tabState.panes.push({
          id,
          sessionId,
          cwd: "",
          lastActivity: Date.now(),
        });
        tabState.activePane = id;
      }),

    removePane: (tabId, paneId) =>
      set((state) => {
        const tabState = state.terminalPanes[tabId];
        if (!tabState) return;

        const newPanes = tabState.panes.filter((p) => p.id !== paneId);
        if (newPanes.length === 0) return; // Don't remove last pane

        tabState.panes = newPanes;

        // Update active pane if we removed it
        if (tabState.activePane === paneId) {
          tabState.activePane = newPanes[newPanes.length - 1].id;
        }
      }),

    setActivePane: (tabId, paneId) =>
      set((state) => {
        const tabState = state.terminalPanes[tabId];
        if (!tabState) return;
        tabState.activePane = paneId;
      }),

    toggleSplitDirection: (tabId) =>
      set((state) => {
        const tabState = state.terminalPanes[tabId];
        if (!tabState) return;
        tabState.splitDirection =
          tabState.splitDirection === "horizontal" ? "vertical" : "horizontal";
      }),

    updatePaneCwd: (tabId, paneId, cwd) =>
      set((state) => {
        const tabState = state.terminalPanes[tabId];
        if (!tabState) return;

        const pane = tabState.panes.find((p) => p.id === paneId);
        if (pane) {
          pane.cwd = cwd;
          pane.lastActivity = Date.now();
        }
      }),

    updatePaneMetadata: (tabId, paneId, updates) =>
      set((state) => {
        const tabState = state.terminalPanes[tabId];
        if (!tabState) return;

        const pane = tabState.panes.find((p) => p.id === paneId);
        if (pane) {
          Object.assign(pane, updates);
        }
      }),

    clearTabPanes: (tabId) =>
      set((state) => {
        delete state.terminalPanes[tabId];
      }),
  }))
);

// Selector hooks
export const useTabPanes = (tabId: string) =>
  useAppStore((s) => s.terminalPanes[tabId]);

export const useTabPanesList = (tabId: string) =>
  useAppStore((s) => s.terminalPanes[tabId]?.panes || []);

export const useActivePane = (tabId: string) =>
  useAppStore((s) => s.terminalPanes[tabId]?.activePane);

export const useSplitDirection = (tabId: string) =>
  useAppStore((s) => s.terminalPanes[tabId]?.splitDirection || "horizontal");
```

## Migration from Local State

### Step 1: Update TerminalPanel.tsx

**Before:**
```typescript
const [panes, setPanes] = useState<TerminalPane[]>([...]);
const [activePane, setActivePane] = useState("pane-1");
const [splitDirection, setSplitDirection] = useState<"horizontal" | "vertical">("horizontal");
const [paneCwds, setPaneCwds] = useState<Record<string, string>>({});
```

**After:**
```typescript
import { useAppStore, useTabPanes, useTabPanesList } from "../../store/appStore";

export function TerminalPanel({ tabId, workingDirectory }: TerminalPanelProps) {
  const initializeTabPanes = useAppStore((s) => s.initializeTabPanes);
  const addPane = useAppStore((s) => s.addPane);
  const removePane = useAppStore((s) => s.removePane);
  const setActivePane = useAppStore((s) => s.setActivePane);
  const toggleSplitDirection = useAppStore((s) => s.toggleSplitDirection);
  const updatePaneCwd = useAppStore((s) => s.updatePaneCwd);
  const updateTab = useAppStore((s) => s.updateTab);

  const tabPaneState = useTabPanes(tabId);
  const panes = useTabPanesList(tabId);
  const activePane = tabPaneState?.activePane || "pane-1";
  const splitDirection = tabPaneState?.splitDirection || "horizontal";

  // Initialize panes on mount
  useEffect(() => {
    initializeTabPanes(tabId, workingDirectory);
  }, [tabId]); // Only run when tabId changes

  // Update handlers
  const handleAddPane = useCallback((direction?: "horizontal" | "vertical") => {
    addPane(tabId, direction);
  }, [tabId, addPane]);

  const handleRemovePane = useCallback((paneId: string) => {
    removePane(tabId, paneId);
  }, [tabId, removePane]);

  const handleSetActivePane = useCallback((paneId: string) => {
    setActivePane(tabId, paneId);
  }, [tabId, setActivePane]);

  const handleCwdChange = useCallback((paneId: string, cwd: string) => {
    updatePaneCwd(tabId, paneId, cwd);
    // Update tab title if this is the active pane
    if (paneId === activePane) {
      updateTab(tabId, { title: folderName(cwd) });
    }
  }, [tabId, activePane, updatePaneCwd, updateTab]);

  // ... rest of component uses handleAddPane, handleRemovePane, etc.
}
```

### Step 2: Update SidebarPanel.tsx (Terminals View)

```typescript
function TerminalsView() {
  const tabs = useAppStore((s) => s.tabs);
  const terminalPanes = useAppStore((s) => s.terminalPanes);
  const { setActiveTab, setActivePane } = useAppStore();
  const projects = useProjectsStore((s) => s.projects);
  const terminalTabs = tabs.filter((t) => t.type === "terminal");

  // Group terminals by project
  const grouped = new Map<string | null, typeof terminalTabs>();
  for (const tab of terminalTabs) {
    const key = tab.projectId || null;
    const list = grouped.get(key) || [];
    list.push(tab);
    grouped.set(key, list);
  }

  return (
    <div className="py-1">
      {Array.from(grouped.entries()).map(([projectId, groupTabs]) => {
        const project = projectId ? projects.find((p) => p.id === projectId) : null;
        return (
          <div key={projectId || "ungrouped"} className="mb-2">
            <div className="px-4 py-1 text-2xs font-semibold uppercase tracking-widest text-foreground-muted">
              {project?.name || "General"}
            </div>
            {groupTabs.map((tab) => {
              const tabState = terminalPanes[tab.id];
              const panes = tabState?.panes || [];

              return (
                <div key={tab.id}>
                  {/* Tab header */}
                  <button
                    onClick={() => setActiveTab(tab.id)}
                    className="w-full flex items-center gap-2 px-4 py-1.5 text-left text-sm text-foreground-secondary hover:bg-muted/50 transition-default"
                  >
                    <Terminal className="w-3.5 h-3.5 text-foreground-muted" />
                    <span className="truncate">{tab.title}</span>
                    <span className="ml-auto text-2xs text-foreground-muted">
                      {panes.length}
                    </span>
                  </button>

                  {/* Pane list (nested) */}
                  {panes.length > 1 && (
                    <div className="ml-8 space-y-0.5">
                      {panes.map((pane, index) => (
                        <button
                          key={pane.id}
                          onClick={() => {
                            setActiveTab(tab.id);
                            setActivePane(tab.id, pane.id);
                          }}
                          className={`w-full flex items-center gap-2 px-2 py-1 rounded text-left text-2xs transition-default ${
                            tabState?.activePane === pane.id
                              ? "bg-primary/10 text-primary"
                              : "text-foreground-muted hover:text-foreground-secondary hover:bg-muted/30"
                          }`}
                        >
                          <FolderOpen className="w-3 h-3" />
                          <span className="truncate">
                            {pane.cwd ? folderName(pane.cwd) : `Pane ${index + 1}`}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function folderName(cwd: string): string {
  const parts = cwd.replace(/\/+$/, "").split("/");
  return parts[parts.length - 1] || cwd;
}
```

## Key Patterns

### Pattern 1: Immer Middleware for Nested Updates
**Use when:** Updating deeply nested state (panes inside tabs inside records)

```typescript
import { immer } from 'zustand/middleware/immer'

export const useAppStore = create<AppStore>()(
  immer((set, get) => ({
    // state and actions
  }))
);
```

**Why immer:**
- Allows direct mutation syntax: `state.terminalPanes[tabId].activePane = paneId`
- Immer internally uses structural sharing for efficiency
- No manual spreading: `{ ...state, terminalPanes: { ...state.terminalPanes, ... } }`
- Source: [Zustand Immer Middleware](https://zustand.docs.pmnd.rs/integrations/immer-middleware)

### Pattern 2: Record Type for Tab-Keyed State
**Use when:** Multiple instances need isolated state (tabs have independent pane sets)

```typescript
terminalPanes: Record<string, TabPaneState>
```

**Benefits:**
- Fast lookups: `O(1)` access by tabId
- Type-safe with TypeScript
- Easy cleanup: `delete state.terminalPanes[tabId]`
- Source: [Zustand with Maps and Records](https://zustand.docs.pmnd.rs/guides/maps-and-sets-usage)

### Pattern 3: Lifecycle-Aware Initialization
**Use when:** State needs to be created when component mounts, cleaned when unmounts

```typescript
// In TerminalPanel
useEffect(() => {
  initializeTabPanes(tabId, workingDirectory);
  // Cleanup handled by removeTab action
}, [tabId]);
```

**Why this works:**
- `initializeTabPanes` is idempotent (checks `if (!state.terminalPanes[tabId])`)
- Cleanup happens in `removeTab` action (already called when tab closes)
- No manual cleanup needed in TerminalPanel
- Prevents stale state accumulation

### Pattern 4: Selector Hooks for Per-Tab State
**Use when:** Components need to subscribe to specific tab's pane state

```typescript
export const useTabPanes = (tabId: string) =>
  useAppStore((s) => s.terminalPanes[tabId]);

export const useTabPanesList = (tabId: string) =>
  useAppStore((s) => s.terminalPanes[tabId]?.panes || []);
```

**Performance:**
- Only re-renders when **that specific tab's** pane state changes
- Other tabs changing panes won't trigger re-renders
- Use `useShallow` if selecting multiple primitive values

## Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| Nested object spreading | Immer middleware | Avoids verbose spread syntax, prevents bugs from missed levels |
| Manual pane cleanup on tab close | Extend `removeTab` action | Single source of truth for tab removal logic |
| Per-component store instances | Global store with Record structure | Simpler, no Context overhead, easier debugging |
| Direct mutation of Record values | Immer's draft state | Zustand needs immutable updates, immer handles it |

## Pitfalls

### Pitfall 1: Forgetting to Initialize Panes
**What happens:** Component reads `terminalPanes[tabId]` before it exists, gets `undefined`, crashes.

**Avoid by:**
- Always call `initializeTabPanes(tabId)` in `useEffect` on mount
- Use fallback selectors: `s.terminalPanes[tabId]?.panes || []`
- Make `initializeTabPanes` idempotent (check before creating)

### Pitfall 2: Memory Leak from Forgotten Cleanup
**What happens:** Closing tabs doesn't remove pane state, store grows unbounded.

**Avoid by:**
- ALWAYS clean up in `removeTab` action (already in store, not component)
- Never rely on component unmount for cleanup (can be skipped in React)

### Pitfall 3: Reassigning State in Immer
**What happens:** Code like `state.terminalPanes = { ...state.terminalPanes, [tabId]: newState }` breaks Immer.

**Avoid by:**
- Mutate properties directly: `state.terminalPanes[tabId] = newState`
- Or use `delete state.terminalPanes[tabId]`
- Never reassign the draft object itself
- Source: [Immer Middleware Best Practices](https://zustand.docs.pmnd.rs/integrations/immer-middleware)

### Pitfall 4: Over-Selecting State
**What happens:** Component selects entire `terminalPanes` object, re-renders on ANY tab's pane change.

**Avoid by:**
- Always select the minimum needed: `useTabPanes(tabId)` NOT `useAppStore(s => s.terminalPanes)`
- Use per-tab selectors: `useTabPanesList(tabId)`
- If selecting multiple values, use `useShallow` from Zustand

### Pitfall 5: CWD Updates Triggering Tab Title Lag
**What happens:** Every keystroke updates CWD, triggers tab title update, causes flicker.

**Avoid by:**
- Only update tab title when **active pane's** CWD changes
- Debounce CWD updates if shell integration fires too frequently
- Check `if (paneId === activePane)` before calling `updateTab`

## Alternative Pattern: React Context + createStore (NOT RECOMMENDED)

You could use Zustand's `createStore` with React Context for per-tab isolation:

```typescript
const TabPaneStoreContext = createContext(null);

const TabPaneStoreProvider = ({ children, tabId, workingDirectory }) => {
  const [store] = useState(() =>
    createStore((set) => ({
      panes: [{ id: "pane-1", sessionId: `${tabId}-1`, cwd: workingDirectory }],
      // ...
    }))
  );
  return (
    <TabPaneStoreContext.Provider value={store}>
      {children}
    </TabPaneStoreContext.Provider>
  );
};
```

**Why NOT to use this:**
- Sidebar can't access pane state (Context not shared across tree)
- More boilerplate (Provider wrapper, custom hook, Context setup)
- Harder to debug (multiple store instances)
- Testing complexity (need to wrap in Provider)

**When to use this:**
- If panes were NEVER shared with sidebar (but they are in this app)
- If you needed to test TerminalPanel in isolation (not a requirement)
- Source: [Zustand and React Context](https://tkdodo.eu/blog/zustand-and-react-context)

## Open Questions

1. **Should shellPid be tracked in pane state?**
   - Not immediately needed for sidebar display
   - Could add later for "kill process" action in context menu
   - LOW priority

2. **Should lastActivity timestamp be used for sorting?**
   - Useful for "recently active" pane highlighting
   - Not in current phase scope
   - MEDIUM priority for future

3. **Do we need to persist pane state across app restarts?**
   - `persist` middleware could save to localStorage
   - Session IDs would be stale (terminals closed on restart)
   - Likely NOT needed (terminals are ephemeral)

4. **Should we track pane resize percentages?**
   - `react-resizable-panels` already handles this internally
   - Store doesn't need to know about layout sizes
   - NOT needed

## Sources

**HIGH confidence:**
- [Zustand Immer Middleware](https://zustand.docs.pmnd.rs/integrations/immer-middleware) — Official docs for nested state updates
- [Zustand Maps and Sets Usage](https://zustand.docs.pmnd.rs/guides/maps-and-sets-usage) — Official pattern for Record types
- [Zustand and React Context by TkDodo](https://tkdodo.eu/blog/zustand-and-react-context) — createStore vs create distinction

**MEDIUM confidence:**
- [Zustand Architecture Patterns at Scale](https://brainhub.eu/library/zustand-architecture-patterns-at-scale) — Best practices for large apps
- [Mastering State Management with Zustand and Immer](https://blog.dushyanth.in/mastering-state-management-with-zustand-and-immer-a-guide-to-efficient-state-updates) — Practical examples

**LOW confidence (context only, not used in recommendations):**
- [Zutron - Electron Zustand Sync](https://github.com/goosewobbler/zutron) — Multi-window Electron state (not needed for single window app)
- [Zustand Cleanup Discussion](https://github.com/pmndrs/zustand/discussions/1869) — Community patterns for state reset
