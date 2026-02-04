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
| `/bc:update` | Update breadcrumb to latest version |

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
bd update <id> --status done     # Mark complete
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

## File Locations

| Content | Location |
|---------|----------|
| Codebase context | `.planning/CODEBASE.md` |
| Phase overviews | `.planning/PHASE-XX.md` |
| Task research | `.planning/research/<task-id>.md` |
| Project state | `.planning/STATE.md` |
| Todo list | `.planning/TODO.md` |
| Task database | `.beads/` |
