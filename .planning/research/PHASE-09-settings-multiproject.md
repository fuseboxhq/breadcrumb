# Research: Settings Persistence & Multi-Project Model

**Date:** 2026-02-11
**Domain:** Electron, State Management, Data Persistence
**Overall Confidence:** HIGH

## TL;DR

Use electron-store 11.0.2 in the main process with JSON Schema validation and expose methods via contextBridge. Sync to Zustand renderer store using IPC channels (get-settings, set-settings, on-settings-changed). Store terminal settings with schema defaults. Use Zustand slices pattern for multi-project state with a projects slice managing active project and per-project overrides.

## Recommended Stack

| Library | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| electron-store | 11.0.2 | Persistent settings in main process | HIGH |
| zustand | 5.0.11 | Renderer state management (already installed) | HIGH |
| ajv | ^8.x | JSON Schema validation (dep of electron-store) | HIGH |

**Install:**
```bash
cd desktop
npm install electron-store@11.0.2
```

## Key Patterns

### 1. Main Process: electron-store Setup

**Use when:** Initializing settings persistence in main/index.ts

```typescript
// main/settings/SettingsStore.ts
import Store from 'electron-store';

// Define schema type
interface SettingsSchema {
  terminal: {
    fontFamily: string;
    fontSize: number;
    fontWeight: number;
    letterSpacing: number;
    scrollback: number;
    cursorStyle: 'block' | 'underline' | 'bar';
    cursorBlink: boolean;
    defaultShell: string;
    defaultWorkingDirectory: string;
  };
  projects: {
    recent: Array<{
      id: string;
      name: string;
      path: string;
      lastOpened: number;
    }>;
    active: string | null;
  };
}

// Create store with schema validation
const schema = {
  terminal: {
    type: 'object',
    properties: {
      fontFamily: { type: 'string', default: 'Menlo, Monaco, "Courier New", monospace' },
      fontSize: { type: 'number', default: 14, minimum: 8, maximum: 32 },
      fontWeight: { type: 'number', default: 400, minimum: 100, maximum: 900 },
      letterSpacing: { type: 'number', default: 0, minimum: -2, maximum: 10 },
      scrollback: { type: 'number', default: 1000, minimum: 0, maximum: 100000 },
      cursorStyle: { type: 'string', enum: ['block', 'underline', 'bar'], default: 'block' },
      cursorBlink: { type: 'boolean', default: true },
      defaultShell: { type: 'string', default: process.env.SHELL || '/bin/zsh' },
      defaultWorkingDirectory: { type: 'string', default: process.env.HOME || '~' },
    },
    default: {},
  },
  projects: {
    type: 'object',
    properties: {
      recent: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            path: { type: 'string' },
            lastOpened: { type: 'number' },
          },
          required: ['id', 'name', 'path', 'lastOpened'],
        },
        default: [],
      },
      active: { type: ['string', 'null'], default: null },
    },
    default: {},
  },
} as const;

export const settingsStore = new Store<SettingsSchema>({
  schema,
  name: 'settings',
  // Migrations for future schema changes
  migrations: {
    '0.2.0': (store) => {
      // Example: Add new field with default
      const terminal = store.get('terminal');
      if (!terminal.letterSpacing) {
        store.set('terminal.letterSpacing', 0);
      }
    },
  },
});

// Helper methods
export class SettingsManager {
  static getAll(): SettingsSchema {
    return settingsStore.store;
  }

  static get<K extends keyof SettingsSchema>(key: K): SettingsSchema[K] {
    return settingsStore.get(key);
  }

  static set<K extends keyof SettingsSchema>(key: K, value: SettingsSchema[K]): void {
    settingsStore.set(key, value);
  }

  static setNested(key: string, value: unknown): void {
    settingsStore.set(key as any, value);
  }

  static reset(): void {
    settingsStore.clear();
  }

  static onDidChange<K extends keyof SettingsSchema>(
    key: K,
    callback: (newValue: SettingsSchema[K], oldValue: SettingsSchema[K]) => void
  ): () => void {
    return settingsStore.onDidChange(key, callback);
  }
}
```

### 2. IPC Bridge: Settings Channels

**Use when:** Exposing settings to renderer via IPC

```typescript
// main/ipc/settingsIpc.ts
import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../shared/types';
import { SettingsManager, settingsStore } from '../settings/SettingsStore';

export function registerSettingsIPCHandlers(mainWindow: BrowserWindow): () => void {
  // Get all settings
  const handleGetSettings = async () => {
    return { success: true, settings: SettingsManager.getAll() };
  };

  // Get specific setting
  const handleGetSetting = async (_event: Electron.IpcMainInvokeEvent, key: string) => {
    try {
      const value = settingsStore.get(key as any);
      return { success: true, value };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  };

  // Set setting
  const handleSetSetting = async (
    _event: Electron.IpcMainInvokeEvent,
    key: string,
    value: unknown
  ) => {
    try {
      SettingsManager.setNested(key, value);
      // Notify all windows of change
      mainWindow.webContents.send(IPC_CHANNELS.SETTINGS_CHANGED, key, value);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  };

  // Reset settings
  const handleResetSettings = async () => {
    try {
      SettingsManager.reset();
      mainWindow.webContents.send(IPC_CHANNELS.SETTINGS_CHANGED, null, SettingsManager.getAll());
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  };

  // Register handlers
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET_ALL, handleGetSettings);
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, handleGetSetting);
  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, handleSetSetting);
  ipcMain.handle(IPC_CHANNELS.SETTINGS_RESET, handleResetSettings);

  // Cleanup function
  return () => {
    ipcMain.removeHandler(IPC_CHANNELS.SETTINGS_GET_ALL);
    ipcMain.removeHandler(IPC_CHANNELS.SETTINGS_GET);
    ipcMain.removeHandler(IPC_CHANNELS.SETTINGS_SET);
    ipcMain.removeHandler(IPC_CHANNELS.SETTINGS_RESET);
  };
}
```

### 3. Preload: Context Bridge API

**Use when:** Exposing settings API to renderer

```typescript
// preload/index.ts additions
import { contextBridge, ipcRenderer } from 'electron';

// Add to BreadcrumbAPI interface
export interface SettingsAPI {
  getAll: () => Promise<{ success: boolean; settings?: Settings; error?: string }>;
  get: (key: string) => Promise<{ success: boolean; value?: unknown; error?: string }>;
  set: (key: string, value: unknown) => Promise<{ success: boolean; error?: string }>;
  reset: () => Promise<{ success: boolean; error?: string }>;
  onChanged: (callback: (key: string | null, value: unknown) => void) => () => void;
}

// Add to api object
const settingsAPI: SettingsAPI = {
  getAll: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET_ALL),
  get: (key) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET, key),
  set: (key, value) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET, key, value),
  reset: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_RESET),
  onChanged: (callback) => {
    const handler = (_: Electron.IpcRendererEvent, key: string | null, value: unknown) =>
      callback(key, value);
    ipcRenderer.on(IPC_CHANNELS.SETTINGS_CHANGED, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.SETTINGS_CHANGED, handler);
  },
};

// Expose via contextBridge
contextBridge.exposeInMainWorld('breadcrumbAPI', {
  // ... existing methods
  settings: settingsAPI,
});
```

### 4. Renderer: Zustand Settings Store

**Use when:** Managing settings state in renderer

```typescript
// renderer/store/settingsStore.ts
import { create } from 'zustand';

interface TerminalSettings {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  letterSpacing: number;
  scrollback: number;
  cursorStyle: 'block' | 'underline' | 'bar';
  cursorBlink: boolean;
  defaultShell: string;
  defaultWorkingDirectory: string;
}

interface SettingsState {
  terminal: TerminalSettings;
  isLoaded: boolean;
}

interface SettingsActions {
  loadSettings: () => Promise<void>;
  updateTerminalSetting: <K extends keyof TerminalSettings>(
    key: K,
    value: TerminalSettings[K]
  ) => Promise<void>;
  resetSettings: () => Promise<void>;
}

export type SettingsStore = SettingsState & SettingsActions;

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  terminal: {
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    fontSize: 14,
    fontWeight: 400,
    letterSpacing: 0,
    scrollback: 1000,
    cursorStyle: 'block',
    cursorBlink: true,
    defaultShell: '/bin/zsh',
    defaultWorkingDirectory: '~',
  },
  isLoaded: false,

  loadSettings: async () => {
    const result = await window.breadcrumbAPI.settings.getAll();
    if (result.success && result.settings) {
      set({ terminal: result.settings.terminal, isLoaded: true });
    }
  },

  updateTerminalSetting: async (key, value) => {
    const settingsPath = `terminal.${key}`;
    const result = await window.breadcrumbAPI.settings.set(settingsPath, value);
    if (result.success) {
      set((state) => ({
        terminal: { ...state.terminal, [key]: value },
      }));
    }
  },

  resetSettings: async () => {
    const result = await window.breadcrumbAPI.settings.reset();
    if (result.success) {
      await get().loadSettings();
    }
  },
}));

// Initialize settings on app load and listen for changes
export function initializeSettings(): () => void {
  const store = useSettingsStore.getState();

  // Load initial settings
  store.loadSettings();

  // Listen for changes from main process
  const unsubscribe = window.breadcrumbAPI.settings.onChanged((key, value) => {
    if (key === null) {
      // Full reset
      store.loadSettings();
    } else if (key.startsWith('terminal.')) {
      const terminalKey = key.replace('terminal.', '') as keyof TerminalSettings;
      useSettingsStore.setState((state) => ({
        terminal: { ...state.terminal, [terminalKey]: value },
      }));
    }
  });

  return unsubscribe;
}
```

### 5. Multi-Project Pattern with Zustand Slices

**Use when:** Managing multiple projects with per-project settings

```typescript
// renderer/store/projectsStore.ts
import { create } from 'zustand';

interface Project {
  id: string;
  name: string;
  path: string;
  lastOpened: number;
  // Per-project terminal settings overrides
  terminalOverrides?: Partial<TerminalSettings>;
  // Active terminal sessions in this project
  terminalSessions: string[];
}

interface ProjectsState {
  projects: Map<string, Project>;
  activeProjectId: string | null;
}

interface ProjectsActions {
  loadProjects: () => Promise<void>;
  setActiveProject: (id: string) => Promise<void>;
  addProject: (project: Omit<Project, 'id' | 'lastOpened' | 'terminalSessions'>) => Promise<void>;
  removeProject: (id: string) => Promise<void>;
  updateProjectOverrides: (id: string, overrides: Partial<TerminalSettings>) => Promise<void>;
  addTerminalSession: (projectId: string, sessionId: string) => void;
  removeTerminalSession: (projectId: string, sessionId: string) => void;
}

export type ProjectsStore = ProjectsState & ProjectsActions;

export const useProjectsStore = create<ProjectsStore>((set, get) => ({
  projects: new Map(),
  activeProjectId: null,

  loadProjects: async () => {
    const result = await window.breadcrumbAPI.settings.get('projects');
    if (result.success && result.value) {
      const { recent, active } = result.value as { recent: any[]; active: string | null };
      const projectsMap = new Map(
        recent.map((p) => [p.id, { ...p, terminalSessions: [] }])
      );
      set({ projects: projectsMap, activeProjectId: active });
    }
  },

  setActiveProject: async (id) => {
    await window.breadcrumbAPI.settings.set('projects.active', id);
    set({ activeProjectId: id });
  },

  addProject: async (project) => {
    const id = crypto.randomUUID();
    const newProject: Project = {
      id,
      ...project,
      lastOpened: Date.now(),
      terminalSessions: [],
    };

    const projects = new Map(get().projects);
    projects.set(id, newProject);

    // Update persistent storage
    const recentProjects = Array.from(projects.values()).map(({ terminalSessions, terminalOverrides, ...rest }) => rest);
    await window.breadcrumbAPI.settings.set('projects.recent', recentProjects);

    set({ projects });
  },

  removeProject: async (id) => {
    const projects = new Map(get().projects);
    projects.delete(id);

    const recentProjects = Array.from(projects.values()).map(({ terminalSessions, terminalOverrides, ...rest }) => rest);
    await window.breadcrumbAPI.settings.set('projects.recent', recentProjects);

    set({ projects, activeProjectId: get().activeProjectId === id ? null : get().activeProjectId });
  },

  updateProjectOverrides: async (id, overrides) => {
    const projects = new Map(get().projects);
    const project = projects.get(id);
    if (project) {
      project.terminalOverrides = { ...project.terminalOverrides, ...overrides };
      projects.set(id, project);
      set({ projects });
    }
  },

  addTerminalSession: (projectId, sessionId) => {
    const projects = new Map(get().projects);
    const project = projects.get(projectId);
    if (project && !project.terminalSessions.includes(sessionId)) {
      project.terminalSessions.push(sessionId);
      projects.set(projectId, project);
      set({ projects });
    }
  },

  removeTerminalSession: (projectId, sessionId) => {
    const projects = new Map(get().projects);
    const project = projects.get(projectId);
    if (project) {
      project.terminalSessions = project.terminalSessions.filter((id) => id !== sessionId);
      projects.set(projectId, project);
      set({ projects });
    }
  },
}));

// Selector hooks for active project
export const useActiveProject = () =>
  useProjectsStore((state) => {
    const activeId = state.activeProjectId;
    return activeId ? state.projects.get(activeId) : null;
  });

export const useProjectTerminalSettings = () => {
  const activeProject = useActiveProject();
  const globalSettings = useSettingsStore((state) => state.terminal);

  // Merge global settings with project overrides
  return activeProject?.terminalOverrides
    ? { ...globalSettings, ...activeProject.terminalOverrides }
    : globalSettings;
};
```

## Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| Custom JSON file persistence | electron-store | Handles file locking, atomic writes, corrupted data recovery |
| Manual schema validation | electron-store with ajv | Built-in JSON Schema validation with detailed error messages |
| Custom IPC security | contextBridge pattern | Prevents XSS attacks, follows Electron security best practices |
| Global Zustand store for projects | Slices pattern | Better code organization, scoped re-renders, easier testing |
| Manual settings sync | electron-store onDidChange + IPC | Built-in change detection, multi-window sync |

## Pitfalls

### Pitfall 1: Using electron-store Directly in Renderer
**What happens:** Security vulnerability. Renderer process could directly manipulate any file on disk. electron-store requires Node.js APIs which bypass context isolation.

**Avoid by:** ALWAYS use electron-store only in the main process. Expose methods via contextBridge with explicit validation.

### Pitfall 2: Forgetting Migration Path
**What happens:** Schema changes break existing user settings. Users lose their configuration on update.

**Avoid by:** Define migrations object in electron-store initialization. Test migrations with real user data before shipping. Never change field types without migration.

### Pitfall 3: Storing Large Data in electron-store
**What happens:** electron-store writes synchronously. Large objects (>1MB) freeze the main process. JSON parsing becomes expensive.

**Avoid by:** Only store settings/preferences (not cache or large datasets). Use IndexedDB in renderer for large data. Keep terminal scrollback in memory, not persisted.

### Pitfall 4: Not Validating IPC Inputs
**What happens:** Malicious renderer code could corrupt settings store by sending invalid data through IPC.

**Avoid by:** Validate all IPC inputs in handlers. Check event.sender.getURL() for untrusted content. Use TypeScript guards for runtime validation.

### Pitfall 5: Overwriting Default Terminal Shell
**What happens:** Hardcoding default shell breaks on different OSes. Users on Windows expect PowerShell, macOS users expect zsh, Linux varies.

**Avoid by:** Use `process.env.SHELL` as default with OS-specific fallbacks. Let users override per-project. Validate shell path exists before using.

### Pitfall 6: Not Handling Settings Load Timing
**What happens:** Components try to use settings before they're loaded from disk. Terminal renders with wrong font then flashes when settings arrive.

**Avoid by:** Wait for `isLoaded: true` before rendering terminal. Show loading skeleton. Initialize settings in App.tsx mount, not lazy.

## Terminal Settings Reference

Based on xterm.js ITerminalOptions:

| Setting | Type | xterm.js Property | Default | Notes |
|---------|------|-------------------|---------|-------|
| fontFamily | string | fontFamily | 'Menlo, Monaco, "Courier New", monospace' | Fallback chain important |
| fontSize | number | fontSize | 14 | Min 8, Max 32 recommended |
| fontWeight | number | fontWeight | 400 | 100-900, increments of 100 |
| letterSpacing | number | letterSpacing | 0 | CSS pixels, can be negative |
| scrollback | number | scrollback | 1000 | Rows retained, 0 = disabled |
| cursorStyle | enum | cursorStyle | 'block' | 'block' \| 'underline' \| 'bar' |
| cursorBlink | boolean | cursorBlink | true | Performance impact if true |

**Additional xterm.js options to consider:**
- `allowTransparency` (boolean) - Must be set before Terminal.open()
- `cursorWidth` (number) - Width when cursorStyle is 'bar'
- `smoothScrollDuration` (number) - Milliseconds, 0 = instant
- `theme` (object) - Color scheme (consider using global Dracula theme)

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────┐
│ Main Process                                                 │
│                                                              │
│  electron-store (settings.json)                             │
│  ├─ terminal: { fontSize, fontFamily, ... }                │
│  ├─ projects: { recent: [], active: id }                   │
│  └─ migrations: { "0.2.0": fn }                             │
│                                                              │
│  SettingsManager                                            │
│  ├─ get/set/reset                                           │
│  └─ onDidChange → broadcast to all windows                 │
│                                                              │
│  IPC Handlers                                               │
│  ├─ SETTINGS_GET_ALL                                       │
│  ├─ SETTINGS_SET                                            │
│  └─ SETTINGS_CHANGED (event to renderer)                   │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ contextBridge
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Preload                                                      │
│                                                              │
│  window.breadcrumbAPI.settings                              │
│  ├─ getAll()                                                │
│  ├─ set(key, value)                                         │
│  └─ onChanged(callback)                                     │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ IPC
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Renderer Process                                             │
│                                                              │
│  Zustand Stores                                             │
│  ├─ settingsStore (terminal: TerminalSettings)             │
│  ├─ projectsStore (projects: Map, activeProjectId)         │
│  └─ appStore (existing UI state)                           │
│                                                              │
│  Derived State                                              │
│  └─ useProjectTerminalSettings()                           │
│      → merges global + project overrides                    │
│                                                              │
│  Components                                                  │
│  ├─ TerminalInstance (consumes merged settings)            │
│  ├─ ProjectSwitcher (sets activeProjectId)                 │
│  └─ SettingsPanel (updates terminal settings)              │
└─────────────────────────────────────────────────────────────┘
```

## Open Questions

1. **Per-project theme overrides?** - Research indicated terminal color themes are best kept global (using Dracula). Confirm this is acceptable or if per-project themes are required.

2. **Project-specific shell?** - Should projects override the default shell? Use case: one project needs bash, another needs fish. Decision: support this in terminalOverrides.

3. **Import/Export settings?** - electron-store stores in JSON at `app.getPath('userData')/settings.json`. Users could manually backup, but should we provide export/import UI?

4. **Sync across machines?** - electron-store is local-only. If users want settings sync (similar to VS Code Settings Sync), would need cloud integration. Out of scope for Phase 09?

5. **Settings migration testing?** - What's the strategy for testing migrations without corrupting developer settings? Consider separate config file for tests.

## Sources

**HIGH confidence:**
- [electron-store - npm](https://www.npmjs.com/package/electron-store) - Latest version 11.0.2, API documentation
- [GitHub - sindresorhus/electron-store](https://github.com/sindresorhus/electron-store) - Official repository with examples
- [xterm.js Terminal Options](https://xtermjs.org/docs/api/terminal/interfaces/iterminaloptions/) - Official API docs for terminal configuration
- [Electron Context Isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation) - Official security documentation
- [Electron contextBridge](https://www.electronjs.org/docs/latest/api/context-bridge) - Official API docs for preload pattern
- [Zustand Slices Pattern](https://docs.pmnd.rs/zustand/guides/slices-pattern) - Official pattern for code organization

**MEDIUM confidence:**
- [Using TypeScript with electron-store](https://whoisryosuke.com/blog/2022/using-typescript-with-electron-store) - TypeScript integration patterns
- [Creating a synchronized store between main and renderer](https://www.bigbinary.com/blog/sync-store-main-renderer-electron) - IPC sync pattern
- [Zutron - Electron State Management](https://github.com/goosewobbler/zutron) - Alternative library for Zustand+Electron sync
- [React Context with Zustand](https://tkdodo.eu/blog/zustand-and-react-context) - Multi-instance pattern

**LOW confidence (needs validation):**
- [secure-electron-store](https://github.com/reZach/secure-electron-store) - Alternative with encryption, but adds complexity
- [electron-store-ipc-bridge](https://github.com/lejeunerenard/electron-store-ipc-bridge) - Helper library, but manual approach gives more control
