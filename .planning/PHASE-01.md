# Phase 01: Merge claude-planz and plan-visualizer into unified Breadcrumb project

**Status:** complete
**Beads Epic:** breadcrumb-btr
**Created:** 2026-02-04

## Objective

Merge the claude-planz planning framework and plan-visualizer web UI into a single unified project called Breadcrumb. Breadcrumb will provide a phase-based planning workflow (via `/bc:*` commands, Beads CLI integration, and research agents) with a persistent local web UI that visualizes phases, tasks, and research across multiple projects.

## Research Summary

**Overall Confidence:** HIGH

The plan-visualizer's stack (React 18, Vite 6, Express, Tailwind, TanStack Query) is proven and reusable. The main new work is: replacing the data source (`.planning/` + Beads SQLite instead of `~/.claude/plans/`), adding multi-project support via a file-based registry, and implementing a daemon lifecycle for the web UI server.

### Recommended Stack

| Library | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| React | 18.3 | Frontend UI framework | HIGH |
| Vite | 6.x | Build tooling + dev server | HIGH |
| Express | 4.21 | Backend API + static serving | HIGH |
| Tailwind CSS | 3.4 | Utility-first styling | HIGH |
| TanStack Query | 5.x | Server state management + caching | HIGH |
| better-sqlite3 | 12.x | Synchronous SQLite reads from Beads DB | HIGH |
| chokidar | 5.x | File system watching for real-time updates | HIGH |
| react-markdown + remark-gfm | 9.x / 4.x | Markdown rendering for phase/research docs | HIGH |
| react-syntax-highlighter | 15.x | Code block syntax highlighting | HIGH |

### Key Patterns

- **Daemon lifecycle**: `child_process.spawn()` with `detached: true` + PID file at `~/.breadcrumb/daemon.pid`. Zero external deps for process management — use Node.js built-ins (`child_process`, `net`, `fs`).
- **Multi-project registry**: `~/.breadcrumb/projects.json` — each project writes its entry on `/bc:init`. UI reads the registry and scopes all data access per-project.
- **Beads data access**: Open `.beads/beads.db` read-only via `better-sqlite3`. Use the `issues`, `dependencies`, `labels` tables. Leverage the `ready_issues` and `blocked_issues` views built into the schema.
- **SSE for real-time updates**: Port from plan-visualizer — chokidar watches `.planning/` and `.beads/` dirs, broadcasts change events via SSE to connected clients.
- **Port detection**: Use `net.Socket.connect()` to check if daemon is already listening on port 9999. Dual-check pattern: PID file + port probe.

### Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| SQLite access | better-sqlite3 | Synchronous API, fastest Node.js SQLite, handles WAL mode |
| File watching | chokidar | Cross-platform, handles edge cases (symlinks, rename events) |
| Markdown rendering | react-markdown + remark-gfm | Handles GFM tables, task lists, code blocks |
| Process daemonization | Node.js child_process.spawn | daemonize-process is a thin wrapper, pm2 is overkill |
| Port checking | Node.js net.Socket | detect-port/tcp-port-used are unnecessary for specific port checks |

### Pitfalls

- **`fork()` vs `spawn()` for daemonization**: Do NOT use `child_process.fork()` — it creates an IPC channel that prevents the parent from exiting. Use `spawn()` with `process.execPath`.
- **Stale PID files**: Always verify PID is alive using `process.kill(pid, 0)`. Handle `EPERM` as "process is running".
- **Beads DB locking**: Open with `{ readonly: true }` to avoid WAL lock contention with the `bd` CLI.
- **JSONL is Beads' source of truth**: The SQLite DB is imported from `.beads/issues.jsonl`. Watch for the DB being regenerated — may need to re-open connection.
- **`stdio: 'inherit'` with `detached: true`**: Don't combine these — the child stays attached to the parent's terminal. Redirect to log files instead.

## Tasks

| ID | Title | Status | Complexity | Dependencies |
|----|-------|--------|------------|--------------|
| breadcrumb-btr.1 | Scaffold Breadcrumb project with combined tech stack | open | Medium | - |
| breadcrumb-btr.2 | Build Beads data service using better-sqlite3 | open | Medium | btr.1 |
| breadcrumb-btr.3 | Build planning file service to read .planning/ directory | open | Medium | btr.1 |
| breadcrumb-btr.4 | Implement multi-project registry and project switching | open | Medium | btr.2, btr.3 |
| breadcrumb-btr.5 | Implement daemon lifecycle (start, stop, detect, health) | open | Medium | btr.1 |
| breadcrumb-btr.6 | Build the frontend UI with project-scoped phase/task views | open | High | btr.2, btr.3, btr.4 |
| breadcrumb-btr.7 | Integrate claude-planz commands, agents, and skills | open | Medium | btr.1 |

### Dependency Graph

```
btr.1 (Scaffold)
├── btr.2 (Beads service)  ──┐
├── btr.3 (Planning service) ├── btr.4 (Multi-project) ── btr.6 (Frontend UI)
├── btr.5 (Daemon lifecycle) │
└── btr.7 (claude-planz)     ┘
```

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Web UI lifecycle | Long-running daemon | Persists across terminal sessions; subsequent projects detect and register with running instance |
| Multi-project registration | File-based registry (~/.breadcrumb/projects.json) | Simple, works when server is down, no HTTP dependency for registration |
| Tech stack | Keep plan-visualizer's stack (React 18, Vite 6, Express, Tailwind, TanStack Query) | Proven working, maximum code reuse, minimal rewriting |
| Beads data access | Direct SQLite read via better-sqlite3 | Fast synchronous reads, no process spawning overhead, typed schema access |
| Docker | Removed | Local dev tool doesn't need containerization; daemon process is simpler |
| Daemon port | 9999 (same as plan-visualizer) | Consistent with existing convention |
| Daemon management | Zero-dependency (Node.js built-ins) | PID files + spawn + net.Socket — no npm packages needed |

## Completion Criteria

- [ ] Breadcrumb project scaffolded with React 18 + Vite 6 + Express + Tailwind + TanStack Query + better-sqlite3
- [ ] Beads data service reads issues, dependencies, labels from .beads/beads.db read-only
- [ ] Planning file service reads and parses .planning/STATE.md, PHASE-*.md, research/*.md
- [ ] File watcher + SSE broadcasts changes in real-time
- [ ] Multi-project registry at ~/.breadcrumb/projects.json with project switching in UI
- [ ] Daemon starts detached on port 9999, PID managed, health/shutdown endpoints work
- [ ] Frontend shows phases, tasks, research per project with status badges and markdown rendering
- [ ] claude-planz /bc:* commands, cp-researcher agent, and skill integrated
- [ ] /bc:init registers project with daemon and starts daemon if not running
- [ ] No Docker dependency

## Sources

**HIGH confidence:**
- Beads DB schema: inspected directly from .beads/beads.db (bd v0.49.3)
- better-sqlite3 docs: Context7 /wiselibs/better-sqlite3 (v12.4.1)
- plan-visualizer codebase: inspected directly from ~/Repositories/plan-visualiser
- claude-planz codebase: inspected directly from ~/Repositories/claude-planz
- Node.js child_process docs: nodejs.org/api/child_process.html
- Node.js net module docs: nodejs.org/api/net.html

**MEDIUM confidence:**
- Express graceful shutdown: expressjs.com/en/advanced/healthcheck-graceful-shutdown.html
