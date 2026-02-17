# Phase 27: AI Debug Assistant

**Status:** in_progress
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

**Overall Confidence:** HIGH

The three core technical domains (Claude Code skills, extension IPC, image handling) are well-understood from official docs and source code analysis. The extension system follows a predictable 5-file pattern for new APIs. Claude Code skills use markdown with YAML frontmatter in `.claude/skills/<name>/SKILL.md`. Images are passed to Claude Code via file path in prompt text (not piped).

### Claude Code Skills Format

Skills are markdown files with optional YAML frontmatter stored in `.claude/skills/<name>/SKILL.md` (or legacy `.claude/commands/<name>.md`). Key features:
- `$ARGUMENTS` / `$0`, `$1` for positional argument substitution
- `!` backtick preprocessing for dynamic shell context injection
- `context: fork` for isolated subagent execution
- `allowed-tools` for scoped tool permissions
- Invoked interactively with `/skill-name` or programmatically with `claude "/skill-name args"`
- Images: pass absolute file path in prompt text — Claude reads from disk

### Extension IPC Protocol

Every new API touches 5 files in order:
1. `types.ts` — Add union members to `HostMessage` / `HostResponse`
2. `extensionHostWorker.ts` — Add API to `breadcrumb.*` + message handler
3. `ExtensionHost.ts` — Bridge method + event emission
4. `ExtensionManager.ts` — State management + forwarding
5. `extensionIpc.ts` — Electron IPC handlers + renderer push

Terminal creation bridges to existing `terminalService.createSession()`. Modals use renderer push events. Workspace state uses a second `electron-store` instance with initial state dump on activation.

### Image Handling

- **Clipboard paste**: Browser `ClipboardEvent.clipboardData.items` (not `.files`) — works in renderer without Electron clipboard
- **Drag-and-drop**: Standard HTML5 `DragEvent.dataTransfer.files`
- **Preview**: `FileReader.readAsDataURL()` for base64 preview in `<img>` tags
- **Persistence**: Save to temp via IPC (`app.getPath('temp')`), pass file path to Claude
- **No new npm packages needed** — all browser APIs

### Key Patterns

| Pattern | Approach |
|---------|----------|
| Terminal from extension | Worker → `HostResponse` → ExtensionHost event → ExtensionManager calls `terminalService.createSession()` → push to renderer |
| Modal from extension | Worker → `HostResponse` → ExtensionManager → push to renderer → renderer renders modal → user response → IPC back → resolve worker promise |
| Workspace state sync | Pre-load into worker at activation time for sync `get()`, fire-and-forget IPC for `update()` |
| Image to Claude Code | Save to temp file → reference absolute path in prompt text sent to terminal |

### Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| Extension persistence | `electron-store` (already installed) | JSON file with schema, atomic writes |
| Simple confirmation dialogs | `electron.dialog.showMessageBox()` | No renderer changes needed |
| Terminal creation | `terminalService.createSession()` (already exists) | Full PTY with replay buffer already wired |
| Image MIME detection | `file.type.startsWith("image/")` | Built-in, handles all formats |
| Drag-and-drop library | Inline HTML5 drag events | Zero extra deps, codebase has no drag-drop lib |
| Clipboard images | Browser `ClipboardEvent` in renderer | No Electron IPC needed |

### Pitfalls

- **`clipboardData.files` empty for screenshot pastes**: Use `.items` and `getAsFile()` — `.files` is only populated for drag-and-drop
- **`dragLeave` flickering on child elements**: Check `!e.currentTarget.contains(e.relatedTarget)` before clearing drag state
- **Sync `get()` impossible over IPC**: Pre-load extension state into worker at activation time, maintain local cache
- **`registerCommand` monkey-patch not reentrant**: Bind `extensionId` as closure variable for new APIs
- **Temp file cleanup**: Delete on modal close via `useEffect` cleanup; add `app.on('before-quit')` fallback
- **`window.isDestroyed()` guard**: Must check before every `webContents.send()` in extensionIpc.ts

## Recommended Approach

### Layer 1: Extension API Foundation
Extend the extension host worker's `breadcrumb` global with:
- `breadcrumb.terminal.createTerminal(options)` — spawns a terminal pane in the active tab, returns a handle for writing/listening
- `breadcrumb.window.showInputModal(schema)` — triggers a custom form modal in the renderer, returns user input
- `context.workspaceState` — persisted key-value storage via electron-store with sync `get()` and async `update()`

Each API call goes through the existing IPC protocol (worker → main → renderer) with new message types.

### Layer 2: Debug Modal UI
A React modal component rendered by the main app (not by the extension — extensions can't render React). The extension triggers it via the `showInputModal` API. The modal collects:
- Issue description (markdown textarea)
- Screenshots (drag & drop, paste from clipboard)
- Console logs (paste, auto-format)
- Instance choice: "New Claude instance" or "Reuse last selected"

### Layer 3: Debug Extension
A bundled extension (`extensions/debug-assistant/`) that:
1. Registers a `debug-assistant.start` command
2. On activation, checks for `.breadcrumb/skills/debug.md` in the active project
3. If missing, offers to create it (spawns Claude with a creation prompt)
4. If present, opens the debug modal for issue input
5. On submit, spawns or reuses a Claude Code pane with the skill + issue context injected

### Layer 4: Skill Sync
- `.breadcrumb/skills/debug.md` is the source of truth
- On project open and on skill file change, sync to `.claude/commands/debug.md`
- Sync-on-action approach (sync when debug extension activates or skill is created/modified)

## Tasks

| ID | Title | Status | Complexity | Dependencies |
|----|-------|--------|------------|--------------|
| breadcrumb-oyb.1 | Extension API: Terminal spawning from extensions | done | Medium | - |
| breadcrumb-oyb.2 | Extension API: Workspace state persistence | done | Medium | - |
| breadcrumb-oyb.3 | Extension API: Input modal triggering from extensions | done | High | - |
| breadcrumb-oyb.4 | Debug modal UI with image paste/drop and console logs | done | High | oyb.3 |
| breadcrumb-oyb.5 | Debug extension package with Claude Code spawning | done | High | oyb.1, oyb.2, oyb.3, oyb.4 |
| breadcrumb-oyb.6 | Skill creation workflow and bidirectional sync | done | Medium | oyb.1, oyb.5 |

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Skill storage | `.breadcrumb/skills/debug.md` synced to `.claude/commands/debug.md` | Keeps Breadcrumb concerns separate while ensuring Claude Code natively picks up the skill |
| Skill format | Claude Code skill with YAML frontmatter + markdown body | Compatible with `.claude/skills/` directory, supports `$ARGUMENTS`, `!` backtick preprocessing |
| Skill creation | Interactive Claude terminal session | More natural — Claude can probe deeper based on answers, discover project structure |
| Debug UI | Custom input modal via extension API | Focused workflow — input issue, attach evidence, launch. Extension triggers it, renderer renders it. |
| Extension API scope | General-purpose additions | Terminal spawning and modal triggering benefit all future extensions, not just debug |
| Extension architecture | Full implementation, no shortcuts | Professional and scalable — proper extension API, proper IPC, proper isolation |
| Image handling | Browser Clipboard API + HTML5 drag events | No new deps, no Electron clipboard IPC needed, works directly in renderer |
| Image to Claude | Save to temp file, pass path in prompt | Confirmed method from official Claude Code docs — no `--image` flag exists |
| Workspace state | Second electron-store instance + worker cache | Sync `get()` via pre-loaded cache, fire-and-forget `update()` |

## Completion Criteria

- [x] Extension API supports `breadcrumb.terminal.createTerminal()` — any extension can spawn a terminal pane
- [x] Extension API supports modal/panel triggering from extensions
- [x] Extension API supports workspace state persistence
- [x] Debug extension is a standalone package in `extensions/debug-assistant/`
- [x] Debug modal collects issue description, screenshots, and console logs
- [x] Claude Code instance spawns with debug skill + issue context pre-loaded
- [x] Debug skill creation workflow works end-to-end (first-time project setup)
- [x] Skill files sync between `.breadcrumb/skills/` and `.claude/commands/`
- [x] Works across multiple projects in the same workspace

## Sources

**HIGH confidence:**
- Claude Code skills documentation (code.claude.com/docs/en/slash-commands)
- Claude Code CLI reference (code.claude.com/docs/en/cli-reference)
- Claude Code common workflows — image handling (code.claude.com/docs/en/common-workflows)
- Extension system source code (types.ts, extensionHostWorker.ts, ExtensionHost.ts, ExtensionManager.ts, extensionIpc.ts)
- Electron clipboard API docs
- MDN ClipboardEvent / DragEvent / FileReader APIs

**MEDIUM confidence:**
- `clipboardData.files` empty for screenshot pastes (MDN + multiple implementation reports)
- Claude Code 5MB image limit (unofficial source)
