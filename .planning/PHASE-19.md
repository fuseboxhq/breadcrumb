# Phase 19: App Bundling & Distribution

**Status:** not_started
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

Run `/bc:plan PHASE-19` to research this phase and populate this section.

## Recommended Approach

The existing Electron Forge + Vite setup is 80% there. Key work areas:

1. **App icon** — Create a placeholder icon, generate .icns (macOS) and .ico (Windows) variants, wire into `packagerConfig`
2. **Forge config hardening** — Add bundle ID, app category, copyright, architecture targeting
3. **DMG maker** — Configure `@electron-forge/maker-dmg` with layout (already in devDeps)
4. **Native module handling** — Verify `@electron-forge/plugin-auto-unpack-natives` correctly handles node-pty in ASAR; may need `asarUnpack` glob patterns
5. **Build verification** — Run `electron-forge package` then `make` on macOS, verify the .app launches and terminals work
6. **Windows build prep** — Configure Squirrel maker properly, document cross-compilation or Windows build requirements

## Tasks

| ID | Title | Status | Complexity |
|----|-------|--------|------------|
| - | No tasks yet | - | - |

Run `/bc:plan PHASE-19` to break down this phase into tasks.

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Build tool | Electron Forge (existing) | Already configured, Vite plugin working |
| macOS installer | DMG via maker-dmg | Standard macOS distribution format |
| Windows installer | Squirrel via maker-squirrel | Already in devDeps, standard for Electron |
| Native module handling | auto-unpack-natives plugin | Already configured, handles ASAR extraction |
| Icon format | .icns (macOS) + .ico (Windows) | Platform requirements |
| Signing | Deferred to follow-up phase | No certificates available yet |

## Completion Criteria

- [ ] `electron-forge make` completes without errors on macOS
- [ ] Produced .dmg installs correctly on macOS (drag to Applications, launches)
- [ ] Packaged app creates terminals with working node-pty
- [ ] Packaged app persists settings via electron-store
- [ ] App has a custom placeholder icon (not default Electron icon)
- [ ] App metadata (name, version, bundle ID) is correct in About dialog
- [ ] Windows Squirrel maker configuration is correct (build-ready, even if not tested on Windows)
- [ ] TypeScript strict mode passes with no errors

## Sources

- Electron Forge docs — packaging, makers, native modules
- Existing `forge.config.ts`, `package.json` in `desktop/`
