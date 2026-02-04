---
name: discuss-task
description: Clarify a task's requirements through interactive discussion before implementation
argument-hint: <task-id>
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - AskUserQuestion
---

# Discuss Task: $ARGUMENTS

Clarify a task's requirements, scope, and approach through interactive discussion before implementation.

## Purpose

This command helps ensure you fully understand what needs to be built before writing code. It's the "measure twice, cut once" step.

**Use this when:**
- A task description is vague or ambiguous
- You're unsure about edge cases or acceptance criteria
- The task involves integration with other systems
- You want to validate your understanding before starting

## Steps

### 1. Get Task Context

Run `bd show $ARGUMENTS` to get the task title, description, and any existing notes.

If the task doesn't exist, inform the user and exit.

### 2. Analyze Current Understanding

Read the task and identify:
- What you DO understand clearly
- What is ambiguous or unclear
- What assumptions you're making
- What's NOT mentioned but probably matters

### 3. Ask Clarifying Questions

Use AskUserQuestion to ask about unclear areas. Focus on:

**Scope & Boundaries:**
- What is IN scope for this task?
- What is explicitly OUT of scope?
- Are there related tasks this depends on or feeds into?

**Acceptance Criteria:**
- What does "done" look like?
- How will we know this works correctly?
- Are there specific test cases to consider?

**Technical Approach:**
- Are there constraints on how this should be built?
- Any existing patterns or code to follow?
- Any approaches to avoid?

**Edge Cases:**
- What happens when [X] fails?
- How should we handle [edge case]?
- What are the error scenarios?

**Integration:**
- What systems/components does this interact with?
- What data formats or APIs are involved?
- Are there authentication/authorization concerns?

### 4. Summarize Understanding

After discussion, summarize what was clarified:

```markdown
## Task Clarification Summary

**Task:** $ARGUMENTS - [title]
**Discussed:** [date]

### Scope
- IN: [what's included]
- OUT: [what's excluded]

### Acceptance Criteria
1. [criterion 1]
2. [criterion 2]
3. [criterion 3]

### Technical Approach
[Agreed approach based on discussion]

### Edge Cases to Handle
- [edge case 1]: [how to handle]
- [edge case 2]: [how to handle]

### Open Questions
[Anything still unresolved]
```

### 5. Update Beads Task

Update the task in Beads with the clarified information:

```bash
bd update $ARGUMENTS --note "Clarified via /bc:discuss-task on [date]. See summary above."
```

Consider updating the task description if it was significantly clarified.

### 6. Suggest Next Steps

```markdown
## Next Steps

Task $ARGUMENTS is now clarified.

Options:
1. Execute the task: `/bc:execute $ARGUMENTS`
2. Run `/bc:research $ARGUMENTS` for technical deep-dive first
3. Continue discussing other tasks

Ready to proceed?
```

## Question Templates

Use these as starting points for AskUserQuestion:

**For vague tasks:**
```
question: "What specific outcome should this task produce?"
options:
  - "A new feature that [X]"
  - "A fix for [specific bug]"
  - "A refactor of [component]"
  - "Other (please describe)"
```

**For technical decisions:**
```
question: "How should we approach [technical aspect]?"
options:
  - "[Option A] - [tradeoff]"
  - "[Option B] - [tradeoff]"
  - "Let me decide based on research"
  - "Other approach"
```

**For scope clarification:**
```
question: "Should this task include [potentially related thing]?"
options:
  - "Yes, include it"
  - "No, that's a separate task"
  - "Let's discuss further"
```

## Anti-Patterns

**DON'T:**
- Ask questions you could answer yourself with research
- Ask yes/no questions when you need details
- Ask multiple complex questions at once
- Assume you understand without confirming

**DO:**
- Ask one focused question at a time
- Provide concrete options when possible
- Summarize your understanding and ask for confirmation
- Note assumptions explicitly so user can correct them
