# Phase 07: Desktop IDE Platform

**Status:** in_progress
**Beads Epic:** breadcrumb-3jm
**Created:** 2026-02-11

## Objective

Evolve Breadcrumb from a CLI planning tool into a full standalone desktop IDE by merging the existing KevCode (ClaudeLens) Electron app into this project. The result is a powerful developer environment with split-pane terminals, AI agent sessions, an embedded Chromium browser, and a scaffolded extension system — all built on Breadcrumb's planning and phase management framework. Breadcrumb continues to work as a CLI extension to Claude Code, but now also ships as a standalone desktop application that's significantly more powerful.

## Research Summary

**Overall Confidence:** HIGH

Use Electron 40.x with Electron Forge 7.11+ and the Vite plugin. Port KevCode's proven architecture (main/preload/renderer, Zustand, IPC). Build terminal multiplexing with @xterm/xterm 6.0.0 + WebGL renderer + react-resizable-panels. Embed browser via WebContentsView (BrowserView is deprecated). Scaffold extensions using VS Code's Extension Host pattern (child_process isolation, package.json manifests, IPC-based API surface).

### Recommended Stack

| Library | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| electron | 40.x | Desktop app framework (Chromium 144, Node 24.11) | HIGH |
| @electron-forge/cli | 7.11.1 | Build, package, publish | HIGH |
| @electron-forge/plugin-vite | 7.11.1 | Vite integration for Electron | HIGH |
| @electron-forge/plugin-auto-unpack-natives | 7.11.1 | Handle node-pty native modules | HIGH |
| @xterm/xterm | 6.0.0 | Terminal emulation UI | HIGH |
| @xterm/addon-webgl | latest | GPU-accelerated rendering (900% faster) | HIGH |
| @xterm/addon-fit | latest | Terminal resize handling | HIGH |
| node-pty | 1.1.0 | Pseudoterminal sessions | HIGH |
| react-resizable-panels | latest | Split pane layout (2M+ weekly downloads) | HIGH |
| zustand | 5.x | State management (from KevCode) | HIGH |
| react | 18.x | UI framework | HIGH |
| tailwindcss | 4.x | CSS framework | HIGH |
| chokidar | 5.x | File watching for hot reload (extensions) | HIGH |
| ajv | 8.x | Extension manifest validation | HIGH |

### Key Patterns

**Terminal multiplexing:** node-pty in main process, xterm.js in renderer, IPC bridge between them. Split panes via react-resizable-panels with nested PanelGroup for horizontal/vertical splits. Use `proposeDimensions()` (not `fit()`) for resize in split panes. tmux-like keybindings via Electron's `before-input-event` with Ctrl+B prefix pattern.

**Browser embedding:** WebContentsView (introduced Electron 30, replaces deprecated BrowserView). Use BaseWindow as container. Tab switching via remove/re-add child views for z-order. NavigationHistory API for back/forward/reload. Must manually close webContents on window close to prevent memory leaks.

**Extension system:** Extensions run in a separate child_process (Extension Host) for crash isolation. Manifest in package.json with `engines.breadcrumb`, `contributes`, `activationEvents`. Capability-based permissions (fileSystem, network, terminal). Discovery from `~/.breadcrumb/extensions/`. Hot reload via chokidar for development.

### Design Guidance

The `frontend-design` skill will be active during execution of UI tasks in this phase. It provides guidelines for typography, color, motion, spatial composition, and avoiding generic aesthetics.

### Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| PTY process spawning | node-pty | Platform differences, signal handling, process cleanup |
| Terminal rendering | @xterm/xterm + WebGL addon | ANSI parsing, cursor positioning, Unicode, accessibility |
| Split pane resizing | react-resizable-panels | Keyboard nav, min/max constraints, persistence |
| Browser history stack | NavigationHistory API | Redirects, in-page navigation, session restore |
| Extension sandboxing | Electron child_process | OS-level isolation; vm2 deprecated with CVEs |
| Native module handling | auto-unpack-natives plugin | ASAR unpack glob patterns miss edge cases |
| Manifest validation | ajv (JSON Schema) | Industry standard, comprehensive |

### Pitfalls

- **node-pty MUST be external in Vite**: If bundled, runtime "Cannot find module" errors. Add to `rollupOptions.external`
- **Memory leaks with BaseWindow**: WebContentsView's webContents not auto-destroyed. Must manually close on window close
- **FitAddon width issues in split panes**: Use `proposeDimensions()` + manual `terminal.resize()`, not `fit()` directly
- **Multiple terminals degrade FPS**: 4 terminals → 15fps without WebGL. Always use @xterm/addon-webgl
- **WebContentsView defaults to white bg**: Call `view.setBackgroundColor('#00000000')` for transparency
- **Monorepo workspace hoisting**: Electron Forge has known issues. Declare ALL deps in desktop/package.json
- **Extension Host crashes**: All extensions die. Implement automatic restart with exponential backoff
- **IPC sender validation**: Always validate `event.senderFrame` to prevent unauthorized access

## Scope

**In scope:**
- Merge KevCode's Electron + React + Vite codebase into Breadcrumb's repo structure
- Core IDE layout: sidebar navigation, tabbed workspaces, resizable split panels
- Terminal multiplexing: tmux-style split panes built on xterm.js + node-pty
- AI agent chat: Claude Code sessions with streaming, tool tracking, model selection (from KevCode)
- Breadcrumb planning panel: phase management, task tracking, status views
- Embedded Chromium browser: dev server preview AND general browsing with multi-tab support
- Extension system scaffold: plugin architecture with defined API surface and sample extension
- Project management: recent projects, git integration, working directory context
- Memory/Plans/Skills/MCP panels carried forward from KevCode

**Out of scope:**
- Actual tmux process embedding (we build tmux-like UX natively)
- Full extension marketplace / registry (just the architecture + sample)
- Mobile or web deployment
- Replacing the CLI — Breadcrumb CLI continues working independently
- Code editor / Monaco integration (potential future phase)
- Collaborative / multi-user features

## Constraints

- **Dual-mode architecture**: Breadcrumb CLI continues working independently; desktop app is additive
- **Electron stack**: Electron 40.x + React + TypeScript + Vite (node-pty needs Node.js, Chromium is native)
- **Frontend design skill active**: Follow design thinking process for all UI tasks
- **KevCode as foundation**: Port and refactor, don't rewrite from scratch
- **Monorepo structure**: Desktop app in `desktop/` alongside existing CLI/server code
- **Security**: contextIsolation=true, sandbox=true, nodeIntegration=false, production fuses enabled

## Tasks

| ID | Title | Status | Complexity | Dependencies |
|----|-------|--------|------------|--------------|
| breadcrumb-3jm.1 | Scaffold desktop/ directory with Electron Forge + Vite | done | High | - |
| breadcrumb-3jm.2 | Port KevCode core services to desktop/ | done | High | .1 |
| breadcrumb-3jm.3 | Build IDE shell layout with resizable panels | done | High | .1 |
| breadcrumb-3jm.4 | Implement terminal multiplexing with split panes | done | High | .2 |
| breadcrumb-3jm.5 | Integrate Breadcrumb planning panel into IDE | done | Medium | .2 |
| breadcrumb-3jm.6 | Build embedded Chromium browser with multi-tab support | done | High | .1 |
| breadcrumb-3jm.7 | Scaffold extension system with sample DB browser extension | open | High | .3 |

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Electron version | 40.x (Chromium 144, Node 24.11) | Latest stable, 3 major versions supported |
| Build system | Electron Forge 7.11 + Vite plugin | KevCode uses this stack, proven. Pin versions (Vite support still experimental) |
| Terminal rendering | @xterm/xterm 6.0.0 + WebGL addon | v6 has GPU texture atlas improvements, IdleTaskQueue. WebGL = 900% faster |
| Split panes | react-resizable-panels | 2M+ weekly downloads, keyboard nav, persistence, min/max constraints |
| Browser embedding | WebContentsView (not BrowserView) | BrowserView deprecated since Electron 30. WebContentsView is the replacement |
| Navigation | NavigationHistory API | Legacy canGoBack/goBack deprecated. New API supports restore(), getAllEntries() |
| Extension isolation | child_process (Extension Host) | VS Code pattern. vm2 deprecated with CVEs. Process isolation is OS-level |
| Extension manifest | package.json with contributes | VS Code-compatible, leverages npm ecosystem, familiar to developers |
| State management | Zustand 5.x | Proven in KevCode, lightweight, good selector patterns |
| CSS framework | Tailwind | Used in both Breadcrumb dashboard and KevCode |
| Repo structure | Monorepo: desktop/ + existing code | CLI/server/dashboard coexist, shared .planning/ and .beads/ |

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

## Sources

**HIGH confidence:**
- [Electron Releases](https://www.electronjs.org/docs/latest/tutorial/electron-timelines)
- [WebContentsView API](https://www.electronjs.org/docs/latest/api/web-contents-view)
- [Migrating from BrowserView to WebContentsView](https://www.electronjs.org/blog/migrate-to-webcontentsview)
- [NavigationHistory API](https://www.electronjs.org/docs/latest/api/navigation-history)
- [Electron Security](https://www.electronjs.org/docs/latest/tutorial/security)
- [Electron Forge Vite Plugin](https://www.electronforge.io/config/plugins/vite)
- [Auto Unpack Native Modules Plugin](https://www.electronforge.io/config/plugins/auto-unpack-natives)
- [@xterm/xterm 6.0.0](https://www.npmjs.com/package/@xterm/xterm)
- [xterm.js Terminal API](https://xtermjs.org/docs/api/terminal/classes/terminal/)
- [node-pty GitHub](https://github.com/microsoft/node-pty)
- [react-resizable-panels GitHub](https://github.com/bvaughn/react-resizable-panels)
- [VS Code Extension Host](https://code.visualstudio.com/api/advanced-topics/extension-host)
- [VS Code Contribution Points](https://code.visualstudio.com/api/references/contribution-points)

**MEDIUM confidence:**
- [VSCode Working with xterm.js](https://github.com/microsoft/vscode/wiki/Working-with-xterm.js/)
- [electron-example-browserview](https://github.com/mamezou-tech/electron-example-browserview)
- [Tabby Split Tab System](https://deepwiki.com/Eugeny/tabby/5.2-split-tab-system)
- [Electron Forge Monorepo Issues](https://github.com/electron/forge/issues/2649)
