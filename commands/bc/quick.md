---
name: quick
description: Quickly execute a task without full planning workflow
argument-hint: <description>
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - AskUserQuestion
  - mcp__context7__resolve-library-id
  - mcp__context7__query-docs
---

# Quick Task: $ARGUMENTS

Execute a task quickly with minimal overhead.

## 0. Preflight

Verify the project is set up before proceeding:

1. Check `.beads/` exists — if not: "Beads not initialized. Run `/bc:init` first." Exit early.

## 1. Validate Input

If `$ARGUMENTS` is empty or missing:
```
Usage: /bc:quick "task description"

Example: /bc:quick "add dark mode toggle"
```
Exit early if no description provided.

## 2. Create Beads Task

```bash
bd create "$ARGUMENTS" -p 2
```

Capture the task ID from output (format: `Created task: <id>`).

## 3. Quick Scope Clarification

Use AskUserQuestion with 1-2 quick questions maximum. Keep it fast.

```
question: "Quick context for: $ARGUMENTS"
options:
  - label: "I'll find the files"
    description: "Let Claude locate relevant files automatically"
  - label: "Specific area"
    description: "I want to specify which files/directories"
```

If user selects "Specific area", ask one follow-up:
```
question: "Which area of the codebase?"
options:
  - label: "Frontend"
    description: "UI components, pages, styles"
  - label: "Backend"
    description: "API, services, database"
  - label: "Config/Build"
    description: "Configuration, build scripts"
```

Do NOT over-ask. Move on quickly.

## 4. Load Context (if available)

If `.planning/CODEBASE.md` exists, read it for:
- Tech stack
- Directory structure
- Existing patterns

This helps make better changes faster.

## 5. Minimal Research (conditional)

Only if the task mentions a specific library or framework:
- Use Context7 for a single quick lookup
- Skip if task is straightforward code change
- Skip WebSearch entirely

Example triggers for Context7:
- "using React Query"
- "with Zod validation"
- "add Tailwind classes"

## 6. Execute the Task

1. **Locate files** - Use Glob/Grep to find relevant files
2. **Read files** - Understand current implementation
3. **Make changes** - Edit/Write as needed
4. **Basic verification** - If lint/typecheck available, run it

Follow existing patterns from the codebase. Keep changes focused.

## 7. Close Task

```bash
bd close <task-id>
```

## 8. Report Completion

```markdown
## QUICK TASK COMPLETE

**Task:** <task-id> - $ARGUMENTS

### Changes
- `<file>`: <brief description of change>

### Verification
- [x] <verification step>

Task closed in Beads.
```

Keep the report concise. User can check git diff for details.
