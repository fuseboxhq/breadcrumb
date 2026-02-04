---
name: doctor
description: Diagnose and repair Breadcrumb + Beads setup issues
allowed-tools:
  - Bash
  - Read
  - Glob
---

# Breadcrumb Doctor

Run a comprehensive health check on the Breadcrumb and Beads setup. Report results and suggest fixes.

## Steps

### 1. Git Repository

Check if a git repository exists:
```bash
git rev-parse --git-dir 2>/dev/null
```

If missing: **FAIL** — "No git repository. Run `/bc:init` to fix."

Check for commits:
```bash
git rev-parse HEAD 2>/dev/null
```

If no commits: **WARN** — "No commits yet. Run `/bc:init` to create initial commit."

### 2. Beads Database

Check `.beads/beads.db` exists:
```bash
ls .beads/beads.db 2>/dev/null
```

If missing: **FAIL** — "Beads not initialized. Run `/bc:init` to fix."

If present, run a quick Beads health probe:
```bash
bd ready 2>&1
```

Check the output for warnings:
- If contains "No git repository" → **WARN** — "Beads git integration broken"
- If contains "Error" or "error" → **WARN** — report the error
- If clean → **OK**

### 3. Git Hooks

Check if Beads hooks are installed by looking for the pre-commit hook:
```bash
ls .git/hooks/pre-commit 2>/dev/null
```

If missing: **WARN** — "Git hooks not installed. Fix: `bd hooks install`"

### 4. Merge Driver

Check merge driver is configured:
```bash
git config merge.beads.driver 2>/dev/null
```

If not configured: **WARN** — "Merge driver not configured. Fix: `git config merge.beads.driver \"bd merge %A %O %A %B\"`"

### 5. Planning Directory

Check `.planning/` exists:
```bash
ls .planning/ 2>/dev/null
```

If missing: **WARN** — "Planning directory not found. Run `/bc:init` to fix."

Check `STATE.md` exists:
```bash
ls .planning/STATE.md 2>/dev/null
```

If missing: **WARN** — "STATE.md not found. Run `/bc:init` to fix."

### 5.5. Quick Tasks Epic

Check if the Quick Tasks epic exists and is active:
```bash
bd list --label quick-tasks-epic --limit 1 2>/dev/null
```

**If no results:** **INFO** — "Quick Tasks epic not found. Will be created on first use or re-run `/bc:init`."

**If found**, extract the epic ID and check its status:
```bash
bd show <epic-id>
```

If the status is not `in_progress`: **WARN** — "Quick Tasks epic is not active. Child tasks may not appear in `bd ready`. Fix: `bd update <epic-id> --status in_progress`"

If status is `in_progress`: **OK**

### 6. Breadcrumb Daemon

Check daemon health:
```bash
curl -s --max-time 2 http://localhost:9999/__daemon/health
```

If not running: **INFO** — "Breadcrumb daemon not running. Run `/bc:init` to start."

### 7. Project Registration

If daemon is running, check this project is registered:
```bash
curl -s http://localhost:9999/api/projects 2>/dev/null
```

Check if current directory appears in the response.

If not registered: **WARN** — "Project not registered with daemon. Run `/bc:init` to register."

### 8. Beads CLI Version

Check Beads CLI version:
```bash
bd --version 2>/dev/null || bd version 2>/dev/null
```

If available, report version. If outdated or erroring: **WARN** — "Beads CLI may need updating."

### 9. Claude Code Hooks

Check that hook scripts exist in `~/.breadcrumb/hooks/`:

```bash
ls ~/.breadcrumb/hooks/bc-statusline.cjs ~/.breadcrumb/hooks/bc-session-start.cjs ~/.breadcrumb/hooks/bc-session-end.cjs ~/.breadcrumb/hooks/bc-bash-guard.cjs 2>/dev/null
```

For each missing file: **WARN** — "Hook [name] missing. Run `/bc:update` to reinstall."

### 10. Claude Code Settings

Read `~/.claude/settings.json` and check:

- Does `hooks.SessionStart` contain a `bc-session-start` entry? If not: **WARN**
- Does `hooks.Stop` contain a `bc-session-end` entry? If not: **WARN**
- Does `hooks.PreToolUse` contain a `bc-bash-guard` entry? If not: **WARN**
- Does top-level `statusLine` reference `bc-statusline`? If not: **WARN**
- Does `permissions.allow` contain `Bash(bd:*)`? If not: **WARN**

For missing entries: "Run `/bc:init` to configure hooks and permissions."

### 11. Report

Display a summary:

```
Breadcrumb Doctor

  Git repository:      [OK / FAIL]
  Git commits:         [OK / WARN: no commits]
  Beads database:      [OK / FAIL]
  Beads health:        [OK / WARN: issues detected]
  Beads CLI version:   [OK: vX.X.X / WARN]
  Git hooks:           [OK / WARN: not installed]
  Merge driver:        [OK / WARN: not configured]
  Planning directory:  [OK / WARN: missing]
  STATE.md:            [OK / WARN: missing]
  Quick Tasks epic:    [OK / INFO: not created / WARN: not active]
  Daemon:              [OK / INFO: not running]
  Project registered:  [OK / WARN: not registered]
  Hook scripts:        [OK / WARN: missing]
  Settings.json:       [OK / WARN: incomplete]
```

If any FAIL or WARN results:
```
To fix most issues automatically, run: /bc:init
```
