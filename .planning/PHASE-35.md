# Phase 35: Claude Code SDK Agent Panel

**Status:** complete
**Beads Epic:** breadcrumb-4xr
**Created:** 2026-03-09

## Objective

Replace the current terminal-based Claude Code launcher with a purpose-built agent panel powered by the Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`). Instead of running the `claude` CLI in an xterm.js PTY, the agent panel communicates with Claude Code programmatically via the SDK's `query()` async generator, yielding structured events for streaming text, tool use, approvals, and results — similar to how t3code integrates with Codex via its `app-server` JSON-RPC mode.

The result is a custom, native-feeling agent experience with rich UI for streaming responses, tool call visualization, and user-controlled permission modes — all rendered in React rather than a terminal emulator.

## Scope

**In scope:**
- Install and integrate `@anthropic-ai/claude-agent-sdk` in Electron main process
- Build an `AgentService` in main process that wraps the SDK's `query()` function
- IPC bridge (`agentIpc.ts`) for renderer ↔ main process communication
- Agent panel React component replacing the current "Launch Claude" terminal flow
- Streaming text rendering with markdown support
- Tool use visualization (show what tool is being called, with what input)
- Approval flow UI tied to the SDK's `canUseTool` callback
- Permission mode selector (default, accept edits, bypass permissions, plan, don't ask)
- Basic session management (start new, resume previous)
- Prompt input with send/interrupt controls

**Out of scope:**
- Multi-provider abstraction (no Codex/Cursor adapter pattern — Claude Code only)
- Multi-agent orchestration or subagent visualization
- File diff viewer for edits (use existing git diff panel for now)
- MCP server configuration UI
- Cost tracking / budget management UI
- Conversation history persistence across app restarts (follow-up phase)

## Constraints

- Use `@anthropic-ai/claude-agent-sdk` (not CLI `stream-json` mode) for structured typed events
- Keep it simple — direct SDK integration, no provider abstraction layer
- Agent process runs in Electron main process (SDK spawns Claude Code internally)
- Frontend design skill active — follow design thinking process for UI tasks
- Must work with existing panel/tab architecture (agent panel is a new tab type)
- Respect existing IPC patterns established in terminalIpc, browserIpc, etc.

## Inspiration

**t3code (github.com/pingdotgg/t3code):**
- Spawns Codex as a structured API process (not a PTY)
- Deep event parsing: every message classified, routed, translated to canonical UI events
- Custom approval cards with approve/deny buttons
- Streaming text rendering with reasoning display
- Session management with history replay
- Clean separation: process management (server) → event translation → UI rendering (React)

**Key difference:** t3code uses Codex's `app-server` JSON-RPC protocol. We use the Claude Agent SDK's `query()` async generator, which serves the same purpose — structured, typed events instead of terminal output.

## Research Summary

**Overall Confidence:** HIGH
**Research completed:** 2026-03-09

See detailed research document: `.planning/research/PHASE-35.md`

### Recommended Stack

| Library | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| @anthropic-ai/claude-agent-sdk | 0.2.71+ | Core SDK — query(), canUseTool, session mgmt | HIGH |
| zod | ^3.24.1 | Required peer dependency for SDK | HIGH |

### Key Findings

- SDK spawns Claude Code CLI as subprocess, communicates via stdin/stdout JSON
- Requires `ANTHROPIC_API_KEY` (no subscription/OAuth auth supported)
- 18 SDKMessage types including stream_event, assistant, result, tool_progress, etc.
- `canUseTool` callback receives toolName, input, options (with signal, toolUseID, agentID)
- Session resume via `resume: sessionId` option, optional `forkSession: true` to branch
- `Query.interrupt()` for stopping, `Query.close()` for forced termination

### Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| Parsing CLI output | SDK's typed SDKMessage events | CLI output is for humans; SDK gives structured types |
| Tool execution loop | SDK's built-in tool execution | Handles Read/Write/Bash/Grep etc. out of the box |
| Permission management | canUseTool callback + permissionMode | SDK provides structured permission flow |
| Session persistence | SDK's resume option | Sessions automatically saved to disk |
| Streaming text parsing | includePartialMessages + stream_event | Provides typed BetaRawMessageStreamEvent |

### Pitfalls

- **PATH propagation**: Electron GUI apps don't inherit shell env — set PATH explicitly or use `pathToClaudeCodeExecutable`
- **API key required**: No subscription auth — must set `ANTHROPIC_API_KEY` env var
- **Nested session blocking**: Clear `CLAUDECODE` env var to avoid "cannot launch inside another session"
- **settingSources default**: Changed to `[]` in v0.2.x — must explicitly set `['project']` for CLAUDE.md loading

### Design Guidance

The `frontend-design` skill will be active during execution of UI tasks (tasks 4, 5, 6) in this phase.

## Recommended Approach

**Architecture (3 layers, mirroring t3code):**

```
┌─────────────────────────┐
│   Renderer (React)      │  Agent panel UI, streaming text,
│   AgentPanel component  │  approval cards, permission selector
├─────────────────────────┤
│   Preload / IPC Bridge  │  agentIpc.ts — typed channels for
│   window.breadcrumbAPI  │  start, send, interrupt, approve
├─────────────────────────┤
│   Main Process          │  AgentService wraps SDK query(),
│   AgentService          │  translates SDKMessages → IPC events
└─────────────────────────┘
```

**SDK Integration Pattern:**
```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

const session = query({
  prompt: userMessage,
  options: {
    cwd: projectPath,
    includePartialMessages: true,  // streaming
    permissionMode: selectedMode,
    canUseTool: async (tool, input, { signal, toolUseID }) => {
      // Forward to renderer for user approval
      const decision = await ipcApprovalRequest(tool, input);
      return decision;
    },
    env: {
      ...process.env,
      PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}`,
      CLAUDECODE: undefined // Prevent nested session rejection
    }
  }
});

for await (const message of session) {
  // Forward typed events to renderer via IPC
  mainWindow.webContents.send("agent:event", message);
}
```

## Tasks

| ID | Title | Status | Complexity | Dependencies |
|----|-------|--------|------------|--------------|
| breadcrumb-4xr.1 | Install Claude Agent SDK and configure Electron build | done | Low | - |
| breadcrumb-4xr.2 | Build AgentService in main process | done | High | 4xr.1 |
| breadcrumb-4xr.3 | Create agent IPC bridge and preload API | done | Medium | 4xr.2 |
| breadcrumb-4xr.4 | Build AgentPanel React component with streaming output | done | High | 4xr.3 |
| breadcrumb-4xr.5 | Add tool use visualization and approval UI | done | High | 4xr.4 |
| breadcrumb-4xr.6 | Wire up Launch Claude button and session management | done | Medium | 4xr.5 |

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| SDK vs CLI | `@anthropic-ai/claude-agent-sdk` | Typed events, canUseTool callback, session resume built-in |
| Provider abstraction | None (Claude Code only) | Avoids premature abstraction; can refactor later |
| Process hosting | Electron main process | SDK spawns subprocess; needs Node.js APIs |
| Auth method | ANTHROPIC_API_KEY env var | SDK policy requires API key, no subscription auth |
| Environment | Explicit PATH + clear CLAUDECODE | Avoids Electron GUI app environment issues |
| Settings | settingSources: ['project'] | Required to load CLAUDE.md from working directory |

## Completion Criteria

- [x] Agent panel opens as a tab/panel in the desktop app
- [x] User can type a prompt and see Claude Code's streaming response rendered in real-time
- [x] Tool use is displayed (tool name, input) with approve/deny controls
- [x] Permission mode is selectable (default, accept edits, full access, plan, don't ask)
- [x] User can interrupt an active agent turn
- [x] Sessions can be resumed after closing and reopening the panel
- [x] Existing "Launch Claude" button opens the new agent panel instead of a terminal
