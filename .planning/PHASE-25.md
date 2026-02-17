# Phase 25: Git Integration Audit & Fix

**Status:** complete
**Beads Epic:** breadcrumb-6sn
**Created:** 2026-02-14
**Completed:** 2026-02-14

## Objective

The git commit integration in the Breadcrumb planning panel is fundamentally broken. Phase commit sections only show planning-related commits (e.g. "Create PHASE-24", "Close PHASE-24") because commit linking relies on matching literal `PHASE-XX` in commit messages. But actual implementation commits use Beads task IDs (e.g. `breadcrumb-c9v.5: Diff viewer`) which never mention the phase. This phase fixes the linking pipeline, enriches future commit messages, and adds a full commit history view.

## Research Summary

**Overall Confidence:** HIGH

The root cause is well-understood and the fix is straightforward. Phase files already contain the Beads epic ID mapping (e.g. `PHASE-24 → breadcrumb-c9v`). Commits contain task IDs like `breadcrumb-c9v.5`. The fix: parse planning files to build a prefix→phase map, then when processing commits, extract the task prefix and look up the phase. No `bd` CLI calls needed at runtime.

### Key Patterns

**Current flow (broken):**
1. `GitService.getCommitLog()` fetches commits
2. `extractPhaseLinks()` matches `/PHASE-\d+/g` in commit message — only finds planning commits
3. `extractTaskLinks()` matches task IDs — but never maps them to phases
4. `gitStore.indexCommits()` uses `commit.phaseLinks` to populate `byPhase` — empty for implementation commits

**Fixed flow:**
1. On startup or when fetching commits, read `.planning/PHASE-*.md` to build `epicPrefix → PHASE-XX` map
2. `GitService.getCommitLog()` accepts the mapping as a parameter
3. After extracting task links, also derive phase links from the task prefix
4. Implementation commits now appear in `byPhase["PHASE-24"]`

**Data available:**
- `.planning/PHASE-24.md` contains `**Beads Epic:** breadcrumb-c9v`
- Commit message `breadcrumb-c9v.5: Build diff viewer` → prefix `breadcrumb-c9v` → `PHASE-24`
- No runtime `bd` calls needed — static file parsing is sufficient

### Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| Calling `bd show` per commit | Parse `.planning/PHASE-*.md` files | Static files, no process spawning, instant |

### Pitfalls

- **Phase file naming inconsistency**: Some files are `PHASE-13-right-panel-layout-overhaul.md` not `PHASE-13.md`. Regex must handle both.
- **Multiple task IDs per commit**: A commit can reference tasks from different epics. Each should add its own phase link.
- **Epic prefix collision**: Won't happen — Beads generates unique prefixes per project.

## Tasks

| ID | Title | Status | Complexity | Dependencies |
|----|-------|--------|------------|--------------|
| breadcrumb-6sn.1 | Build task-prefix→phase mapping from planning files | done | Medium | - |
| breadcrumb-6sn.2 | Fix GitService to resolve task IDs to phase links | done | Medium | breadcrumb-6sn.1 |
| breadcrumb-6sn.3 | Update gitStore indexing with task→phase resolution | done | Low | breadcrumb-6sn.2 |
| breadcrumb-6sn.4 | Enrich bc:execute commit messages with PHASE-XX | done | Low | - |
| breadcrumb-6sn.5 | Add All Commits view to planning panel | done | Medium | - |

### Task Details

**breadcrumb-6sn.1: Build task-prefix→phase mapping from planning files**
- Add a method to GitService (or a new helper) that reads `.planning/PHASE-*.md` files
- Parse each for `**Beads Epic:** <id>` to extract the epic prefix
- Return `Map<string, string>` mapping prefix → phase ID (e.g. `breadcrumb-c9v → PHASE-24`)
- Cache the result per project path
- Handle file naming variants (`PHASE-13.md` vs `PHASE-13-right-panel-layout-overhaul.md`)

**breadcrumb-6sn.2: Fix GitService to resolve task IDs to phase links**
- Modify `getCommitLog()` to accept or lazily build the prefix→phase map
- After `extractTaskLinks()`, for each task ID, extract the prefix (everything before the last `.N`)
- Look up the prefix in the map, and add the resolved phase to `phaseLinks`
- Keep existing `extractPhaseLinks()` for backward compat (explicit PHASE-XX mentions still work)

**breadcrumb-6sn.3: Update gitStore indexing with task→phase resolution**
- The mapping needs to be passed from renderer → main process, or built in the main process
- Since GitService runs in main and `.planning/` is a local directory, GitService can read the files directly
- Verify `indexCommits()` correctly indexes the now-populated `phaseLinks`
- No gitStore changes needed if GitService returns correct `phaseLinks` — just verify

**breadcrumb-6sn.4: Enrich bc:execute commit messages with PHASE-XX**
- Update the `bc:execute` skill to include `[PHASE-XX]` in commit messages
- Format: `breadcrumb-c9v.5: Build diff viewer [PHASE-24]`
- This ensures future commits are findable by both regex patterns
- Does NOT require any desktop app code changes — skill-only change

**breadcrumb-6sn.5: Add All Commits view to planning panel** (frontend-design skill active)
- Add a new section/toggle in PlanningPanel for "All Commits"
- Shows full `git log` chronologically, not filtered by phase
- Clicking a commit opens the diff tab (reuse existing `openDiffTab`)
- Pagination support (reuse `fetchMoreCommits`)

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Mapping source | Parse `.planning/PHASE-*.md` | Static files, no process spawning, instant, already have epic IDs |
| Where to resolve | GitService (main process) | Has filesystem access, runs before renderer sees data |
| Commit message format | `task-id: description [PHASE-XX]` | Bracket suffix is grep-friendly and unobtrusive |
| All Commits UI | Section in PlanningPanel | Reuses existing commit rendering, avoids new tab type |

## Completion Criteria

- [x] Implementation commits (e.g. `breadcrumb-c9v.5`) correctly appear under their parent phase in the planning panel
- [x] New commits created via `/bc:execute` include `PHASE-XX` in the message
- [x] An "All Commits" view exists showing full project git history
- [x] Existing commit history is retroactively linked (no re-commit needed)
- [x] Phase commit counts in the pipeline view reflect actual implementation commits

## Completion Notes

Phase completed on 2026-02-14. All 5 tasks finished.
Fixed the broken git commit→phase linking by building an epicPrefix→phaseId map from planning files and resolving task IDs at query time. Enriched future commit messages with `[PHASE-XX]` suffix. Added a collapsible All Commits chronological view to the planning panel.

## Sources

**HIGH confidence:**
- Direct codebase audit: `GitService.ts`, `gitStore.ts`, `PlanningPanel.tsx`
- Beads CLI output: `bd show`, `bd list` verified task→epic relationships
- Planning file audit: confirmed all PHASE-*.md files contain Beads Epic IDs
