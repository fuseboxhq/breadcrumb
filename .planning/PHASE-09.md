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

Run `/bc:plan PHASE-09` to research this phase and populate this section.

## Recommended Approach

**Architecture:** Introduce a `Project` concept in the Zustand store — each project has an id, path, name, and owns terminal sessions, explorer state, and future agent sessions. A project switcher in the title bar or sidebar allows switching context. Terminals spawn in their project's root directory by default.

**Shell integration:** Use OSC escape sequences (same approach as Warp, iTerm2, VS Code). OSC 133 for command start/end boundaries, OSC 7 for cwd reporting. Requires shell rc file snippets (`.zshrc`, `.bashrc`) or detection of existing integrations.

**Settings:** Use `electron-store` for persisted preferences. Create a settings store (Zustand) that syncs with electron-store via IPC. Settings panel in the sidebar "Settings" view.

**Search:** xterm-addon-search with a floating search bar (Cmd+F when terminal focused). Style to match the glassmorphism overlay pattern from command palette.

Run `/bc:plan PHASE-09` to break down into tasks with dependencies.

## Tasks

| ID | Title | Status | Complexity |
|----|-------|--------|------------|
| - | No tasks yet | - | - |

Run `/bc:plan PHASE-09` to break down this phase into tasks.

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Multi-project model | Zustand store with Project entities | Central to the vision — everything is project-scoped |
| Shell integration | OSC 133 + OSC 7 + OSC 8 | Industry standard (Warp, iTerm2, VS Code all use this) |
| Terminal search | xterm-addon-search | Official xterm addon, well-maintained |
| Settings persistence | electron-store | Standard for Electron apps, JSON-based, zero setup |
| Clickable links | xterm-addon-web-links | Official addon, handles URL detection |
| Unicode support | xterm-addon-unicode11 | Proper emoji and CJK character rendering |

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
