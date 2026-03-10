# Phase 37: Agent Panel Bug Fixes

**Status:** complete
**Beads Epic:** breadcrumb-qmn
**Created:** 2026-03-09

## Objective

Fix three known bugs in the Claude Code agent panel: the Allow button on approval cards not working, the Always Allow button not whitelisting tools correctly, and skill/command invocation errors. These are regressions or incomplete implementations from PHASE-35 and PHASE-36 that need targeted fixes to make the agent panel fully functional.

## Scope

**In scope:**
- Fix Allow button click handling on approval cards (button click doesn't trigger approval)
- Fix Always Allow button to properly whitelist tools via SDK `updatedPermissions`
- Fix approval state race condition (state cleanup on IPC failure)
- Add diagnostic logging to trace the approval IPC chain

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

**Overall Confidence:** MEDIUM

The approval flow has been audited end-to-end across 4 files. The SDK's `canUseTool` API is well-documented and our callback signature matches. The bugs are likely in the IPC chain or state management rather than the SDK interaction itself.

### SDK canUseTool API

The SDK calls `canUseTool(toolName, input, options)` where options includes:
- `toolUseID: string` — unique ID for this tool call
- `suggestions?: PermissionUpdate[]` — pre-computed permission updates for "always allow"
- `decisionReason?: string` — why this permission request was triggered
- `signal: AbortSignal` — for cancellation

Return `{ behavior: 'allow', updatedPermissions: options.suggestions }` to whitelist the tool.

### Bugs Found in Audit

| Bug | Location | Severity | Description |
|-----|----------|----------|-------------|
| Race condition | AgentPanel.tsx:440-457 | HIGH | Approval removed from state even if IPC call fails |
| Type gap | preload handler (line 369) | LOW | Inline type omits `suggestions` (OK at runtime, fragile) |
| SDK callback type | AgentService.ts:89 | LOW | `canUseTool` opts type doesn't include `suggestions` |
| Defensive redundancy | ApprovalCard buttons | INFO | Both `stopPropagation()` and `data-no-focus` applied |

### Key Patterns

- SDK provides `suggestions` in `canUseTool` options — return them as `updatedPermissions` for "always allow"
- `resolveApproval` returns `false` when no pending approval matches — must handle this in renderer
- Approval state should only be cleaned up after confirmed IPC success

### Pitfalls

- **IPC silent failure**: If `approve()` IPC fails, the card disappears but the SDK hangs waiting for permission resolution
- **toolUseID undefined**: If the SDK sends an unexpected value, the Map lookup silently fails

## Tasks

| ID | Title | Status | Complexity | Dependencies |
|----|-------|--------|------------|--------------|
| breadcrumb-qmn.4 | Add diagnostic logging to approval IPC chain | done | Low | - |
| breadcrumb-qmn.1 | Debug and fix Allow button approval flow | done | Medium | qmn.4 |
| breadcrumb-qmn.2 | Fix Always Allow with SDK updatedPermissions | done | Medium | qmn.1 |
| breadcrumb-qmn.3 | Fix approval state race condition | done | Medium | qmn.1 |

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Debug approach | Console logging at every IPC boundary | Need to trace toolUseID matching between renderer ↔ main ↔ SDK |
| Always Allow mechanism | Return `opts.suggestions` as `updatedPermissions` | Official SDK pattern — suggestions are pre-computed by the SDK |
| State cleanup | Only remove approval from UI after IPC success | Prevents silent SDK hangs when IPC fails |
| Type safety | Update inline handler types to include `suggestions` | Prevent future regressions when TypeScript strictness changes |

## Completion Criteria

- [ ] Clicking "Allow" on an approval card successfully approves the tool and the agent continues
- [ ] Clicking "Always Allow" whitelists the tool so it doesn't prompt again for the session
- [ ] Approval card stays visible if the IPC call fails (with error indicator)
- [ ] Console logs trace the full approval flow at every boundary for debugging
- [ ] All fixes verified by testing with actual SDK interactions

## Critical Files

- `desktop/src/renderer/components/agent/AgentPanel.tsx` — approval card UI and click handlers
- `desktop/src/main/agent/AgentService.ts` — approval resolution and SDK canUseTool callback
- `desktop/src/main/ipc/agentIpc.ts` — IPC handler for AGENT_APPROVE
- `desktop/src/preload/index.ts` — bridge between renderer and main process

## Sources

**HIGH confidence:**
- SDK type definitions: `node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts`
- `CanUseTool` type (line 122-148): 3-arg callback with `suggestions` in options
- `PermissionResult` type (line 1167-1177): `updatedPermissions` for always-allow
- `PermissionUpdate` type (line 1184-1211): `addRules` with `destination: 'session'`
