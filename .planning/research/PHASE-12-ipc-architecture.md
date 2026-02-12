# Research: IPC Architecture and Main Process Service Patterns

**Date:** 2026-02-12
**Domain:** Electron IPC, Main Process Architecture
**Overall Confidence:** HIGH

## TL;DR

Breadcrumb uses a clean 3-layer IPC architecture:
1. **Shared types** (`IPC_CHANNELS` constants) define channel names
2. **Main process handlers** register `ipcMain.handle()` for request/response and listen to service events to `send()` to renderer
3. **Preload bridge** exposes type-safe API via `contextBridge.exposeInMainWorld()`

Services follow EventEmitter pattern. IPC handlers are modular (one file per domain), return cleanup functions, and use guard flags to prevent duplicate registration.

## IPC Architecture Pattern

### 1. Channel Definitions (Shared Types)

**Location:** `/desktop/src/shared/types/index.ts`

All IPC channel names are defined as string constants in `IPC_CHANNELS`:

```typescript
export const IPC_CHANNELS = {
  // Request/response channels (use ipcMain.handle)
  TERMINAL_CREATE: "terminal:create",
  TERMINAL_WRITE: "terminal:write",
  TERMINAL_RESIZE: "terminal:resize",
  TERMINAL_TERMINATE: "terminal:terminate",

  // Event channels (use webContents.send from main → renderer)
  TERMINAL_DATA: "terminal:data",
  TERMINAL_EXIT: "terminal:exit",
  TERMINAL_PROCESS_CHANGE: "terminal:process-change",

  SETTINGS_GET_ALL: "settings:get-all",
  SETTINGS_SET: "settings:set",
  SETTINGS_CHANGED: "settings:changed", // Event channel

  // ... more channels
} as const;
```

**Pattern:**
- Request/response: `noun:verb` (e.g., `terminal:create`, `settings:get`)
- Events (main → renderer): `noun:event-name` (e.g., `terminal:data`, `settings:changed`)

### 2. Preload Bridge (Type-Safe API)

**Location:** `/desktop/src/preload/index.ts`

The preload script:
1. Defines the renderer API interface (`BreadcrumbAPI`)
2. Maps API methods to `ipcRenderer.invoke()` or `ipcRenderer.on()`
3. Exposes via `contextBridge.exposeInMainWorld("breadcrumbAPI", api)`

```typescript
export interface BreadcrumbAPI {
  // Request/response operations (invoke pattern)
  createTerminal: (config) => Promise<{ success: boolean; sessionId?: string; error?: string }>;
  writeTerminal: (sessionId: string, data: string) => Promise<{ success: boolean; error?: string }>;

  // Event listeners (on pattern) - return cleanup function
  onTerminalData: (callback: (data: TerminalDataEvent) => void) => () => void;
  onTerminalExit: (callback: (data: TerminalExitEvent) => void) => () => void;
}

const api: BreadcrumbAPI = {
  createTerminal: (config) =>
    ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_CREATE, config),

  writeTerminal: (sessionId, data) =>
    ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_WRITE, { sessionId, data }),

  onTerminalData: (callback) => {
    const handler = (_: Electron.IpcRendererEvent, data: TerminalDataEvent) =>
      callback(data);
    ipcRenderer.on(IPC_CHANNELS.TERMINAL_DATA, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.TERMINAL_DATA, handler);
  },
};

contextBridge.exposeInMainWorld("breadcrumbAPI", api);
```

**Key Patterns:**
- All async operations return `Promise<{ success: boolean; error?: string; ... }>`
- Event listeners return cleanup functions for unsubscribing
- Type safety enforced via `BreadcrumbAPI` interface
- Renderer accesses via `window.breadcrumbAPI.*`

### 3. Main Process IPC Handlers

**Location:** `/desktop/src/main/ipc/*.ts`

Each domain has its own IPC handler file:
- `handlers.ts` - Core system operations (file dialogs, git, system info)
- `terminalIpc.ts` - Terminal operations
- `settingsIpc.ts` - Settings management
- `extensionIpc.ts` - Extension management

**Handler Registration Pattern:**

```typescript
// terminalIpc.ts
export function registerTerminalIPCHandlers(mainWindow: BrowserWindow): () => void {
  // Guard against duplicate registration
  if (handlersRegistered) return () => {};
  handlersRegistered = true;

  // Register request/response handlers
  ipcMain.handle(
    IPC_CHANNELS.TERMINAL_CREATE,
    async (_, config: { id: string; name: string; workingDirectory: string }) => {
      try {
        const sessionId = terminalService.createSession(config);
        return { success: true, sessionId };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }
  );

  // Listen to service events and forward to renderer
  const dataHandler = (data: { sessionId: string; data: string }) => {
    mainWindow.webContents.send(IPC_CHANNELS.TERMINAL_DATA, data);
  };
  terminalService.on("data", dataHandler);

  // Return cleanup function
  return () => {
    terminalService.off("data", dataHandler);
    ipcMain.removeHandler(IPC_CHANNELS.TERMINAL_CREATE);
    handlersRegistered = false;
  };
}
```

**Key Patterns:**
1. **Guard flag** (`handlersRegistered`) prevents duplicate registration
2. **Request/response** uses `ipcMain.handle()` - async, returns result
3. **Events** use service EventEmitter → `mainWindow.webContents.send()`
4. **Error handling**: Always wrap in try/catch, return `{ success: false, error }`
5. **Return cleanup function** to remove all handlers and listeners
6. **Typed parameters** destructured from event args

### 4. Main Process Services

Services are singleton classes that:
1. Extend `EventEmitter` for async events
2. Provide synchronous/async methods for operations
3. Emit events that IPC handlers forward to renderer

**Example: TerminalService**

```typescript
export class TerminalService extends EventEmitter {
  private sessions: Map<string, TerminalSession> = new Map();

  createSession(config: TerminalConfig): string {
    const ptyProcess = pty.spawn(shell, [], { ... });

    this.sessions.set(id, { id, name, pty: ptyProcess, workingDirectory });

    // Emit events for IPC handlers to forward
    ptyProcess.onData((data: string) => {
      this.emit("data", { sessionId: id, data });
    });

    ptyProcess.onExit(({ exitCode, signal }) => {
      this.emit("exit", { sessionId: id, exitCode, signal });
    });

    return id;
  }

  write(sessionId: string, data: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    session.pty.write(data);
    return true;
  }
}

export const terminalService = new TerminalService();
```

**Example: GitService**

```typescript
export class GitService {
  // Simple stateless service - no EventEmitter needed
  getGitInfo(workingDirectory: string): GitInfo {
    if (!this.isGitRepo(workingDirectory)) {
      return { isGitRepo: false, branch: "", remote: "", repoName: "", provider: null };
    }

    const branch = this.getBranch(workingDirectory);
    const remote = this.getRemote(workingDirectory);
    return { isGitRepo: true, branch, remote, ... };
  }

  private isGitRepo(workingDirectory: string): boolean {
    try {
      execSync("git rev-parse --is-inside-work-tree", { cwd: workingDirectory });
      return true;
    } catch {
      return false;
    }
  }
}

export const gitService = new GitService();
```

**Service Patterns:**
- **Stateful services** (Terminal, Extensions): Use EventEmitter, manage state
- **Stateless services** (Git): No EventEmitter, pure functions
- **Singleton exports**: `export const serviceName = new ServiceClass()`
- **Events**: Service emits, IPC handler listens and forwards to renderer

### 5. Main Process Registration

**Location:** `/desktop/src/main/index.ts`

```typescript
let mainWindow: BrowserWindow | null = null;
let cleanupIPC: (() => void) | null = null;
let cleanupTerminalIPC: (() => void) | null = null;
let cleanupExtensionIPC: (() => void) | null = null;
let cleanupSettingsIPC: (() => void) | null = null;

function setupMainWindow(): void {
  if (!mainWindow) return;

  // Register all IPC handlers
  cleanupIPC = registerIPCHandlers(mainWindow);
  cleanupTerminalIPC = registerTerminalIPCHandlers(mainWindow);
  cleanupSettingsIPC = registerSettingsIPCHandlers(mainWindow);
  cleanupExtensionIPC = registerExtensionIPCHandlers(mainWindow, extensionManager);
}

function cleanupMainWindow(): void {
  if (cleanupIPC) { cleanupIPC(); cleanupIPC = null; }
  if (cleanupTerminalIPC) { cleanupTerminalIPC(); cleanupTerminalIPC = null; }
  if (cleanupExtensionIPC) { cleanupExtensionIPC(); cleanupExtensionIPC = null; }
  if (cleanupSettingsIPC) { cleanupSettingsIPC(); cleanupSettingsIPC = null; }
}

app.whenReady().then(() => {
  mainWindow = createMainWindow();
  setupMainWindow();

  mainWindow.on("closed", () => {
    cleanupMainWindow();
    mainWindow = null;
  });
});
```

## IPC Communication Patterns

### Request/Response (Invoke/Handle)

**Use when:** Renderer needs a result from main process

**Main process:**
```typescript
ipcMain.handle(IPC_CHANNELS.TERMINAL_CREATE, async (_, config) => {
  try {
    const result = terminalService.createSession(config);
    return { success: true, sessionId: result };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});
```

**Preload:**
```typescript
createTerminal: (config) =>
  ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_CREATE, config),
```

**Renderer:**
```typescript
const result = await window.breadcrumbAPI.createTerminal({ id, name, workingDirectory });
if (result.success) {
  console.log("Created:", result.sessionId);
}
```

### Fire-and-Forget Events (Main → Renderer)

**Use when:** Main process needs to notify renderer (service events, status changes)

**Main process (IPC handler):**
```typescript
const dataHandler = (data: { sessionId: string; data: string }) => {
  mainWindow.webContents.send(IPC_CHANNELS.TERMINAL_DATA, data);
};
terminalService.on("data", dataHandler);
```

**Preload:**
```typescript
onTerminalData: (callback) => {
  const handler = (_: Electron.IpcRendererEvent, data: TerminalDataEvent) =>
    callback(data);
  ipcRenderer.on(IPC_CHANNELS.TERMINAL_DATA, handler);
  return () => ipcRenderer.removeListener(IPC_CHANNELS.TERMINAL_DATA, handler);
},
```

**Renderer:**
```typescript
useEffect(() => {
  const cleanup = window.breadcrumbAPI.onTerminalData((data) => {
    console.log("Terminal data:", data);
  });
  return cleanup;
}, []);
```

### Bidirectional Event Streaming (Settings)

**Use when:** Renderer can modify state AND needs to be notified of changes

**Main process:**
```typescript
// Handle set request
ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, (_, key: string, value: unknown) => {
  SettingsManager.set(key, value);
  return { success: true };
});

// Watch for changes and broadcast
const unsubscribe = settingsStore.onDidAnyChange((newValue) => {
  mainWindow.webContents.send(IPC_CHANNELS.SETTINGS_CHANGED, newValue);
});
```

**Preload:**
```typescript
setSetting: (key, value) =>
  ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET, key, value),

onSettingsChanged: (callback) => {
  const handler = (_, data: Record<string, unknown>) => callback(data);
  ipcRenderer.on(IPC_CHANNELS.SETTINGS_CHANGED, handler);
  return () => ipcRenderer.removeListener(IPC_CHANNELS.SETTINGS_CHANGED, handler);
},
```

## Directory Structure

```
desktop/src/
├── shared/
│   └── types/
│       └── index.ts           # IPC_CHANNELS + shared interfaces
├── preload/
│   └── index.ts               # BreadcrumbAPI + contextBridge
├── main/
│   ├── index.ts               # App entry, IPC registration orchestration
│   ├── ipc/
│   │   ├── handlers.ts        # Core system IPC (dialogs, git, files)
│   │   ├── terminalIpc.ts     # Terminal IPC handlers
│   │   ├── settingsIpc.ts     # Settings IPC handlers
│   │   └── extensionIpc.ts    # Extension IPC handlers
│   ├── terminal/
│   │   └── TerminalService.ts # Terminal service (EventEmitter)
│   ├── settings/
│   │   └── SettingsStore.ts   # Settings service (electron-store)
│   ├── git/
│   │   └── GitService.ts      # Git service (stateless)
│   └── extensions/
│       └── ExtensionManager.ts # Extension service (EventEmitter)
└── renderer/
    └── ... (React components using window.breadcrumbAPI)
```

## Key Design Principles

### 1. Security (Context Isolation)

- **NEVER** expose `ipcRenderer` directly to renderer
- Use `contextBridge.exposeInMainWorld()` to create sandboxed API
- Type safety via `BreadcrumbAPI` interface prevents misuse

### 2. Type Safety

- Shared `IPC_CHANNELS` prevents typos
- TypeScript interfaces for all IPC payloads
- Preload defines complete renderer API surface

### 3. Modularity

- One IPC handler file per domain/service
- Services are independent, testable classes
- IPC handlers are thin adapters (service → IPC)

### 4. Resource Management

- All handler registration functions return cleanup functions
- Main process tracks cleanup functions, calls on window close
- Services clean up resources on shutdown (`terminateAll()`)

### 5. Error Handling

- Always return `{ success: boolean; error?: string }` from IPC handlers
- Never throw across IPC boundary
- Services throw, IPC handlers catch and convert to result objects

### 6. Consistency

- Request/response: Always use `ipcMain.handle()` + `ipcRenderer.invoke()`
- Events: Always use `webContents.send()` + `ipcRenderer.on()`
- Event listeners in preload always return cleanup functions
- All async operations return promises

## Recommended Patterns for New Services

### Creating a New Service

```typescript
// src/main/myservice/MyService.ts
import { EventEmitter } from "events";

export interface MyConfig {
  id: string;
  name: string;
}

export class MyService extends EventEmitter {
  private state: Map<string, any> = new Map();

  doSomething(config: MyConfig): string {
    // Do work
    const result = "result-id";

    // Emit events for async notifications
    this.emit("something-happened", { id: result, data: "..." });

    return result;
  }

  cleanup(): void {
    this.state.clear();
  }
}

export const myService = new MyService();
```

### Adding IPC Handlers

```typescript
// src/main/ipc/myServiceIpc.ts
import { BrowserWindow, ipcMain } from "electron";
import { IPC_CHANNELS } from "../../shared/types";
import { myService } from "../myservice/MyService";

let handlersRegistered = false;

export function registerMyServiceIPCHandlers(mainWindow: BrowserWindow): () => void {
  if (handlersRegistered) return () => {};
  handlersRegistered = true;

  // Request/response handlers
  ipcMain.handle(
    IPC_CHANNELS.MY_DO_SOMETHING,
    async (_, config: MyConfig) => {
      try {
        const result = myService.doSomething(config);
        return { success: true, result };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }
  );

  // Event forwarding
  const eventHandler = (data: any) => {
    mainWindow.webContents.send(IPC_CHANNELS.MY_EVENT, data);
  };
  myService.on("something-happened", eventHandler);

  // Cleanup
  return () => {
    myService.off("something-happened", eventHandler);
    ipcMain.removeHandler(IPC_CHANNELS.MY_DO_SOMETHING);
    handlersRegistered = false;
  };
}
```

### Updating Shared Types

```typescript
// src/shared/types/index.ts
export const IPC_CHANNELS = {
  // ... existing channels
  MY_DO_SOMETHING: "my:do-something",
  MY_EVENT: "my:event",
} as const;

export interface MyEventData {
  id: string;
  data: string;
}
```

### Updating Preload

```typescript
// src/preload/index.ts
export interface BreadcrumbAPI {
  // ... existing methods
  doSomething: (config: MyConfig) => Promise<{ success: boolean; result?: string; error?: string }>;
  onMyEvent: (callback: (data: MyEventData) => void) => () => void;
}

const api: BreadcrumbAPI = {
  // ... existing implementations
  doSomething: (config) =>
    ipcRenderer.invoke(IPC_CHANNELS.MY_DO_SOMETHING, config),

  onMyEvent: (callback) => {
    const handler = (_: Electron.IpcRendererEvent, data: MyEventData) =>
      callback(data);
    ipcRenderer.on(IPC_CHANNELS.MY_EVENT, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.MY_EVENT, handler);
  },
};
```

### Registering in Main

```typescript
// src/main/index.ts
import { registerMyServiceIPCHandlers } from "./ipc/myServiceIpc";

let cleanupMyServiceIPC: (() => void) | null = null;

function setupMainWindow(): void {
  if (!mainWindow) return;
  cleanupIPC = registerIPCHandlers(mainWindow);
  cleanupTerminalIPC = registerTerminalIPCHandlers(mainWindow);
  cleanupMyServiceIPC = registerMyServiceIPCHandlers(mainWindow); // Add here
}

function cleanupMainWindow(): void {
  if (cleanupIPC) { cleanupIPC(); cleanupIPC = null; }
  if (cleanupTerminalIPC) { cleanupTerminalIPC(); cleanupTerminalIPC = null; }
  if (cleanupMyServiceIPC) { cleanupMyServiceIPC(); cleanupMyServiceIPC = null; } // Add here
}
```

## Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| Direct ipcRenderer in renderer | contextBridge + typed API | Security: prevents XSS from accessing ipcRenderer |
| String literals for channels | IPC_CHANNELS constants | Type safety: single source of truth, prevents typos |
| Manual cleanup tracking | Return cleanup functions | Memory leaks: ensures proper listener removal |
| Throwing errors across IPC | `{ success, error }` objects | IPC errors are opaque, won't serialize properly |
| Storing state in IPC handlers | Services with EventEmitter | Separation of concerns: IPC is transport, services are logic |

## Pitfalls

### Duplicate Handler Registration

**What happens:** Electron throws error: "Attempted to register a second handler"

**Avoid by:** Use guard flag (`handlersRegistered`) in handler registration functions

### Memory Leaks from Event Listeners

**What happens:** Event listeners accumulate on window reload/navigation, causing duplicate events and memory leaks

**Avoid by:**
- Always return cleanup functions from event listener registrations
- Call cleanup on `window.closed` event in main process
- In React renderer, return cleanup from `useEffect`

### Forgetting to Forward Service Events

**What happens:** Service emits events but renderer never receives them

**Avoid by:** Always register service event listeners in IPC handler and forward via `webContents.send()`

### Not Handling Destroyed Windows

**What happens:** `webContents.send()` throws if window is destroyed

**Avoid by:** Check `!mainWindow.isDestroyed()` before sending (see `settingsIpc.ts` and `extensionIpc.ts` examples)

```typescript
const unsubscribe = settingsStore.onDidAnyChange((newValue) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(IPC_CHANNELS.SETTINGS_CHANGED, newValue);
  }
});
```

### Passing Non-Serializable Data Across IPC

**What happens:** Functions, class instances, circular references fail to serialize

**Avoid by:**
- Only pass JSON-serializable data (plain objects, arrays, primitives)
- Convert class instances to plain objects before sending
- For file operations, pass paths not file handles

### Not Using Async for Long Operations

**What happens:** Blocking the main process freezes the UI

**Avoid by:**
- Always use `async` in `ipcMain.handle()` handlers
- For CPU-intensive work, use worker threads or child processes
- For I/O, use async Node.js APIs (fs.promises, child_process async)

## Sources

**HIGH confidence:**
- `/desktop/src/shared/types/index.ts` - IPC channel definitions and type contracts
- `/desktop/src/preload/index.ts` - Complete preload bridge implementation
- `/desktop/src/main/index.ts` - Main process IPC registration orchestration
- `/desktop/src/main/ipc/terminalIpc.ts` - Example of stateful service IPC pattern
- `/desktop/src/main/ipc/settingsIpc.ts` - Example of settings synchronization pattern
- `/desktop/src/main/ipc/handlers.ts` - Example of simple request/response handlers
- `/desktop/src/main/ipc/extensionIpc.ts` - Example of complex service with bidirectional events
- `/desktop/src/main/terminal/TerminalService.ts` - EventEmitter-based service pattern
- `/desktop/src/main/git/GitService.ts` - Stateless service pattern
- `/desktop/src/main/settings/SettingsStore.ts` - Settings management with electron-store
- `/desktop/src/main/extensions/ExtensionManager.ts` - Complex service with lifecycle management

All sources are from the actual codebase, no external references needed.
