# Phase 35: Claude Code SDK Agent Panel

**Status:** not_started
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

Run `/bc:plan PHASE-35` to research this phase and populate this section.

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
    canUseTool: async (tool, input) => {
      // Forward to renderer for user approval
      const decision = await ipcApprovalRequest(tool, input);
      return decision;
    },
  }
});

for await (const message of session) {
  // Forward typed events to renderer via IPC
  mainWindow.webContents.send("agent:event", message);
}
```

## Tasks

| ID | Title | Status | Complexity |
|----|-------|--------|------------|
| - | No tasks yet | - | - |

Run `/bc:plan PHASE-35` to break down this phase into tasks.

## Technical Decisions

- **SDK over CLI**: The SDK provides typed TypeScript events, built-in `canUseTool` callback for approval flows, and session resume — all of which we'd have to build manually with the CLI `stream-json` approach.
- **No provider abstraction**: Unlike t3code's multi-provider adapter pattern, we're integrating Claude Code only. This avoids premature abstraction and keeps the codebase simple. Can be refactored later if needed.
- **Main process hosting**: The SDK spawns a subprocess internally, so it must run in Electron's main process (not renderer). Events are forwarded to the renderer via IPC, matching the existing pattern used for terminals and browser panels.

## Completion Criteria

- [ ] Agent panel opens as a tab/panel in the desktop app
- [ ] User can type a prompt and see Claude Code's streaming response rendered in real-time
- [ ] Tool use is displayed (tool name, input) with approve/deny controls
- [ ] Permission mode is selectable (default, accept edits, full access, plan, don't ask)
- [ ] User can interrupt an active agent turn
- [ ] Sessions can be resumed after closing and reopening the panel
- [ ] Existing "Launch Claude" button opens the new agent panel instead of a terminal
