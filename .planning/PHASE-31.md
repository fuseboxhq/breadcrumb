# Phase 31: Dynamic Extension UI Contributions

**Status:** done
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

**Overall Confidence:** HIGH

This is primarily a renderer-side wiring change. The main process already parses full manifests and tracks extension state. The renderer already subscribes to extension changes via `onExtensionsChanged`. The gap is that `getExtensionsForRenderer()` only sends 8 fields (missing `contributes.views`, `contributes.keybindings`, `activationEvents`), the renderer has no reactive store for contributions, and all extension UI is hardcoded in 6 locations across 4 component files.

### Key Findings

**Current data flow gap:**
- `ExtensionManager.getExtensionsForRenderer()` returns `{id, displayName, version, description, status, publisher, capabilities, commands}` — commands are included but views, keybindings, and activation events are not
- The `onExtensionsChanged` IPC channel already broadcasts the full array on every status change — enriching the payload is trivial
- `ExtensionsPanel.tsx` already calls `getExtensions()` on mount and subscribes to `onExtensionsChanged` — just consumes a limited shape

**Hardcoded debug UI inventory (6 touchpoints):**
1. `TerminalPanel.tsx:417-425` — Bug button in terminal toolbar
2. `SidebarPanel.tsx:205-209` — "Debug with Claude" in explorer context menu
3. `SidebarPanel.tsx:297-303` — "Debug with Claude" inline button in expanded project
4. `commands.ts:149-160` — "Start Debug Session" command palette entry
5. `App.tsx:171-175` — `<DebugModal>` container
6. `debugStore.ts` — `startDebugSession()`, `useDebugStore`, `detectDebugSkill()`

**Important: StatusBar Bug icon is for DevTools toggle, NOT debug-assistant — leave it alone.**

**Claude/Sparkles buttons (3 locations, stay hardcoded):**
- `TerminalPanel.tsx:410-416` — toolbar
- `SidebarPanel.tsx:192-204` — explorer context menu
- `SidebarPanel.tsx:685-697` — terminals context menu

### Design Guidance

The `frontend-design` skill is not needed for this phase — the work is architectural wiring, not visual design. The existing button styles are reused.

### Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| Extension state management | Zustand store with `onExtensionsChanged` subscription | Consistent with existing stores, reactive, minimal boilerplate |
| Command → action mapping | `executeExtensionCommand()` IPC | Already exists and works — just needs to be the execution path for all extension commands |

### Pitfalls

- **Debug modal flow**: `startDebugSession()` has special logic (detect skill → modal vs toast). This needs to stay functional but be triggered via extension command execution, not direct import. The debug-assistant extension's `start` command already handles this internally.
- **Command deduplication**: If an extension is activated twice or commands are registered at both manifest-parse time and runtime, the command palette could show duplicates. Use `commandId` as the unique key.
- **StatusBar Bug icon**: The Bug icon in `StatusBar.tsx` is for DevTools toggle — NOT related to debug-assistant. Don't touch it.
- **Lazy activation**: `sample-db-browser` uses `activationEvents: ["onCommand:..."]` (lazy). The UI contribution (button/command) should show regardless — clicking it should auto-activate the extension then execute.

## Recommended Approach

1. **Enrich the data** (task .1): Expand `ExtensionInfoForRenderer` to include full `contributes` object. One-line change in `getExtensionsForRenderer()`.

2. **Build the store** (task .2): New `extensionStore.ts` — zustand store that subscribes to `onExtensionsChanged`, exposes derived selectors like `useActiveExtensionCommands()`, `useIsExtensionActive(id)`.

3. **Replace hardcoded UI** (tasks .3, .4): Components query the store. Terminal toolbar and sidebar render extension command buttons dynamically from `contributes.commands` where `category` matches a UI slot. Command palette merges extension commands into its list.

4. **Wire debug flow** (task .6): The debug modal + store stays but is triggered via `executeExtensionCommand("debug-assistant.start")` instead of direct `startDebugSession()` import. The extension's `start` command handler already does skill detection + modal.

5. **Enhance extensions panel** (task .5): Show contribution details per extension.

## Tasks

| ID | Title | Status | Complexity | Dependencies |
|----|-------|--------|------------|--------------|
| breadcrumb-vrp.1 | Expand ExtensionInfoForRenderer to include full contributes manifest | done | Low | - |
| breadcrumb-vrp.2 | Create reactive extensionStore in renderer for contribution tracking | done | Medium | .1 |
| breadcrumb-vrp.3 | Replace hardcoded debug UI in toolbar and sidebar with contribution-driven rendering | done | High | .2 |
| breadcrumb-vrp.4 | Dynamic command palette: merge extension commands based on active state | done | Medium | .2 |
| breadcrumb-vrp.5 | Enhance Extensions panel to show per-extension contributions | done | Low | .2 |
| breadcrumb-vrp.6 | Wire debug-assistant modal and store through extension command execution | done | Medium | .3 |

### Task Details

**breadcrumb-vrp.1: Expand ExtensionInfoForRenderer to include full contributes manifest**
- Add `contributes` (full object), `activationEvents`, and `extensionDependencies` to `ExtensionInfoForRenderer` type in `shared/types/index.ts`
- Update `getExtensionsForRenderer()` in `ExtensionManager.ts` to include these fields
- Update preload type in `preload/index.ts` to match
- Tiny change — just widening the data that's already parsed

**breadcrumb-vrp.2: Create reactive extensionStore in renderer for contribution tracking**
- New file: `desktop/src/renderer/store/extensionStore.ts`
- Zustand store that calls `getExtensions()` on init and subscribes to `onExtensionsChanged`
- State: `extensions: ExtensionInfoForRenderer[]`, derived selectors:
  - `useActiveExtensions()` — only active extensions
  - `useActiveExtensionCommands()` — flat list of commands from active extensions with `extensionId` attached
  - `useIsExtensionActive(id)` — boolean check
  - `useExtensionCommandsByCategory(category)` — commands grouped by manifest category (e.g. "Debug")
  - `executeExtensionCommand(commandId)` — wraps `window.breadcrumbAPI.executeExtensionCommand()`
- Subscribe to IPC changes in store init (similar to how `planningStore` works)

**breadcrumb-vrp.3: Replace hardcoded debug UI in toolbar and sidebar with contribution-driven rendering**
- **TerminalPanel.tsx**: Remove hardcoded Bug button. Add a loop over `useExtensionCommandsByCategory("Debug")` (or similar) that renders buttons for active extension commands. Each button calls `executeExtensionCommand(commandId)`.
- **SidebarPanel.tsx**: Remove 3 hardcoded debug entries (explorer context menu, expanded project actions, terminals context menu). Replace with contribution-driven menu items from active extensions.
- Remove `import { startDebugSession } from "../../store/debugStore"` from TerminalPanel and SidebarPanel.
- Keep Claude/Sparkles buttons untouched.

**breadcrumb-vrp.4: Dynamic command palette: merge extension commands based on active state**
- Update `commands.ts` `buildCommands()` to accept extension commands from the store
- Remove hardcoded `debug-start` command entry
- Merge active extension commands into the command list with `icon`, `label` (from manifest `title`), `category` (from manifest), and action that calls `executeExtensionCommand()`
- Commands from inactive extensions don't appear
- Also update `CommandPalette.tsx` to pass extension commands to `buildCommands()`

**breadcrumb-vrp.5: Enhance Extensions panel to show per-extension contributions**
- In `ExtensionsPanel.tsx`, expand the detail view to show:
  - `contributes.commands` — list with command ID and title
  - `contributes.views` — list with view ID and name
  - `contributes.keybindings` — list with command and key combo
- Group by section with labels
- Show "No contributions" if empty

**breadcrumb-vrp.6: Wire debug-assistant modal and store through extension command execution**
- The debug-assistant's `start` command currently runs in the extension host worker, which can show modals and create terminals via the extension API
- However, the current `DebugModal` in `App.tsx` is a hardcoded React component with `useDebugStore` — it's renderer-side, not extension-triggered
- **Decision point**: Either (a) the extension's `start` command uses `breadcrumb.window.showInputModal()` (the generic extension modal), or (b) we keep `DebugModal` but trigger it via IPC when the extension command executes
- Option (b) is simpler for now: `executeExtensionCommand("debug-assistant.start")` → main process routes to extension host → extension handler calls back with modal request → renderer shows DebugModal
- Remove direct `startDebugSession` imports from all components
- Clean up: `debugStore.ts` can be simplified to just the modal state, with `startDebugSession` no longer called directly

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| UI contribution source | Manifest `contributes` field | VS Code convention, already exists in sample manifests |
| Claude button | Core feature, always visible | Not an extension contribution — IDE-level capability |
| Renderer state | Zustand store (`extensionStore.ts`) | Consistent with existing stores (appStore, planningStore) |
| IPC trigger | `onExtensionsChanged` | Already wired, just needs richer payload |
| Validation target | debug-assistant | Has 3+ visible UI touchpoints across toolbar, sidebar, command palette |
| Command execution | `executeExtensionCommand()` IPC | Already exists — becomes the universal dispatch for all extension actions |
| Debug modal | Keep existing DebugModal, trigger via extension command | Avoids rebuilding a polished modal; just changes the trigger path |
| Lazy-activated extensions | Show UI, auto-activate on click | `onCommand:` activation events mean the extension starts when its command runs |

## Completion Criteria

- [ ] Deactivate debug-assistant → Bug button (terminal toolbar), sidebar entry, and command palette entry all vanish instantly
- [ ] Reactivate debug-assistant → all its UI reappears without page reload
- [ ] A hypothetical new extension with `contributes.commands` automatically gets command palette entries and UI presence without any hardcoding
- [ ] Extensions panel shows each extension's contributions (commands, views, keybindings) alongside status
- [ ] Zero hardcoded extension-specific UI remains in renderer components — everything flows from the contribution system
- [ ] Existing extensions work without manifest changes (backward compatible)

## Sources

**HIGH confidence:**
- Direct codebase audit: `ExtensionManager.ts` (lines 264-275), `extensionIpc.ts`, `preload/index.ts`
- Hardcoded UI inventory: `TerminalPanel.tsx:417-425`, `SidebarPanel.tsx:205-209,297-303`, `commands.ts:149-160`, `App.tsx:171-175`
- Extension manifests: `debug-assistant/package.json`, `sample-db-browser/package.json`
- Existing IPC: `onExtensionsChanged` channel, `executeExtensionCommand` handler
