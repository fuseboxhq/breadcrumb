---
name: new-phase
description: Create a new phase with PHASE-XX.md file and corresponding Beads epic
argument-hint: <title>
allowed-tools:
  - Bash
  - Write
  - Read
  - Glob
  - AskUserQuestion
---

# Create New Phase: $ARGUMENTS

Create a new phase for the project. Before creating the files, ask questions to deeply understand the phase scope, goals, and constraints.

## Philosophy

**Understand before scaffolding.** A phase with rich context leads to better planning and execution. Don't create empty templates — ask enough questions to populate the phase file with real substance.

**Be conversational, not bureaucratic.** Adapt your questions based on what you learn. Skip questions that are already answered by the title/description.

## Steps

### 0. Preflight

Verify the project is set up before proceeding:

1. Check `.git` exists — if not: "No git repository. Run `/bc:init` first." Exit early.
2. Check `.beads/` exists — if not: "Beads not initialized. Run `/bc:init` first." Exit early.
3. Check `.planning/` exists — if not: "Breadcrumb not initialized. Run `/bc:init` first." Exit early.

### 1. Read Existing Context

Before asking anything, gather context silently:

**Check existing phases:**
```bash
ls .planning/PHASE-*.md 2>/dev/null | sort -V
```

**Read project state:**
If `.planning/STATE.md` exists, read it to understand:
- What phases already exist
- What's currently active
- What's been completed

**Read codebase context:**
If `.planning/CODEBASE.md` exists, read it for tech stack, structure, patterns.

**Determine phase number:**
If no phases exist, this will be PHASE-01. Otherwise, increment from the highest.

### 2. Discovery Questions (IMPORTANT)

**This is the core of the command.** Use AskUserQuestion to have a multi-round conversation that deeply explores what this phase is about. Adapt based on the title/description provided in `$ARGUMENTS`.

**Round 1 — Goal & Vision:**

Start by reflecting back what you understand from the title, then probe deeper:

```
question: "What's the core outcome you want from this phase?"
options:
  - "[Inferred goal based on title]"
  - "[Alternative interpretation]"
  - "[Broader scope interpretation]"
```

```
question: "How does this fit into the bigger picture?"
options:
  - "It's foundational — other work depends on it"
  - "It's independent — can be done in any order"
  - "It builds on [previous phase]"
  - "It's exploratory — figuring out the right approach"
```

**Round 2 — Scope & Boundaries:**

Based on what you learned in Round 1, ask about scope:

```
question: "What is explicitly OUT of scope for this phase?"
```

If the phase involves building something, ask:
```
question: "What's the minimum viable version of this?"
options:
  - "Full implementation — do it properly"
  - "MVP first — get it working, polish later"
  - "Spike/prototype — just prove it can work"
```

**Round 3 — Constraints & Preferences:**

Ask about constraints relevant to what you've learned:

- Technology constraints (must use X, avoid Y)
- Patterns to follow or avoid
- Integration points with existing code
- Known risks or concerns

```
question: "Any specific technical constraints or preferences?"
options:
  - "Must integrate with [existing system/pattern]"
  - "Use [specific technology/library]"
  - "Follow existing patterns in the codebase"
  - "No constraints — recommend what's best"
```

**Round 4 — Success Criteria:**

```
question: "What does 'done' look like for this phase?"
options:
  - "[Specific observable outcome based on discussion]"
  - "[Alternative completion criteria]"
  - "I'll know it when I see it — help me define it"
```

**Adaptive questioning rules:**
- If the user gave a detailed description with `$ARGUMENTS`, skip questions already answered
- If the codebase context makes certain answers obvious, state your assumption and ask to confirm rather than asking from scratch
- If the user gives short answers, probe deeper. If they give detailed answers, move on faster
- Aim for 2-4 rounds of questions. Don't ask more than 8 total questions
- Group related questions using the multi-option format where possible
- If the user says "just create it" or similar, respect that and proceed with what you have

### 3. Synthesize Phase Description

From the discovery conversation, write a clear phase description that includes:

- **Objective**: 2-3 sentences on what this phase accomplishes and why
- **Scope**: What's included and what's explicitly excluded
- **Constraints**: Any technology or design constraints mentioned
- **Success criteria**: 3-5 observable "done" conditions
- **Context**: How it relates to existing work (previous phases, codebase patterns)

### 4. Create Beads Epic

```bash
bd create "Phase [XX]: [title]" -p 0
```

Capture the returned task ID.

### 5. Create Phase File

Create `.planning/PHASE-XX.md` with the synthesized content:

```markdown
# Phase XX: [Title]

**Status:** not_started
**Beads Epic:** [epic-id]
**Created:** [YYYY-MM-DD]

## Objective

[2-3 sentences synthesized from discovery conversation]

## Scope

**In scope:**
- [item]
- [item]

**Out of scope:**
- [item]
- [item]

## Constraints

- [Any technology, design, or process constraints from the conversation]

## Research Summary

Run `/bc:plan PHASE-XX` to research this phase and populate this section.

## Recommended Approach

[If enough context exists from the conversation, sketch the approach here.
Otherwise: "Run `/bc:plan PHASE-XX` to research and define the approach."]

## Tasks

| ID | Title | Status | Complexity |
|----|-------|--------|------------|
| - | No tasks yet | - | - |

Run `/bc:plan PHASE-XX` to break down this phase into tasks.

## Technical Decisions

[Any decisions already made during the discovery conversation]

## Completion Criteria

- [ ] [Observable criterion from discussion]
- [ ] [Observable criterion from discussion]
- [ ] [Observable criterion from discussion]
```

### 6. Update STATE.md

Update `.planning/STATE.md`:

```markdown
**Current Phase:** PHASE-XX
**Last Updated:** [date]

## Active Work

PHASE-XX: [title] (not_started)
```

### 7. Report Success

```
Phase created!

  File: .planning/PHASE-XX.md
  Beads Epic: [epic-id]
  Title: [title]

Summary:
  [1-2 sentence summary of what was discussed and captured]

Next steps:
  1. Plan the phase: /bc:plan PHASE-XX
  2. This will:
     - Research implementation approaches
     - Break down into tasks with dependencies
     - Create Beads tasks under the epic
     - Refine completion criteria
```
