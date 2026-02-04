---
name: init
description: Initialize Beads CLI and Breadcrumb directories for phase-based planning
allowed-tools:
  - Bash
  - Write
  - Read
---

# Initialize Breadcrumb

Set up Beads CLI, the `.planning/` directory structure, and connect to the Breadcrumb web UI.

## Steps

### 1. Check Beads CLI Installation

Run `which bd` to check if Beads CLI is installed.

If not installed, inform the user:
```
Beads CLI not found. Install with:
  curl -fsSL https://raw.githubusercontent.com/steveyegge/beads/main/scripts/install.sh | bash
```

### 2. Initialize Beads

If Beads is installed and `.beads/` doesn't exist, run:
```bash
bd init
```

### 3. Create Planning Directory Structure

```bash
mkdir -p .planning/research
```

### 4. Create STATE.md

If `.planning/STATE.md` doesn't exist, create it:

```markdown
# Project State

**Current Phase:** None
**Last Updated:** [date]

## Active Work

No phases created yet. Run `/bc:new-phase [title]` to create your first phase.

## Completed Phases

(none yet)

## Quick Commands

- Map existing codebase: `/bc:integrate`
- Create phase: `/bc:new-phase [title]`
- Plan phase: `/bc:plan PHASE-XX`
- Execute phase: `/bc:execute PHASE-XX`
- Check status: `/bc:status`
- Research task: `/bc:research <task-id>`
- Close phase: `/bc:close-phase PHASE-XX`
- Add todo: `/bc:todo "idea"`
- View todos: `/bc:todos`
```

### 5. Create .gitignore

If `.planning/.gitignore` doesn't exist:
```
# Keep research but ignore temp files
*.tmp
*.bak
```

### 6. Connect to Breadcrumb Web UI

**Find the Breadcrumb server installation:**

Check these locations in order:
1. Read `~/.breadcrumb/install-path` — this contains the path to the server directory
2. Check `~/.breadcrumb/server/` (default installed location)
3. Check if the current working directory has a `server/daemon.ts` (development clone)

Store the resolved server path as `$SERVER_DIR` for subsequent steps.

If not found, inform the user:
```
Breadcrumb web UI not installed. The planning commands will work without it.
To install the web UI, run:
  curl -fsSL https://raw.githubusercontent.com/fuseboxhq/breadcrumb/main/install.sh | bash
```

**If installed, detect and start the daemon:**

Check if the daemon is already running:
```bash
curl -s --max-time 2 http://localhost:9999/__daemon/health
```

If the health check succeeds, the daemon is running. Skip to project registration.

If the health check fails, start the daemon using the resolved server path:
```bash
cd "$SERVER_DIR" && pnpm daemon:start
```

**Register this project with the daemon:**

Get the current working directory and project name (from the directory name or package.json name).

If the daemon is running, register via HTTP:
```bash
curl -s -X POST "http://localhost:9999/api/projects" \
  -H "Content-Type: application/json" \
  -d '{"path":"[cwd]","name":"[project-name]"}'
```

Or register via the daemon CLI:
```bash
cd "$SERVER_DIR" && pnpm daemon -- register "$(pwd)" "[project-name]"
```

### 7. Report Success

```
Breadcrumb initialized!

Created:
  .beads/              - Beads task database
  .planning/           - Phase planning documents
  .planning/research/  - Task research documents
  .planning/STATE.md   - Project state tracking

Web UI: http://localhost:9999 [running/not running]
Project registered: [yes/no]

Next steps (existing codebase):
  1. Map the codebase: /bc:integrate
  2. Create your first phase: /bc:new-phase "Your First Phase"
  3. Plan and execute: /bc:plan PHASE-01 → /bc:execute PHASE-01

Next steps (new project):
  1. Create your first phase: /bc:new-phase "Setup and Configuration"
  2. Plan and execute: /bc:plan PHASE-01 → /bc:execute PHASE-01
  3. Check status: /bc:status
```
