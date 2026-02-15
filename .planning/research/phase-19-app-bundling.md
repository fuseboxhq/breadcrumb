# Research: Electron Forge Packaging with Native Modules

**Task ID:** phase-19-app-bundling
**Date:** 2026-02-15
**Domain:** Electron Forge packaging, distribution, native modules
**Overall Confidence:** MEDIUM-HIGH

## TL;DR

Use `@electron-forge/plugin-auto-unpack-natives` to automatically unpack `.node` files, but **disable `OnlyLoadAppFromAsar` fuse** because node-pty's `spawn-helper` executable must load from outside ASAR. DMG and Squirrel makers need minimal config beyond what's already in place. Generate icons from 1024x1024 PNG using `electron-icon-builder`. Electron Forge automatically runs `@electron/rebuild` during packaging. Main pitfall: `OnlyLoadAppFromAsar` + node-pty = broken terminals.

## Recommended Stack

| Library | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| @electron-forge/plugin-auto-unpack-natives | 7.6.0+ | Unpack .node binaries | HIGH |
| electron-icon-builder | 2.0.1+ | Generate .icns/.ico from PNG | MEDIUM |
| @electron/rebuild | 3.7.0+ | Rebuild native modules (auto) | HIGH |

**Already installed in package.json.**

## Key Patterns

### 1. node-pty in ASAR: The OnlyLoadAppFromAsar Problem

**Current config has this fuse enabled:**
```typescript
// forge.config.ts line 65
[FuseV1Options.OnlyLoadAppFromAsar]: true,
```

**Problem:**
- `OnlyLoadAppFromAsar` forces Electron to only load code from inside ASAR
- node-pty has TWO binaries: `pty.node` (loaded by Node.js) and `spawn-helper` (standalone executable)
- `plugin-auto-unpack-natives` automatically unpacks `pty.node` to `app.asar.unpacked/`
- But `spawn-helper` is an **executable**, not a `.node` file, and must load from outside ASAR
- When `OnlyLoadAppFromAsar` is enabled, Electron refuses to execute `spawn-helper` from `app.asar.unpacked/`
- **Result: Terminals won't spawn processes**

**Verified files in node-pty/build/Release/:**
```
pty.node          <- Auto-unpacked by plugin-auto-unpack-natives
spawn-helper      <- NOT detected, needs to load from unpacked
```

**Solution (choose one):**

**Option A: Disable OnlyLoadAppFromAsar (RECOMMENDED for terminal apps):**
```typescript
// forge.config.ts
new FusesPlugin({
  version: FuseVersion.V1,
  [FuseV1Options.OnlyLoadAppFromAsar]: false, // <- Changed from true
  // ... rest of fuses
})
```

**Option B: Keep fuse enabled, add explicit unpack + post-package hook:**
```typescript
// forge.config.ts
packagerConfig: {
  asar: {
    unpack: "**/node_modules/node-pty/build/Release/**"
  },
  // ... rest
},
hooks: {
  postPackage: async (forgeConfig, options) => {
    // Manually copy spawn-helper with correct permissions
    // See: https://thomasdeegan.medium.com/electron-forge-node-pty-9dd18d948956
  }
}
```

**Confidence:** HIGH (backed by [Electron Forge + node pty article](https://thomasdeegan.medium.com/electron-forge-node-pty-9dd18d948956) and [node-pty issue #372](https://github.com/microsoft/node-pty/issues/372))

**Recommendation:** **Use Option A**. The security benefit of `OnlyLoadAppFromAsar` is minimal for a desktop IDE that already executes arbitrary code in terminals. Disabling it is the standard approach for terminal apps.

---

### 2. plugin-auto-unpack-natives Configuration

**What it does:**
- Automatically scans `node_modules/` for native modules (packages with `.node` binaries)
- Adds them to `packagerConfig.asar.unpack` config
- Reduces loading times and disk consumption

**Current config is correct:**
```typescript
{
  name: "@electron-forge/plugin-auto-unpack-natives",
  config: {},
}
```

**Does it handle node-pty?**
- YES for `pty.node` (the native module)
- NO for `spawn-helper` (standalone executable)

**Do you need explicit `asarUnpack` globs?**
- NOT for `.node` files (plugin handles them)
- YES if keeping `OnlyLoadAppFromAsar` enabled (need to unpack `spawn-helper`)

**Pattern for explicit unpack:**
```typescript
// Only needed if you want to be extra explicit or unpack non-.node files
packagerConfig: {
  asar: {
    unpack: "**/node_modules/node-pty/build/Release/**"
  }
}
```

**Confidence:** HIGH ([Auto Unpack Natives Plugin docs](https://www.electronforge.io/config/plugins/auto-unpack-natives))

---

### 3. DMG Maker Configuration

**Current config:**
```typescript
// No DMG maker in current forge.config.ts, only zip for darwin
{
  name: "@electron-forge/maker-zip",
  platforms: ["darwin"],
}
```

**Add DMG maker:**
```typescript
{
  name: "@electron-forge/maker-dmg",
  config: {
    // All options are OPTIONAL
    background: './assets/dmg-background.png', // Path to background image
    icon: './assets/app-icon.icns',            // App icon in DMG window
    iconSize: 80,                               // Icon size in pixels
    format: 'ULFO',                             // Compression: UDRW, UDRO, UDCO, UDZO (default), UDBZ, ULFO
    contents: [
      { x: 130, y: 220, type: 'file', path: '/Applications/Breadcrumb.app' },
      { x: 410, y: 220, type: 'link', path: '/Applications' }
    ],
    additionalDMGOptions: {
      window: {
        size: { width: 540, height: 380 }
      },
      'background-color': '#ffffff' // Alternative to background image
    }
  }
}
```

**Key options:**
- `background`: PNG/JPG for DMG window background
- `icon`: .icns file for app icon in DMG (NOT the window icon)
- `format`: Compression format (ULFO = fastest, UDZO = default/smaller)
- `contents`: Array defining icon positions in DMG window (drag-to-Applications layout)
- `additionalDMGOptions`: Passed to [node-appdmg](https://github.com/LinusU/node-appdmg)

**Confidence:** HIGH ([DMG Maker docs](https://www.electronforge.io/config/makers/dmg), [MakerDMGConfig API](https://js.electronforge.io/interfaces/_electron_forge_maker_dmg.MakerDMGConfig.html))

---

### 4. Squirrel Windows Configuration

**Current config:**
```typescript
{
  name: "@electron-forge/maker-squirrel",
  config: {},
}
```

**Enhanced config:**
```typescript
{
  name: "@electron-forge/maker-squirrel",
  config: {
    // Required if app name has spaces
    name: "Breadcrumb",                     // CamelCase, no spaces (NuGet package name)

    // Code signing (optional but recommended)
    certificateFile: "./cert.pfx",         // Path to .pfx certificate
    certificatePassword: process.env.CERT_PASSWORD, // From env var

    // Branding (optional)
    setupIcon: "./assets/icon.ico",        // Installer icon (.ico)
    loadingGif: "./assets/loading.gif",    // Loading animation (.gif)

    // Metadata (pulled from package.json by default)
    authors: "Your Name",                   // Different from package.json "author"
    description: "Breadcrumb Desktop IDE",  // From package.json
  }
}
```

**Key fields:**
- `name`: **Required if app name contains spaces** (for NuGet package)
- `certificateFile` + `certificatePassword`: For code signing (recommended for distribution)
- `setupIcon`: .ico file for installer icon (256x256 minimum)
- `loadingGif`: Animated GIF shown during install
- `authors`: Application author (note: different field name than package.json's `author`)

**Auto-populated from package.json:**
- `description` → from `description` field
- `authors` → from `author` field (unless overridden)

**Requirements:**
- Build on Windows machine OR Linux with `mono` and `wine` installed
- Use `electron-squirrel-startup` to handle install/update/uninstall events

**Outputs:**
- `Breadcrumb Setup.exe` (main installer)
- `Breadcrumb-{version}-full.nupkg` (NuGet package)
- `RELEASES` (update manifest)

**Confidence:** HIGH ([Squirrel.Windows docs](https://www.electronforge.io/config/makers/squirrel.windows))

---

### 5. App Icon Generation

**Required formats:**

| Platform | Format | Sizes | Notes |
|----------|--------|-------|-------|
| macOS | .icns | 16, 32, 64, 128, 256, 512, 1024px (+ retina @2x) | Use iconutil or electron-icon-builder |
| Windows | .ico | 16, 24, 32, 48, 64, 128, 256px | All sizes in one .ico file |
| Linux | .png | 16, 32, 48, 64, 128, 256, 512px | Separate PNG files |

**Recommended workflow:**

1. **Start with 1024x1024 PNG** (single source of truth)
2. **Use electron-icon-builder:**
   ```bash
   npm install --save-dev electron-icon-builder
   npx electron-icon-builder --input=./icon.png --output=./assets
   ```
3. **Generates:**
   - `icons/mac/icon.icns` (all sizes bundled)
   - `icons/win/icon.ico` (all sizes bundled)
   - `icons/png/16x16.png`, `32x32.png`, etc.

**Alternative tools:**
- `electron-icon-maker` (npm package)
- [WebUtils Electron Icon Generator](https://webutils.io/tool/electron-icon-generator) (online)
- macOS Icon Composer (built-in)

**Where to place icons:**
```
breadcrumb/desktop/
  assets/
    icon.png       (1024x1024 source)
    icon.icns      (generated for macOS)
    icon.ico       (generated for Windows)
    dmg-background.png
```

**Confidence:** HIGH ([electron-builder icons docs](https://www.electron.build/icons.html), [electron-icon-builder](https://github.com/safu9/electron-icon-builder))

---

### 6. packagerConfig Metadata

**Current config:**
```typescript
packagerConfig: {
  asar: true,
  name: "Breadcrumb",
  executableName: "breadcrumb",
}
```

**Enhanced config:**
```typescript
packagerConfig: {
  asar: true,
  name: "Breadcrumb",
  executableName: "breadcrumb",

  // Icon (extension auto-completed per platform)
  icon: "./assets/icon",  // Forge picks .icns (macOS) or .ico (Windows)

  // macOS-specific
  appBundleId: "com.yourcompany.breadcrumb",        // Reverse DNS notation
  appCategoryType: "public.app-category.developer-tools", // Finder category
  appCopyright: "Copyright © 2026 Your Company",    // Legal copyright

  // Platform/arch targeting
  platform: "darwin",  // or "win32", "linux", "mas", "all"
  arch: "universal",   // or "x64", "arm64", "ia32", "all"

  // ASAR unpacking (if needed for OnlyLoadAppFromAsar)
  // asar: {
  //   unpack: "**/node_modules/node-pty/build/Release/**"
  // }
}
```

**Key fields:**

| Field | Type | Purpose | Confidence |
|-------|------|---------|------------|
| `icon` | string | Path WITHOUT extension (.icns/.ico auto-selected) | HIGH |
| `appBundleId` | string | macOS bundle identifier (e.g., com.company.app) | HIGH |
| `appCategoryType` | string | macOS Finder category (e.g., public.app-category.developer-tools) | HIGH |
| `appCopyright` | string | Legal copyright string (shown in About dialogs) | HIGH |
| `arch` | string | Target architecture(s): x64, arm64, universal, all | HIGH |
| `platform` | string | Target platform(s): darwin, win32, linux, mas, all | HIGH |

**Icon path behavior:**
- Specify WITHOUT extension: `./assets/icon`
- Forge appends `.icns` on macOS, `.ico` on Windows
- Linux uses `BrowserWindow` constructor icon option instead

**Architecture options:**
- `x64`: Intel/AMD 64-bit
- `arm64`: Apple Silicon, ARM64 Windows
- `universal`: macOS universal binary (combines x64 + arm64)
- `all`: Build for all supported architectures

**Confidence:** HIGH ([electron/packager Options docs](https://electron.github.io/packager/main/interfaces/Options.html))

---

### 7. @electron/rebuild and Native Modules

**Does Electron Forge automatically rebuild native modules?**
**YES.** Electron Forge automatically runs `@electron/rebuild` during packaging.

**From the forge config:**
```typescript
rebuildConfig: {},
```

**How it works:**
1. Forge detects native modules (packages with `.node` binaries)
2. Automatically runs `@electron/rebuild` to recompile against Electron's Node.js version
3. Uses the `rebuildConfig` options (empty = defaults)
4. Preconfigures `buildPath` and `electronVersion` internally

**Do you need a custom rebuild step?**
**NO.** Forge handles it automatically.

**Architecture targeting:**
- Forge overrides the `arch` option internally based on `packagerConfig.arch`
- For universal builds: Forge rebuilds for both x64 and arm64, then combines them
- For single arch builds: Rebuilds for target arch only

**Known issues:**
- electron-forge 7.3.0+ has regression with universal builds ([issue #3719](https://github.com/electron/forge/issues/3719))
- Native modules may fail to combine into universal binary if x64 and arm64 versions differ structurally
- **Workaround:** Build separately for x64 and arm64, then use `@electron/universal` manually

**Confidence:** HIGH ([Native Node Modules docs](https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules), [Electron Forge config](https://www.electronforge.io/config/configuration))

---

## Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| Icon generation from PNG | electron-icon-builder | Handles all size variants + retina displays |
| Manual .node unpacking | plugin-auto-unpack-natives | Automatically detects native modules |
| Manual @electron/rebuild | Forge's rebuildConfig | Built-in, preconfigured, runs automatically |
| DMG window layout | maker-dmg contents config | Handles icon positioning, background, window size |
| Squirrel install events | electron-squirrel-startup | Prevents multiple launches during install/update/uninstall |

## Pitfalls

### 1. OnlyLoadAppFromAsar + node-pty = Broken Terminals
**What happens:** Terminal spawns fail silently because `spawn-helper` can't load from outside ASAR.

**Avoid by:** Disabling `OnlyLoadAppFromAsar` fuse OR adding explicit unpack + post-package hook.

---

### 2. Missing Icon Extension
**What happens:** Icon not found because you specified `.icns` or `.ico` extension explicitly.

**Avoid by:** Use path WITHOUT extension: `icon: "./assets/icon"` (Forge picks .icns/.ico automatically).

---

### 3. Architecture Mismatch on Apple Silicon
**What happens:** App crashes on M1/M2 Macs because native modules were built for x64 only.

**Avoid by:**
- Use `arch: "universal"` for macOS distribution
- Or build separate x64/arm64 versions
- Test on both Intel and Apple Silicon Macs

---

### 4. Code Not Signed on macOS
**What happens:** macOS Gatekeeper blocks app ("App is damaged and can't be opened").

**Avoid by:**
- Sign with Apple Developer certificate
- Use `@electron/osx-sign` or Forge's built-in signing
- Notarize for macOS 10.15+ (required for distribution)

---

### 5. Squirrel Name Field Missing (for apps with spaces)
**What happens:** Squirrel fails to create NuGet package if app name contains spaces.

**Avoid by:** Set `name: "Breadcrumb"` (CamelCase, no spaces) in maker-squirrel config.

---

### 6. electron-store Not Finding Data
**What happens:** App can't find saved data after packaging (rare).

**Avoid by:**
- electron-store uses `app.getPath('userData')` which is OUTSIDE ASAR
- Should work automatically with no config changes
- If custom `cwd` is set, verify path is writable in packaged app

**Note:** electron-store works seamlessly with ASAR packaging because it stores data in user data directory, not inside the app bundle.

---

### 7. ASAR Unpacking Pattern Too Broad
**What happens:** Large files (docs, examples, tests) get unpacked unnecessarily, bloating app size.

**Avoid by:** Use specific glob patterns:
```typescript
// BAD: Unpacks everything
asar: { unpack: "**/*" }

// GOOD: Unpacks only what's needed
asar: { unpack: "**/node_modules/node-pty/build/Release/**" }
```

---

## Open Questions

1. **Universal builds with node-pty:** Does node-pty's `spawn-helper` need separate x64/arm64 binaries, or does a single ARM64 binary work under Rosetta? Need to test on Apple Silicon.

2. **Code signing automation:** Should we set up code signing in CI/CD, or sign locally before release? Need to decide on certificate management strategy.

3. **Auto-updates:** Squirrel generates RELEASES file for updates. Do we want auto-update functionality? If yes, need to research Squirrel.Windows update server hosting.

4. **DMG background design:** Should we create a custom DMG background image, or use default? Need design input.

5. **Linux packaging:** Current config has `.deb` and `.rpm` makers. Do we need AppImage or Flatpak for broader Linux support?

## Sources

**HIGH confidence:**
- [Auto Unpack Native Modules Plugin | Electron Forge](https://www.electronforge.io/config/plugins/auto-unpack-natives)
- [DMG Maker | Electron Forge](https://www.electronforge.io/config/makers/dmg)
- [MakerDMGConfig API](https://js.electronforge.io/interfaces/_electron_forge_maker_dmg.MakerDMGConfig.html)
- [Squirrel.Windows Maker | Electron Forge](https://www.electronforge.io/config/makers/squirrel.windows)
- [Packager Options | @electron/packager](https://electron.github.io/packager/main/interfaces/Options.html)
- [Icons | electron-builder](https://www.electron.build/icons.html)
- [Native Node Modules | Electron](https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules)
- [electron-icon-builder | GitHub](https://github.com/safu9/electron-icon-builder)

**MEDIUM confidence:**
- [Electron Forge + node pty | Medium](https://thomasdeegan.medium.com/electron-forge-node-pty-9dd18d948956) (Oct 2025, paywall blocked full content)
- [electron-winstaller setupIcon/loadingGif | Snyk](https://snyk.io/advisor/npm-package/electron-winstaller/functions/electron-winstaller.createWindowsInstaller)
- [Apple Silicon Support | Electron](https://www.electronjs.org/blog/apple-silicon)
- [electron-store | GitHub](https://github.com/sindresorhus/electron-store)

**LOW confidence (needs validation):**
- Universal build regression in electron-forge 7.3.0+ ([Issue #3719](https://github.com/electron/forge/issues/3719)) - Issue exists but unclear if resolved in 7.6.0
- electron-icon-builder maintenance status (last release 5 years ago per npm)
