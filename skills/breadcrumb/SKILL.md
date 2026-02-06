---
name: breadcrumb
description: Background knowledge for breadcrumb workflows. Provides phase management conventions and Beads CLI integration.
user-invocable: false
---

# breadcrumb Conventions

breadcrumb is a lightweight research and planning extension that integrates with Beads CLI for task tracking.

## Directory Structure

```
.planning/
├── CODEBASE.md              # Existing codebase context (from /bc:integrate)
├── PHASE-01.md              # Phase definition + research + tasks
├── PHASE-02.md
├── TODO.md                  # Quick capture ideas (from /bc:todo)
├── research/                # Task-level deep dives
│   └── bd-xxxx.md
└── STATE.md                 # Current context (optional)

.beads/
└── beads.db                 # Beads task database
```

## Phase Lifecycle

```
new-phase → plan → execute → close-phase
    ↓         ↓        ↓          ↓
 PHASE-XX.md  Research  /bc:execute  Mark complete
 + Beads epic + Tasks   implements   Archive
```

## Commands

| Command | Purpose |
|---------|---------|
| `/bc:init` | Initialize Beads + `.planning/` directory |
| `/bc:integrate` | Explore existing codebase and create CODEBASE.md |
| `/bc:new-phase [title]` | Create PHASE-XX.md + Beads epic |
| `/bc:plan PHASE-XX` | Clarify requirements, research, create tasks |
| `/bc:execute <task-id \| PHASE-XX>` | Execute a task or all tasks in a phase |
| `/bc:discuss-task <task-id>` | Clarify a task through interactive discussion |
| `/bc:research <task-id>` | Deep research on specific task |
| `/bc:status` | Show all phases and progress |
| `/bc:close-phase PHASE-XX` | Mark phase complete |
| `/bc:todo <description>` | Add item to todo list |
| `/bc:todos` | View and manage todo list |
| `/bc:quick <description>` | Quick task execution without full planning |
| `/bc:bug-fix <description>` | Investigate and fix a bug (reproduce→diagnose→fix→verify) |
| `/bc:view` | Open web dashboard in browser |
| `/bc:update` | Update breadcrumb to latest version |
| `/bc:doctor` | Diagnose and repair setup issues |

## Always Track Work

**Every code change must be tracked in Beads**, even small ad-hoc requests like "change the font" or "fix the typo".

### When to auto-track

Create a quick task when ALL of these are true:
1. The user's request involves changing code or files (not just reading or answering questions)
2. You are NOT already inside a `/bc:execute` or `/bc:quick` command flow
3. A `.beads/` directory exists in the project

### How to auto-track

**Before making changes:**

1. Find the Quick Tasks epic:
   ```bash
   bd list --label quick-tasks-epic --limit 1 2>/dev/null
   ```
   If not found, create it:
   ```bash
   bd create "Quick Tasks" --type epic --labels quick-tasks-epic
   bd update <epic-id> --status in_progress
   ```

2. Create a task with an imperative title (5-8 words):
   ```bash
   bd create "<title>" --parent <epic-id> --labels <fix|tweak|add|refactor>
   bd update <task-id> --status in_progress
   ```

**After completing changes:**
```bash
bd close <task-id>
```

### Auto-title examples

| User request | Task title | Label |
|---|---|---|
| "make the sidebar wider" | Widen sidebar layout | tweak |
| "the button color is wrong" | Fix button color | fix |
| "add a loading spinner" | Add loading spinner | add |
| "clean up the utils file" | Refactor utils module | refactor |
| "update the README" | Update README docs | tweak |

### What NOT to track

- Questions and explanations (no code change)
- Active `/bc:*` command flows (those have their own tracking)
- Reading files or exploring code (no modification)

## Frontend Design Skill

Breadcrumb ships with the `frontend-design` skill (`~/.claude/skills/frontend-design/SKILL.md`). This skill provides guidelines for creating distinctive, production-grade frontend interfaces.

**When to use it:** Any task involving UI work — building components, pages, layouts, styling, or visual design. The skill is automatically loaded as background context and guides aesthetic decisions like typography, color, motion, and spatial composition.

**How planning commands use it:**
- `/bc:plan` detects UI/frontend/design tasks and notes that the frontend-design skill will be active during execution
- `/bc:execute` leverages the skill automatically when implementing frontend tasks
- `/bc:new-phase` suggests the frontend-design skill for phases with UI/design scope

## Philosophy

**Understand before building.** Commands like `/bc:plan`, `/bc:discuss-task`, and `/bc:research` will ask clarifying questions before diving into work. This ensures requirements are clear and reduces rework.

## Beads CLI Quick Reference

```bash
bd init                          # Initialize Beads
bd ready                         # List tasks with no blockers
bd show <id>                     # View task details
bd list                          # List all tasks
bd create "Title" -p 0           # Create task
bd create "Title" --parent <id>  # Create child task
bd close <id>                    # Mark complete (close the issue)
bd update <id> --status in_progress  # Mark in progress
bd dep add <child> <parent>      # Add dependency
```

## Phase Naming

Phases use sequential numbering:
- `PHASE-01` - First phase
- `PHASE-02` - Second phase
- `PHASE-10` - Tenth phase (zero-padded for sorting)

Each phase has a corresponding Beads epic that contains all tasks.

## Task Hierarchy

```
PHASE-01.md ←→ bd-a3f8 (Beads epic)
                ├── bd-a3f8.1 (Task)
                ├── bd-a3f8.2 (Task)
                └── bd-a3f8.3 (Task)
```

## Hooks

Breadcrumb installs Claude Code hooks during `/bc:init`:

| Hook | Type | Purpose |
|------|------|---------|
| `bc-statusline.cjs` | statusLine | Live phase, progress, task, context bar |
| `bc-session-start.cjs` | SessionStart | Warm cache, start daemon, check updates |
| `bc-session-end.cjs` | Stop | Run `bd sync` to flush Beads state |
| `bc-bash-guard.cjs` | PreToolUse | Block `bd` CLI mistakes (e.g., `--status in-progress` → use `in_progress`) |

Hooks are stored in `~/.breadcrumb/hooks/` and configured in `~/.claude/settings.json`.

## Beads CLI Gotchas

- Status values use **underscores**: `in_progress`, not `in-progress`
- To close an issue, use `bd close <id>`, not `bd update <id> --status done`
- Epic must be `in_progress` for child tasks to appear in `bd ready`

## File Locations

| Content | Location |
|---------|----------|
| Codebase context | `.planning/CODEBASE.md` |
| Phase overviews | `.planning/PHASE-XX.md` |
| Task research | `.planning/research/<task-id>.md` |
| Project state | `.planning/STATE.md` |
| Todo list | `.planning/TODO.md` |
| Task database | `.beads/` |
| Hook scripts | `~/.breadcrumb/hooks/` |
| Status cache | `~/.breadcrumb/cache/` |
