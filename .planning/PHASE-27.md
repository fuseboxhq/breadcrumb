# Phase 27: AI Debug Assistant

**Status:** not_started
**Beads Epic:** breadcrumb-oyb
**Created:** 2026-02-14

## Objective

Build a per-project AI debug assistant that lets users describe a bug (with screenshots, console logs, and free text), then spawns a Claude Code instance pre-loaded with project-specific debug context to investigate and fix the issue. The debug knowledge lives as a Claude Code skill per project, created interactively on first use. This is implemented as a fully-featured Breadcrumb extension, which requires extending the extension API with terminal spawning and dynamic UI panel capabilities.

## Scope

**In scope:**
- Extension API additions: `breadcrumb.terminal.createTerminal()` for spawning terminal panes from extensions
- Extension API additions: Dynamic panel/view registration so extensions can contribute UI
- Extension API additions: `context.workspaceState` / `context.globalState` for extension storage
- Debug extension: packaged as a proper Breadcrumb extension using the new API
- Debug modal UI: centered overlay for inputting issue description, pasting screenshots, adding console logs
- Per-project debug skill: stored in `.breadcrumb/skills/debug.md`, synced to `.claude/commands/debug.md`
- Skill creation workflow: when no debug skill exists, spawn Claude interactively to create one (Claude asks about logging tech, doc locations, common patterns, debug procedures)
- Claude Code spawning: launch new instance or reuse last-selected, pre-injected with debug skill + issue context
- Skill sync mechanism: `.breadcrumb/skills/debug.md` ↔ `.claude/commands/debug.md` bidirectional or one-way sync

**Out of scope:**
- Extension marketplace / installer UI
- Extension hot-reload / file watching
- Non-debug extension examples (beyond the existing sample-db-browser)
- Auto-detection of logging frameworks (user tells Claude interactively)
- Automated test generation from debug sessions
- Debug session history / replay

## Constraints

- Must build on top of the existing extension system architecture (ExtensionManager, ExtensionHost, extensionHostWorker)
- The extension API additions must be general-purpose — not debug-specific. Other extensions should be able to use `breadcrumb.terminal.createTerminal()` and panel registration
- The debug skill file must be a valid Claude Code skill (markdown format compatible with `.claude/commands/`)
- Frontend design skill active — follow design thinking process for UI tasks
- Must work across multiple projects in the same Breadcrumb workspace (each project has its own debug skill)

## Research Summary

Run `/bc:plan PHASE-27` to research this phase and populate this section.

## Recommended Approach

### Layer 1: Extension API Foundation
Extend the extension host worker's `breadcrumb` global with:
- `breadcrumb.terminal.createTerminal(options)` — spawns a terminal pane in the active tab, returns a handle for writing/listening
- `breadcrumb.panels.registerPanel(id, options)` — registers a panel type that can be added to the right panel or as a modal
- `breadcrumb.workspace.rootPath` / `breadcrumb.workspace.getConfiguration()` — workspace awareness
- `context.workspaceState` / `context.globalState` — persisted key-value storage

Each API call goes through the existing IPC protocol (worker → main → renderer) with new message types.

### Layer 2: Debug Extension
A bundled extension (`extensions/debug-assistant/`) that:
1. Registers a `debug-assistant.start` command
2. On activation, checks for `.breadcrumb/skills/debug.md` in the active project
3. If missing, offers to create it (spawns Claude with a creation prompt)
4. If present, opens the debug modal for issue input
5. On submit, spawns or reuses a Claude Code pane with the skill + issue context injected

### Layer 3: Debug Modal UI
A React modal component rendered by the main app (not by the extension — extensions can't render React). The extension triggers it via a new `breadcrumb.window.showInputModal(schema)` API that lets extensions define form fields. The modal collects:
- Issue description (rich text / markdown)
- Screenshots (drag & drop, paste from clipboard)
- Console logs (paste, auto-format)
- Instance choice: "New Claude instance" or "Reuse last selected"

### Layer 4: Skill Sync
- `.breadcrumb/skills/debug.md` is the source of truth
- On project open and on skill file change, sync to `.claude/commands/debug.md`
- Use a file watcher or sync-on-action approach

## Tasks

| ID | Title | Status | Complexity |
|----|-------|--------|------------|
| - | No tasks yet | - | - |

Run `/bc:plan PHASE-27` to break down this phase into tasks.

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Skill storage | `.breadcrumb/skills/debug.md` synced to `.claude/commands/debug.md` | Keeps Breadcrumb concerns separate while ensuring Claude Code natively picks up the skill |
| Skill creation | Interactive Claude terminal session | More natural — Claude can probe deeper based on answers, discover project structure |
| Debug UI | Modal dialog | Focused workflow — input issue, attach evidence, launch. Doesn't need to persist as a panel. |
| Extension API scope | General-purpose additions | Terminal spawning and panel registration benefit all future extensions, not just debug |
| Extension architecture | Full implementation, no shortcuts | Professional and scalable — proper extension API, proper IPC, proper isolation |

## Completion Criteria

- [ ] Extension API supports `breadcrumb.terminal.createTerminal()` — any extension can spawn a terminal pane
- [ ] Extension API supports modal/panel triggering from extensions
- [ ] Extension API supports workspace state persistence
- [ ] Debug extension is a standalone package in `extensions/debug-assistant/`
- [ ] Debug modal collects issue description, screenshots, and console logs
- [ ] Claude Code instance spawns with debug skill + issue context pre-loaded
- [ ] Debug skill creation workflow works end-to-end (first-time project setup)
- [ ] Skill files sync between `.breadcrumb/skills/` and `.claude/commands/`
- [ ] Works across multiple projects in the same workspace
