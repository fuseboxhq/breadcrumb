# Research: Claude Code Project-Level Skills and Commands

**Date:** 2026-02-17
**Domain:** Claude Code CLI — Skills, Slash Commands, Context Pre-loading
**Overall Confidence:** HIGH (sourced directly from official docs at code.claude.com)

---

## TL;DR

Claude Code skills are markdown files (or directories with a `SKILL.md`) stored in `.claude/skills/` or `.claude/commands/`. They are invoked interactively with `/skill-name` and accept positional arguments via `$ARGUMENTS`. There is no `--skill` flag to invoke a skill from the CLI; the closest equivalent is passing the skill invocation as an initial prompt string (`claude "/skill-name arg1 arg2"`) or piping context into a headless `-p` run. Screenshots/images cannot be piped via stdin; reference them by file path in the prompt.

---

## File Format

### Option A: Simple command file (legacy, still supported)

A single markdown file at `.claude/commands/skill-name.md` or `.claude/skills/skill-name/SKILL.md`.

```yaml
---
name: fix-issue
description: Fix a GitHub issue by number. Use when asked to fix, implement, or resolve a GitHub issue.
argument-hint: "[issue-number]"
disable-model-invocation: true
allowed-tools: Read, Edit, Bash(gh *)
---

Fix GitHub issue $ARGUMENTS following our coding standards.

1. Read the issue: `gh issue view $ARGUMENTS`
2. Understand the requirements
3. Implement the fix
4. Write tests
5. Create a commit
```

### Option B: Skill directory (recommended — supports supporting files)

```
.claude/skills/fix-issue/
├── SKILL.md           # Required — main instructions
├── reference.md       # Optional — detailed docs loaded on demand
└── scripts/
    └── validate.sh    # Optional — scripts Claude can execute
```

### Frontmatter fields (all optional except as noted)

| Field | Required | Description |
|-------|----------|-------------|
| `name` | No | Slash command name. Defaults to directory/file name. Lowercase, hyphens, max 64 chars. |
| `description` | Recommended | When-to-use guidance. Claude uses this for auto-invocation decisions. |
| `argument-hint` | No | Shown in autocomplete. E.g. `[issue-number]` or `[filename] [format]`. |
| `disable-model-invocation` | No | `true` = user-only trigger, hidden from Claude's context. Use for deploy/commit skills. |
| `user-invocable` | No | `false` = Claude-only, hidden from `/` menu. Use for background reference skills. |
| `allowed-tools` | No | Tools Claude can use without per-call permission when this skill is active. |
| `model` | No | Model to use when this skill is active. |
| `context` | No | `fork` = run in isolated subagent, not main conversation. |
| `agent` | No | Subagent type when `context: fork`. Options: `Explore`, `Plan`, `general-purpose`, or any name from `.claude/agents/`. |
| `hooks` | No | Hooks scoped to this skill's lifecycle. |

---

## Invocation

### Interactive (primary method)

```
/skill-name
/skill-name arg1 arg2
/fix-issue 123
/migrate-component SearchBar React Vue
```

### Argument substitution variables

| Variable | Description |
|----------|-------------|
| `$ARGUMENTS` | All arguments as a single string |
| `$ARGUMENTS[0]`, `$ARGUMENTS[1]` | Positional by 0-based index |
| `$0`, `$1`, `$2` | Shorthand for positional |
| `${CLAUDE_SESSION_ID}` | Current session UUID |

If `$ARGUMENTS` is absent from skill content but the user passes arguments, Claude Code appends `ARGUMENTS: <value>` to the end automatically.

### Dynamic context injection via shell commands

Use backtick-wrapped commands prefixed with `!` — they execute before Claude sees the prompt:

```yaml
---
name: pr-summary
description: Summarize changes in a pull request
context: fork
agent: Explore
allowed-tools: Bash(gh *)
---

## Pull request context
- PR diff: !`gh pr diff`
- PR comments: !`gh pr view --comments`
- Changed files: !`gh pr diff --name-only`

## Your task
Summarize this pull request for the team.
```

This is preprocessing. The shell commands run first; Claude only sees the rendered output, not the `!` syntax.

---

## Programmatic / Non-Interactive Invocation

### There is no `--skill` CLI flag.

The CLI has no dedicated flag like `--skill fix-issue 123`. The workarounds are:

**Option 1: Pass skill invocation as the initial prompt string**

```bash
claude "/fix-issue 123"
```

This opens an interactive REPL with the skill invocation pre-submitted. Claude Code treats the first argument as the initial prompt.

**Option 2: Headless print mode with skill invocation**

```bash
claude -p "/fix-issue 123"
```

This runs non-interactively and exits after completion. Useful for CI/automation.

**Option 3: Pipe context into headless mode**

```bash
cat build-error.txt | claude -p "/debug-error"
# or
git diff | claude -p "Review these changes for issues"
```

Stdin content becomes part of the prompt context in `-p` mode.

**Option 4: Command substitution for inline context**

```bash
claude "/fix-issue 123 Context: $(gh issue view 123)"
```

Limit: `ARG_MAX` (~2MB on macOS). Shell `$()` strips trailing newlines.

**Option 5: Append system prompt to scope behavior**

```bash
claude --append-system-prompt "Always use TypeScript" "/fix-issue 123"
```

---

## Pre-loading Context (Screenshots, Logs, Files)

### Images / Screenshots

**There is no stdin pipe for images.** Claude Code cannot accept image data via stdin or `claude -p`.

Supported methods (interactive session only):
1. Drag and drop an image into the terminal window
2. Copy image and paste with `Ctrl+V` (not `Cmd+V`) in the interactive REPL
3. Pass the file path in the prompt: `"Analyze this screenshot: /path/to/screenshot.png"`

For non-interactive/spawned invocations: pass the absolute file path in the prompt string.

```bash
claude "Here is a screenshot of the error: /tmp/error-screenshot.png. What's causing it?"
```

Claude Code reads the image from disk when given a path. This is HIGH confidence from official docs.

### Log files and text content

```bash
# Pipe into headless mode
cat /var/log/app.log | claude -p "Find all ERROR-level entries and group by root cause"

# Reference via @ in interactive mode
# > Analyze @/path/to/build-error.txt
```

### Files and directories (@ syntax, interactive only)

In the interactive REPL, prefix file paths with `@` to include content inline:

```
> Explain the logic in @src/auth/login.ts
> What's the structure of @src/components?
```

This is not available in `-p` (headless) mode. Use piped stdin or path references in the prompt string instead.

### Pre-populate context before spawning

**Using `--add-dir`**: Add extra working directories Claude has access to.

```bash
claude --add-dir ../shared-lib --add-dir ../packages/api "/fix-issue 123"
```

Skills defined in `.claude/skills/` within `--add-dir` directories are also loaded automatically.

**Using `--append-system-prompt-file`** (print mode only): Load extra instructions from a file.

```bash
claude -p --append-system-prompt-file ./context/current-sprint.txt "/review-pr"
```

---

## Key CLI Flags for Automation

```bash
claude -p "query"                          # Headless, exits after response
claude -p --output-format json "query"     # JSON output for scripting
claude -p --output-format stream-json "q"  # Streaming JSON
claude --continue -p "query"               # Resume last session, headless
claude --resume session-name -p "query"    # Resume named session, headless
claude --permission-mode plan -p "query"   # Read-only planning mode
claude --append-system-prompt "..." "q"    # Add context to system prompt
claude --max-turns 5 -p "query"            # Limit agentic turns (CI use)
claude --max-budget-usd 2.00 -p "query"    # Spending cap
claude --disable-slash-commands "query"    # Disable all skills for session
claude --dangerously-skip-permissions "q"  # No approval prompts (CI only)
```

---

## Skill Storage Locations

| Location | Path | Scope |
|----------|------|-------|
| Personal | `~/.claude/skills/<name>/SKILL.md` | All projects |
| Project | `.claude/skills/<name>/SKILL.md` | This project only |
| Legacy (still works) | `.claude/commands/<name>.md` | This project only |
| Plugin | `<plugin>/skills/<name>/SKILL.md` | Where plugin enabled |

When skill names conflict: enterprise > personal > project. Plugin skills are namespaced `plugin-name:skill-name`.

Monorepo support: Claude Code auto-discovers skills from nested `.claude/skills/` directories when you're editing files in subdirectories.

---

## Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| Argument parsing in skill | `$ARGUMENTS[N]` / `$N` substitutions | Built-in, no shell scripting needed |
| Pre-fetching external data | `!` backtick syntax in SKILL.md | Runs before Claude sees prompt, avoids tool roundtrip |
| CI/automation loop | `claude -p --output-format json` | Structured output parseable without regex |
| Expensive skill triggering too often | `disable-model-invocation: true` | Prevents Claude from auto-loading it |
| Skills flooding context | `user-invocable: false` + lean descriptions | Controls what goes into context budget |

---

## Pitfalls

### Pitfall: Skills exceeding context budget
**What happens:** If you have many skills, their descriptions may exceed the 2% context window budget (fallback: 16,000 chars). Skills beyond the budget are silently excluded — Claude won't know they exist.
**Avoid by:** Keep descriptions short and specific. Check with `/context`. Override with `SLASH_COMMAND_TOOL_CHAR_BUDGET` env var.

### Pitfall: `context: fork` with reference-only content
**What happens:** A skill with `context: fork` runs in an isolated subagent with no conversation history. If the skill only contains reference guidelines (not a task), the subagent gets instructions but nothing to do and returns empty output.
**Avoid by:** Only use `context: fork` for skills with explicit actionable tasks, not passive guidelines.

### Pitfall: Assuming `/skill-name` works in `-p` headless mode
**What happens:** There are reports that slash command invocation syntax in the initial prompt may not reliably trigger the skill lookup in all versions of the CLI in `-p` mode. Behavior may depend on CLI version.
**Avoid by:** Test the specific invocation style (`claude -p "/fix-issue 123"`) in your target environment before relying on it in CI.

### Pitfall: Image pre-loading via stdin
**What happens:** `cat screenshot.png | claude -p "..."` does not work. Images passed as raw bytes to stdin are not processed.
**Avoid by:** Pass the absolute file path in the prompt string instead.

### Pitfall: Skills vs Commands name conflict
**What happens:** If both `.claude/commands/review.md` and `.claude/skills/review/SKILL.md` exist, the skill takes precedence.
**Avoid by:** After migrating to skills format, delete the old `.claude/commands/` file.

---

## Open Questions

1. **Does `/skill-name` in the initial prompt reliably trigger skill invocation in `-p` mode?** The official docs show `claude "/fix-issue 123"` syntax in examples but do not explicitly confirm this works non-interactively. Testing required.

2. **`--input-format stream-json`**: The CLI supports `--input-format stream-json` for feeding structured message streams into Claude. The exact format for injecting pre-rendered image messages this way (as the Agent SDK supports) is not documented in the CLI reference — may require the SDK, not the CLI.

---

## Sources

**HIGH confidence (official docs, fetched 2026-02-17):**
- [Claude Code Skills documentation](https://code.claude.com/docs/en/slash-commands) — primary source for file format, frontmatter, argument substitution, `!` backtick injection
- [Claude Code CLI reference](https://code.claude.com/docs/en/cli-reference) — all CLI flags
- [Claude Code Common Workflows](https://code.claude.com/docs/en/common-workflows) — image handling, pipe patterns, @ references

**MEDIUM confidence (verified via GitHub issue):**
- [Issue #6009 — Pipe stdin to interactive session](https://github.com/anthropics/claude-code/issues/6009) — Closed as "Not Planned" Jan 2026; command substitution workaround confirmed

**LOW confidence (not independently verified):**
- Whether `claude -p "/skill-name"` reliably invokes the skill vs. treating it as a literal string — needs local testing
