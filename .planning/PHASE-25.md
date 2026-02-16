# Phase 25: Git Integration Audit & Fix

**Status:** not_started
**Beads Epic:** breadcrumb-6sn
**Created:** 2026-02-14

## Objective

The git commit integration in the Breadcrumb planning panel is fundamentally broken. Phase commit sections only show planning-related commits (e.g. "Create PHASE-24", "Close PHASE-24") because commit linking relies on matching literal `PHASE-XX` in commit messages. But actual implementation commits use Beads task IDs (e.g. `breadcrumb-c9v.5: Diff viewer`) which never mention the phase. This phase fixes the linking pipeline, enriches future commit messages, and adds a full commit history view.

## Scope

**In scope:**
- Audit and fix `GitService.extractPhaseLinks()` to resolve Beads task IDs → parent phase
- Update `gitStore.indexCommits()` to use the improved linking
- Enrich the `/bc:execute` commit workflow to include `PHASE-XX` in commit messages going forward
- Add an "All Commits" view in the planning panel for browsing full project history
- Verify the fix works against the existing commit history (retroactive linking)

**Out of scope:**
- Rewriting or amending old commit messages
- Changes to the DiffViewer component (already fixed separately)
- Git branch management or merge/PR features
- CI/CD integration

## Constraints

- Must work with existing Beads CLI (`bd show <task-id>` to resolve parent epic)
- Must not break the existing `phaseLinks`/`taskLinks` fields on CommitInfo
- The task-to-phase resolution must be cached to avoid repeated `bd` calls
- Follow existing patterns in GitService (execFile-based, async)

## Research Summary

Run `/bc:plan PHASE-25` to research this phase and populate this section.

## Recommended Approach

1. **Fix task→phase mapping**: When `extractTaskLinks` finds task IDs like `breadcrumb-c9v.5`, resolve them to their parent epic using `bd show` or Beads data, then map epic title → phase ID
2. **Cache the mapping**: Build a task-prefix→phase lookup table (e.g. `breadcrumb-c9v` → `PHASE-24`) so only one resolution per epic is needed
3. **Enrich commit messages**: Update the Breadcrumb execute skill to include `[PHASE-XX]` in commit messages
4. **All Commits view**: Add a section/tab in PlanningPanel that shows full `git log` regardless of phase linking

## Tasks

| ID | Title | Status | Complexity |
|----|-------|--------|------------|
| - | No tasks yet | - | - |

Run `/bc:plan PHASE-25` to break down this phase into tasks.

## Technical Decisions

- Task ID resolution will use Beads CLI (`bd show`) rather than parsing `.beads/` files directly, to stay compatible with Beads format changes
- Commit messages will be enriched with `[PHASE-XX]` prefix, not body tags, for visibility and easier regex matching

## Completion Criteria

- [ ] Implementation commits (e.g. `breadcrumb-c9v.5`) correctly appear under their parent phase in the planning panel
- [ ] New commits created via `/bc:execute` include `PHASE-XX` in the message
- [ ] An "All Commits" view exists showing full project git history
- [ ] Existing commit history is retroactively linked (no re-commit needed)
- [ ] Phase commit counts in the pipeline view reflect actual implementation commits
