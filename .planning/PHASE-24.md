# Phase 24: Git Integration & Diff Viewer

**Status:** in_progress
**Beads Epic:** breadcrumb-c9v
**Created:** 2026-02-14

## Objective

Integrate git history into the Breadcrumb planning panel so users can see exactly what code changed for any phase or task. Automatically link commits to phases and tasks by parsing commit messages for phase IDs (`PHASE-XX`) and task IDs (`breadcrumb-xxx.N`), display a commit history per phase/task, and provide a rich diff viewer with summary and full syntax-highlighted drill-down — all within the existing right panel.

## Scope

**In scope:**
- Backend git service: parse git log, extract commit metadata, auto-link commits to phases/tasks by matching IDs in commit messages
- New IPC channels for git data (commit list per phase, commit list per task, diff for a commit)
- Commit history section in the planning panel: expandable per phase and per task
- Commit summary view: files changed, insertions/deletions counts, author, relative timestamp
- Full diff viewer: syntax-highlighted unified diff with expandable hunks, file tree navigation
- Works for the selected project in the portfolio header
- Design tokens and polish consistent with PHASE-21/23 aesthetic

**Out of scope:**
- Cross-project git aggregation (only the selected project)
- Git operations (push, pull, commit, branch management — this is read-only)
- Manual commit-to-task linking UI (automatic parsing only for now)
- Blame/annotation view
- PR/merge request integration
- Changes to the backend PlanningService markdown parsing
- Modifying the Beads CLI or database schema

## Constraints

- Frontend design skill active — follow design thinking process for UI tasks
- Must work within the existing right panel architecture (~400px width)
- Git operations must be async and non-blocking (large repos can have thousands of commits)
- Diff rendering must handle large files gracefully (truncation, lazy loading)
- Follow existing patterns: Electron IPC via preload bridge, Zustand stores, Tailwind classes
- Commit message parsing must be robust — handle various formats (with/without Co-Authored-By, multi-line messages, etc.)
- Apply PHASE-21 design tokens (teal accents, Inter font, softened backgrounds)

## Research Summary

**Overall Confidence:** HIGH

Extend the existing `GitService` (`desktop/src/main/git/GitService.ts`) with `getCommitLog()` and `getCommitDiff()` methods using `git log --format` and `git diff`. Parse commit messages with regex to match `PHASE-\d+` and Beads task ID patterns (e.g. `breadcrumb-rjx.3`). Use `@git-diff-view/react` for the diff viewer — 40kb bundle, 280ms render on 15k-line diffs, built-in syntax highlighting with dark mode.

### Recommended Stack

| Library | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| @git-diff-view/react | 0.0.39+ | Syntax-highlighted diff rendering | HIGH |
| @git-diff-view/core | 0.0.39+ | Diff parsing (built into git-diff-view) | HIGH |

### Key Patterns

**GitService extension:** Add `getCommitLog(cwd, opts)` and `getCommitDiff(cwd, hash)` to the existing singleton class. Use `execFileAsync("git", [...args], { cwd, timeout })` matching the existing pattern. Return structured data, never raw strings.

**IPC pattern:** Add `GIT_LOG: "git:log"`, `GIT_DIFF: "git:diff"`, `GIT_COMMIT_STATS: "git:commit-stats"` to `IPC_CHANNELS`. Register handlers in `handlers.ts` or a new `gitIpc.ts`. Expose via preload bridge with typed interface.

**Commit linking:** Parse the first line + body of each commit message for:
- `PHASE-\d+` → link to phase
- `[a-z]+-[a-z0-9]+\.\d+` → link to Beads task (e.g. `breadcrumb-c9v.3`)
- `breadcrumb-[a-z0-9]+` → link to Beads epic

**Store pattern:** New `gitStore.ts` with immer middleware, keyed by `projectPath`. Cache commit lists per phase/task. Paginate with `--skip` and `--max-count` for large repos.

### Design Guidance

The `frontend-design` skill will be active during execution of UI tasks in this phase. It provides guidelines for typography, color, motion, spatial composition, and avoiding generic aesthetics.

### Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| Diff parsing | @git-diff-view/core's built-in parser | Handles edge cases (binary files, renames, mode changes) |
| Syntax highlighting in diffs | @git-diff-view/react with lowlight | Built-in, 40kb, dark mode ready |
| Git log parsing | `git log --format` with delimiter-separated fields | Structured output, no ambiguous parsing |
| Relative timestamps | Small helper or `Intl.RelativeTimeFormat` | Don't install moment/dayjs for one feature |

### Pitfalls

- **Unbounded git log**: Always pass `--max-count` to avoid loading 10k+ commits. Paginate with `--skip`.
- **Large diffs**: Some commits touch hundreds of files. Truncate file list and show "N more files" with load-more. Limit individual file diffs to 5000 lines.
- **Binary files in diffs**: `@git-diff-view/react` handles these gracefully, but filter them out of stats.
- **Commit message formats**: Some commits have no body, some have Co-Authored-By trailers, some reference multiple phases. Parse the full message, not just the first line.
- **Git not available**: Handle the case where `git` isn't in PATH (unlikely in an IDE but defensive).

## Tasks

| ID | Title | Status | Complexity | Dependencies |
|----|-------|--------|------------|--------------|
| breadcrumb-c9v.1 | Build GitService commit log & diff methods | done | High | - |
| breadcrumb-c9v.2 | Add IPC channels & preload bridge for git data | open | Medium | c9v.1 |
| breadcrumb-c9v.3 | Create gitStore with commit caching & phase/task linking | open | High | c9v.2 |
| breadcrumb-c9v.4 | Build commit history UI in phase pipeline | open | High | c9v.3 |
| breadcrumb-c9v.5 | Build diff viewer component with @git-diff-view/react | open | High | c9v.4 |
| breadcrumb-c9v.6 | Polish: loading states, empty states, large diff handling | open | Medium | c9v.5 |

### Task Details

**c9v.1 — Build GitService commit log & diff methods** (High)
Extend the existing `GitService` class in `desktop/src/main/git/GitService.ts`:
- `getCommitLog(cwd, options)` — runs `git log --format="DELIM%H|%an|%ae|%aI|%s|%b"` with `--max-count` and `--skip` for pagination. Returns `CommitInfo[]` with hash, author, email, date, subject, body, and parsed phase/task links.
- `getCommitDiff(cwd, hash)` — runs `git diff hash^..hash` to get the full unified diff as a string. Also runs `git diff --stat hash^..hash` for the summary (files changed, insertions, deletions).
- `getCommitStats(cwd, hash)` — runs `git show --stat --format="" hash` for file-level stats.
- Commit message parsing: extract `PHASE-\d+` and Beads task ID patterns from subject + body. Return as `phaseLinks: string[]` and `taskLinks: string[]`.
- Handle edge cases: initial commit (no parent), merge commits, empty diffs.
- Types: `CommitInfo`, `CommitDiff`, `CommitStats` exported from the module.

**c9v.2 — Add IPC channels & preload bridge for git data** (Medium)
Wire the GitService methods through the Electron IPC layer:
- Add to `IPC_CHANNELS`: `GIT_LOG: "git:log"`, `GIT_DIFF: "git:diff"`, `GIT_COMMIT_STATS: "git:commit-stats"`
- Register handlers in `handlers.ts` (or new `gitIpc.ts` if cleaner) following the `{ success, data, error }` pattern with `validatePath()`.
- Add to preload `BreadcrumbAPI` interface: `getGitLog(projectPath, options)`, `getGitDiff(projectPath, hash)`, `getGitCommitStats(projectPath, hash)`.
- Type the options: `{ maxCount?: number, skip?: number, grep?: string }` for log filtering.

**c9v.3 — Create gitStore with commit caching & phase/task linking** (High)
New Zustand store `desktop/src/renderer/store/gitStore.ts`:
- State: `commits` keyed by projectPath → `{ allCommits: CommitInfo[], byPhase: Record<phaseId, CommitInfo[]>, byTask: Record<taskId, CommitInfo[]>, loading, error, hasMore }`.
- Actions: `fetchCommits(projectPath, options)`, `fetchMoreCommits(projectPath)` for pagination, `fetchDiff(projectPath, hash)`.
- On fetch, auto-categorize commits by parsing their `phaseLinks` and `taskLinks` into the `byPhase` and `byTask` indices.
- Cache diffs keyed by commit hash (avoid re-fetching).
- Selectors: `usePhaseCommits(projectPath, phaseId)`, `useTaskCommits(projectPath, taskId)`, `useCommitDiff(projectPath, hash)`.

**c9v.4 — Build commit history UI in phase pipeline** (High)
Add commit history to the planning panel (frontend-design skill active):
- In `PhasePipeline`, show a small commit count badge next to the task count (e.g. "3 commits").
- When a phase is expanded, add a "Commits" tab/section below the task groups.
- Each commit row: short hash (monospace, teal), subject (truncated), author, relative time.
- Click a commit to select it for the diff viewer.
- In `PhaseTasksExpanded`, each task row optionally shows its linked commit count. Clicking expands to show task-specific commits.
- Pagination: "Load more" button at the bottom of the commit list.
- Auto-fetch commits when the planning panel mounts for the selected project.

**c9v.5 — Build diff viewer component with @git-diff-view/react** (High)
Create a `DiffViewer` component (frontend-design skill active):
- Install `@git-diff-view/react` and `@git-diff-view/core`.
- **Summary view**: File tree showing changed files with +/- counts. Each file has an icon (added/modified/deleted), path, and stats.
- **Full diff view**: Clicking a file scrolls to its syntax-highlighted unified diff. Use `@git-diff-view/react`'s `DiffView` component with dark theme configuration matching PHASE-21 tokens.
- **Layout**: The diff viewer takes over the panel content area (replaces the pipeline view temporarily). Back button to return to the pipeline.
- **Theme**: Configure `@git-diff-view/react` with custom CSS variables to match the Breadcrumb dark palette (background, line colors, syntax colors).
- Handle binary files (show "Binary file" badge, no diff).

**c9v.6 — Polish: loading states, empty states, large diff handling** (Medium)
Final polish pass (frontend-design skill active):
- **Loading states**: Skeleton placeholders for commit list and diff viewer.
- **Empty states**: "No commits found for this phase" with specific messaging. "No linked commits" for tasks with no matching IDs in commit messages.
- **Large diff handling**: Truncate files with 5000+ lines ("File too large — showing first 5000 lines"). Show "N more files" when a commit touches 50+ files.
- **Transitions**: Smooth panel switch between pipeline and diff view (slide or fade).
- **Accessibility**: Keyboard navigation in commit list and file tree. Focus management when switching views.
- **Performance**: Verify pagination works for repos with 1000+ commits. Profile diff rendering on large commits.

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Commit linking | Automatic via commit message regex | Commits already contain phase/task IDs — no manual effort needed |
| Diff library | @git-diff-view/react | 40kb bundle, 280ms render on 15k-line diffs, built-in syntax highlighting, dark mode |
| Diff parsing | @git-diff-view/core built-in | Handles edge cases (binary, renames, mode changes) — don't hand-roll |
| Git access | Extend existing GitService | Already has execFileAsync pattern, singleton, timeouts |
| Pagination | --max-count + --skip | Standard git log pagination, prevents unbounded queries |
| Store | New gitStore.ts with immer | Matches existing pattern (planningStore), keeps git state separate |
| Diff viewer layout | Takes over panel content | Diff needs horizontal space — can't share with pipeline |
| Timestamps | Intl.RelativeTimeFormat | Native API, no library dependency |

## Completion Criteria

- [ ] Commits automatically linked to phases and tasks by parsing commit messages
- [ ] Each phase in the pipeline shows a commit count and expandable commit history
- [ ] Each task in the expanded phase view shows its linked commits
- [ ] Commit summary shows: hash, message, author, timestamp, files changed, +/- lines
- [ ] Clicking a commit shows full syntax-highlighted diff with file tree
- [ ] Diff viewer handles large files gracefully (truncation, scroll)
- [ ] Performance acceptable for repos with 1000+ commits (pagination/lazy loading)
- [ ] Design is cohesive with PHASE-21/23 polish

## Sources

**HIGH confidence:**
- Existing GitService code (direct analysis — `desktop/src/main/git/GitService.ts`)
- Existing IPC patterns (direct analysis — `handlers.ts`, `planningIpc.ts`, `preload/index.ts`)
- Existing PlanningPanel architecture (direct analysis — PHASE-23 implementation)
- @git-diff-view/react benchmarks: 280ms / 40kb / 28MB memory (web research, Dec 2025)

**MEDIUM confidence:**
- @git-diff-view/react dark theme customization (docs + examples, not directly tested)
- Git log --format delimiter parsing (standard git feature, well-documented)
