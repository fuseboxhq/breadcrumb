---
name: new-phase
description: Create a new phase with PHASE-XX.md file and corresponding Beads epic
argument-hint: <title>
allowed-tools:
  - Bash
  - Write
  - Read
  - Glob
---

# Create New Phase: $ARGUMENTS

Create a new phase for the project with a PHASE-XX.md file and corresponding Beads epic.

## Steps

### 1. Determine Phase Number

Check existing phases:
```bash
ls .planning/PHASE-*.md 2>/dev/null | sort -V | tail -1
```

If no phases exist, this will be PHASE-01.
Otherwise, increment from the highest existing phase number.

Format: `PHASE-XX` (zero-padded, e.g., PHASE-01, PHASE-02, PHASE-10)

### 2. Create Beads Epic

Create the epic in Beads:
```bash
bd create "Phase [XX]: $ARGUMENTS" -p 0
```

Capture the returned task ID (e.g., `bd-a3f8`).

### 3. Create Phase File

Create `.planning/PHASE-XX.md`:

```markdown
# Phase XX: $ARGUMENTS

**Status:** not_started
**Beads Epic:** [epic-id]
**Created:** [YYYY-MM-DD]

## Objective

[To be defined during /bc:plan]

## Research Summary

Run `/bc:plan PHASE-XX` to research this phase and populate this section.

## Recommended Approach

[To be defined during /bc:plan]

## Tasks

| ID | Title | Status | Complexity |
|----|-------|--------|------------|
| - | No tasks yet | - | - |

Run `/bc:plan PHASE-XX` to break down this phase into tasks.

## Technical Decisions

[To be documented during planning and execution]

## Completion Criteria

- [ ] [To be defined during /bc:plan]
```

### 4. Update STATE.md

Update `.planning/STATE.md` to reflect the new phase:

```markdown
**Current Phase:** PHASE-XX
**Last Updated:** [date]

## Active Work

PHASE-XX: $ARGUMENTS (not_started)
```

### 5. Report Success

```
Phase created!

  File: .planning/PHASE-XX.md
  Beads Epic: [epic-id]
  Title: $ARGUMENTS

Next steps:
  1. Plan the phase: /bc:plan PHASE-XX
  2. This will:
     - Research implementation approaches
     - Break down into tasks
     - Create Beads tasks under the epic
     - Define completion criteria
```
