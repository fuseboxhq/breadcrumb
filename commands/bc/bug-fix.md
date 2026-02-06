---
name: bug-fix
description: Investigate, diagnose, and fix a bug with structured reproduce→diagnose→fix→verify workflow
argument-hint: <bug description>
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
  - Skill
---

# Bug Fix: $ARGUMENTS

Investigate a bug with discipline: reproduce it, find the root cause, fix the cause (not the symptom), verify the fix, and check for related issues.

## Philosophy

**Diagnose before patching.** A band-aid fix that doesn't address the root cause will come back. Spend time understanding WHY it's broken, not just WHERE.

**Check for patterns.** If a null check is missing in one handler, it's probably missing in similar handlers too. Fix the class of bug, not just the instance.

## 0. Preflight

Verify the project is set up before proceeding:

1. Check `.beads/` exists — if not: "Beads not initialized. Run `/bc:init` first." Exit early.

## 1. Validate Input

If `$ARGUMENTS` is empty or missing:
```
Usage: /bc:bug-fix "description of the bug"

Example: /bc:bug-fix "dashboard shows stale data after switching projects"
Example: /bc:bug-fix "sidebar collapses on page refresh"
Example: /bc:bug-fix "TypeError when clicking empty task list"
```
Exit early if no description provided.

## 2. Gather Bug Report

Use AskUserQuestion to understand the bug. Adapt based on how much detail is in `$ARGUMENTS`.

**If `$ARGUMENTS` is vague** (e.g., "it's broken", "the page crashes"):

```
question: "Can you describe what you're seeing?"
options:
  - label: "Error message"
    description: "There's a specific error or crash"
  - label: "Wrong behavior"
    description: "It works but does the wrong thing"
  - label: "Missing behavior"
    description: "Something that should happen doesn't"
  - label: "Visual issue"
    description: "Layout, styling, or rendering problem"
```

```
question: "How severe is this?"
options:
  - label: "Critical"
    description: "Blocks core functionality, data loss, or crash"
  - label: "Moderate"
    description: "Broken feature but workarounds exist"
  - label: "Minor"
    description: "Cosmetic, edge case, or low-impact"
```

**If `$ARGUMENTS` is detailed** (has symptoms, steps, or error messages), skip to severity only and confirm your understanding:

```
Based on your description, I understand:
- Symptom: [what's happening]
- Expected: [what should happen]
- Trigger: [what causes it, if known]

I'll investigate from here.
```

```
question: "How severe?"
options:
  - label: "Critical"
    description: "Blocks core functionality"
  - label: "Moderate"
    description: "Broken but has workarounds"
  - label: "Minor"
    description: "Low-impact or cosmetic"
```

## 3. Create Beads Task

Find or create the Quick Tasks epic (same as `/bc:quick`):
```bash
bd list --label quick-tasks-epic --limit 1 2>/dev/null
```

If not found:
```bash
bd create "Quick Tasks" --type epic --labels quick-tasks-epic
bd update <epic-id> --status in_progress
```

Create the bug task with a clear title:
```bash
bd create "Fix: <concise description>" --parent <epic-id> --labels bug -p <priority> -d "<full bug description with symptoms>"
bd update <task-id> --status in_progress
```

Priority mapping:
- Critical → `-p 0`
- Moderate → `-p 1`
- Minor → `-p 2`

## 4. Load Context

**Read codebase context:**
If `.planning/CODEBASE.md` exists, read it for tech stack, directory structure, and patterns.

**Check recent bug fixes** for awareness of related issues:
```bash
bd list --label bug --all --limit 5
```

## 5. Reproduce — Understand the Trigger

**This is the most important step.** Before touching any code, understand exactly what triggers the bug.

1. **Locate the area** — Use Grep/Glob to find code related to the bug description
2. **Trace the flow** — Read the relevant files end-to-end to understand the data/control flow
3. **Identify the trigger** — What input, state, or sequence causes the bug?
4. **Check if reproducible** — If there are tests, run them. If not, trace the logic mentally.

Report what you found:
```
### Reproduction
- **Trigger:** [what causes the bug]
- **Location:** [file:line where it manifests]
- **Flow:** [brief trace of how we get there]
```

If you cannot identify the trigger, ask the user for more context before proceeding.

## 6. Diagnose — Find the Root Cause

Now dig deeper. The symptom location is rarely the root cause.

1. **Ask "why" repeatedly** — Why does this value end up null? Because it's not set. Why isn't it set? Because the setter is never called. Why? Because the condition above is wrong. THAT'S the root cause.
2. **Check assumptions** — Are types correct? Are async operations awaited? Are edge cases handled?
3. **Look at recent changes** — Did this work before? What changed?
   ```bash
   git log --oneline -10 -- <relevant-file>
   ```
4. **Use Context7 if needed** — If the bug involves a library, check official docs for correct usage.

Report the diagnosis:
```
### Root Cause
**What:** [the actual cause, not the symptom]
**Why:** [explanation of why this causes the observed bug]
**File:** [file:line of the root cause]
```

## 7. Check for Related Issues

**Before fixing, look for the same bug class elsewhere.** This is what separates a good fix from a whack-a-mole patch.

- If a null check is missing → grep for similar patterns in sibling files
- If an async/await is missing → check other async handlers in the same module
- If a type is wrong → check other usages of the same type
- If an edge case is unhandled → check if the same edge case affects similar code paths

```bash
# Example: find similar patterns
grep -rn "<pattern-that-caused-bug>" src/ --include="*.ts" --include="*.tsx"
```

Report findings:
```
### Related Issues
- [file:line] — Same pattern, [needs fix / already handled]
- [file:line] — Similar but different, [safe / needs attention]
```

If no related issues found, note that too.

## 8. Propose Fix

Before writing code, explain the fix:

```
### Proposed Fix
**Approach:** [what will change and why]
**Files:** [list of files to modify]
**Risk:** [Low/Medium/High — what could go wrong]
```

Use AskUserQuestion to confirm:
```
question: "Ready to apply the fix?"
options:
  - label: "Yes, fix it"
    description: "Apply the proposed fix"
  - label: "Show me more detail"
    description: "Explain the fix in more depth first"
  - label: "Different approach"
    description: "I'd prefer a different solution"
```

If "Show me more detail", explain the specific code changes, then ask again.
If "Different approach", discuss alternatives, then re-propose.

## 9. Implement the Fix

Apply the fix:
1. **Fix the root cause** — Not the symptom
2. **Fix related issues** — From step 7, if any
3. **Follow existing patterns** — Don't refactor unrelated code
4. **Keep changes minimal** — Only what's needed for the fix

**For UI/frontend bugs**: The `frontend-design` skill provides design guidelines if the fix involves visual changes.

## 10. Verify the Fix

Run appropriate verification:

1. **Build check** — Ensure the project compiles/builds
   ```bash
   # Adapt to project's build command
   pnpm build 2>&1 | tail -20
   ```

2. **Run tests** — If tests exist for the affected area
   ```bash
   # Adapt to project's test command
   pnpm test 2>&1 | tail -30
   ```

3. **Type check** — If TypeScript
   ```bash
   pnpm tsc --noEmit 2>&1 | tail -20
   ```

4. **Manual trace** — Re-trace the bug flow mentally to confirm the fix addresses the root cause

5. **Regression check** — Does the fix break anything else? Check callers of modified functions.

## 11. Close Task

```bash
bd close <task-id>
```

## 12. Report Completion

```markdown
## BUG FIX COMPLETE

**Task:** <task-id> - Fix: <title> [`bug`]
**Severity:** <Critical/Moderate/Minor>

### Bug Summary
- **Symptom:** <what was observed>
- **Root Cause:** <the actual cause>
- **Fix:** <what was changed and why>

### Changes
- `<file:line>`: <what changed>
- `<file:line>`: <what changed>

### Related Issues Fixed
- `<file:line>`: <same pattern fixed> (or "None found")

### Verification
- [x] <verification step>
- [x] <verification step>

### Confidence
<High/Medium/Low> — <brief justification>

Task closed in Beads.
```
