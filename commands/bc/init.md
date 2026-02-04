---
name: init
description: Initialize Beads CLI, git repository, and Breadcrumb directories for phase-based planning
allowed-tools:
  - Bash
  - Write
  - Read
  - Edit
---

# Initialize Breadcrumb

Set up git, Beads CLI, the `.planning/` directory structure, and connect to the Breadcrumb web UI. This command is idempotent — safe to re-run on already-initialized projects.

## Steps

### 1. Check Prerequisites

**Check git:**
```bash
which git
```
If not found:
```
Git is required but not found. Install git and try again.
```
Stop here.

**Check Beads CLI:**
```bash
which bd
```
If not found:
```
Beads CLI not found. Install with:
  curl -fsSL https://raw.githubusercontent.com/steveyegge/beads/main/scripts/install.sh | bash
```
Stop here.

Both must be present to proceed.

### 2. Git Repository Setup

Check if a git repository exists:
```bash
git rev-parse --git-dir 2>/dev/null
```

**If no git repository:**
```bash
git init
```
Report: "Initialized git repository"

**Check for existing commits:**
```bash
git rev-parse HEAD 2>/dev/null
```
If this fails (exit code non-zero), there are no commits yet. Remember this — we'll create an initial commit in Step 5.

### 3. Beads Setup

**If `.beads/` does NOT exist:**
```bash
bd init
```
Report: "Initialized Beads database"

**If `.beads/` already exists:**

Check for legacy database issues (idempotent — succeeds silently if already migrated):
```bash
bd migrate --update-repo-id 2>&1 || true
```

**Then, regardless of whether `.beads/` was new or existing, run these setup commands (all idempotent):**

Install git hooks:
```bash
bd hooks install
```

Configure merge driver for Beads JSONL files:
```bash
git config merge.beads.driver "bd merge %A %O %A %B"
git config merge.beads.name "Beads JSONL merge driver"
```

Sync SQLite database with JSONL (ensures they're in agreement):
```bash
bd sync 2>/dev/null || true
```

### 4. Create Planning Directory Structure

```bash
mkdir -p .planning/research
```

**If `.planning/STATE.md` doesn't exist, create it:**

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
- Diagnose issues: `/bc:doctor`
```

**If `.planning/.gitignore` doesn't exist:**
```
# Keep research but ignore temp files
*.tmp
*.bak
```

### 5. Initial Commit

Check if `.beads/` or `.planning/` have uncommitted changes:
```bash
git status --porcelain .beads/ .planning/
```

**If there are untracked or modified files in those directories:**
```bash
git add .beads/ .planning/
git commit -m "Initialize Breadcrumb project with Beads task tracking"
```
Report: "Created initial commit with .beads/ and .planning/"

**IMPORTANT:** Only stage `.beads/` and `.planning/` — never run `git add .` or `git add -A`, which could accidentally stage unrelated user files.

**If everything is already committed and clean:**
Report: "Project files already committed"

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

### 7. Health Check

Run a quick smoke test to verify Beads is working:
```bash
bd ready 2>&1
```

Check the output:
- If it contains "No git repository" or "Error" → report the warning and suggest running `bd doctor`
- If output is clean (empty list or shows tasks) → Beads is healthy

### 8. Report Success

```
Breadcrumb initialized!

Setup:
  Git repository:    [initialized / already existed]
  Beads database:    [initialized / already existed]
  Git hooks:         installed
  Merge driver:      configured
  Initial commit:    [created / skipped (already committed)]

Web UI: http://localhost:9999 [running / not running]
Project registered: [yes / no]

Next steps (existing codebase):
  1. Map the codebase: /bc:integrate
  2. Create your first phase: /bc:new-phase "Your First Phase"
  3. Plan and execute: /bc:plan PHASE-01 → /bc:execute PHASE-01

Next steps (new project):
  1. Create your first phase: /bc:new-phase "Setup and Configuration"
  2. Plan and execute: /bc:plan PHASE-01 → /bc:execute PHASE-01
  3. Check status: /bc:status

Troubleshooting:
  Run /bc:doctor to diagnose any issues.
```
