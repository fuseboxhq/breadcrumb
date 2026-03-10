# Phase 37: Agent Panel Bug Fixes

**Status:** not_started
**Beads Epic:** breadcrumb-qmn
**Created:** 2026-03-09

## Objective

Fix three known bugs in the Claude Code agent panel: the Allow button on approval cards not working, the Always Allow button not whitelisting tools correctly, and skill/command invocation errors. These are regressions or incomplete implementations from PHASE-35 and PHASE-36 that need targeted fixes to make the agent panel fully functional.

## Scope

**In scope:**
- Fix Allow button click handling on approval cards (button click doesn't trigger approval)
- Fix Always Allow button to properly whitelist tools via SDK `updatedPermissions`
- Fix skill/command invocation errors in the agent panel
- Debug the full approval IPC chain end-to-end (renderer → preload → main → SDK)

**Out of scope:**
- New features or UX enhancements
- Refactoring existing code beyond what's needed for the fix
- Terminal panel changes
- Session history improvements

## Constraints

- Frontend design skill active — follow design thinking process for UI tasks
- Targeted fixes only — don't over-engineer or add unnecessary code
- Must trace each bug through the full IPC chain to find the root cause
- Test each fix by exercising the approval flow with actual SDK tool calls

## Research Summary

Run `/bc:plan PHASE-37` to research this phase and populate this section.

## Recommended Approach

1. Add diagnostic logging to trace the approval flow end-to-end
2. Run the app and trigger tool approval (e.g., ask Claude to read a file in default permission mode)
3. Check console logs to identify where the flow breaks
4. Fix each bug at the root cause
5. Verify by testing the full approval cycle

## Tasks

| ID | Title | Status | Complexity |
|----|-------|--------|------------|
| 1 | Debug and fix Allow button on approval cards | not_started | Medium |
| 2 | Debug and fix Always Allow button whitelisting | not_started | Medium |
| 3 | Fix skill/command invocation errors | not_started | Medium |

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Debug approach | Console logging through IPC chain | Need to trace where the flow breaks between renderer, preload, main process, and SDK |

## Completion Criteria

- [ ] Clicking "Allow" on an approval card successfully approves the tool and the agent continues
- [ ] Clicking "Always Allow" whitelists the tool so it doesn't prompt again for the session
- [ ] Skill/command invocations work without errors
- [ ] All three fixes verified by testing with actual SDK interactions

## Critical Files

- `desktop/src/renderer/components/agent/AgentPanel.tsx` — approval card UI and click handlers
- `desktop/src/main/agent/AgentService.ts` — approval resolution and SDK canUseTool callback
- `desktop/src/main/ipc/agentIpc.ts` — IPC handler for AGENT_APPROVE
- `desktop/src/preload/index.ts` — bridge between renderer and main process
