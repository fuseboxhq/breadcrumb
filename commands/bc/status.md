---
name: status
description: Show all phases, their progress, and ready tasks
allowed-tools:
  - Bash
  - Read
  - Glob
---

# Project Status

Display the current state of all phases and tasks.

## Steps

### 1. Check Initialization

Verify `.planning/` directory exists. If not:
```
Breadcrumb not initialized. Run /bc:init first.
```

### 2. List All Phases

Find all phase files:
```bash
ls .planning/PHASE-*.md 2>/dev/null | sort -V
```

For each phase file, read and extract:
- Phase number and title
- Status (not_started, in_progress, complete)
- Beads Epic ID
- Task count and completion

### 3. Get Task Status from Beads

Run `bd list` to get all tasks.

For each phase, count:
- Total tasks
- Completed tasks
- Blocked tasks
- Ready tasks (open with no blockers)

### 4. Get Ready Tasks

Run `bd ready` to get tasks that can be worked on now.

### 5. Display Status

Format output:

```markdown
# Project Status

**Last Updated:** [date]

## Phases

### PHASE-01: [Title] ██████████░░ 8/10 tasks (in_progress)
  Epic: bd-a3f8
  Ready: bd-a3f8.5, bd-a3f8.6
  Blocked: bd-a3f8.9 (waiting on bd-a3f8.8)

### PHASE-02: [Title] ░░░░░░░░░░░░ 0/5 tasks (not_started)
  Epic: bd-b2c1
  Ready: bd-b2c1.1

### PHASE-03: [Title] ████████████ 6/6 tasks (complete)
  Epic: bd-c3d4
  Completed: [date]

---

## Summary

| Status | Count |
|--------|-------|
| Complete | 1 |
| In Progress | 1 |
| Not Started | 1 |
| **Total Tasks** | **21** |
| **Completed** | **14** |

## Ready to Work

Tasks with no blockers:

| ID | Phase | Title | Complexity |
|----|-------|-------|------------|
| bd-a3f8.5 | 01 | [title] | Medium |
| bd-a3f8.6 | 01 | [title] | Low |
| bd-b2c1.1 | 02 | [title] | High |

## Quick Actions

- Execute a task: `/bc:execute <task-id>`
- Execute all tasks in phase: `/bc:execute PHASE-XX`
- Plan a phase: `/bc:plan PHASE-XX`
- Discuss a task: `/bc:discuss-task <task-id>`
- Research a task: `/bc:research <task-id>`
- Close a phase: `/bc:close-phase PHASE-XX`
- Create new phase: `/bc:new-phase [title]`
- Add a todo: `/bc:todo "idea"`
- View todos: `/bc:todos`
- Mark task done: `bd update <task-id> --status done`
- See task details: `bd show <task-id>`
```

### 6. Handle Empty State

If no phases exist:
```markdown
# Project Status

No phases created yet.

## Get Started

1. Create your first phase:
   /bc:new-phase "Initial Setup"

2. Plan the phase:
   /bc:plan PHASE-01

3. Check status again:
   /bc:status
```

### 7. Handle No Tasks Ready

If phases exist but no tasks are ready:
```markdown
## Ready to Work

No tasks currently ready.

**Possible reasons:**
- All tasks are blocked by dependencies
- All tasks are complete
- Phases haven't been planned yet

**Actions:**
- Check blocked tasks: `bd list`
- Plan a phase: `/bc:plan PHASE-XX`
```
