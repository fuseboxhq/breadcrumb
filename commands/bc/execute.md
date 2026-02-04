---
name: execute
description: Execute a specific task or all tasks in a phase
argument-hint: <task-id | PHASE-XX>
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Task
  - AskUserQuestion
  - WebSearch
  - WebFetch
  - mcp__context7__resolve-library-id
  - mcp__context7__query-docs
---

# Execute: $ARGUMENTS

Implement a task or work through all tasks in a phase.

## Determine Mode

Parse `$ARGUMENTS`:
- If starts with `PHASE-` → Phase mode (execute all tasks)
- Otherwise → Task mode (execute single task)

---

## Task Mode (single task)

### 1. Load Task Context

```bash
bd show $ARGUMENTS
```

If task not found, report error and exit.

### 2. Check Task Status

If task is already `done`, inform user:
```
Task $ARGUMENTS is already complete.
Use bd ready to see available tasks.
```

### 3. Load Phase Context

Find which phase this task belongs to by checking `.planning/PHASE-*.md` files for the task ID or its parent epic.

Read the phase file to understand:
- Overall objective
- Research summary
- Technical decisions
- Related tasks

### 4. Load Codebase Context

If `.planning/CODEBASE.md` exists, read it for:
- Tech stack
- Existing patterns
- Directory structure

### 5. Load Task Research

If `.planning/research/$ARGUMENTS.md` exists, read it for detailed implementation guidance.

### 6. Confirm Before Starting

Use AskUserQuestion:
```
question: "Ready to implement: [task title]. Proceed?"
options:
  - label: "Yes, implement it"
    description: "Start working on this task"
  - label: "Show me the plan first"
    description: "Explain what will be done before starting"
  - label: "Cancel"
    description: "Don't implement right now"
```

If "Show me the plan first", explain the implementation approach, then ask again.

### 6b. Mark Task In Progress

Update Beads:
```bash
bd update $ARGUMENTS --status in_progress
```

Update the phase markdown task table. Using the PHASE-XX.md file identified in step 3, edit the `## Tasks` table:
- Find the row containing `| $ARGUMENTS |`
- Change the Status cell from `open` to `in_progress`

For example, change:
```
| btr.1 | Scaffold project | open | Medium | - |
```
to:
```
| btr.1 | Scaffold project | in_progress | Medium | - |
```

### 7. Implement the Task

Based on the task description and context:
- Write/edit code as needed
- Follow existing patterns from CODEBASE.md
- Follow technical decisions from phase file
- Use Context7 for library documentation if needed

### 8. Verify Implementation

Run appropriate verification:
- If tests exist for this area, run them
- If task has specific acceptance criteria, verify each one
- Check for obvious errors (lint, type check if applicable)

### 9. Mark Task Complete

Close the task in Beads:
```bash
bd close $ARGUMENTS
```

Update the phase markdown task table. Using the PHASE-XX.md file identified in step 3, edit the `## Tasks` table:
- Find the row containing `| $ARGUMENTS |`
- Change the Status cell from `in_progress` (or `open`) to `done`

For example, change:
```
| btr.1 | Scaffold project | in_progress | Medium | - |
```
to:
```
| btr.1 | Scaffold project | done | Medium | - |
```

### 10. Report Completion

```markdown
## TASK COMPLETED

**Task:** $ARGUMENTS - [title]

### Changes Made
- [file]: [what changed]
- [file]: [what changed]

### Verification
- [x] [verification step]
- [x] [verification step]

### Next Steps
Run `bd ready` to see remaining tasks.
```

---

## Phase Mode (all tasks)

### 1. Validate Phase Exists

Check `.planning/$ARGUMENTS.md` exists.

### 2. Get All Tasks

```bash
bd list
```

Filter to tasks under this phase's epic.

### 3. Check for Ready Tasks

```bash
bd ready
```

If no tasks are ready (all blocked or done):
- If all done: "Phase $ARGUMENTS is complete. Run /bc:close-phase $ARGUMENTS"
- If blocked: Show what's blocking and ask how to proceed

### 4. Confirm Phase Execution

Use AskUserQuestion:
```
question: "Execute all [N] tasks in $ARGUMENTS?"
options:
  - label: "Yes, execute all"
    description: "Work through tasks in dependency order"
  - label: "One at a time"
    description: "Execute one task, then ask before continuing"
  - label: "Show task list first"
    description: "Review tasks before starting"
  - label: "Cancel"
    description: "Don't execute right now"
```

### 5. Execute Tasks in Order

For each ready task (respecting dependencies):

1. Show: "Starting task [id]: [title]"
2. Mark task in progress: `bd update [id] --status in_progress`
3. Update PHASE-XX.md task table: change status from `open` to `in_progress`
4. Execute using Task Mode steps 3-9 (which includes closing in Beads and updating markdown to `done`)
5. If "One at a time" mode, ask before continuing
6. Check for newly unblocked tasks

### 6. Handle Failures

If a task fails:
```
question: "Task [id] failed: [reason]. How to proceed?"
options:
  - label: "Skip and continue"
    description: "Move to next task, come back to this later"
  - label: "Retry"
    description: "Try implementing this task again"
  - label: "Stop here"
    description: "Pause phase execution"
```

### 7. Report Phase Progress

```markdown
## PHASE EXECUTION COMPLETE

**Phase:** $ARGUMENTS - [title]

### Tasks Completed
- [x] [id]: [title]
- [x] [id]: [title]

### Tasks Remaining
- [ ] [id]: [title] (blocked by: [deps])

### Summary
[N] of [M] tasks completed.

### Next Steps
[If all done: Run /bc:close-phase $ARGUMENTS]
[If remaining: Run bd ready to see what's next]
```
