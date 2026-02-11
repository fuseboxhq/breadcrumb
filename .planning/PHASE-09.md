# Phase 09: Terminal Experience

**Status:** not_started
**Beads Epic:** breadcrumb-xrv
**Created:** 2026-02-11

## Objective

Build a production-grade, Warp-level terminal experience that supports multi-project workflows. In an agentic AI world where developers work on 3-4 projects simultaneously, Breadcrumb should be the single IDE instance they launch — with terminals, explorers, and agents scoped per-project. This phase delivers full shell integration (command detection, cwd tracking, clickable links), search, split panes with keyboard navigation, terminal settings/preferences, and the multi-project architecture that underpins everything.

## Scope

**In scope:**
- Multi-project workspace model: project switcher, per-project terminal groups, per-project explorer
- Per-terminal working directory with cwd tracking (OSC 7/133)
- Shell integration: command boundary detection (OSC 133), exit code display, clickable links (OSC 8)
- Shell selection (zsh, bash, fish) per terminal and as default preference
- Search in terminal output (xterm-addon-search) with match highlighting and search bar overlay
- Split pane polish: keyboard shortcuts to split/navigate/close, focus management, named panes
- Terminal settings panel: font family, font size, scrollback length, default shell, cursor style
- Proper tab naming from cwd (show folder name, not "Terminal 1")
- xterm addons: search, web-links, unicode11, serialize (for scrollback persistence)
- Command palette integration: terminal commands registered in Cmd+K

**Out of scope:**
- Remote terminals (SSH, Docker exec, containers) — future phase
- Light mode / theme switching (dark only for now)
- Terminal multiplexer protocol (tmux integration)
- Full file tree implementation in explorer (scaffold the multi-project model, but file tree is its own phase)

## Constraints

- Frontend design skill active — follow design thinking process for UI tasks
- Build on existing xterm.js + node-pty + IPC architecture (PHASE-07)
- Use existing design token system from PHASE-08 (Dracula palette, transitions, etc.)
- xterm addons only — no forking xterm or custom terminal emulator
- Multi-project model must be backward-compatible (single project still works seamlessly)
- Settings must persist across restarts (electron-store or similar)
- All keyboard shortcuts must be discoverable via command palette

## Research Summary

### xterm.js Addons (HIGH confidence)
- **@xterm/addon-search** (0.15.0): `findNext()`/`findPrevious()` with regex, case-sensitive, and `onDidChangeResults` event. `highlightLimit: 1000` default prevents perf issues. Decorations persist until `clearDecorations()`.
- **@xterm/addon-web-links** (0.12.0): Detects URLs + handles OSC 8 hyperlinks natively. Custom click handler receives `(event, uri)`. In Electron, use `shell.openExternal(uri)`.
- **@xterm/addon-unicode11** (0.10.0): Fixes emoji/CJK character widths. Must set `terminal.unicode.activeVersion = '11'` after loading — loading alone doesn't activate.
- **@xterm/addon-serialize** (0.14.0): Experimental but functional. Serializes scrollback + cursor + colors. Restore before `terminal.open()` for best results. Use `scrollback` option to limit size.

### Shell Integration (HIGH confidence)
- **OSC 133** (command boundaries): `A` = prompt start, `B` = prompt end, `C` = command start, `D;exitcode` = command end. Standardized by FinalTerm, adopted by VS Code/iTerm2/kitty/Windows Terminal.
- **OSC 7** (cwd reporting): `file://hostname/path` format. Must URI-encode special chars. 2083-byte limit.
- **OSC 8** (hyperlinks): Handled automatically by addon-web-links. No custom parser needed.
- **xterm.js parser**: `terminal.parser.registerOscHandler(133, callback)` for custom handling. Sync preferred, async supported. 10MB payload limit.
- **Shell scripts**: User-sourced helper scripts (recommended approach). Guard variable `__TERMINAL_INTEGRATION_LOADED` prevents double-loading. Bash uses `PROMPT_COMMAND` + `preexec_functions`, zsh uses `precmd_functions` + `preexec_functions`, fish uses `--on-event fish_prompt/fish_preexec`.

### Settings & Multi-Project (HIGH confidence)
- **electron-store** (11.0.2): Main process only (security). JSON Schema validation with ajv. Atomic writes + corruption recovery. `onDidChange()` for reactive updates. Migrations object for schema evolution.
- **IPC bridge pattern**: `SETTINGS_GET_ALL`, `SETTINGS_SET`, `SETTINGS_CHANGED` channels. Validate all inputs in handlers. Broadcast changes to renderer.
- **Multi-project Zustand store**: `Project` entity with `id, name, path, terminalSessions[]`. `projectsStore` with `Map<string, Project>` and `activeProjectId`. `useProjectTerminalSettings()` merges global + per-project overrides. Persist recent projects in electron-store.

### Key Pitfalls Identified
- electron-store: Never use in renderer (security). Always validate IPC inputs. Keep stored data small (<1MB). Wait for `isLoaded` before rendering terminals.
- OSC 133: `PROMPT_COMMAND` ordering matters (save `$?` on first line). Zsh precmd hooks must be last. Guard against double integration.
- Scrollback: Never set unlimited (memory leak). 1000-5000 for interactive, 10000+ only for log viewing.
- Unicode11: Not grapheme-cluster-aware — compound emojis (ZWJ sequences) may still break.

## Recommended Approach

**Architecture:** Introduce a `Project` concept in the Zustand store — each project has an id, path, name, and owns terminal sessions, explorer state, and future agent sessions. A project switcher in the title bar or sidebar allows switching context. Terminals spawn in their project's root directory by default.

**Shell integration:** Use OSC escape sequences (same approach as Warp, iTerm2, VS Code). OSC 133 for command start/end boundaries, OSC 7 for cwd reporting. Provide user-sourced helper scripts for bash, zsh, fish with guard variables to prevent double-loading.

**Settings:** Use `electron-store` 11.0.2 in main process with JSON Schema validation. Expose via IPC to a Zustand `settingsStore` in renderer. Settings panel in sidebar "Settings" view. Per-project terminal overrides merged with global defaults.

**Search:** @xterm/addon-search with a floating search bar (Cmd+F when terminal focused). Style to match the glassmorphism overlay pattern from command palette. `findNext`/`findPrevious` with regex toggle.

**Addon loading order:** Unicode11 first (activate `'11'`), then WebLinks (with Electron handler), then Search, then optional Serialize.

## Tasks

| ID | Title | Status | Complexity | Depends On |
|----|-------|--------|------------|------------|
| breadcrumb-xrv.1 | Multi-project workspace model | done | Large | - |
| breadcrumb-xrv.2 | Settings persistence & terminal preferences | done | Large | xrv.1 |
| breadcrumb-xrv.3 | Shell integration (OSC sequences) | done | Large | - |
| breadcrumb-xrv.4 | xterm addon suite & search overlay | done | Medium | - |
| breadcrumb-xrv.5 | Split pane keyboard navigation | done | Medium | - |
| breadcrumb-xrv.6 | CWD tracking & tab naming | open | Medium | xrv.1, xrv.3 |
| breadcrumb-xrv.7 | Terminal polish & command palette | open | Medium | xrv.4, xrv.5, xrv.6 |

### Task Details

**xrv.1 — Multi-project workspace model (Large)**
Foundational task. Create `projectsStore` Zustand store with `Project` entity (id, name, path, terminalSessions[], terminalOverrides). Build project switcher UI in title bar or sidebar. Wire "Add Project" flow (folder picker → create project → set active). Update `TerminalPanel` to scope panes by active project. Scaffold explorer view placeholder per project. Ensure single-project backward compatibility.

**xrv.2 — Settings persistence & terminal preferences (Large)**
Install `electron-store` 11.0.2. Create `SettingsStore.ts` in main process with JSON Schema for terminal settings (fontFamily, fontSize, scrollback, cursorStyle, cursorBlink, defaultShell). Create settings IPC bridge (get/set/reset/onChanged channels). Create `settingsStore` Zustand store in renderer that syncs via IPC. Build settings panel UI (sidebar view) with live preview. Wire terminal settings into `TerminalInstance`. Support per-project overrides merged with global defaults.

**xrv.3 — Shell integration (OSC sequences) (Large)**
Register OSC 133 handler via `terminal.parser.registerOscHandler(133, ...)` to track command boundaries (A/B/C/D). Create `CommandBlock` model tracking prompt start/end, command start/end, exit code, timestamps. Create shell helper scripts for bash/zsh/fish with guard variables. Bundle scripts in app resources. Add exit code badge overlay on command completion. Emit OSC 7 from shell scripts for cwd reporting.

**xrv.4 — xterm addon suite & search overlay (Medium)**
Install @xterm/addon-search, @xterm/addon-web-links, @xterm/addon-unicode11. Load in correct order (unicode11 → web-links → search). Build floating search bar overlay (Cmd+F toggle) with glassmorphism styling. Wire findNext/findPrevious/clearDecorations. Add regex toggle and match count display. Configure web-links to open in system browser via IPC.

**xrv.5 — Split pane keyboard navigation (Medium)**
Add keyboard shortcuts: Cmd+D (split horizontal), Cmd+Shift+D (split vertical), Cmd+W (close pane). Add Cmd+Option+Arrow for focus navigation between panes. Track focus state per pane with visual indicators. Add pane numbering and Cmd+1-9 direct pane switching. Ensure all shortcuts registered in command palette.

**xrv.6 — CWD tracking & tab naming (Medium)**
Parse OSC 7 data from shell integration to update per-terminal cwd in store. Derive tab names from cwd (show folder name, not "Terminal 1"). Update terminal tab bar to show project-relative paths. When cwd changes, update store and re-render tab title. Ensure new terminals inherit project root as initial cwd.

**xrv.7 — Terminal polish & command palette (Medium)**
Register all terminal commands in command palette (new terminal, split, search, navigate panes, clear, settings). Add Warp-level visual polish: smooth pane transitions, focus ring animation, command block subtle separators, exit code color coding (green/red). Add terminal welcome message on first launch. Final integration testing across all features.

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Multi-project model | Zustand `projectsStore` with Project entities | Central to the vision — everything is project-scoped |
| Shell integration | OSC 133 + OSC 7 + OSC 8 | Industry standard (Warp, iTerm2, VS Code all use this) |
| Shell script delivery | User-sourced helper scripts with guard vars | Non-invasive, user controls loading, easy to debug/disable |
| Terminal search | @xterm/addon-search (0.15.0) | Official xterm addon, regex support, match highlighting |
| Settings persistence | electron-store 11.0.2 (main process only) | Atomic writes, schema validation, corruption recovery |
| Settings IPC | contextBridge + dedicated channels | Follows Electron security best practices |
| Clickable links | @xterm/addon-web-links (0.12.0) | Official addon, OSC 8 + pattern detection |
| Unicode support | @xterm/addon-unicode11 (0.10.0) | Proper emoji and CJK character rendering |
| Addon loading order | unicode11 → web-links → search → serialize | Core rendering first, then features |
| Per-project overrides | Merged with `useProjectTerminalSettings()` | Global defaults + project-specific customization |
| Scrollback default | 5000 lines | Balance of usability (~34MB) and performance |

## Completion Criteria

- [ ] Multi-project workspace: can open 2+ projects, each with their own terminal group and context
- [ ] Project switcher accessible from title bar or sidebar
- [ ] Terminals spawn in project root directory, tab names reflect cwd
- [ ] Shell integration: command boundaries detected, exit codes shown, cwd tracked automatically
- [ ] Clickable URLs in terminal output
- [ ] Ctrl+F / Cmd+F search overlay with match highlighting and next/prev navigation
- [ ] Split panes with keyboard shortcuts (Cmd+D horizontal, Cmd+Shift+D vertical, Cmd+W close)
- [ ] Keyboard navigation between panes (Cmd+Option+Arrow or similar)
- [ ] Terminal settings panel with font, size, scrollback, shell, cursor style preferences
- [ ] Settings persist across app restarts
- [ ] Terminal commands available in Cmd+K command palette
- [ ] Warp-level visual polish: smooth transitions, proper focus states, command block hints
