# Phase 22: Roadmap Command

**Status:** not_started
**Beads Epic:** breadcrumb-zrg
**Created:** 2026-02-14

## Objective

Introduce `/bc:roadmap` — a high-level project planning command that creates multiple placeholder phases from a single guided conversation. Instead of creating phases one at a time with `/bc:new-phase`, users describe their full project vision and the command breaks it into an ordered sequence of phases with titles, objectives, rough scope, and auto-detected dependencies. This gives a birds-eye view of the entire project arc that can be expanded later with `/bc:plan`.

Additionally, generate an optional `ROADMAP.md` file in `.planning/` that provides a visual summary of the full phase pipeline — but Breadcrumb should work fine without it (phase-by-phase planning remains the core workflow).

## Scope

**In scope:**
- New `/bc:roadmap` skill with guided conversation flow
- AI-driven phase breakdown: user describes vision, command suggests phases
- Each placeholder phase gets: title, 1-2 sentence objective, rough in/out-of-scope bullets
- Auto-detect phase ordering/dependencies from the conversation context
- Create all PHASE-XX.md files with `not_started` status
- Create corresponding Beads epics for each phase
- Generate `.planning/ROADMAP.md` with the full pipeline view (optional best-practice artifact)
- Update STATE.md with all new phases
- Git commit all created files

**Out of scope:**
- Detailed task breakdown within phases (that's `/bc:plan`)
- Research or implementation planning (that's `/bc:plan` + `/bc:research`)
- Modifying the Breadcrumb panel UI (that's the next phase)
- Making ROADMAP.md a hard requirement — Breadcrumb works without it
- Changing existing `/bc:new-phase` or `/bc:plan` commands

## Constraints

- Must follow existing Breadcrumb skill patterns (see other `/bc:*` skills in userSettings)
- Must integrate with Beads CLI (`bd`) for epic creation
- Phase numbering must auto-increment from the highest existing PHASE-XX
- ROADMAP.md should be a summary view, not a replacement for individual PHASE-XX.md files
- Guided conversation should use AskUserQuestion for structured input

## Recommended Approach

Run `/bc:plan PHASE-22` to research and define the approach.

## Tasks

| ID | Title | Status | Complexity |
|----|-------|--------|------------|
| - | No tasks yet | - | - |

Run `/bc:plan PHASE-22` to break down this phase into tasks.

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Command name | `/bc:roadmap` | Intuitive engineering term, contrasts with `/bc:plan` |
| Conversation style | Guided | Ask about vision, suggest phases, user confirms/edits |
| Phase detail level | Title + objective + rough scope | Enough to set boundaries, not so much it's premature |
| Dependencies | Auto-detect from conversation | Infer ordering, user confirms before creation |
| ROADMAP.md | Optional best-practice | Generated but not required for Breadcrumb to function |

## Completion Criteria

- [ ] `/bc:roadmap` skill exists and can be invoked
- [ ] Guided conversation captures project vision and suggests phase breakdown
- [ ] All phases created with PHASE-XX.md files, Beads epics, and STATE.md entries
- [ ] Phase dependencies auto-detected and reflected in phase files
- [ ] ROADMAP.md generated with pipeline view of all phases
- [ ] Existing `/bc:plan` and `/bc:new-phase` workflows unaffected
