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
  - Skill
---

# Close Phase: $ARGUMENTS

Mark a phase as complete, verify all tasks are done, and update documentation.

## Steps

### 0. Preflight

Verify the project is set up before proceeding:

1. Check `.git` exists — if not: "No git repository. Run `/bc:init` first." Exit early.
2. Check `.beads/` exists — if not: "Beads not initialized. Run `/bc:init` first." Exit early.
3. Check `.planning/` exists — if not: "Breadcrumb not initialized. Run `/bc:init` first." Exit early.

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
bd list
```

Filter the output to tasks whose ID starts with the epic ID prefix (e.g., `btr.1`, `btr.2` for epic `btr`). Note: `bd list --parent` is not a valid Beads flag — always use `bd list` and filter manually.

Check if all tasks are marked done. If not:
```
Cannot close phase. Incomplete tasks:
  - [task-id]: [title] (status: [status])
  - [task-id]: [title] (status: [status])

Options:
  - Execute remaining tasks: /bc:execute $ARGUMENTS
  - Execute single task: /bc:execute [task-id]
  - Mark manually done: bd close [task-id]
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

3. Synchronize the task table with Beads state:
   - For each task in the `## Tasks` table, check its status in the `bd list` output
   - If a task is closed in Beads but not `done` in the table, update it to `done`
   - If a task is in_progress in Beads but not `in_progress` in the table, update it
   - Log any discrepancies found and fixed

4. Add completion summary (optional):
```markdown
## Completion Notes

Phase completed on [date]. All [N] tasks finished.
[Any notable outcomes or learnings]
```

### 6. Update Beads Epic

Close the epic in Beads:
```bash
bd close [epic-id]
```

### 7. Update STATE.md

Read `.planning/STATE.md`, then update it:

- Remove this phase's line from "## Active Work"
- Append to "## Completed Phases": `- PHASE-XX: [title] (completed [date])`
- If `**Current Phase:**` pointed to this phase, set it to the next in-progress phase (if any), or `None`
- Do NOT remove other active phases — there may be multiple phases in progress

### 7.5. Git Commit

Stage and commit the close:
```bash
git add .planning/$ARGUMENTS.md .planning/STATE.md
git commit -m "Close $ARGUMENTS: [title]"
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
