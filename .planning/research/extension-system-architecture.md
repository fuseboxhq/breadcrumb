# Research: Plugin/Extension System for Electron Desktop IDE

**Date:** 2026-02-11
**Domain:** Electron, Extension Architecture, Plugin Systems
**Overall Confidence:** HIGH

## TL;DR

Use VS Code's extension host model as inspiration but simplified for Breadcrumb's needs. Run extensions in a separate Node.js process (not isolated-vm, not WebAssembly) with manifest-based contribution points, IPC-based API surface, and contextBridge security. Load from npm packages OR local directories with file watching for hot reload during development. Don't hand-roll security sandboxing—use Electron's built-in process isolation + contextBridge.

## Recommended Architecture

**Process Model: Extension Host Pattern (VS Code-inspired)**

```
Main Process (Electron)
├── Extension Manager
│   ├── Manifest Parser
│   ├── Dependency Resolver
│   └── Lifecycle Controller
│
└── Extension Host Process (Node.js child_process)
    ├── Extension Runtime
    ├── API Surface (IPC-based)
    └── Error Isolation

Renderer Process (React UI)
└── Exposed API via contextBridge
    ├── breadcrumb.commands.*
    ├── breadcrumb.panels.*
    ├── breadcrumb.terminal.*
    └── breadcrumb.storage.*
```

**Why this approach:**
- Process isolation prevents extension crashes from killing the IDE
- Node.js child process gives full npm ecosystem access
- Simpler than isolated-vm (no V8 API complexity, better debugging)
- Proven at massive scale (VS Code has 40,000+ extensions)
- Electron's built-in IPC + contextBridge provides security boundary

## Extension Manifest Schema

Use `package.json` with Breadcrumb-specific fields (VS Code-compatible structure):

```json
{
  "name": "breadcrumb-db-browser",
  "displayName": "Database Browser",
  "version": "1.0.0",
  "publisher": "your-org",
  "description": "SQLite and Postgres database browser panel",
  "categories": ["Other"],
  "icon": "icon.png",

  "engines": {
    "breadcrumb": "^0.4.0"
  },

  "main": "./dist/extension.js",

  "activationEvents": [
    "onView:databaseExplorer",
    "onCommand:breadcrumb.db.connect"
  ],

  "contributes": {
    "commands": [
      {
        "command": "breadcrumb.db.connect",
        "title": "Connect to Database",
        "category": "Database",
        "icon": "$(database)"
      }
    ],
    "views": {
      "explorer": [
        {
          "id": "databaseExplorer",
          "name": "Databases",
          "icon": "resources/db-icon.svg",
          "when": "breadcrumb.hasWorkspace"
        }
      ]
    },
    "viewsContainers": {
      "activitybar": [
        {
          "id": "database",
          "title": "Database",
          "icon": "resources/db-container-icon.svg"
        }
      ]
    },
    "menus": {
      "view/title": [
        {
          "command": "breadcrumb.db.refresh",
          "when": "view == databaseExplorer",
          "group": "navigation"
        }
      ],
      "commandPalette": [
        {
          "command": "breadcrumb.db.connect",
          "when": "breadcrumb.hasWorkspace"
        }
      ]
    },
    "keybindings": [
      {
        "command": "breadcrumb.db.connect",
        "key": "ctrl+shift+d",
        "mac": "cmd+shift+d",
        "when": "editorFocus"
      }
    ],
    "configuration": {
      "title": "Database Browser",
      "properties": {
        "breadcrumb.db.defaultConnection": {
          "type": "string",
          "default": "",
          "description": "Default database connection string"
        }
      }
    }
  },

  "dependencies": {
    "pg": "^8.11.3",
    "better-sqlite3": "^12.4.1"
  },

  "breadcrumb": {
    "apiVersion": "1.0.0",
    "capabilities": {
      "fileSystem": "readonly",
      "network": true,
      "terminal": false
    }
  }
}
```

**Key decisions:**
- Use `package.json` not `extension.json` (familiar to Node.js developers, npm tooling works)
- `engines.breadcrumb` field for version compatibility
- `contributes` section matches VS Code pattern (porting knowledge is easy)
- Custom `breadcrumb` section for IDE-specific metadata
- `activationEvents` for lazy loading

## API Surface Design

**Namespace-based API exposed via IPC:**

```typescript
// Extension code (runs in Extension Host process)
export function activate(context: ExtensionContext) {
  // Commands
  const disposable = breadcrumb.commands.registerCommand(
    'breadcrumb.db.connect',
    async () => {
      const uri = await breadcrumb.window.showInputBox({
        prompt: 'Enter connection string',
        placeHolder: 'postgresql://user:pass@host:5432/db'
      });
      // ...
    }
  );

  // Panels
  const provider = new DatabaseTreeProvider();
  breadcrumb.window.registerTreeDataProvider('databaseExplorer', provider);

  // Status bar
  const statusItem = breadcrumb.window.createStatusBarItem(
    StatusBarAlignment.Right,
    100
  );
  statusItem.text = '$(database) Connected';
  statusItem.show();

  // Terminal integration
  const terminal = breadcrumb.terminal.createTerminal({
    name: 'DB Shell',
    shellPath: '/usr/bin/psql'
  });

  // Storage
  await context.globalState.update('lastConnection', uri);
  const last = context.globalState.get<string>('lastConnection');

  context.subscriptions.push(disposable, statusItem, terminal);
}

export function deactivate() {
  // Cleanup
}
```

**API Namespaces:**

| Namespace | Purpose | Confidence |
|-----------|---------|------------|
| `breadcrumb.commands` | Register/execute commands | HIGH |
| `breadcrumb.window` | UI dialogs, status bar, notifications | HIGH |
| `breadcrumb.panels` | Custom sidebar panels, webview panels | HIGH |
| `breadcrumb.terminal` | Terminal integration, PTY access | HIGH |
| `breadcrumb.workspace` | File system, project context | HIGH |
| `breadcrumb.storage` | Persistent storage (global/workspace) | HIGH |
| `breadcrumb.languages` | Language support (future) | MEDIUM |
| `breadcrumb.debug` | Debugger integration (future) | MEDIUM |

**Implementation pattern (Main Process):**

```typescript
// main/extensions/api/commands.ts
import { ipcMain } from 'electron';

export class CommandsAPI {
  private commands = new Map<string, Function>();

  registerCommand(extensionId: string, commandId: string, handler: Function) {
    const fullId = `${extensionId}.${commandId}`;
    this.commands.set(fullId, handler);

    // Expose to renderer via IPC
    ipcMain.handle(`command:${fullId}`, async (event, ...args) => {
      try {
        return await handler(...args);
      } catch (error) {
        console.error(`Command ${fullId} failed:`, error);
        throw error;
      }
    });
  }

  executeCommand(commandId: string, ...args: any[]) {
    const handler = this.commands.get(commandId);
    if (!handler) {
      throw new Error(`Command not found: ${commandId}`);
    }
    return handler(...args);
  }
}
```

**Versioning strategy:**
- API version in manifest: `"breadcrumb.apiVersion": "1.0.0"`
- Semantic versioning: 1.x.x = compatible, 2.x.x = breaking
- Extensions declare minimum required version in `engines.breadcrumb`
- Extension Manager checks compatibility before loading
- Deprecation warnings logged for 1 major version before removal

## Extension Lifecycle

**Lifecycle hooks:**

```typescript
interface ExtensionModule {
  activate(context: ExtensionContext): void | Promise<void>;
  deactivate?(): void | Promise<void>;
}

interface ExtensionContext {
  subscriptions: Disposable[];
  extensionPath: string;
  extensionUri: string;
  globalState: Memento;
  workspaceState: Memento;
  secrets: SecretStorage;
  extensionMode: ExtensionMode; // production | development | test
}
```

**Activation flow:**

1. **Discovery**: Extension Manager scans `~/.breadcrumb/extensions/` and `<project>/.breadcrumb-extensions/`
2. **Parse manifest**: Validate `package.json`, check `engines.breadcrumb` compatibility
3. **Dependency resolution**: Check if `extensionDependencies` are loaded
4. **Lazy activation**: Wait for activation event (e.g., `onCommand:*`, `onView:*`, `*` for immediate)
5. **Load**: Spawn Extension Host process (or use existing), `require()` the `main` entry point
6. **Activate**: Call `activate(context)`, catch errors, log failures
7. **Track subscriptions**: Store `Disposable` objects for cleanup
8. **Deactivate**: Call `deactivate()` on extension unload, dispose subscriptions

**Error isolation:**

```typescript
// main/extensions/ExtensionHost.ts
class ExtensionHost {
  private process: ChildProcess;

  async activateExtension(extensionId: string) {
    try {
      const result = await this.sendRequest('activateExtension', { extensionId });
      return result;
    } catch (error) {
      console.error(`Extension ${extensionId} activation failed:`, error);
      this.markExtensionFailed(extensionId);
      // Don't crash the host, just disable the extension
      this.showNotification(`Extension ${extensionId} failed to activate`);
    }
  }

  private setupProcessHandlers() {
    this.process.on('error', (error) => {
      console.error('Extension Host error:', error);
      this.restartHost(); // Restart host, reload all extensions
    });

    this.process.on('exit', (code) => {
      if (code !== 0) {
        console.error(`Extension Host exited with code ${code}`);
        this.restartHost();
      }
    });
  }
}
```

**Key guarantees:**
- Extension failures don't crash the IDE (process isolation)
- Failed extensions are marked and skipped on restart
- Extension Host crashes trigger automatic restart with telemetry
- Each extension's `activate()` is wrapped in try/catch
- Unhandled rejections in extensions are caught and logged

## UI Contribution Points

**Supported contribution points (MVP):**

| Point | Description | Example |
|-------|-------------|---------|
| `commands` | Executable commands in palette | Database: Connect |
| `views` | Tree views in sidebar containers | Database Explorer tree |
| `viewsContainers` | Custom activity bar containers | Database icon in sidebar |
| `menus` | Context menus, view title menus | Right-click → Export Schema |
| `keybindings` | Keyboard shortcuts | Ctrl+Shift+D → Connect |
| `configuration` | User settings | Default connection string |
| `statusBarItems` | Status bar icons/text | $(database) Connected |

**Implementation approach:**

Extensions declare contribution points in manifest → Extension Manager parses on load → Contributions registered with IDE components → Renderer UI reflects changes dynamically.

**Example: Registering a panel**

```typescript
// Manifest declares:
"contributes": {
  "views": {
    "explorer": [{
      "id": "databaseExplorer",
      "name": "Databases"
    }]
  }
}

// Extension code implements:
export function activate(context: ExtensionContext) {
  const provider = new DatabaseTreeProvider();
  breadcrumb.window.registerTreeDataProvider('databaseExplorer', provider);
}

class DatabaseTreeProvider implements TreeDataProvider<DbItem> {
  getChildren(element?: DbItem): DbItem[] {
    // Return tree structure
  }

  getTreeItem(element: DbItem): TreeItem {
    return {
      label: element.name,
      collapsibleState: TreeItemCollapsibleState.Collapsed,
      iconPath: new ThemeIcon('database'),
      command: { command: 'breadcrumb.db.select', arguments: [element] }
    };
  }
}
```

**Communication flow:**

1. Extension calls `registerTreeDataProvider()` in Extension Host
2. IPC message sent to Main Process
3. Main Process stores provider reference, notifies Renderer
4. Renderer requests tree data via IPC → Main → Extension Host → Provider
5. Provider returns data → Extension Host → Main → Renderer → React component updates

## Security: Process Isolation + contextBridge

**DON'T use:**
- `vm2` (deprecated, multiple CVE's including CVE-2026-22709)
- Node.js `vm` module (bypassable, not a security boundary)
- WebAssembly sandboxing (overkill, limits npm ecosystem access)

**DO use:**
- Electron child_process for Extension Host (OS-level process isolation)
- contextBridge for Renderer API exposure (Electron's security boundary)
- Capability-based permissions declared in manifest

**Security model:**

```typescript
// Manifest declares capabilities
"breadcrumb": {
  "capabilities": {
    "fileSystem": "readonly",    // none | readonly | readwrite
    "network": true,              // boolean
    "terminal": false,            // boolean
    "clipboard": true             // boolean
  }
}
```

**Enforcement in API:**

```typescript
// main/extensions/api/workspace.ts
class WorkspaceAPI {
  async readFile(extensionId: string, uri: string): Promise<Uint8Array> {
    const manifest = this.getManifest(extensionId);
    const capability = manifest.breadcrumb?.capabilities?.fileSystem;

    if (capability === 'none' || !capability) {
      throw new Error(`Extension ${extensionId} lacks fileSystem capability`);
    }

    // Proceed with file read
    return fs.readFile(uri);
  }

  async writeFile(extensionId: string, uri: string, data: Uint8Array) {
    const manifest = this.getManifest(extensionId);
    const capability = manifest.breadcrumb?.capabilities?.fileSystem;

    if (capability !== 'readwrite') {
      throw new Error(`Extension ${extensionId} lacks readwrite capability`);
    }

    return fs.writeFile(uri, data);
  }
}
```

**Renderer security (preload script):**

```typescript
// desktop/src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('breadcrumbAPI', {
  commands: {
    execute: (commandId: string, ...args: any[]) =>
      ipcRenderer.invoke('command:execute', commandId, ...args),

    getCommands: () =>
      ipcRenderer.invoke('command:getAll')
  },

  panels: {
    registerPanel: (panelId: string, options: any) =>
      ipcRenderer.invoke('panels:register', panelId, options),

    updatePanel: (panelId: string, data: any) =>
      ipcRenderer.invoke('panels:update', panelId, data)
  },

  // Never expose raw ipcRenderer or require()
});
```

**Why this is secure:**
- Extension Host runs in separate process (can't access Renderer DOM)
- Renderer only sees `window.breadcrumbAPI` (no Node.js APIs)
- All API calls validated by Main Process before reaching Extension Host
- Capability model limits damage from compromised extensions
- Process crash only affects Extension Host, not IDE

## Loading Extensions

**Sources:**

1. **npm packages** (production):
   - Install to `~/.breadcrumb/extensions/node_modules/`
   - Use `npm install <package>` or custom installer UI
   - Scoped packages: `@myorg/breadcrumb-db-browser`

2. **Local directories** (development):
   - Symlink to `~/.breadcrumb/extensions/`
   - Or load from workspace `.breadcrumb-extensions/`
   - Hot reload via file watching (chokidar)

**Discovery algorithm:**

```typescript
// main/extensions/ExtensionManager.ts
class ExtensionManager {
  private extensionPaths = [
    path.join(os.homedir(), '.breadcrumb', 'extensions'),
    path.join(workspace, '.breadcrumb-extensions')
  ];

  async discoverExtensions(): Promise<ExtensionManifest[]> {
    const extensions: ExtensionManifest[] = [];

    for (const basePath of this.extensionPaths) {
      const entries = await fs.readdir(basePath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory() || entry.isSymbolicLink()) {
          const manifestPath = path.join(basePath, entry.name, 'package.json');

          try {
            const manifest = await this.loadManifest(manifestPath);
            if (this.isValidExtension(manifest)) {
              extensions.push(manifest);
            }
          } catch (error) {
            console.warn(`Skipping invalid extension: ${entry.name}`, error);
          }
        }
      }
    }

    return extensions;
  }

  private isValidExtension(manifest: any): boolean {
    return !!(
      manifest.name &&
      manifest.version &&
      manifest.engines?.breadcrumb &&
      manifest.main
    );
  }
}
```

**Hot reload (development mode):**

```typescript
import chokidar from 'chokidar';

class ExtensionManager {
  private watchers = new Map<string, FSWatcher>();

  watchExtension(extensionId: string, extensionPath: string) {
    if (process.env.NODE_ENV !== 'development') return;

    const watcher = chokidar.watch(extensionPath, {
      ignored: /(node_modules|\.git)/,
      persistent: true
    });

    watcher.on('change', async (filePath) => {
      console.log(`Extension ${extensionId} changed: ${filePath}`);

      // Deactivate old version
      await this.deactivateExtension(extensionId);

      // Clear require cache
      this.clearRequireCache(extensionPath);

      // Reactivate
      await this.activateExtension(extensionId);

      // Notify renderer
      this.notifyExtensionReloaded(extensionId);
    });

    this.watchers.set(extensionId, watcher);
  }

  private clearRequireCache(extensionPath: string) {
    Object.keys(require.cache).forEach((key) => {
      if (key.startsWith(extensionPath)) {
        delete require.cache[key];
      }
    });
  }
}
```

**Installation flow (npm packages):**

1. User clicks "Install Extension" in UI or runs CLI command
2. Main Process runs `npm install <package> --prefix ~/.breadcrumb/extensions`
3. Extension Manager discovers new extension
4. Manifest validated, dependencies checked
5. Extension activated if activation event matches current state
6. UI updated to show extension in Extensions panel

## Dependency Resolution

**Problem:** Extension A depends on Extension B.

**Solution:** Topological sort + lazy activation.

```typescript
interface ExtensionManifest {
  name: string;
  extensionDependencies?: string[]; // e.g., ["other-extension"]
}

class ExtensionManager {
  async activateExtension(extensionId: string): Promise<void> {
    const manifest = this.getManifest(extensionId);

    // Activate dependencies first
    if (manifest.extensionDependencies) {
      for (const depId of manifest.extensionDependencies) {
        if (!this.isActivated(depId)) {
          await this.activateExtension(depId); // Recursive
        }
      }
    }

    // Now activate this extension
    await this.doActivate(extensionId);
  }

  private sortExtensionsByDependencies(
    extensions: ExtensionManifest[]
  ): ExtensionManifest[] {
    // Topological sort (Kahn's algorithm)
    const graph = new Map<string, string[]>();
    const inDegree = new Map<string, number>();

    // Build graph
    for (const ext of extensions) {
      graph.set(ext.name, ext.extensionDependencies || []);
      inDegree.set(ext.name, 0);
    }

    for (const [, deps] of graph) {
      for (const dep of deps) {
        inDegree.set(dep, (inDegree.get(dep) || 0) + 1);
      }
    }

    // Sort
    const queue = extensions.filter(e => inDegree.get(e.name) === 0);
    const sorted: ExtensionManifest[] = [];

    while (queue.length > 0) {
      const ext = queue.shift()!;
      sorted.push(ext);

      const deps = graph.get(ext.name) || [];
      for (const dep of deps) {
        const degree = inDegree.get(dep)! - 1;
        inDegree.set(dep, degree);

        if (degree === 0) {
          const depExt = extensions.find(e => e.name === dep);
          if (depExt) queue.push(depExt);
        }
      }
    }

    return sorted;
  }
}
```

**Circular dependency handling:**
- Detect cycles during topological sort
- Log error: "Circular dependency detected: A → B → A"
- Mark both extensions as failed, don't activate
- Show notification to user

## Real-World Examples

### VS Code
- **Architecture:** Extension Host (Node.js process) + IPC
- **Manifest:** package.json with `contributes`, `activationEvents`
- **API:** Namespace-based (`vscode.commands`, `vscode.window`)
- **Security:** Process isolation, no vm sandboxing
- **Ecosystem:** 40,000+ extensions, proven at massive scale
- **Confidence:** HIGH (most battle-tested model)

### Eclipse Theia
- **Architecture:** Identical to VS Code (forked approach)
- **Extensions:** Supports both VS Code extensions AND Theia plugins
- **Two models:** Runtime-installable (VS Code) + compile-time (Theia native)
- **Dependency injection:** Full access to Theia internals for native plugins
- **Confidence:** MEDIUM (good for understanding VS Code compatibility)

### Zed
- **Architecture:** WebAssembly + Rust
- **Sandboxing:** WASM runtime (can't freeze main thread)
- **Ecosystem:** Much smaller, requires Rust knowledge
- **Trade-offs:** Better performance guarantees, but limited npm access
- **Confidence:** LOW for Breadcrumb (WASM overhead not worth it for Node.js IDE)

### Atom (legacy, archived)
- **Architecture:** Node.js packages loaded directly in renderer
- **Security:** None (full Node.js access from UI)
- **Why it failed:** Extensions could hang UI, no isolation
- **Lesson:** Don't run extensions in renderer process
- **Confidence:** HIGH (anti-pattern to avoid)

## Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| JavaScript sandboxing | Electron child_process | vm2 deprecated, vm bypassable, process isolation is OS-level |
| IPC communication | Electron's ipcMain/ipcRenderer | Built-in, type-safe, handles serialization |
| Manifest validation | JSON Schema + ajv | Industry standard, 10,000+ stars, comprehensive |
| File watching | chokidar | Cross-platform, battle-tested, handles symlinks |
| Dependency resolution | Topological sort (Kahn's) | Well-known algorithm, handles cycles |

**Specific anti-patterns:**
- Don't use `eval()` or `new Function()` to load extensions (code injection risk)
- Don't run extension code in renderer (UI hangs, security risk)
- Don't invent custom manifest format (use package.json, leverage npm ecosystem)
- Don't skip activation events (startup time will suffer)

## Pitfalls

### Extension Host Crashes
**What happens:** All extensions die, UI shows stale data.
**Avoid by:** Automatic restart with exponential backoff, reload all extensions, notify user.

### Memory Leaks in Extensions
**What happens:** Extension Host process grows unbounded, system slows down.
**Avoid by:** Monitor memory usage, set limits (--max-old-space-size=4096), restart host if exceeded.

### Activation Event Mistakes
**What happens:** Extensions activate on every keystroke (`*` activation), killing performance.
**Avoid by:** Validate activation events, warn about `*`, suggest specific events.

### API Version Drift
**What happens:** Extensions break when API changes, users get cryptic errors.
**Avoid by:** Semantic versioning, check `engines.breadcrumb` compatibility, show clear errors.

### IPC Payload Size
**What happens:** Sending large data (e.g., 100MB file) via IPC crashes or hangs.
**Avoid by:** Stream large data through files/sockets, limit IPC payload to ~10MB, document limits.

### Circular Dependencies
**What happens:** Extensions never activate, dependency resolution hangs.
**Avoid by:** Topological sort detects cycles, log error, mark both failed.

### Extension Conflicts
**What happens:** Two extensions register same command ID, second silently fails.
**Avoid by:** Namespace commands with extension ID (`ext-id.command`), warn on conflicts.

### Hot Reload State Loss
**What happens:** Reloading extension loses in-memory state, breaks user workflow.
**Avoid by:** Use `context.globalState` for persistence, document state loss on reload.

## Implementation Roadmap

**Phase 1: Core Infrastructure (Week 1-2)**
- Extension Manager (discovery, manifest parsing, activation)
- Extension Host process (child_process spawn, IPC bridge)
- Basic API: commands, window.showInputBox, window.showNotification
- Error isolation and logging

**Phase 2: UI Contribution Points (Week 3-4)**
- Views and ViewsContainers
- Status bar items
- Menus and context menus
- Keybindings registry

**Phase 3: Advanced APIs (Week 5-6)**
- Terminal integration
- File system API with capability checks
- Storage API (globalState, workspaceState)
- Configuration contribution point

**Phase 4: Developer Experience (Week 7-8)**
- Hot reload for local extensions
- Extension debugging (attach to Extension Host)
- Extension generator CLI (`breadcrumb create-extension`)
- Sample extension (Database Browser)

## Open Questions

**Performance:** Should we use a single Extension Host process for all extensions, or spawn one per extension?
- **Research needed:** Measure memory overhead, activation time trade-offs
- **Recommendation:** Single process for MVP, add multi-process in Phase 2 if needed

**WebView panels:** How should extensions render custom UI (e.g., database query results)?
- **Options:** WebView (Electron BrowserView), React components via IPC
- **Recommendation:** WebView for MVP (simpler isolation), investigate React IPC later

**Extension marketplace:** Where should users discover/install extensions?
- **Options:** In-app UI, CLI, external website
- **Recommendation:** Start with CLI (`breadcrumb ext install <name>`), add UI later

**TypeScript support:** Should extensions be TypeScript-first?
- **Recommendation:** Provide `@types/breadcrumb-extension-api` npm package, examples in TS, but allow JS

## Recommended Stack

| Component | Library | Version | Purpose | Confidence |
|-----------|---------|---------|---------|------------|
| Manifest validation | ajv | ^8.12.0 | JSON Schema validation | HIGH |
| File watching | chokidar | ^5.0.0 | Hot reload for dev extensions | HIGH |
| Process management | Node.js child_process | built-in | Extension Host spawning | HIGH |
| IPC | Electron ipcMain/Renderer | built-in | API surface communication | HIGH |
| Context isolation | Electron contextBridge | built-in | Renderer security | HIGH |

**Install:**
```bash
pnpm add ajv chokidar
pnpm add -D @types/node
```

## Sources

**HIGH confidence:**
- [Extension Host | Visual Studio Code Extension API](https://code.visualstudio.com/api/advanced-topics/extension-host)
- [Extension Manifest | Visual Studio Code Extension API](https://code.visualstudio.com/api/references/extension-manifest)
- [Contribution Points | Visual Studio Code Extension API](https://code.visualstudio.com/api/references/contribution-points)
- [Inter-Process Communication | Electron](https://www.electronjs.org/docs/latest/tutorial/ipc)
- [Process Sandboxing | Electron](https://www.electronjs.org/docs/latest/tutorial/sandbox)
- [isolated-vm - npm](https://www.npmjs.com/package/isolated-vm)

**MEDIUM confidence:**
- [Extensions - Eclipse Theia](https://theia-ide.org/docs/extensions/)
- [Developing Extensions | Zed Code Editor Documentation](https://zed.dev/docs/extensions/developing-extensions)
- [Advanced Electron.js architecture - LogRocket Blog](https://blog.logrocket.com/advanced-electron-js-architecture/)

**LOW confidence (needs validation):**
- [Critical vm2 Node.js Flaw - The Hacker News](https://thehackernews.com/2026/01/critical-vm2-nodejs-flaw-allows-sandbox.html)
- [electron-reload - npm](https://www.npmjs.com/package/electron-reload)
