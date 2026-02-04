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
  - AskUserQuestion
  - mcp__context7__resolve-library-id
  - mcp__context7__query-docs
---

# Plan Phase: $ARGUMENTS

Clarify requirements, research implementation approaches, and break down into executable tasks.

## Philosophy

**Understand before building.** Ask questions first. Don't assume requirements.

**Your training is stale.** Verify technical claims. Use Context7 and official docs.

**Be prescriptive.** "Use X because..." not "consider X or Y..."

## Steps

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

### 3. Clarify Requirements (IMPORTANT)

**Before researching, ensure you understand what needs to be built.**

Use AskUserQuestion to clarify:

**Scope & Objectives:**
- What is the expected outcome of this phase?
- What is IN scope vs OUT of scope?
- Are there dependencies on other phases?

**Constraints:**
- Any technology constraints (must use X, can't use Y)?
- Any timeline or resource constraints?
- Any existing code/patterns to follow?

**Success Criteria:**
- What does "done" look like for this phase?
- How will we verify it works correctly?
- Are there specific acceptance criteria?

**Preferences:**
- Any approaches you want to explore or avoid?
- Any specific libraries or tools you prefer?

**Example questions:**
```
question: "What is the primary goal of this phase?"
options:
  - "Build [specific feature]"
  - "Fix [specific problem]"
  - "Refactor [specific component]"
  - "Other (let me describe)"

question: "Are there any technology constraints?"
options:
  - "Must use [specific tech]"
  - "Prefer [tech] but flexible"
  - "No constraints - recommend what's best"
  - "Other constraints"
```

**Only proceed to research once requirements are clear.**

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

Update `.planning/STATE.md`:
```markdown
**Current Phase:** $ARGUMENTS
**Last Updated:** [date]

## Active Work

$ARGUMENTS: [title] (in_progress) - [N] tasks
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
