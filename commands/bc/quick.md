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
  - Skill
---

# Quick Task: $ARGUMENTS

Execute a task quickly with minimal overhead. The task is tracked under the Quick Tasks epic in Beads.

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

## 2. Find or Create Quick Tasks Epic

Look up the persistent Quick Tasks epic:
```bash
bd list --label quick-tasks-epic --limit 1 2>/dev/null
```

**If no results (epic doesn't exist):**
```bash
bd create "Quick Tasks" --type epic --labels quick-tasks-epic
bd update <epic-id> --status in_progress
```

Capture the epic ID for the next step.

## 3. Create Beads Task

**Generate a concise title.** If `$ARGUMENTS` is a full sentence (e.g., "can you make the sidebar wider"), condense it to an imperative 5-8 word title (e.g., "Widen sidebar layout"). Use the original input as the task description.

**Classify the intent** and pick the best label:

| Label | When to use |
|-------|-------------|
| `fix` | Bug fixes, corrections, things that are "wrong" or "broken" |
| `tweak` | Style changes, adjustments, updates to existing things |
| `add` | New features, additions, creating something new |
| `refactor` | Code restructuring, cleanup, reorganization |

**Create the task under the Quick Tasks epic:**
```bash
bd create "<concise-title>" --parent <quick-epic-id> --labels <fix|tweak|add|refactor> -p 2 -d "<original $ARGUMENTS as description>"
bd update <task-id> --status in_progress
```

## 4. Quick Scope Clarification

Use AskUserQuestion with 1-2 quick questions maximum. Keep it fast.

```
question: "Quick context for: <task title>"
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

## 5. Load Context (if available)

If `.planning/CODEBASE.md` exists, read it for:
- Tech stack
- Directory structure
- Existing patterns

Also check recent quick tasks for awareness of recent changes:
```bash
bd list --parent <quick-epic-id> --all --limit 3
```

This helps avoid conflicting with work just completed.

## 6. Minimal Research (conditional)

Only if the task mentions a specific library or framework:
- Use Context7 for a single quick lookup
- Skip if task is straightforward code change
- Skip WebSearch entirely

Example triggers for Context7:
- "using React Query"
- "with Zod validation"
- "add Tailwind classes"

## 7. Execute the Task

1. **Locate files** - Use Glob/Grep to find relevant files
2. **Read files** - Understand current implementation
3. **Make changes** - Edit/Write as needed
4. **Basic verification** - If lint/typecheck available, run it

Follow existing patterns from the codebase. Keep changes focused.

## 8. Close Task

```bash
bd close <task-id>
```

## 9. Report Completion

```markdown
## QUICK TASK COMPLETE

**Task:** <task-id> - <concise-title> [`label`]
**Epic:** Quick Tasks (<epic-id>)

### Changes
- `<file>`: <brief description of change>

### Verification
- [x] <verification step>

Task closed in Beads.
```

Keep the report concise. User can check git diff for details.
