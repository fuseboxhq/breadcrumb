# Phase 19: App Bundling & Distribution

**Status:** done
**Beads Epic:** breadcrumb-o00
**Created:** 2026-02-14

## Objective

Get `electron-forge make` producing proper, installable application artifacts for macOS (.dmg) and Windows (.exe/Squirrel installer) that install, launch, and run correctly — including native dependencies like node-pty. This is the MVP distribution phase: no code signing, no auto-updates, no CI/CD. Those are follow-up phases once the build pipeline works end-to-end.

## Scope

**In scope:**
- Fix/configure `electron-forge make` to produce working macOS .dmg and Windows Squirrel installer
- Ensure native modules (node-pty) are correctly rebuilt and packaged for each target platform
- Create placeholder app icon (.icns for macOS, .ico for Windows) and wire into forge config
- Configure proper app metadata (name, version, description, bundle ID, copyright)
- Ensure ASAR packaging works correctly with native modules (auto-unpack-natives)
- Verify the packaged app launches, creates terminals, and persists settings
- DMG configuration (background, icon positions) for a decent macOS install experience
- Handle node-pty binary rebuild for target architecture (arm64/x64)

**Out of scope:**
- Code signing (Apple notarization, Windows Authenticode) — no certs available yet
- Auto-update mechanism (electron-updater, Squirrel.Windows updates)
- CI/CD pipelines (GitHub Actions cross-platform builds)
- Linux packaging beyond what's already configured (deb/rpm makers exist)
- Custom installer UI or splash screens
- Release management (GitHub Releases, S3 hosting, download pages)
- App Store submission (Mac App Store, Microsoft Store)

## Constraints

- Use existing Electron Forge setup (already configured with Vite plugin, makers, fuses)
- No new build tools — extend forge.config.ts, don't replace it
- Must work on macOS arm64 (current dev machine) at minimum
- node-pty is the critical native dependency — it must work in the packaged app
- Follow existing project patterns (TypeScript strict, no unnecessary deps)

## Research Summary

**Overall Confidence:** HIGH

Use the existing Electron Forge + Vite setup. The critical fix is **disabling the `OnlyLoadAppFromAsar` fuse** — node-pty's `spawn-helper` executable must load from outside ASAR, and the auto-unpack-natives plugin only handles `.node` files, not standalone executables. Generate icons from a 1024x1024 PNG using `electron-icon-builder`. DMG and Squirrel makers need straightforward config additions. Forge auto-runs `@electron/rebuild` for native modules — no custom rebuild step needed.

### Recommended Stack

| Library | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| @electron-forge/plugin-auto-unpack-natives | 7.6.0 (installed) | Unpack .node binaries from ASAR | HIGH |
| electron-icon-builder | 2.0.1+ (new devDep) | Generate .icns/.ico from 1024px PNG | HIGH |
| @electron/rebuild | 3.7.0 (installed) | Rebuild native modules (automatic) | HIGH |

### Key Patterns

**OnlyLoadAppFromAsar must be disabled** — node-pty has two binaries: `pty.node` (native module, auto-unpacked) and `spawn-helper` (standalone executable, NOT detected by auto-unpack-natives). With the fuse enabled, Electron refuses to execute `spawn-helper` from `app.asar.unpacked/`, breaking all terminal spawning. For a terminal IDE that already executes arbitrary user code, this fuse provides no meaningful security benefit.

**Icon path omits extension** — Set `icon: "./assets/icon"` in packagerConfig. Forge auto-appends `.icns` (macOS) or `.ico` (Windows) per target platform.

**Forge auto-rebuilds native modules** — `rebuildConfig: {}` is sufficient. No manual `@electron/rebuild` step needed. Architecture is determined by `packagerConfig.arch`.

### Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| Icon size variants | electron-icon-builder | Generates all required sizes from single 1024px PNG |
| Manual .node unpacking | plugin-auto-unpack-natives | Automatically detects native modules |
| Manual @electron/rebuild | Forge rebuildConfig | Built-in, auto-runs during packaging |
| DMG window layout | maker-dmg contents config | Handles positioning, background, window size |

### Pitfalls

- **OnlyLoadAppFromAsar + node-pty = broken terminals**: spawn-helper can't load from outside ASAR. Must disable fuse.
- **Icon path with extension**: Use `./assets/icon` not `./assets/icon.icns` — Forge picks extension per platform.
- **Architecture mismatch on Apple Silicon**: Native modules built for x64 crash on arm64. Build for current arch first (arm64), universal builds can come later.
- **Squirrel name field**: Required for NuGet package naming. Use CamelCase, no spaces.
- **Unsigned macOS app**: Gatekeeper will warn users. Expected for MVP — signing is a follow-up phase. Users can right-click > Open to bypass.

## Tasks

| ID | Title | Status | Complexity | Dependencies |
|----|-------|--------|------------|--------------|
| breadcrumb-o00.1 | Create placeholder app icon and generate platform variants | done | Low | - |
| breadcrumb-o00.2 | Harden forge.config.ts: metadata, icon, fuses, ASAR unpack | done | Medium | o00.1 |
| breadcrumb-o00.3 | Configure DMG maker for macOS installer | done | Low | o00.2 |
| breadcrumb-o00.4 | Configure Squirrel maker for Windows installer | done | Low | o00.2 |
| breadcrumb-o00.5 | Build, package, and verify macOS app end-to-end | done | High | o00.3, o00.4 |

### Task Details

**o00.1 — Create placeholder app icon and generate platform variants (Low)**
Create a simple but distinctive 1024x1024 PNG icon for Breadcrumb (can be refined later). Use `electron-icon-builder` to generate `.icns` (macOS) and `.ico` (Windows) variants.

Files to create:
- `desktop/assets/icon.png` (1024x1024 source)
- `desktop/assets/icon.icns` (generated)
- `desktop/assets/icon.ico` (generated)

Install `electron-icon-builder` as devDependency.

**o00.2 — Harden forge.config.ts: metadata, icon, fuses, ASAR unpack (Medium)**
Update `forge.config.ts` with:
- `icon: "./assets/icon"` in packagerConfig (no extension)
- `appBundleId: "com.breadcrumb.desktop"` for macOS
- `appCategoryType: "public.app-category.developer-tools"`
- `appCopyright: "Copyright 2026 Breadcrumb"`
- **Disable `OnlyLoadAppFromAsar` fuse** (critical for node-pty)
- Add explicit `asar.unpack` for node-pty's `spawn-helper`: `"**/node_modules/node-pty/build/Release/**"`
- Remove `resetAdHocDarwinSignature` (no signing yet)

**o00.3 — Configure DMG maker for macOS installer (Low)**
Replace or supplement the existing `maker-zip` (darwin) with `maker-dmg`:
- Set `format: "ULFO"` (fast compression)
- Configure `contents` array for drag-to-Applications layout (app icon + Applications symlink)
- Set `icon` and `additionalDMGOptions.window.size`
- Keep `maker-zip` as a secondary option

**o00.4 — Configure Squirrel maker for Windows installer (Low)**
Update `maker-squirrel` config with:
- `name: "Breadcrumb"` (CamelCase, no spaces)
- `setupIcon: "./assets/icon.ico"`
- `authors` and `description` metadata
- Note: Can't test on macOS, but config should be build-ready

**o00.5 — Build, package, and verify macOS app end-to-end (High)**
Run `electron-forge package` then `electron-forge make` on macOS. Verify:
- Build completes without errors
- .dmg is produced and mounts correctly
- App installs to /Applications via drag
- App launches with custom icon
- Terminal creation works (node-pty + spawn-helper)
- Settings persist via electron-store
- About dialog shows correct metadata
- Fix any issues found during verification

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Build tool | Electron Forge (existing) | Already configured, Vite plugin working |
| macOS installer | DMG via maker-dmg | Standard macOS distribution format |
| Windows installer | Squirrel via maker-squirrel | Already in devDeps, standard for Electron |
| Native module handling | auto-unpack-natives + explicit unpack | Plugin handles .node; explicit glob for spawn-helper |
| OnlyLoadAppFromAsar | **Disabled** | node-pty spawn-helper must load from outside ASAR |
| Icon generation | electron-icon-builder from 1024px PNG | Single source, generates all platform variants |
| Architecture | arm64 first (dev machine), universal later | Start simple, avoid universal build regressions |
| Signing | Deferred to follow-up phase | No certificates available yet |

## Completion Criteria

- [x] `electron-forge make` completes without errors on macOS
- [x] Produced .dmg installs correctly on macOS (drag to Applications, launches)
- [x] Packaged app creates terminals with working node-pty
- [x] Packaged app persists settings via electron-store
- [x] App has a custom placeholder icon (not default Electron icon)
- [x] App metadata (name, version, bundle ID) is correct in About dialog
- [x] Windows Squirrel maker configuration is correct (build-ready, even if not tested on Windows)
- [x] TypeScript strict mode passes with no errors

## Sources

**HIGH confidence:**
- `.planning/research/phase-19-app-bundling.md` — full implementation research
- [Auto Unpack Natives Plugin | Electron Forge](https://www.electronforge.io/config/plugins/auto-unpack-natives)
- [DMG Maker | Electron Forge](https://www.electronforge.io/config/makers/dmg)
- [Squirrel.Windows Maker | Electron Forge](https://www.electronforge.io/config/makers/squirrel.windows)
- [Packager Options | @electron/packager](https://electron.github.io/packager/main/interfaces/Options.html)
- [electron-icon-builder | GitHub](https://github.com/safu9/electron-icon-builder)

**MEDIUM confidence:**
- [Electron Forge + node pty | Medium](https://thomasdeegan.medium.com/electron-forge-node-pty-9dd18d948956)
- [node-pty issue #372](https://github.com/microsoft/node-pty/issues/372) — spawn-helper ASAR issues
