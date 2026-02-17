# Research: Extension API Patterns — Adding New Capabilities

**Date:** 2026-02-17
**Domain:** Electron Extension System, IPC Architecture
**Overall Confidence:** HIGH (all findings derived directly from source code)

---

## TL;DR

The extension system is a 3-layer sandwich: Worker process (runs extension code) ↔ Main process (ExtensionHost.ts bridges) ↔ Renderer (via Electron IPC + preload). Every new API capability requires touching all 5 files in a predictable pattern. The terminal and modal systems already exist in the main process — extension access is purely a matter of adding the right IPC messages.

---

## System Architecture (from source)

```
Worker process (extensionHostWorker.ts)
  ↕ process.send() / process.on("message")
  ↕ types: HostMessage (main→worker), HostResponse (worker→main)
Main process (ExtensionHost.ts)
  ↕ EventEmitter + pendingRequests Map (request/response correlation)
ExtensionManager.ts (listens to ExtensionHost events)
  ↕ EventEmitter
extensionIpc.ts (ipcMain.handle + mainWindow.webContents.send)
  ↕ Electron IPC
preload/index.ts (contextBridge.exposeInMainWorld)
  ↕ window.breadcrumbAPI
Renderer (React components, stores)
```

---

## Part 1: Current IPC Message Protocol

### HostMessage (main process → worker)

Defined in `desktop/src/main/extensions/types.ts`:

```typescript
export type HostMessage =
  | { type: "activate"; extensionId: string; extensionPath: string; main: string }
  | { type: "deactivate"; extensionId: string }
  | { type: "execute-command"; commandId: string; args: unknown[] }
  | { type: "shutdown" };
```

### HostResponse (worker → main process)

```typescript
export type HostResponse =
  | { type: "activated"; extensionId: string }
  | { type: "deactivated"; extensionId: string }
  | { type: "command-result"; commandId: string; result: unknown }
  | { type: "error"; extensionId?: string; message: string; stack?: string }
  | { type: "register-command"; extensionId: string; commandId: string }
  | { type: "log"; level: "info" | "warn" | "error"; message: string };
```

### How ExtensionHost correlates requests/responses

`ExtensionHost.ts` uses a `pendingRequests: Map<string, {resolve, reject}>` keyed by compound string IDs:
- Activation: `"activate:<extensionId>"`
- Deactivation: `"deactivate:<extensionId>"`
- Commands: `"command:<commandId>"`

Fire-and-forget messages (no correlation needed): `register-command`, `log`, `error` (the last two emit events on ExtensionHost instead of resolving a pending promise).

---

## Part 2: `breadcrumb.commands.registerCommand()` End-to-End

### In the worker (extensionHostWorker.ts)

During `handleActivate()`, the worker patches `breadcrumb.commands.registerCommand` to inject the `extensionId`:

```
Extension calls: breadcrumb.commands.registerCommand("myCmd", handler)
Worker patches the ID to: "my-extension.myCmd" (prefixed)
Worker calls: commands.set("my-extension.myCmd", handler)  // local Map
Worker sends: { type: "register-command", extensionId, commandId: "my-extension.myCmd" }
```

### In the main process (ExtensionHost.ts → handleMessage)

```
case "register-command":
  → this.emit("command-registered", msg.extensionId, msg.commandId)
```

### In ExtensionManager.ts

```
this.host.on("command-registered", (extId, cmdId) => {
  this.registeredCommands.set(cmdId, extId)  // tracks commandId → extensionId
  this.emit("commands-changed")
})
```

### When a command executes

1. Renderer calls `window.breadcrumbAPI.executeExtensionCommand("my-extension.myCmd")`
2. Preload invokes `ipcRenderer.invoke(EXTENSIONS_EXECUTE_COMMAND, commandId, ...args)`
3. `extensionIpc.ts` receives it, calls `extensionManager.executeCommand(commandId, ...args)`
4. `ExtensionManager.executeCommand()` validates the command exists in `registeredCommands`, then calls `this.host.executeCommand(commandId, args)`
5. `ExtensionHost.executeCommand()` sends `{ type: "execute-command", commandId, args }` to the worker, stores a pending promise keyed by `"command:<commandId>"`
6. Worker's `handleCommand()` finds the handler in its local `commands` Map, executes it, sends back `{ type: "command-result", commandId, result }`
7. ExtensionHost resolves the pending promise → returns to extensionIpc → returns `{ success: true, result }` to preload → renderer gets the result

---

## Part 3: Adding New Message Types

### The 5-file checklist for any new API

Every new API capability requires touching exactly these files in this order:

1. **`types.ts`** — Add union member to `HostMessage` and/or `HostResponse`
2. **`extensionHostWorker.ts`** — Add the API to `breadcrumb.*` object + add a handler in the `process.on("message")` switch (if main→worker direction needed)
3. **`ExtensionHost.ts`** — Add a typed method that sends the message + handles the response (either via `pendingRequests` or by emitting an event)
4. **`ExtensionManager.ts`** — Add any state management or forwarding logic needed
5. **`extensionIpc.ts`** — Add `ipcMain.handle(...)` if the renderer needs to call it, or `mainWindow.webContents.send(...)` if the main process needs to push to renderer. Also add to the cleanup return function.

Optionally:
6. **`shared/types/index.ts`** — Add new `IPC_CHANNELS` constant(s)
7. **`preload/index.ts`** — Add to the `BreadcrumbAPI` interface + `api` object + `contextBridge.exposeInMainWorld`

### The two message directions

**Worker → Main (fire-and-forget, no correlation needed):**
Used for: notifications, registrations, logs
Pattern: Worker sends a `HostResponse`, ExtensionHost `handleMessage` emits an event, ExtensionManager listens and acts

**Main → Worker → Main (request/response):**
Used for: actions that return data (execute command, create terminal)
Pattern: ExtensionHost sends `HostMessage`, stores pending in `pendingRequests`, worker sends back a `HostResponse`, ExtensionHost resolves the pending promise

**Main → Renderer (push):**
Used for: status updates, events that happened outside renderer's knowledge
Pattern: `mainWindow.webContents.send(IPC_CHANNELS.SOME_EVENT, data)` from `extensionIpc.ts`

---

## Part 4: How to Add `breadcrumb.terminal.createTerminal()`

### What already exists

The full terminal system is operational:
- `TerminalService` (singleton `terminalService`) in `desktop/src/main/terminal/TerminalService.ts`
- IPC handlers in `terminalIpc.ts` on channels `TERMINAL_CREATE`, `TERMINAL_WRITE`, etc.
- The renderer already creates terminals via `window.breadcrumbAPI.createTerminal(config)`

The extension API needs to bridge: worker → main → `terminalService.createSession()` → notify renderer to mount a terminal UI.

### Message additions needed

**In `types.ts`, add to `HostMessage`:**
```typescript
| { type: "terminal-create"; requestId: string; name: string; workingDirectory: string; shell?: string }
```

**In `types.ts`, add to `HostResponse`:**
```typescript
| { type: "terminal-create-result"; requestId: string; sessionId: string; success: boolean; error?: string }
```

A `requestId` is needed because multiple terminal creates can be in flight simultaneously. Use `crypto.randomUUID()` in the worker.

### In `extensionHostWorker.ts`

Add to `breadcrumb` API object:
```typescript
terminal: {
  createTerminal(options: { name: string; workingDirectory?: string; shell?: string }) {
    const requestId = Math.random().toString(36).slice(2);
    // Returns a promise resolved when main confirms creation
    return new Promise((resolve, reject) => {
      pendingTerminalRequests.set(requestId, { resolve, reject });
      sendToMain({ type: "terminal-create", requestId, ...options });
    });
  }
}
```

Handle the response in `process.on("message")`:
```typescript
case "terminal-create-result":
  const pending = pendingTerminalRequests.get(msg.requestId);
  if (pending) {
    if (msg.success) pending.resolve({ sessionId: msg.sessionId });
    else pending.reject(new Error(msg.error));
    pendingTerminalRequests.delete(msg.requestId);
  }
  break;
```

### In `ExtensionHost.ts`

Add to `handleMessage`:
```typescript
case "terminal-create-request":
  this.emit("terminal-create-request", msg.requestId, msg.name, msg.workingDirectory, msg.shell);
  break;
```

ExtensionHost emits the event upward; ExtensionManager handles the actual work.

### In `ExtensionManager.ts`

```typescript
this.host.on("terminal-create-request", (requestId, name, workingDirectory, shell) => {
  // terminalService is already a singleton imported in index.ts
  // ExtensionManager needs a reference to it, pass via constructor or import
  const sessionId = `ext-${Date.now()}`;
  try {
    terminalService.createSession({ id: sessionId, name, workingDirectory: workingDirectory || os.homedir(), shell });
    // Tell the renderer to open a terminal pane
    this.emit("terminal-created", sessionId, name);
    // Tell the worker the creation succeeded
    this.host.send({ type: "terminal-create-result", requestId, sessionId, success: true });
  } catch (err) {
    this.host.send({ type: "terminal-create-result", requestId, sessionId: "", success: false, error: String(err) });
  }
});
```

### In `extensionIpc.ts`

Forward the `terminal-created` event to the renderer:
```typescript
extensionManager.on("terminal-created", (sessionId, name) => {
  if (!mainWindow.isDestroyed()) {
    mainWindow.webContents.send(IPC_CHANNELS.EXTENSIONS_TERMINAL_CREATED, { sessionId, name });
  }
});
```

Add `EXTENSIONS_TERMINAL_CREATED: "extensions:terminal-created"` to `IPC_CHANNELS`.

### In the renderer

The renderer listens for `EXTENSIONS_TERMINAL_CREATED`, then calls `useAppStore.getState().addPane(...)` or `initializeTabPanes(...)` to open a terminal pane pointing at that `sessionId`. This is the same path the UI already takes when a user manually opens a terminal tab.

### Capability check

The manifest already declares `terminal: boolean` in `ExtensionCapabilities`. Before accepting the `terminal-create-request`, check the extension's capability. ExtensionManager has `this.extensions.get(extensionId).manifest.breadcrumb?.capabilities?.terminal`.

---

## Part 5: How to Add `breadcrumb.window.showModal()`

### What exists for UI triggering

The renderer already receives push events from the main process in two patterns:
1. `EXTENSIONS_STATUS_CHANGED` — fires when extension state changes, renderer listens in `ExtensionsPanel.tsx`
2. `mainWindow.webContents.send(channel, data)` — the general pattern for main→renderer push

There is no existing modal system in the codebase. The renderer has no modal store. This needs to be built in the renderer as well as wired through IPC.

### Full flow for showModal

**In `types.ts`, add to `HostResponse`:**
```typescript
| { type: "show-modal"; requestId: string; title: string; message: string; buttons: string[] }
```

**In `types.ts`, add to `HostMessage`:**
```typescript
| { type: "modal-result"; requestId: string; buttonIndex: number }
```

**In `extensionHostWorker.ts`, add to `breadcrumb.window`:**
```typescript
showModal(options: { title: string; message: string; buttons?: string[] }): Promise<number> {
  const requestId = Math.random().toString(36).slice(2);
  return new Promise((resolve) => {
    pendingModalRequests.set(requestId, resolve);
    sendToMain({
      type: "show-modal",
      requestId,
      title: options.title,
      message: options.message,
      buttons: options.buttons || ["OK"],
    });
  });
}
```

Handle the modal result coming back from main:
```typescript
case "modal-result":
  const resolve = pendingModalRequests.get(msg.requestId);
  if (resolve) {
    resolve(msg.buttonIndex);
    pendingModalRequests.delete(msg.requestId);
  }
  break;
```

**In `ExtensionHost.ts`, `handleMessage`:**
```typescript
case "show-modal":
  this.emit("show-modal", msg.requestId, msg.title, msg.message, msg.buttons);
  break;
```

**In `extensionIpc.ts`:**
- Push the modal request to the renderer:
  ```typescript
  extensionManager.on("show-modal", (requestId, title, message, buttons) => {
    mainWindow.webContents.send(IPC_CHANNELS.EXTENSIONS_SHOW_MODAL, { requestId, title, message, buttons });
  });
  ```
- Add an IPC handler for when the renderer sends back the button choice:
  ```typescript
  ipcMain.handle(IPC_CHANNELS.EXTENSIONS_MODAL_RESULT, async (_event, requestId: string, buttonIndex: number) => {
    extensionManager.resolveModal(requestId, buttonIndex);
  });
  ```

**In `ExtensionManager.ts`:**
```typescript
resolveModal(requestId: string, buttonIndex: number): void {
  this.host.send({ type: "modal-result", requestId, buttonIndex });
}
```

**In the renderer**, add a Zustand store slice or a React context for pending modals. The renderer listens for `EXTENSIONS_SHOW_MODAL`, renders a modal component, and when the user clicks a button, calls `window.breadcrumbAPI.resolveExtensionModal(requestId, buttonIndex)`.

**Simpler alternative:** Use Electron's built-in `dialog.showMessageBox()` which runs in the main process with no renderer involvement. The modal blocks the extension until answered, no renderer changes needed. This is appropriate for simple confirmation dialogs.

```typescript
// In extensionIpc.ts or ExtensionManager.ts
import { dialog } from "electron";

extensionManager.on("show-modal", async (requestId, title, message, buttons) => {
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: "question",
    title,
    message,
    buttons,
  });
  extensionManager.resolveModal(requestId, response);
});
```

This avoids all renderer changes for the initial implementation.

---

## Part 6: How to Add `context.workspaceState`

### What exists

`SettingsStore.ts` uses `electron-store` (already installed and used throughout the app). `settingsStore` is the singleton. The key structure is `settings.json` at the app's userData path.

Extension state should be stored separately from app settings to avoid schema conflicts.

### Design

Create a separate `electron-store` instance for extension data, keyed by `extensionId`:

```typescript
// desktop/src/main/extensions/ExtensionStore.ts
import Store from "electron-store";

const extensionDataStore = new Store<Record<string, Record<string, unknown>>>({
  name: "extension-data",  // → extension-data.json in userData
  defaults: {},
});

export class ExtensionStateManager {
  static get(extensionId: string, key: string): unknown {
    return extensionDataStore.get(`${extensionId}.${key}`);
  }

  static set(extensionId: string, key: string, value: unknown): void {
    extensionDataStore.set(`${extensionId}.${key}`, value);
  }

  static clear(extensionId: string): void {
    // Remove all keys for this extension on deactivation
    const all = extensionDataStore.store;
    for (const k of Object.keys(all)) {
      if (k.startsWith(`${extensionId}.`)) {
        extensionDataStore.delete(k as never);
      }
    }
  }
}
```

### IPC messages needed

**In `types.ts`, add to `HostResponse`:**
```typescript
| { type: "state-get"; requestId: string; extensionId: string; key: string }
| { type: "state-set"; extensionId: string; key: string; value: unknown }
```

**In `types.ts`, add to `HostMessage`:**
```typescript
| { type: "state-get-result"; requestId: string; value: unknown }
```

### In `extensionHostWorker.ts`

Extend `ExtensionContext` interface:
```typescript
interface ExtensionContext {
  subscriptions: Disposable[];
  extensionPath: string;
  extensionId: string;
  workspaceState: {
    get<T>(key: string): T | undefined;
    update(key: string, value: unknown): Promise<void>;
  };
}
```

During `handleActivate()`, construct the `workspaceState` object bound to the extension's ID:
```typescript
const context: ExtensionContext = {
  subscriptions: [],
  extensionPath,
  extensionId,
  workspaceState: {
    get<T>(key: string): T | undefined {
      // Synchronous lookup not possible over IPC — use cached values
      return stateCache.get(`${extensionId}.${key}`) as T | undefined;
    },
    async update(key: string, value: unknown): Promise<void> {
      stateCache.set(`${extensionId}.${key}`, value);
      sendToMain({ type: "state-set", extensionId, key, value });
    }
  }
};
```

For `get()` to work synchronously on first access, the worker needs to receive an initial state dump when activating. Add a state snapshot to the `activate` HostMessage:

```typescript
| { type: "activate"; extensionId: string; extensionPath: string; main: string; initialState: Record<string, unknown> }
```

`ExtensionManager.activateExtension()` reads the extension's state from `ExtensionStateManager` before sending the activate message.

### In `ExtensionHost.ts`

When sending the `activate` message, include the initial state dump. When receiving `state-set` from the worker, emit an event for ExtensionManager to persist.

```typescript
case "state-set":
  this.emit("state-set", msg.extensionId, msg.key, msg.value);
  break;
```

### In `ExtensionManager.ts`

```typescript
this.host.on("state-set", (extensionId, key, value) => {
  ExtensionStateManager.set(extensionId, key, value);
});
```

On activation, read state and pass it in the activate message:
```typescript
const initialState = ExtensionStateManager.getAll(extensionId);  // returns all keys for this ext
await this.host.activateExtension(id, ext.extensionPath, ext.manifest.main, initialState);
```

On deactivation (optional): call `ExtensionStateManager.clear(extensionId)` only if `workspaceState` should be non-persistent. For persistent workspace state, keep it.

---

## Key Architecture Constraints

### Synchronous get() is impossible over IPC

The `get()` method on `workspaceState` must return synchronously (like VS Code's `Memento.get()`). The only way to achieve this over an async IPC channel is to pre-load the state into the worker at activation time and maintain a local cache. Any `update()` call writes to local cache immediately and sends a fire-and-forget IPC message to persist.

### Command ID namespacing is automatic

The worker's `handleActivate()` patches `registerCommand` to prefix the command ID with `extensionId` if not already prefixed. Extension authors don't need to do this manually.

### `registerCommand` is monkey-patched per activation

The original `breadcrumb.commands.registerCommand` is replaced during `handleActivate()` and restored afterward. This means the `extensionId` injection only works during `activate()`. If an extension registers commands lazily (after `activate()` returns), those commands get an empty `extensionId`. This is a known gap in the current implementation.

### The worker uses a single shared `commands` Map

All extensions in the same worker process share the same `commands` Map. Command IDs are namespaced by extension ID to prevent collision, but there is no per-extension isolation. If two extensions registered the same fully-qualified command ID, the second would silently overwrite the first.

### Push events to the renderer require `mainWindow` reference

`extensionIpc.ts` has a reference to `mainWindow`. All push events to the renderer must go through this file (or through a mechanism that has the window reference). `ExtensionManager` does not have direct renderer access — it emits events that `extensionIpc.ts` listens to.

### The `handlersRegistered` guard in other IPC files does not exist in `extensionIpc.ts`

`terminalIpc.ts` and `handlers.ts` use a `handlersRegistered` boolean guard to prevent double-registration. `extensionIpc.ts` does not. This is not a problem currently because `registerExtensionIPCHandlers` is only called once in `index.ts`, but it's worth knowing.

---

## Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| Extension persistence | `electron-store` (already installed) | JSON file with schema, atomic writes |
| Modal dialogs | `electron.dialog.showMessageBox()` | No renderer changes needed for simple cases |
| Terminal creation | `terminalService.createSession()` (already exists) | Full pty with replay buffer already wired up |
| requestId generation | `Math.random().toString(36).slice(2)` | Sufficient for in-process correlation; no need for crypto |

---

## Pitfalls

### Pitfall: Monkey-patching `registerCommand` is not reentrant

If an extension calls `registerCommand` inside an async callback after `activate()` returns, the worker has already restored the original (non-patched) function and the `extensionId` will be an empty string in the sent message.

**Avoid by:** Binding `extensionId` into the `breadcrumb` API object per-extension rather than patching the shared singleton. The correct approach for new API additions is to pass `extensionId` as a closure variable when constructing the context-specific API object.

### Pitfall: `window.isDestroyed()` must be checked before every `webContents.send()`

`extensionIpc.ts` correctly guards its push calls. Any new push event added must also check `!mainWindow.isDestroyed()` or it will throw after the window closes.

### Pitfall: The worker's `process.send()` blocks if the IPC buffer is full

For high-frequency messages (e.g., streaming terminal output to the worker), `process.send()` can block. Terminal output should flow main→renderer directly, not through the extension worker.

### Pitfall: Require cache invalidation on deactivation clears all modules in the extension path

`handleDeactivate()` deletes every `require.cache` entry whose key starts with `ext.context.extensionPath`. If two extensions share a node_modules path, this could evict the other extension's cached modules. Extensions should have isolated `node_modules` under their own directory.

### Pitfall: `pendingRequests` key collision if the same command runs twice simultaneously

`ExtensionHost.executeCommand()` uses `"command:<commandId>"` as the key. If the same command is invoked twice concurrently, the second call overwrites the pending request, and the first call's promise is never resolved. Use a unique requestId (e.g., `"command:<commandId>:<uuid>"`) for any new multi-inflight scenarios.

---

## Open Questions

- Should `workspaceState` be scoped to the workspace directory path (as VS Code does) or just per-extension globally? The current `SettingsStore` does not have a per-workspace concept — workspace state is stored in the flat settings object under `workspace.*`. For true per-workspace isolation, the store key would need to incorporate the project path.

- The `show-modal` feature via `dialog.showMessageBox()` is modal to the entire application window. If an extension calls it while the user is in the middle of something, it interrupts completely. A non-blocking notification or in-app toast (using the existing UI system) may be more appropriate for most cases.

---

## Sources

**HIGH confidence (read directly from source files):**

- `/Users/krsecurity/Repositories/breadcrumb/desktop/src/main/extensions/types.ts` — All message type definitions
- `/Users/krsecurity/Repositories/breadcrumb/desktop/src/main/extensions/extensionHostWorker.ts` — Worker process, API surface, message dispatch
- `/Users/krsecurity/Repositories/breadcrumb/desktop/src/main/extensions/ExtensionHost.ts` — Main process bridge, pending request correlation
- `/Users/krsecurity/Repositories/breadcrumb/desktop/src/main/extensions/ExtensionManager.ts` — State management, lifecycle coordination
- `/Users/krsecurity/Repositories/breadcrumb/desktop/src/main/ipc/extensionIpc.ts` — Electron IPC handlers and renderer push
- `/Users/krsecurity/Repositories/breadcrumb/desktop/src/main/ipc/terminalIpc.ts` — Terminal IPC pattern (model for new capabilities)
- `/Users/krsecurity/Repositories/breadcrumb/desktop/src/main/terminal/TerminalService.ts` — Existing terminal service
- `/Users/krsecurity/Repositories/breadcrumb/desktop/src/main/settings/SettingsStore.ts` — electron-store usage pattern
- `/Users/krsecurity/Repositories/breadcrumb/desktop/src/shared/types/index.ts` — IPC_CHANNELS registry
- `/Users/krsecurity/Repositories/breadcrumb/desktop/src/preload/index.ts` — Full BreadcrumbAPI surface and contextBridge wiring
- `/Users/krsecurity/Repositories/breadcrumb/desktop/src/renderer/store/appStore.ts` — Renderer state (for modal + terminal integration)
