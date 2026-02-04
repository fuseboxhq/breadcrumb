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

### 4.5. Project Instructions (CLAUDE.md & AGENTS.md)

Add Breadcrumb workflow instructions to the project's configuration files so Claude Code and agents know to use Breadcrumb for planning and Beads for task tracking.

The following block should be prepended to the **top** of each file. If the file doesn't exist, create it with just this content.

**For `.claude/CLAUDE.md`:**

Read `.claude/CLAUDE.md` if it exists. Prepend this block at the very top (before any existing content):

```markdown
# Task Tracking & Planning

**Use Breadcrumb (`/bc`) for phase-based planning and execution.**

```
/bc:status         # View all phases and progress
/bc:plan           # Plan a phase with task breakdown
/bc:execute        # Execute tasks in a phase
/bc:new-phase      # Create a new phase
/bc:integrate      # Explore codebase and create context
```

**Use Beads CLI (`bd`) for task tracking.**

```
bd ready           # List tasks with no blockers
bd list            # List all tasks
bd show <id>       # View task details
bd update <id> --status in_progress  # Mark in progress
bd close <id>      # Mark complete
```

When working on this project, use Breadcrumb for all phase-based workflows and Beads CLI for task management.

---

```

If `.claude/CLAUDE.md` already contains `/bc:` references, skip this step (already configured).

**For `AGENTS.md`:**

Read `AGENTS.md` in the project root if it exists. Prepend this block at the very top:

```markdown
# Agent Instructions

All agents working on this project should use **Breadcrumb** (`/bc:*` commands) for phase-based planning and **Beads CLI** (`bd`) for task tracking. Check `.planning/STATE.md` for current phase status before starting work.

---

```

If `AGENTS.md` already contains `Breadcrumb` or `/bc:` references, skip this step (already configured).

Create the `.claude/` directory if it doesn't exist:
```bash
mkdir -p .claude
```

### 5. Initial Commit

Check if `.beads/` or `.planning/` have uncommitted changes:
```bash
git status --porcelain .beads/ .planning/
```

**If there are untracked or modified files in those directories:**
```bash
git add .beads/ .planning/ .claude/CLAUDE.md AGENTS.md
git commit -m "Initialize Breadcrumb project with Beads task tracking"
```
Report: "Created initial commit with .beads/, .planning/, and project instructions"

**IMPORTANT:** Only stage `.beads/`, `.planning/`, `.claude/CLAUDE.md`, and `AGENTS.md` — never run `git add .` or `git add -A`, which could accidentally stage unrelated user files.

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

### 6.5. Configure Claude Code Settings

Merge Breadcrumb hooks and pre-approved permissions into `~/.claude/settings.json` without destroying existing entries (e.g., from GSD or other tools).

**Read the current settings file:**
```bash
cat ~/.claude/settings.json 2>/dev/null || echo '{}'
```

Parse the JSON. Then apply these merges:

**Hooks — merge into `hooks` object:**

Claude Code hooks use a nested format: each hook event is an array of objects with an optional `matcher` and a `hooks` array containing the commands.

For each of these, check if the `hooks` object already contains a bc-* entry (search for `bc-session-start`, `bc-session-end`, `bc-bash-guard` in the JSON). If not present, append the entry to the appropriate array:

- `hooks.SessionStart` array — append:
  ```json
  { "hooks": [{ "type": "command", "command": "node ~/.breadcrumb/hooks/bc-session-start.cjs" }] }
  ```

- `hooks.Stop` array — append:
  ```json
  { "hooks": [{ "type": "command", "command": "node ~/.breadcrumb/hooks/bc-session-end.cjs" }] }
  ```

- `hooks.PreToolUse` array — append (note `matcher` at top level, not inside hooks):
  ```json
  { "matcher": "Bash", "hooks": [{ "type": "command", "command": "node ~/.breadcrumb/hooks/bc-bash-guard.cjs" }] }
  ```

For `hooks.statusLine` (this is a direct object, NOT an array):
- If not set → set to `{ "type": "command", "command": "node ~/.breadcrumb/hooks/bc-statusline.cjs" }`
- If already set with `bc-statusline` → leave unchanged
- If set with something else → ask the user whether to replace it or keep existing

**Permissions — merge into `permissions.allow` array:**

For each permission pattern below, check if it already exists in the array. If not, append it:

```
Bash(bd:*)
Bash(grep:*)
Bash(find:*)
Bash(wc:*)
Bash(which:*)
Bash(file:*)
Bash(du:*)
Bash(stat:*)
Bash(git status:*)
Bash(git log:*)
Bash(git diff:*)
Bash(git branch:*)
Bash(git show:*)
Bash(git remote:*)
Bash(pnpm:*)
Bash(npm:*)
Bash(node:*)
Bash(npx:*)
Bash(tsc:*)
Bash(ls:*)
Bash(pwd:*)
Bash(env:*)
Bash(uname:*)
Bash(curl:*)
```

**Write the merged settings back:**

Use `JSON.stringify(settings, null, 2)` formatting. Write to `~/.claude/settings.json`.

Report what was added (e.g., "Added 4 hooks and 24 permission rules" or "Hooks already configured, added 3 new permission rules").

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
