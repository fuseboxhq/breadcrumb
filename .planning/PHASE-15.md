# Phase 15: Desktop IDE Comprehensive Review

**Status:** complete
**Beads Epic:** breadcrumb-3s6
**Created:** 2026-02-14

## Objective

Conduct a systematic audit of the Electron desktop IDE across user flow, missing features, visual polish, and code quality. The goal is to produce a prioritized, actionable list of issues and improvements — not to fix them in this phase, but to feed a follow-up implementation phase with a clear backlog. The review benchmarks against Cursor/Windsurf-style AI-first IDEs: streamlined, browser preview, terminal, minimal chrome.

## Scope

**In scope:**
- Full walkthrough of the desktop IDE from first launch to daily use
- User flow & UX: navigation patterns, discoverability, panel interactions, keyboard-driven workflows
- Missing features gap analysis vs a Cursor/Windsurf-like AI-first IDE
- Visual polish: consistency, spacing, typography, dark theme, animations, responsiveness
- Code quality: architecture, error handling, state management, performance, tech debt
- Integration points: how Breadcrumb/Beads planning tools surface in the IDE

**Out of scope:**
- Breadcrumb CLI internals and web dashboard (unless directly surfaced in IDE)
- Fixing issues (this phase produces the audit; fixes go to a follow-up phase)
- Extension system internals (review only the user-facing surface)

## Constraints

- Frontend design skill active — follow design thinking process for UI review tasks
- Review should be structured by area (UX flow, features, visual, code) with severity ratings
- Each finding should be specific and actionable (not vague "improve X")
- Benchmark against Cursor/Windsurf for feature gap analysis

## Research Summary

**Overall Confidence:** HIGH

The desktop IDE is a custom Electron app (not a VS Code fork) with 19 major React components, 4 Zustand stores, 80+ IPC channels, and a Dracula-based dark theme. It has working terminals (PTY with process detection, split panes, shell integration), an embedded browser (WebContentsView), and a planning dashboard (Breadcrumb phases + Beads tasks). The benchmark targets are Cursor and Windsurf — both VS Code forks with deep AI integration, full file explorer, multi-tab editors, and agent modes.

### Current Desktop IDE Inventory

| Area | Components | Status |
|------|-----------|--------|
| Layout shell | AppShell, ActivityBar, SidebarPanel, StatusBar, TitleBar | Complete |
| Terminals | TerminalPanel, TerminalInstance, TerminalSearch | 90% — PTY, splits, OSC shell integration |
| Browser | BrowserPanel, DevToolsDock, BrowserViewManager | 85% — WebContentsView, nav chrome, error pages |
| Planning | PlanningPanel (919 lines) | 70% — read-only view of phases + Beads tasks |
| Command palette | CommandPalette (365 lines, ~16 commands) | Working but thin |
| Settings | Terminal settings only | Missing theme, keybinding, general settings |
| Extensions | ExtensionsPanel | 10% — discovery only, minimal integration |
| File explorer | ExplorerView (project list only) | 0% — no file tree |

### Cursor/Windsurf Feature Benchmark

**Must-Have (Table Stakes for AI-First IDE):**
- File explorer with tree view
- Multi-tab editor with split panes
- Full-text search and regex (across files)
- Git source control panel (staging, commits, diffs)
- Command palette with 100+ commands
- Theme and keybinding customization
- Extension/plugin system
- Go-to-definition, go-to-symbol navigation

**AI-First Essentials:**
- Chat/assistant side panel (Cmd+L / Cascade)
- Inline code completions (Tab)
- Inline edit (Cmd+K highlight-and-prompt)
- Multi-file agent mode (Composer / Cascade)
- Codebase indexing and context awareness
- Terminal command execution by AI agent
- Model selection / switching
- Project-level AI rules (.cursorrules / .windsurfrules)

**Advanced / Differentiating:**
- Built-in browser with live preview + DevTools
- Background/parallel agents
- Agent lifecycle hooks
- MCP (Model Context Protocol) support
- Persistent AI memory across sessions
- Automatic context discovery
- Plan mode with step visualization

### Key Findings from Codebase Exploration

1. **~40 IPC channels defined but unwired** — agent, auth, MCP, scratchpad, memory channels exist in types but have no handlers or UI
2. **File explorer is a stub** — Only project list, no file tree
3. **Light theme never implemented** despite `setTheme()` in appStore
4. **Planning integration is read-only** — Can view phases/tasks but can't create, update, or close
5. **Tab types "browser" and "breadcrumb" defined but never rendered** in WorkspaceContent
6. **SidebarPanel is 780 lines** — largest component, doing too much
7. **Browser bounds race condition** has a 50ms setTimeout workaround + React Strict Mode fix (fragile)
8. **Terminal process polling at 200ms** — could be event-driven
9. **No cache invalidation** in planning store — stale data risk

### Design Guidance

The `frontend-design` skill will be active during execution of UI tasks in this phase. It provides guidelines for typography, color, motion, spatial composition, and avoiding generic aesthetics.

## Tasks

| ID | Title | Status | Complexity | Dependencies |
|----|-------|--------|------------|--------------|
| breadcrumb-3s6.1 | UX flow audit — walk through every user journey and document friction | done | Medium | - |
| breadcrumb-3s6.2 | Feature gap analysis vs Cursor/Windsurf baseline | done | Medium | - |
| breadcrumb-3s6.3 | Visual polish sweep — consistency, states, transitions, spacing | done | Medium | - |
| breadcrumb-3s6.4 | Code quality & architecture review | done | High | - |
| breadcrumb-3s6.5 | Integration & dead code review — Breadcrumb/Beads + stranded IPC channels | done | Medium | - |
| breadcrumb-3s6.6 | Consolidated findings report — prioritized actionable backlog | done | High | 3s6.1-5 |

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Phase type | Audit only, no code changes | Findings feed a follow-up implementation phase |
| Benchmark targets | Cursor + Windsurf | Both are AI-first IDE market leaders, closest to intended product |
| Finding format | Severity (critical/high/medium/low) + effort (S/M/L) | Enables prioritized backlog creation |
| Output location | .planning/research/phase-15-findings.md | Central document for all findings |

## Completion Criteria

- [x] Complete user flow walkthrough documented with all friction points
- [x] Feature gap analysis vs Cursor/Windsurf baseline complete
- [x] Visual polish issues cataloged with descriptions
- [x] Code quality review covering architecture, state, error handling, performance
- [x] Integration points between IDE and Breadcrumb/Beads reviewed
- [x] All findings consolidated into a prioritized, actionable backlog

## Sources

**HIGH confidence:**
- Codebase exploration of all 49 source files in desktop/src/
- Cursor AI Review 2026 — prismic.io, nxcode.io, techjacksolutions.com
- Windsurf Review 2026 — vibecoding.app, secondtalent.com
- Cursor vs Windsurf comparison — windsurf.com, datacamp.com, codecademy.com
- Cursor Changelog 2026 — promptlayer.com
- Cursor Hooks — infoq.com
- Windsurf Cascade Memories — docs.windsurf.com
- Cursor/Windsurf keyboard shortcuts — design.dev, dotcursorrules.com, smithery.ai
