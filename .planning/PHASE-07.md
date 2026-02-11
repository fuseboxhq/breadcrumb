# Phase 07: Desktop IDE Platform

**Status:** not_started
**Beads Epic:** breadcrumb-3jm
**Created:** 2026-02-11

## Objective

Evolve Breadcrumb from a CLI planning tool into a full standalone desktop IDE by merging the existing KevCode (ClaudeLens) Electron app into this project. The result is a powerful developer environment with split-pane terminals, AI agent sessions, an embedded Chromium browser, and a scaffolded extension system — all built on Breadcrumb's planning and phase management framework. Breadcrumb continues to work as a CLI extension to Claude Code, but now also ships as a standalone desktop application that's significantly more powerful.

## Scope

**In scope:**
- Merge KevCode's Electron + React + Vite codebase into Breadcrumb's repo structure
- Core IDE layout: sidebar navigation, tabbed workspaces, resizable split panels
- Terminal multiplexing: tmux-style split panes built on xterm.js + node-pty (pane splits, tabs, resize, keyboard shortcuts)
- AI agent chat: Claude Code sessions with streaming, tool tracking, model selection (carried from KevCode)
- Breadcrumb planning panel: phase management, task tracking, status views integrated into the IDE
- Embedded Chromium browser: dev server preview AND general browsing with multi-tab support (via Electron BrowserView/WebContentsView)
- Extension system scaffold: plugin architecture with defined API surface, lifecycle hooks, and one sample extension (e.g., database browser)
- Project management: recent projects, git integration, working directory context
- Memory/Plans/Skills/MCP panels carried forward from KevCode

**Out of scope:**
- Actual tmux process embedding (we build tmux-like UX natively instead)
- Full extension marketplace / registry (just the architecture + sample)
- Mobile or web deployment
- Replacing the CLI — Breadcrumb CLI continues working independently
- Code editor / Monaco integration (potential future phase)
- Collaborative / multi-user features

## Constraints

- **Dual-mode architecture**: Breadcrumb must remain usable as a Claude Code CLI extension. Desktop app is additive, not a replacement
- **Electron stack**: Keep Electron + React + TypeScript + Vite (node-pty requires Node.js, Chromium embedding is native to Electron, KevCode proves the stack works — Tauri would require full native rewrite and loses node-pty)
- **Frontend design skill active**: Follow design thinking process for all UI tasks — distinctive, production-grade interfaces
- **KevCode as foundation**: Port and refactor, don't rewrite from scratch. KevCode's architecture (main/preload/renderer, Zustand store, IPC handlers) is solid and should be preserved
- **Monorepo structure**: Desktop app code lives alongside CLI code in a clear directory structure (e.g., `desktop/` or `app/`)

## Research Summary

Run `/bc:plan PHASE-07` to research this phase and populate this section.

## Recommended Approach

### Architecture

```
breadcrumb/
├── cli/                    # Existing Breadcrumb CLI (unchanged)
├── dashboard/              # Existing web dashboard
├── desktop/                # NEW: Electron desktop IDE
│   ├── src/
│   │   ├── main/           # Electron main process
│   │   │   ├── agents/     # Claude session management (from KevCode)
│   │   │   ├── terminal/   # PTY + terminal multiplexing
│   │   │   ├── browser/    # Embedded browser management
│   │   │   ├── extensions/ # Extension host + loader
│   │   │   ├── planning/   # Breadcrumb planning integration
│   │   │   ├── ipc/        # IPC handlers
│   │   │   └── ...
│   │   ├── renderer/       # React UI
│   │   │   ├── components/
│   │   │   ├── layouts/    # IDE shell, panels, splits
│   │   │   ├── store/      # Zustand state
│   │   │   └── ...
│   │   ├── preload/        # Secure IPC bridge
│   │   └── shared/         # Shared types
│   ├── package.json
│   ├── forge.config.ts
│   └── vite.*.config.ts
├── .planning/              # Phase management (used by both CLI and desktop)
└── .beads/                 # Task tracking
```

### Terminal Strategy (Recommended: tmux-like UI on xterm.js)

Build split-pane terminal management natively in React rather than embedding actual tmux:
- **Pros**: Full control over UX, no tmux dependency, deep integration with IDE features (e.g., right-click context menus, drag-to-split, linking terminals to agent sessions), consistent cross-platform behavior
- **Implementation**: React split-pane layout → each pane hosts an xterm.js instance → node-pty manages PTY sessions → keyboard shortcuts mirror tmux conventions (Ctrl+B prefix or customizable)
- **Features**: Horizontal/vertical splits, tab groups, terminal rename, broadcast input to all panes, session persistence

### Browser Strategy

Use Electron's WebContentsView (successor to BrowserView) for embedded Chromium:
- Multi-tab browser panel within the IDE
- Navigation bar with URL input, back/forward/refresh
- DevTools toggle per tab
- Auto-detect localhost dev servers from terminal output
- Bookmark dev URLs per project

### Extension System Strategy

Plugin architecture inspired by VS Code's model but simpler:
- Extensions are npm packages or local directories with a manifest (`extension.json`)
- Defined API surface: `breadcrumb.terminal`, `breadcrumb.panels`, `breadcrumb.commands`, `breadcrumb.storage`
- Lifecycle: activate/deactivate hooks
- UI contribution points: sidebar panels, status bar items, context menu entries
- Sample extension: SQLite/Postgres database browser panel

## Tasks

| ID | Title | Status | Complexity |
|----|-------|--------|------------|
| - | No tasks yet | - | - |

Run `/bc:plan PHASE-07` to break down this phase into tasks.

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Framework | Electron + React + Vite | node-pty requires Node.js, Chromium is native, KevCode proves the stack. Tauri would require full rewrite |
| Terminal approach | xterm.js + node-pty with React split-pane UI | Full UX control, no tmux dependency, cross-platform, deep IDE integration |
| Browser embedding | Electron WebContentsView | Modern successor to BrowserView, native Chromium, multi-tab capable |
| State management | Zustand (from KevCode) | Lightweight, proven in KevCode, good selector patterns for performance |
| Repo structure | Monorepo with `desktop/` directory | CLI and desktop coexist, shared planning files, independent build/publish |
| Extension system | Manifest-based plugins with defined API | Simple but extensible, familiar to VS Code users, allows community growth |
| CSS framework | Tailwind (from KevCode) | Already proven in both Breadcrumb dashboard and KevCode |

## Completion Criteria

- [ ] Electron app launches from `desktop/` with full IDE layout (sidebar, tabbed workspace, resizable panels)
- [ ] Terminal multiplexing works: horizontal/vertical splits, multiple tabs, resize, keyboard shortcuts
- [ ] AI agent chat sessions functional with streaming output and tool tracking
- [ ] Breadcrumb planning panel shows phases, tasks, and status (reads from `.planning/` and `.beads/`)
- [ ] Embedded browser opens URLs in IDE tabs with navigation controls
- [ ] Extension system scaffold in place with manifest loading, lifecycle hooks, and API surface defined
- [ ] One sample extension working (e.g., database browser panel)
- [ ] Breadcrumb CLI continues to work independently (no regressions)
- [ ] Project selection and git integration carried forward from KevCode

## KevCode Migration Notes

**Carry forward as-is (refactor into new structure):**
- AgentManager / AgentSession (agent sessions)
- TerminalService (extend with split-pane support)
- MemoryService, PlansService, SkillsLoader, MCPConfigStore
- CredentialStore (auth flow)
- GitService
- Zustand store patterns
- Preload/IPC architecture

**Extend significantly:**
- Terminal UI → add split-pane multiplexing, tmux-like shortcuts
- Layout → full IDE shell with flexible panel arrangement
- Sidebar → add Breadcrumb-specific navigation (phases, tasks, todos)

**Build new:**
- Browser panel (WebContentsView management)
- Extension host + loader + API surface
- Breadcrumb planning integration (read .planning/, .beads/, show in UI)
- IDE-specific keybinding system
