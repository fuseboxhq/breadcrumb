# Phase 22: Roadmap Command

**Status:** complete
**Beads Epic:** breadcrumb-zrg
**Created:** 2026-02-14
**Completed:** 2026-02-14

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

## Research Summary

**Overall Confidence:** HIGH

The roadmap skill is a new markdown file (`~/.claude/commands/bc/roadmap.md`) following the established skill pattern. All 15 existing bc skills use the same structure: YAML frontmatter (name, description, argument-hint, allowed-tools) followed by step-by-step instructions. The new skill reuses existing patterns from `new-phase.md` (guided conversation, PHASE-XX.md creation, Beads epic creation) but extends them to batch-create multiple phases from a single conversation.

### Key Patterns

**Skill file structure:** YAML frontmatter with `name`, `description`, `argument-hint`, `allowed-tools` fields. Body is step-by-step instructions that Claude follows.

**Guided conversation:** Use `AskUserQuestion` with structured options for multi-round input. Pattern established in `new-phase.md` with 2-4 rounds of adaptive questions.

**Phase file creation:** Auto-increment from highest existing `PHASE-XX.md`. Each gets status `not_started`, a Beads epic via `bd create`, and standard section stubs.

**State management:** Read/update `.planning/STATE.md` — append new phases under `## Active Work`, update `Last Updated` date.

### Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| Phase numbering | `ls .planning/PHASE-*.md \| sort -V \| tail -1` | Reliable auto-increment from existing files |
| Epic creation | `bd create "Phase XX: title" -p 0` | Beads CLI handles ID generation |
| Argument parsing | Existing `$ARGUMENTS` pattern | Skills receive args via `$ARGUMENTS` variable |

### Pitfalls

- **Phase numbering collisions**: Must read highest existing phase number *before* creating any new files — don't hardcode starting numbers
- **Conversation scope creep**: The guided conversation should capture vision breadth, not implementation depth — keep phases at title + objective + rough scope level
- **ROADMAP.md staleness**: Make clear it's a snapshot generated at roadmap time, not a live document — individual PHASE-XX.md files are the source of truth

## Tasks

| ID | Title | Status | Complexity | Dependencies |
|----|-------|--------|------------|--------------|
| breadcrumb-zrg.1 | Write the `/bc:roadmap` skill file | done | High | - |
| breadcrumb-zrg.2 | Update `/bc:status` for roadmap awareness | done | Low | zrg.1 |
| breadcrumb-zrg.3 | Cross-reference existing skills for compatibility | done | Low | zrg.1 |
| breadcrumb-zrg.4 | End-to-end validation & polish | done | Medium | zrg.1 |

### Task Details

**zrg.1 — Write the `/bc:roadmap` skill file** (High)
Create `~/.claude/commands/bc/roadmap.md` with complete implementation:
- Frontmatter: name, description, argument-hint (optional project description), allowed-tools (Bash, Write, Read, Edit, Glob, AskUserQuestion, Skill)
- Preflight: verify `.git`, `.beads/`, `.planning/` exist
- Read existing context: STATE.md, PROJECT.md, CODEBASE.md, highest PHASE-XX number
- Guided conversation (3 rounds): vision capture → AI suggests phase breakdown → user reviews/edits/confirms
- Phase generation: auto-number, create PHASE-XX.md files with title, objective, rough scope, constraints
- Beads integration: create an epic per phase via `bd create`
- Dependency detection: infer ordering from conversation, add to phase files
- ROADMAP.md generation: pipeline view with phase titles, objectives, status, dependencies
- State updates: append all new phases to STATE.md
- Git commit all created files
- Success report with next steps

**zrg.2 — Update `/bc:status` for roadmap awareness** (Low)
Modify `~/.claude/commands/bc/status.md` to:
- Check if `.planning/ROADMAP.md` exists
- If present, include a brief "Roadmap" section showing the pipeline overview
- Keep existing status output unchanged

**zrg.3 — Cross-reference existing skills for compatibility** (Low)
Verify that roadmap-generated phases work seamlessly with:
- `/bc:plan` — can plan any roadmap-generated phase
- `/bc:execute` — can execute planned phases
- `/bc:new-phase` — doesn't conflict with auto-numbering
- `/bc:close-phase` — can close roadmap-generated phases
No code changes expected — just verify and document any edge cases.

**zrg.4 — End-to-end validation & polish** (Medium)
Dry-run the complete flow:
- Verify phase numbering logic handles gaps and existing phases
- Verify Beads epic creation succeeds for batch operations
- Verify STATE.md updates are correct (append, don't clobber)
- Verify ROADMAP.md renders cleanly
- Polish conversation flow based on testing
- Fix any issues found

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Command name | `/bc:roadmap` | Intuitive engineering term, contrasts with `/bc:plan` |
| Conversation style | Guided (3 rounds) | Vision → suggest phases → confirm. Enough structure without being bureaucratic |
| Phase detail level | Title + objective + rough scope | Enough to set boundaries, not so much it's premature |
| Dependencies | Auto-detect from conversation | Infer ordering from context, user confirms before creation |
| ROADMAP.md | Optional best-practice | Generated but not required for Breadcrumb to function |
| Skill file location | `~/.claude/commands/bc/roadmap.md` | Follows existing skill pattern |
| Argument handling | Optional project description | `$ARGUMENTS` can provide initial context to skip Round 1 |

## Completion Criteria

- [x] `/bc:roadmap` skill exists and can be invoked
- [x] Guided conversation captures project vision and suggests phase breakdown
- [x] All phases created with PHASE-XX.md files, Beads epics, and STATE.md entries
- [x] Phase dependencies auto-detected and reflected in phase files
- [x] ROADMAP.md generated with pipeline view of all phases
- [x] Existing `/bc:plan` and `/bc:new-phase` workflows unaffected

## Sources

**HIGH confidence:**
- Existing skill files in `~/.claude/commands/bc/` (direct pattern reference)
- `new-phase.md` skill (guided conversation + phase creation pattern)
- `status.md` skill (state reading pattern)
- Beads CLI `bd create`, `bd dep add` (epic/dependency management)
