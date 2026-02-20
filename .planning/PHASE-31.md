# Phase 31: Dynamic Extension UI Contributions

**Status:** not_started
**Beads Epic:** breadcrumb-vrp
**Created:** 2026-02-20

## Objective

Extension-contributed UI (toolbar buttons, sidebar entries, command palette commands) is currently hardcoded throughout the renderer. When an extension is deactivated, its UI stays visible — clicking a dead button does nothing or errors. This phase replaces all hardcoded extension UI with a manifest-driven contribution system where UI elements automatically appear when an extension activates and vanish when it deactivates. The debug-assistant extension is the immediate test case, but the system must work generically for any extension.

## Scope

**In scope:**
- Renderer-side reactive store tracking active extensions and their contributions
- Reading `contributes.commands` (and `contributes.views`, `contributes.keybindings`) from extension manifests
- Exposing extension contributions through the IPC bridge to the renderer
- Replacing hardcoded debug-assistant UI in terminal toolbar, sidebar, and command palette with contribution-driven rendering
- Command palette dynamically populated from registered extension commands
- Extensions panel showing what each extension contributes (commands, views, keybindings)
- Real-time toggle: deactivate → UI vanishes, activate → UI reappears

**Out of scope:**
- Claude/Sparkles button — that's a core IDE feature, stays hardcoded
- New extension API capabilities (terminal, modal, state APIs are fine as-is)
- Extension marketplace or install-from-URL
- Extension settings UI (configuration from manifest)
- Creating new extensions beyond the existing two samples

## Constraints

- Must use existing `contributes` field in extension `package.json` as the source of truth (VS Code-style manifest declarations)
- Must work with the existing `ExtensionManager` → `ExtensionHost` → worker architecture
- Existing `onExtensionsChanged` IPC event should be the trigger for renderer updates
- No breaking changes to extension API — existing extensions must continue to work without modification
- Debug-assistant is the primary validation target

## Research Summary

Run `/bc:plan PHASE-31` to research this phase and populate this section.

## Recommended Approach

The main process already tracks extension state and manifests in `ExtensionManager`. The renderer already has `onExtensionsChanged` for real-time updates. The gap is:

1. **Main → Renderer data**: `getExtensionsForRenderer()` needs to include `contributes` from the manifest so the renderer knows what UI each extension provides
2. **Renderer store**: A reactive store (zustand) that tracks active extensions and their contributions, updated via `onExtensionsChanged`
3. **UI integration points**: Terminal toolbar, sidebar, and command palette query the store instead of importing hardcoded components
4. **Extensions panel enhancement**: Show contribution details per extension

The debug-assistant's `contributes.commands` already declares its commands. The hardcoded `startDebugSession` import in 4+ files gets replaced with a generic "execute extension command" dispatch.

## Tasks

| ID | Title | Status | Complexity |
|----|-------|--------|------------|
| - | No tasks yet | - | - |

Run `/bc:plan PHASE-31` to break down this phase into tasks.

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| UI contribution source | Manifest `contributes` field | VS Code convention, already exists in sample manifests |
| Claude button | Core feature, always visible | Not an extension contribution — IDE-level capability |
| Renderer state | Zustand store | Consistent with existing stores (appStore, planningStore) |
| IPC trigger | `onExtensionsChanged` | Already wired, just needs richer payload |
| Validation target | debug-assistant | Has 3 visible UI touchpoints across toolbar, sidebar, command palette |

## Completion Criteria

- [ ] Deactivate debug-assistant → Bug button (terminal toolbar), sidebar entry, and command palette entry all vanish instantly
- [ ] Reactivate debug-assistant → all its UI reappears without page reload
- [ ] A hypothetical new extension with `contributes.commands` automatically gets command palette entries and UI presence without any hardcoding
- [ ] Extensions panel shows each extension's contributions (commands, views, keybindings) alongside status
- [ ] Zero hardcoded extension-specific UI remains in renderer components — everything flows from the contribution system
- [ ] Existing extensions work without manifest changes (backward compatible)

## Sources

**HIGH confidence:**
- Direct codebase audit: `ExtensionManager.ts`, `extensionHostWorker.ts`, `ExtensionHost.ts`, `extensionIpc.ts`
- Current hardcoded UI: `TerminalPanel.tsx:419-423`, `SidebarPanel.tsx:207-208,298-302`, `CommandPalette.tsx:79`, `commands.ts:149-157`
- Extension manifests: `debug-assistant/package.json`, `sample-db-browser/package.json`
- Existing IPC surface: `preload/index.ts` extension methods
