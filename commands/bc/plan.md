---
name: plan
description: Clarify requirements, research a phase, break it into tasks, and populate PHASE-XX.md
argument-hint: <PHASE-XX>
allowed-tools:
  - Bash
  - WebSearch
  - WebFetch
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Task
  - AskUserQuestion
  - mcp__context7__resolve-library-id
  - mcp__context7__query-docs
  - Skill
---

# Plan Phase: $ARGUMENTS

Clarify requirements, research implementation approaches, and break down into executable tasks.

## Philosophy

**Understand before building.** Ask questions first. Don't assume requirements.

**Your training is stale.** Verify technical claims. Use Context7 and official docs.

**Be prescriptive.** "Use X because..." not "consider X or Y..."

## Steps

### 0. Preflight

Verify the project is set up before proceeding:

1. Check `.git` exists — if not: "No git repository. Run `/bc:init` first." Exit early.
2. Check `.beads/` exists — if not: "Beads not initialized. Run `/bc:init` first." Exit early.
3. Check `.planning/` exists — if not: "Breadcrumb not initialized. Run `/bc:init` first." Exit early.

### 1. Validate Phase Exists

Check that `.planning/$ARGUMENTS.md` exists.

If not found:
```
Phase $ARGUMENTS not found.
Create it first: /bc:new-phase [title]
```

### 2. Read Phase Context

Read `.planning/$ARGUMENTS.md` to get:
- Phase title
- Beads Epic ID
- Current status
- Any existing content

If status is `complete`, warn user and confirm they want to re-plan.

**Also check for codebase context:**
If `.planning/CODEBASE.md` exists, read it to understand:
- Existing tech stack (don't recommend conflicting technologies)
- Directory structure (know where to put new code)
- Existing patterns (follow established conventions)

This context should inform your research and task planning.

### 3. Validate Requirements

**Check that the phase file has sufficient context from `/bc:new-phase`.**

The phase file should already contain an Objective, Scope, Constraints, and Completion Criteria from the discovery questions asked during phase creation.

**If the phase file is sparse** (e.g. it was created manually or with an older version), use AskUserQuestion to fill the gaps:

- What is the expected outcome?
- What is IN scope vs OUT of scope?
- Any technology constraints?
- What does "done" look like?

**If the phase file already has rich context**, confirm your understanding briefly:

```
Based on the phase description, I understand:
- Goal: [summarize]
- Scope: [summarize]
- Constraints: [summarize]

I'll proceed with research based on this. Let me know if anything needs adjusting.
```

**Only ask questions about gaps — don't repeat what's already documented.**

### 4. Research Phase Implementation

**Identify research domains:**
- What technologies/libraries are needed?
- What patterns do experts use?
- What are common pitfalls?
- What shouldn't be hand-rolled?

**Context7 First (for libraries):**
```
1. mcp__context7__resolve-library-id
   libraryName: "[library name]"

2. mcp__context7__query-docs
   libraryId: [resolved ID]
   query: "[specific question]"
```

**WebSearch for ecosystem questions:**
- Include current year
- Cross-verify findings
- Assign confidence levels (HIGH/MEDIUM/LOW)

### 4b. Identify Frontend/Design Tasks

Check if the phase involves any UI, frontend, or design work by looking for keywords in the objective and scope: UI, frontend, component, page, layout, design, styling, CSS, visual, dashboard, sidebar, form, modal, etc.

**If frontend work is detected**, note in the Research Summary:
```markdown
### Design Guidance
The `frontend-design` skill will be active during execution of UI tasks in this phase. It provides guidelines for typography, color, motion, spatial composition, and avoiding generic aesthetics.
```

Tag UI-related tasks with a note: `(frontend-design skill active)` in their description when creating them in Beads.

### 5. Define Tasks

Break the phase into 3-7 tasks. Each task should be:
- Completable in one focused session
- Have clear done criteria
- Be independently verifiable

For each task:
- Title (action-oriented)
- What it accomplishes
- Complexity (Low/Medium/High)
- Dependencies on other tasks

### 6. Create Beads Tasks

For each task, create in Beads under the phase epic:
```bash
bd create "[Task title]" --parent [epic-id]
```

If tasks have dependencies:
```bash
bd dep add [dependent-task] [dependency-task]
```

### 6b. Activate Epic

Set the phase epic to `in_progress` so subtasks are unblocked for execution:
```bash
bd update [epic-id] --status in_progress
```

This ensures tasks appear in `bd ready` immediately after planning. Without this, the epic's `open` status blocks all children.

### 7. Update Phase File

Update `.planning/$ARGUMENTS.md` with full content:

```markdown
# Phase XX: [Title]

**Status:** in_progress
**Beads Epic:** [epic-id]
**Created:** [date]

## Objective

[2-3 sentences on what this phase accomplishes and why it matters]

## Research Summary

**Overall Confidence:** [HIGH/MEDIUM/LOW]

[TL;DR - 2-3 sentences on the recommended approach]

### Recommended Stack

| Library | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| [name] | [ver] | [why] | [H/M/L] |

### Key Patterns

[Brief description of important patterns to follow]

### Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| [X] | [Y] | [edge cases] |

### Pitfalls

- **[Pitfall]**: [How to avoid]

## Tasks

| ID | Title | Status | Complexity | Dependencies |
|----|-------|--------|------------|--------------|
| [id] | [title] | open | [L/M/H] | [deps or -] |

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| [What] | [Option] | [Why] |

## Completion Criteria

- [ ] [Observable criterion 1]
- [ ] [Observable criterion 2]
- [ ] [Observable criterion 3]

## Sources

**HIGH confidence:**
- [source]

**MEDIUM confidence:**
- [source]
```

### 8. Update STATE.md

Read `.planning/STATE.md`, then update it:

- Set `**Current Phase:**` to `$ARGUMENTS` (if not already set to another active phase)
- Set `**Last Updated:**` to today's date
- Under `## Active Work`, find and update this phase's line to: `$ARGUMENTS: [title] (in_progress) - [N] tasks`
- Do NOT remove other phases' entries from Active Work

### 8.5. Git Commit

Stage and commit the plan:
```bash
git add .planning/$ARGUMENTS.md .planning/STATE.md .planning/research/
git commit -m "Plan $ARGUMENTS: [title] - [N] tasks"
```

### 9. Report Summary

```markdown
## PHASE PLANNED

**Phase:** $ARGUMENTS - [title]
**Confidence:** [level]
**Tasks:** [N]

### Approach
[1-2 sentence summary]

### Tasks Created
1. [id]: [title] ([complexity])
2. [id]: [title] ([complexity])
...

### Key Decisions
- [decision 1]
- [decision 2]

### Watch Out For
- [main pitfall]

### Next Steps
1. Execute the phase: /bc:execute $ARGUMENTS
2. Or execute one task: /bc:execute [first task id]
3. Deep research if needed: /bc:research [task-id]
```
