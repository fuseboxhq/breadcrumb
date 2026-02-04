---
name: close-phase
description: Mark a phase as complete and update its status
argument-hint: <PHASE-XX>
allowed-tools:
  - Bash
  - Write
  - Read
  - Edit
  - AskUserQuestion
---

# Close Phase: $ARGUMENTS

Mark a phase as complete, verify all tasks are done, and update documentation.

## Steps

### 1. Validate Phase Exists

Check that `.planning/$ARGUMENTS.md` exists.

If not, inform the user:
```
Phase $ARGUMENTS not found. Available phases:
[list existing PHASE-XX.md files]
```

### 2. Read Phase File

Read `.planning/$ARGUMENTS.md` to get:
- Beads Epic ID
- Completion criteria
- Current status

If status is already `complete`, inform user and exit.

### 3. Check Task Completion

Get all tasks under the phase's Beads epic:
```bash
bd list --parent [epic-id]
```

Or list all and filter for tasks starting with the epic ID.

Check if all tasks are marked done. If not:
```
Cannot close phase. Incomplete tasks:
  - [task-id]: [title] (status: [status])
  - [task-id]: [title] (status: [status])

Options:
  - Execute remaining tasks: /bc:execute $ARGUMENTS
  - Execute single task: /bc:execute [task-id]
  - Mark manually done: bd update [task-id] --status done
```

### 4. Verify Completion Criteria

Read the completion criteria from the phase file.
Ask user to confirm each criterion is met (or auto-verify if possible).

### 5. Update Phase File

Update `.planning/$ARGUMENTS.md`:

1. Change status:
```markdown
**Status:** complete
```

2. Add completion date:
```markdown
**Completed:** [YYYY-MM-DD]
```

3. Update tasks table to show all as done

4. Add completion summary (optional):
```markdown
## Completion Notes

Phase completed on [date]. All [N] tasks finished.
[Any notable outcomes or learnings]
```

### 6. Update Beads Epic

Mark the epic as done:
```bash
bd update [epic-id] --status done
```

### 7. Update STATE.md

Update `.planning/STATE.md`:
- Remove this phase from "Active Work"
- Add to completed phases list
- Update "Current Phase" to next incomplete phase (if any)

```markdown
## Completed Phases

- PHASE-XX: [title] (completed [date])

## Active Work

[Next phase or "No active phases"]
```

### 8. Report Success

```
Phase $ARGUMENTS closed!

  Status: complete
  Tasks completed: [N]
  Completed: [date]

Summary:
  [Brief summary of what was accomplished]

Next steps:
  - Create next phase: /bc:new-phase [title]
  - Check status: /bc:status
```
