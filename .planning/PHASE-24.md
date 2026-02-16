# Phase 24: Git Integration & Diff Viewer

**Status:** not_started
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

Run `/bc:plan PHASE-24` to research this phase and populate this section.

## Recommended Approach

**Backend:** Create a `GitService` in `desktop/src/main/services/` that shells out to `git log` and `git diff` with structured output formats (`--format`, `--stat`, `--patch`). Parse commit messages with regex to match `PHASE-\d+` and known Beads task ID patterns. Expose via IPC handlers.

**Store:** New `gitStore.ts` Zustand store caching commit lists per phase/task, with lazy loading and pagination for large histories.

**UI:** Add a "Commits" expandable section to each phase row in the pipeline. When expanded, show compact commit rows (hash, message, author, time). Clicking a commit shows the diff summary, clicking further drills into full syntax-highlighted diff. For syntax highlighting, evaluate `react-diff-viewer` or a lightweight custom solution using `shiki` or `prism`.

## Tasks

| ID | Title | Status | Complexity |
|----|-------|--------|------------|
| - | No tasks yet | - | - |

Run `/bc:plan PHASE-24` to break down this phase into tasks.

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Commit linking | Automatic via commit message parsing | Commits already contain phase/task IDs — no manual effort needed |
| Diff viewer | Summary + drill-down to full | Compact by default, rich when needed — fits narrow panel |
| UI location | Inline in planning panel | No new panels — consistent with existing dashboard flow |
| Project scope | Selected project only | Matches current panel architecture, avoids cross-repo complexity |
| Git access | Shell out to `git` CLI | Reliable, no native module dependencies, works everywhere |

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

Run `/bc:plan PHASE-24` to research and populate sources.
