# Research: Electron Forge + Vite Setup for 2025-2026

**Date:** 2026-02-11
**Domain:** Electron, Desktop Development, Build Tooling
**Overall Confidence:** HIGH

## TL;DR

Use Electron 40.x with Electron Forge 7.11+ and the Vite plugin. For node-pty integration, use the `@electron-forge/plugin-auto-unpack-natives` plugin and mark node-pty as external in your Vite config. Enable all recommended security fuses in production. Use separate Vite configs for main and renderer processes. Expect some friction with monorepo setups; Forge assumes single-app directory structure.

## Recommended Stack

| Library | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| electron | ^40.3.0 | Desktop runtime (Chromium 144, Node 24.11) | HIGH |
| @electron-forge/cli | ^7.11.1 | Build & packaging toolchain | HIGH |
| @electron-forge/plugin-vite | ^7.11.1 | Vite integration for Forge | HIGH |
| @electron-forge/plugin-auto-unpack-natives | ^7.11.1 | Automatic native module unpacking | HIGH |
| @electron-forge/plugin-fuses | ^7.11.1 | Security fuse configuration | HIGH |
| vite | ^6.0.0 | Build tool for main/renderer | HIGH |
| node-pty | ^1.1.0 | Pseudoterminal for terminal emulation | HIGH |
| @electron/rebuild | ^3.7.0 | Native module rebuilding (auto-used by Forge) | HIGH |
| @electron/fuses | ^1.10.0 | Fuse configuration library | HIGH |

**Install:**
```bash
npm install --save-dev @electron-forge/cli@^7.11.1 \
  @electron-forge/plugin-vite@^7.11.1 \
  @electron-forge/plugin-auto-unpack-natives@^7.11.1 \
  @electron-forge/plugin-fuses@^7.11.1 \
  @electron-forge/maker-squirrel@^7.11.1 \
  @electron-forge/maker-dmg@^7.11.1 \
  @electron-forge/maker-deb@^7.11.1 \
  @electron-forge/maker-rpm@^7.11.1 \
  @electron/fuses@^1.10.0 \
  vite@^6.0.0

npm install electron@^40.3.0 node-pty@^1.1.0
```

## Current Electron Version

**Electron 40.3.0** (released February 11, 2026)
- **Chromium:** 144.0.7559.60
- **Node.js:** 24.11.1
- **V8:** 14.4

Electron releases major versions every 8 weeks in concert with Chromium's 4-week release schedule. The latest 3 stable releases are officially supported.

## Key Patterns

### 1. Project Initialization

**Use when:** Starting a new Electron project from scratch

```bash
npx create-electron-app@latest my-app --template=vite
cd my-app
npm start
```

**For TypeScript:**
```bash
npx create-electron-app@latest my-app --template=vite-typescript
```

### 2. Project Structure (Vite Template)

```
my-app/
├── src/
│   ├── main.js                 # Main process entry
│   ├── preload.js              # Preload script (context bridge)
│   └── renderer.js             # Renderer process entry
├── index.html                  # Renderer HTML
├── vite.main.config.js         # Vite config for main process
├── vite.preload.config.js      # Vite config for preload scripts
├── vite.renderer.config.js     # Vite config for renderer process
├── forge.config.js             # Electron Forge configuration
└── package.json                # Must set main: ".vite/build/main.js"
```

### 3. Forge Configuration for Vite + node-pty

**forge.config.js**
```javascript
const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

module.exports = {
  packagerConfig: {
    asar: true,  // MUST enable asar for auto-unpack-natives to work
  },
  rebuildConfig: {}, // Uses @electron/rebuild automatically
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        certificateFile: './cert.pfx',
        certificatePassword: process.env.CERT_PASSWORD,
      },
    },
    {
      name: '@electron-forge/maker-dmg',
      config: {
        format: 'ULFO',
        background: './assets/dmg-background.png',
      },
    },
    {
      name: '@electron-forge/maker-deb',
      config: {
        options: {
          maintainer: 'Your Name',
          homepage: 'https://example.com',
        },
      },
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {
        options: {
          homepage: 'https://example.com',
        },
      },
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-vite',
      config: {
        // `build` can include multiple entry points
        build: [
          {
            entry: 'src/main.js',
            config: 'vite.main.config.js',
          },
          {
            entry: 'src/preload.js',
            config: 'vite.preload.config.js',
          },
        ],
        renderer: [
          {
            name: 'main_window',
            config: 'vite.renderer.config.js',
          },
        ],
      },
    },
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {}, // No config options; works automatically
    },
    new FusesPlugin({
      version: FuseVersion.V1,
      // Production security fuses
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
      [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]: true,
      [FuseV1Options.GrantFileProtocolExtraPrivileges]: false,
    }),
  ],
};
```

### 4. Vite Main Process Config (for node-pty)

**vite.main.config.js**
```javascript
// Source: Electron Forge Vite documentation
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      // CRITICAL: Mark node-pty as external to prevent bundling
      external: ['node-pty', 'electron'],
    },
  },
});
```

### 5. Secure BrowserWindow Configuration

**src/main.js**
```javascript
// Source: Electron security documentation
import { app, BrowserWindow } from 'electron';
import path from 'path';

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/main_window/preload.js'),

      // Security settings (defaults since v12/v20, but explicit is better)
      contextIsolation: true,        // DEFAULT since v12.0.0
      nodeIntegration: false,        // DEFAULT since v5.0.0
      sandbox: true,                 // DEFAULT since v20.0.0
      webSecurity: true,             // DEFAULT, never disable
      allowRunningInsecureContent: false,  // DEFAULT
    },
  });

  // CSP header configuration
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';"
        ],
      },
    });
  });

  // Load renderer
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }
}

app.whenReady().then(() => {
  createWindow();
});
```

### 6. Context Bridge Pattern (IPC Communication)

**src/preload.js**
```javascript
// Source: Electron Context Isolation documentation
import { contextBridge, ipcRenderer } from 'electron';

// NEVER expose ipcRenderer directly; wrap each method
contextBridge.exposeInMainWorld('terminalAPI', {
  // Renderer -> Main (invoke pattern)
  createTerminal: (options) => ipcRenderer.invoke('terminal:create', options),
  writeToTerminal: (id, data) => ipcRenderer.invoke('terminal:write', { id, data }),
  resizeTerminal: (id, cols, rows) => ipcRenderer.invoke('terminal:resize', { id, cols, rows }),

  // Main -> Renderer (on pattern, with cleanup)
  onTerminalData: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('terminal:data', handler);

    // Return cleanup function
    return () => ipcRenderer.removeListener('terminal:data', handler);
  },
});
```

**src/main.js (IPC Handlers)**
```javascript
// Source: Electron IPC documentation
import { ipcMain } from 'electron';
import pty from 'node-pty';

const terminals = new Map();

ipcMain.handle('terminal:create', (event, options) => {
  // ALWAYS validate sender
  if (!event.senderFrame) return { error: 'Invalid sender' };

  const ptyProcess = pty.spawn('bash', [], {
    name: 'xterm-256color',
    cols: options.cols || 80,
    rows: options.rows || 24,
    cwd: process.env.HOME,
    env: process.env,
  });

  const id = Math.random().toString(36);
  terminals.set(id, ptyProcess);

  ptyProcess.onData((data) => {
    event.sender.send('terminal:data', { id, data });
  });

  return { id };
});

ipcMain.handle('terminal:write', (event, { id, data }) => {
  const terminal = terminals.get(id);
  if (terminal) terminal.write(data);
});
```

### 7. Package.json Configuration

```json
{
  "name": "my-electron-app",
  "version": "1.0.0",
  "main": ".vite/build/main.js",
  "scripts": {
    "start": "electron-forge start",
    "package": "electron-forge package",
    "make": "electron-forge make"
  }
}
```

## Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| Native module unpacking | `@electron-forge/plugin-auto-unpack-natives` | Automatically detects ALL native modules; manual glob patterns miss edge cases |
| IPC communication | `ipcRenderer.invoke()` + `ipcMain.handle()` | Built-in async/await support; safer than `send/on` |
| Security configuration | Electron Fuses plugin | Post-build binary modification prevents runtime bypasses |
| Terminal emulation | node-pty + xterm.js | node-pty handles pseudoterminal complexity; xterm.js handles rendering |
| App packaging | Electron Forge makers | Handles code signing, installers, updates, and platform differences |

## Pitfalls

### 1. node-pty MUST Be External
**What happens:** If node-pty is bundled by Vite, it fails at runtime with "Cannot find module" errors. The native `.node` files and `spawn-helper` executable cannot be bundled.

**Avoid by:**
```javascript
// vite.main.config.js
build: {
  rollupOptions: {
    external: ['node-pty']
  }
}
```

### 2. ASAR Must Be Enabled for auto-unpack-natives
**What happens:** The `@electron-forge/plugin-auto-unpack-natives` plugin only works if `packagerConfig.asar` is set to `true` or an object. If asar is disabled, native modules won't be unpacked.

**Avoid by:**
```javascript
// forge.config.js
packagerConfig: {
  asar: true,  // Required
}
```

### 3. Monorepo Path Resolution Issues
**What happens:** Electron Forge expects the app in the current directory. When run from a monorepo subdirectory (e.g., `desktop/`), it may fail to find dependencies in the workspace root `node_modules/`.

**Avoid by:**
- Run all Forge commands from the desktop app directory, not the monorepo root
- Ensure `package.json` in the app directory includes ALL dependencies (don't rely on workspace hoisting)
- Use explicit paths in `forge.config.js` if needed
- Consider using pnpm's `shamefully-hoist=true` for Electron dependencies (not ideal, but pragmatic)

**Known Issue:** There's a documented bug where Forge cannot find Electron packages in devDependencies when using NPM workspaces. This is still being tracked as of 2026.

### 4. Vite Plugin Is Still Experimental
**What happens:** As of Electron Forge v7.5.0, Vite support is marked "experimental." Minor releases may introduce breaking changes.

**Avoid by:**
- Pin Forge dependencies to specific versions in `package.json`
- Read release notes carefully when updating
- Test builds after any Forge update

### 5. IPC Sender Validation Is Critical
**What happens:** Without sender validation, any web frame can send IPC messages to the main process, allowing malicious sites loaded in webviews to access privileged APIs.

**Avoid by:**
```javascript
ipcMain.handle('my-api', (event, data) => {
  // ALWAYS validate sender
  if (!event.senderFrame || event.senderFrame.url !== EXPECTED_URL) {
    throw new Error('Unauthorized');
  }
  // ... handle request
});
```

### 6. contextIsolation Requires Context Bridge
**What happens:** With `contextIsolation: true` (default since v12), the renderer can't access Node.js APIs or preload script variables directly.

**Avoid by:**
- Always use `contextBridge.exposeInMainWorld()` to expose APIs to the renderer
- Never set `nodeIntegration: true` as a workaround; it defeats security

### 7. CSP Meta Tags Don't Work for file://
**What happens:** When loading local files via `file://` protocol, HTTP headers can't be set. CSP must be defined in HTML `<meta>` tags.

**Avoid by:**
```html
<!-- index.html -->
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';">
```

### 8. macOS Code Signing Required After Fuse Flipping
**What happens:** On Apple Silicon, flipping fuses invalidates the code signature. The app won't launch without re-signing.

**Avoid by:**
```javascript
// If not immediately code signing after fuses
new FusesPlugin({
  version: FuseVersion.V1,
  resetAdHocDarwinSignature: true,  // Required for arm64 macOS
  // ... fuses
})
```

## Monorepo Considerations

### Directory Structure Recommendation

```
breadcrumb/                    # Monorepo root
├── desktop/                   # Electron app (run Forge from here)
│   ├── src/
│   │   ├── main.js
│   │   ├── preload.js
│   │   └── renderer.js
│   ├── vite.main.config.js
│   ├── vite.preload.config.js
│   ├── vite.renderer.config.js
│   ├── forge.config.js
│   └── package.json           # Must list ALL dependencies
├── api/                       # Existing API code
├── server/                    # Existing server code
└── package.json               # Workspace root
```

### Package Manager Setup (pnpm)

**pnpm-workspace.yaml**
```yaml
packages:
  - 'desktop'
  - 'api'
  - 'server'
```

**desktop/package.json**
```json
{
  "name": "breadcrumb-desktop",
  "main": ".vite/build/main.js",
  "dependencies": {
    "electron": "^40.3.0",
    "node-pty": "^1.1.0"
  },
  "devDependencies": {
    "@electron-forge/cli": "^7.11.1",
    "@electron-forge/plugin-vite": "^7.11.1",
    "@electron-forge/plugin-auto-unpack-natives": "^7.11.1",
    "vite": "^6.0.0"
  }
}
```

**Known Limitation:** Electron Forge assumes single-app structure. Workspace hoisting can cause Forge to fail finding dependencies. Workarounds:
1. Declare ALL dependencies in `desktop/package.json` (don't rely on workspace hoisting)
2. Use `pnpm --filter desktop` commands to ensure correct context
3. Run `npm start` / `npm run make` from `desktop/` directory, not monorepo root

## Security Best Practices Checklist

### Process Isolation
- [x] `contextIsolation: true` (default since v12.0.0)
- [x] `sandbox: true` (default since v20.0.0)
- [x] `nodeIntegration: false` (default since v5.0.0)
- [x] `webSecurity: true` (never disable)
- [x] Use `contextBridge` for all renderer APIs

### Fuses (Production)
- [x] `RunAsNode: false` - Disable ELECTRON_RUN_AS_NODE
- [x] `EnableCookieEncryption: true` - Encrypt cookies at rest
- [x] `EnableNodeOptionsEnvironmentVariable: false` - Disable NODE_OPTIONS
- [x] `EnableNodeCliInspectArguments: false` - Disable --inspect flags
- [x] `EnableEmbeddedAsarIntegrityValidation: true` - Validate app.asar
- [x] `OnlyLoadAppFromAsar: true` - Prevent unvalidated code execution
- [x] `LoadBrowserProcessSpecificV8Snapshot: true` - Separate V8 snapshots
- [x] `GrantFileProtocolExtraPrivileges: false` - Disable file:// privileges

### Content Security Policy
- [x] Define restrictive CSP: `default-src 'self'; script-src 'self'`
- [x] Use HTTP headers for remote content
- [x] Use `<meta>` tags for `file://` protocol
- [x] Avoid `'unsafe-eval'` and `'unsafe-inline'` (except styles if necessary)

### IPC Security
- [x] Never expose `ipcRenderer` directly
- [x] Validate `event.senderFrame` in all IPC handlers
- [x] Use `invoke/handle` pattern over `send/on` for async operations
- [x] Sanitize all user input before IPC

### Maintenance
- [x] Keep Electron updated (latest 3 major versions supported)
- [x] Audit dependencies regularly
- [x] Load only HTTPS content (never HTTP)
- [x] Use custom protocols instead of `file://` when possible

## Packaging Best Practices

### Windows (Squirrel)
- Use `@electron-forge/maker-squirrel`
- Generates `Setup.exe`, NuGet package, and RELEASES file
- Configure code signing via `certificateFile` and `certificatePassword`
- Use `electron-squirrel-startup` to handle installer events
- Set App User Model ID for proper Windows taskbar integration

### macOS (DMG)
- Use `@electron-forge/maker-dmg`
- Can ONLY be built on macOS machines
- Configure background image and compression format
- Code sign BEFORE distributing (required for Apple Silicon)
- Use `resetAdHocDarwinSignature: true` if not immediately signing after fuses

### Linux (deb)
- Use `@electron-forge/maker-deb`
- Requires `fakeroot` and `dpkg` installed
- Can build on Linux or macOS
- Configure `maintainer` and `homepage` metadata

### Linux (rpm)
- Use `@electron-forge/maker-rpm`
- Requires `rpm-build` (Fedora) or `rpm` (Debian/Ubuntu)
- Must build on Linux
- Configure `homepage` metadata

## Open Questions

### 1. Auto-Update Configuration
Electron Forge supports auto-update via Squirrel (Windows) and Squirrel.Mac, but configuration wasn't fully researched:
- How to set up update server?
- Update URL configuration in makers?
- Code signing requirements for updates?

### 2. Monorepo Shared Code
How to share TypeScript types or utilities between the Electron app and the existing web/API codebase:
- Can `desktop/` import from workspace sibling packages?
- Does Vite handle workspace protocol imports (`workspace:*`)?
- Native module conflicts if shared packages depend on incompatible Node versions?

**Recommendation:** Test with a minimal monorepo setup before committing to architecture.

### 3. Development Workflow with Existing Server
The breadcrumb project has an existing Express server. During development:
- Should the Electron app connect to `localhost:3000` server?
- Or embed server logic in the main process?
- How to handle database connections (better-sqlite3) in Electron vs. server?

**Recommendation:** Research Electron's process architecture for integrating existing Node.js servers (likely via ChildProcess or embedded in main process).

## Sources

**HIGH confidence:**
- [Electron Releases](https://www.electronjs.org/docs/latest/tutorial/electron-timelines)
- [Electron 40.0.0 Release](https://www.electronjs.org/blog/electron-40-0)
- [Electron Forge Vite Template](https://www.electronforge.io/templates/vite)
- [Electron Forge Vite Plugin](https://www.electronforge.io/config/plugins/vite)
- [Electron Native Modules](https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules)
- [Electron Fuses](https://www.electronjs.org/docs/latest/tutorial/fuses)
- [Electron Security](https://www.electronjs.org/docs/latest/tutorial/security)
- [Electron Context Isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation)
- [Electron Preload Scripts](https://www.electronjs.org/docs/latest/tutorial/tutorial-preload)
- [Electron IPC](https://www.electronjs.org/docs/latest/tutorial/ipc)
- [Auto Unpack Native Modules Plugin](https://www.electronforge.io/config/plugins/auto-unpack-natives)
- [Electron Forge Makers](https://www.electronforge.io/config/makers)
- [@electron-forge/cli npm](https://www.npmjs.com/package/@electron-forge/cli)
- [electron npm](https://www.npmjs.com/package/electron)
- [node-pty npm](https://www.npmjs.com/package/node-pty)

**MEDIUM confidence:**
- [Electron Squirrel.Windows Maker](https://www.electronforge.io/config/makers/squirrel.windows)
- [Electron DMG Maker](https://www.electronforge.io/config/makers/dmg)
- [Electron deb Maker](https://www.electronforge.io/config/makers/deb)
- [Electron rpm Maker](https://www.electronforge.io/config/makers/rpm)
- [Content Security Policy for Electron](https://content-security-policy.com/examples/electron/)
- [Electron CSP Configuration](https://medium.com/@yashsomkuwar/how-to-setup-csp-and-cors-in-electron-js-b93b05c5bda2)

**LOW confidence (needs validation):**
- [Electron Forge Monorepo Issue](https://github.com/electron/forge/issues/2649) - Known issue with monorepo support, still open as of search date
- [Electron Forge Vite External Modules Issue](https://github.com/electron/forge/issues/3917) - Known issue with external module packaging
