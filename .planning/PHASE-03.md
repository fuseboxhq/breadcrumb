# Phase 03: Universal Quick Task Tracking

**Status:** in_progress
**Beads Epic:** breadcrumb-d8v
**Created:** 2026-02-04

## Objective

Make ALL work done in Claude Code tracked through Beads — even small ad-hoc requests like "change the font on page X". Introduce a persistent Quick Tasks epic that collects all non-phase work, update SKILL.md to enforce automatic task creation before any code change, improve the `/bc:quick` command with auto-titling and labels, and add a sidebar UI section showing quick task history.

## Scope

**In scope:**
- Persistent "Quick Tasks" epic in Beads with label-based identification
- SKILL.md behavioral instruction for automatic task tracking
- Improved `/bc:quick` command (epic parenting, auto-titling, labels)
- Sidebar UI section pinned below phases showing recent quick tasks
- `/bc:init` and `/bc:doctor` updates for epic management

**Out of scope:**
- Dedicated quick tasks detail view (sidebar only)
- Task editing/updating from the sidebar UI
- Analytics or reporting on quick task history
- Changes to `/bc:execute` or phase task workflow

## Constraints

- Must not slow down Claude's response time noticeably (<500ms overhead for task creation)
- Must not be bureaucratic — tracking is fully automatic and passive
- Sidebar must work in both expanded and collapsed modes
- Quick Tasks epic must survive across sessions (persistent in Beads DB)
- Init command must be idempotent (no duplicate epics)
- Self-healing: projects initialized before this feature get the epic on first use

## Research Summary

**Overall Confidence:** HIGH

Beads CLI natively supports everything needed:
- `bd create --type epic --labels quick-tasks-epic` — single-command epic creation
- `bd list --label quick-tasks-epic --limit 1` — label-based epic lookup
- `bd create --parent <id> --labels <category>` — child task with labels
- `bd list --parent <id> --all` — list children including closed

Frontend already has all data: `useIssues()` fetches all issues with labels and parentId. SSE file watchers auto-invalidate queries when `.beads/` changes. No new API endpoints needed.

## Tasks

| ID | Title | Status | Complexity | Dependencies |
|----|-------|--------|------------|--------------|
| d8v.1 | Add Quick Tasks epic to /bc:init | open | Low | - |
| d8v.2 | Add "Always Track Work" section to SKILL.md | open | Medium | d8v.1 |
| d8v.3 | Improve /bc:quick command | open | Medium | d8v.1 |
| d8v.4 | Create QuickTaskList sidebar component | open | Medium | d8v.1 |
| d8v.5 | Update Sidebar layout with Quick Tasks section | open | Low | d8v.4 |
| d8v.6 | Wire quick tasks data in App.tsx | open | Low | d8v.5 |
| d8v.7 | Add Quick Tasks epic check to /bc:doctor | open | Low | - |

### Task Details

**d8v.1 — Add Quick Tasks epic to /bc:init**
- Add step 3.5 to `commands/bc/init.md` for idempotent epic creation
- Update Step 8 report to mention Quick Tasks epic
- **Done when**: `/bc:init` creates the epic with `quick-tasks-epic` label or skips if exists

**d8v.2 — Add "Always Track Work" section to SKILL.md**
- Add new section to `skills/breadcrumb/SKILL.md` after Commands, before Philosophy
- Instructions for when to auto-track, how to auto-track, auto-title examples, exclusions
- **Done when**: SKILL.md contains the behavioral instruction

**d8v.3 — Improve /bc:quick command**
- Rewrite `commands/bc/quick.md` with Quick Tasks epic parenting, auto-titling, labels
- Load recent quick tasks for context
- **Done when**: `/bc:quick` creates tasks under the Quick Tasks epic with labels

**d8v.4 — Create QuickTaskList sidebar component**
- New file: `src/components/Sidebar/QuickTaskList.tsx`
- Expanded: last 5 tasks with status dots, titles, relative times
- Collapsed: Zap icon with open count badge
- Add `relativeTime()` helper to `src/lib/taskUtils.ts`
- **Done when**: Component renders in both modes, `pnpm build` passes

**d8v.5 — Update Sidebar layout**
- Modify `src/components/Sidebar/Sidebar.tsx` to accept quickTasks props
- Pin QuickTaskList at bottom with border-t separator
- **Done when**: Quick Tasks section appears below phases in sidebar

**d8v.6 — Wire quick tasks data in App.tsx**
- Derive quick tasks from allIssues using useMemo
- Pass to Sidebar component
- **Done when**: Sidebar shows real quick task data from Beads

**d8v.7 — Add Quick Tasks epic check to /bc:doctor**
- Add step 5.5 to `commands/bc/doctor.md`
- Check epic exists and is in_progress
- **Done when**: `/bc:doctor` reports Quick Tasks epic status

### Dependency Graph

```
d8v.1 (init.md)
├── d8v.2 (SKILL.md)
├── d8v.3 (quick.md)
└── d8v.4 (QuickTaskList.tsx)
      └── d8v.5 (Sidebar.tsx)
            └── d8v.6 (App.tsx)
d8v.7 (doctor.md) — independent
```

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Epic identification | Label `quick-tasks-epic` | Labels survive renames; native `bd list --label` filter |
| Epic creation | `bd create --type epic --labels quick-tasks-epic` | Single command, clean |
| Auto-tracking | SKILL.md behavioral instruction | Zero user effort; Claude creates/closes tasks automatically |
| Task labels | fix, tweak, add, refactor | Lightweight categorization by intent |
| Sidebar data source | Filter from existing `useIssues()` | No new API endpoint needed |
| Sidebar placement | Pinned at bottom, `flex-shrink-0` | Always visible, doesn't crowd phases |

## Completion Criteria

- [ ] Every code change in a Breadcrumb project is automatically tracked as a Beads task
- [ ] Quick tasks live under a persistent "Quick Tasks" epic, separate from phase epics
- [ ] Sidebar shows recent quick tasks with status and relative timestamps
- [ ] `/bc:quick` creates properly categorized tasks with good titles
- [ ] Self-healing: works on projects initialized before this feature
- [ ] `pnpm build` passes with no TypeScript errors
