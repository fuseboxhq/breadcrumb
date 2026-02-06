---
name: init
description: Initialize Beads CLI, git repository, and Breadcrumb directories for phase-based planning
allowed-tools:
  - Bash
  - Write
  - Read
  - Edit
  - Glob
  - AskUserQuestion
  - Skill
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

### 3.5. Quick Tasks Epic

Create a persistent "Quick Tasks" epic for tracking ad-hoc work outside of phases. This is idempotent — safe to re-run.

**Check if Quick Tasks epic already exists:**
```bash
bd list --label quick-tasks-epic --limit 1 2>/dev/null
```

**If no results (epic doesn't exist):**
```bash
bd create "Quick Tasks" --type epic --labels quick-tasks-epic
```

Capture the epic ID from output (format: `Created issue: <id>`). Then activate it so child tasks are unblocked:
```bash
bd update <epic-id> --status in_progress
```

Report: "Created Quick Tasks epic"

**If epic already exists:**
Report: "Quick Tasks epic already exists"

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

### 5.5. Project Discovery

After the technical setup, understand what this project is about and write a project brief.

**Detect project maturity:**

Use Glob to check for source files:
```
**/*.{ts,tsx,js,jsx,py,go,rs,java,rb,cs,cpp,c,swift,kt}
```

Count results:
- **0 source files** → Brand new project (full discovery)
- **1-10 source files** → Early project (light discovery — ask if they want to describe the project)
- **11+ source files** → Existing codebase (skip discovery — suggest `/bc:integrate` instead)

Also check: if `.planning/PROJECT.md` already exists, skip this step entirely.

---

**For brand new or early projects:**

**Step 1 — Open-ended description:**

Use AskUserQuestion with a free-form prompt:

```
question: "In your own words, describe what this project is. What are you building and why?"
options:
  - label: "Let me describe it"
    description: "I'll type out what this project is about"
  - label: "Skip for now"
    description: "I'll set up the project context later"
```

If "Skip for now", skip to step 6. Write a minimal `.planning/PROJECT.md`:
```markdown
# Project Brief

*Run `/bc:init` again or edit this file to add project context.*
```

If "Let me describe it", the user will type their description via the "Other" option. Capture this as the **raw description**.

**Step 2 — Parse and ask targeted follow-ups:**

From the raw description, extract what you can about:
- What it does
- Who it's for
- Tech preferences mentioned
- Scale/ambition

Then ask 2-3 follow-up questions based on what's MISSING from their description. Adapt — don't ask about things they already covered.

**Possible follow-ups (pick what's relevant):**

```
question: "What's the tech stack?"
options:
  - label: "React + TypeScript"
    description: "React frontend with TypeScript"
  - label: "Next.js"
    description: "Full-stack with Next.js"
  - label: "Python"
    description: "Python-based (Flask, Django, FastAPI, etc.)"
  - label: "Not decided yet"
    description: "Help me choose during planning"
```

```
question: "What's the scope of v1?"
options:
  - label: "MVP"
    description: "Minimal viable product — core features only"
  - label: "Full product"
    description: "Complete implementation with polish"
  - label: "Prototype"
    description: "Proof of concept to validate the idea"
```

```
question: "Who's the audience?"
options:
  - label: "Developers"
    description: "Technical users, CLI tools, APIs"
  - label: "End users"
    description: "Non-technical consumers"
  - label: "Internal team"
    description: "Internal tooling or dashboards"
  - label: "Just me"
    description: "Personal project or learning"
```

**Adaptive rules:**
- If they mentioned "React app" → skip tech stack question
- If they mentioned "for my team" → skip audience question
- If they gave a detailed description → only ask 1 follow-up
- If they gave a brief description → ask 2-3 follow-ups
- Maximum 3 follow-up questions total

**Step 3 — Write `.planning/PROJECT.md`:**

Synthesize everything into a project brief:

```markdown
# Project Brief

## What
[1-2 sentences: what this project is and what problem it solves]

## Why
[1-2 sentences: motivation, who it's for, what need it fills]

## Tech Stack
[Known or intended technologies. "TBD" is fine for undecided areas]
- **Language:** [e.g., TypeScript]
- **Framework:** [e.g., React, Next.js, Express]
- **Styling:** [e.g., Tailwind CSS, CSS Modules]
- **Database:** [e.g., PostgreSQL, SQLite, none yet]
- **Other:** [any mentioned tools, APIs, services]

## Scope
[MVP / Full product / Prototype — with brief clarification]

## Audience
[Who uses this and in what context]

## Initial Thoughts
[Any architecture ideas, constraints, or decisions mentioned in discovery.
This section gets refined as phases are planned.]

---
*Generated during `/bc:init`. Update as the project evolves.*
```

**Step 4 — Stage PROJECT.md:**

```bash
git add .planning/PROJECT.md
git commit -m "Add project brief"
```

---

**For existing codebases (11+ source files):**

Skip discovery. After reporting success in step 8, mention:
```
This looks like an existing codebase. Run /bc:integrate to map the codebase,
or /bc:init again to add a project description.
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

**Status line — merge at top level (NOT inside `hooks`):**

`statusLine` is a **top-level key** in settings.json, separate from the `hooks` object:
- If `statusLine` not set → set to `{ "type": "command", "command": "node ~/.breadcrumb/hooks/bc-statusline.cjs" }`
- If already set with `bc-statusline` → leave unchanged
- If set with something else → ask the user whether to replace it or keep existing

**Permissions — merge into `permissions.allow` array:**

For each permission pattern below, check if it already exists in the array. If not, append it:

```
Bash(bd:*)
Bash(grep:*)
Bash(pgrep:*)
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
Bash(cat:*)
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
  Quick Tasks epic:  [created / already existed]
  Git hooks:         installed
  Merge driver:      configured
  Project brief:     [created / skipped]
  Initial commit:    [created / skipped (already committed)]

Web UI: http://localhost:9999 [running / not running]
Project registered: [yes / no]

Next steps (existing codebase):
  1. Map the codebase: /bc:integrate
  2. Create your first phase: /bc:new-phase "Your First Phase"
  3. Plan and execute: /bc:plan PHASE-01 → /bc:execute PHASE-01

Next steps (new project):
  1. Your project brief is in .planning/PROJECT.md
  2. Create your first phase: /bc:new-phase "Setup and Scaffolding"
  3. Plan and execute: /bc:plan PHASE-01 → /bc:execute PHASE-01
  4. Check status: /bc:status

Troubleshooting:
  Run /bc:doctor to diagnose any issues.
```
