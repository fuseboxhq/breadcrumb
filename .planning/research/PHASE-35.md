# Research: Claude Agent SDK Integration for Electron Desktop App

**Task ID:** PHASE-35
**Date:** 2026-03-09
**Domain:** Electron + Claude Agent SDK Integration
**Overall Confidence:** HIGH

## TL;DR

The Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) spawns the Claude Code CLI as a subprocess and communicates via stdin/stdout JSON streaming. It requires an Anthropic API key (not subscription auth). For Electron integration, run the SDK in the main process and forward events to the renderer via IPC. Watch for PATH/environment issues when the Electron app doesn't inherit the user's shell environment.

## Recommended Stack

| Library | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| @anthropic-ai/claude-agent-sdk | 0.2.71+ | Core SDK for Claude Code integration | HIGH |
| zod | ^3.24.1 | Required peer dependency for SDK | HIGH |
| Node.js | 18+ | Runtime requirement | HIGH |

**Install:**
```bash
npm install @anthropic-ai/claude-agent-sdk zod
```

## Key Patterns

### 1. query() Function Signature

**Use when:** Starting a new Claude Code session

**Source:** [Claude Agent SDK TypeScript Reference](https://platform.claude.com/docs/en/agent-sdk/typescript)

```typescript
import { query, Options, Query } from "@anthropic-ai/claude-agent-sdk";

const session: Query = query({
  prompt: string | AsyncIterable<SDKUserMessage>,
  options?: Options
});

// Query extends AsyncGenerator<SDKMessage, void> with additional methods
for await (const message of session) {
  // Handle streaming messages
}
```

**Options interface (key fields):**
```typescript
type Options = {
  // Core settings
  cwd?: string;                    // Working directory (default: process.cwd())
  model?: string;                  // Claude model
  permissionMode?: PermissionMode; // 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan' | 'dontAsk'

  // Streaming & messages
  includePartialMessages?: boolean; // Enable streaming partial messages

  // Permissions
  allowedTools?: string[];          // Pre-approved tools
  disallowedTools?: string[];       // Blocked tools
  canUseTool?: CanUseTool;          // Custom permission callback

  // Session management
  resume?: string;                  // Session ID to resume
  sessionId?: string;               // Use specific UUID instead of auto-generating
  forkSession?: boolean;            // Fork to new session ID when resuming

  // Process control
  abortController?: AbortController;
  pathToClaudeCodeExecutable?: string; // Custom Claude Code CLI path

  // Tools & MCP
  tools?: string[] | { type: 'preset'; preset: 'claude_code' };
  mcpServers?: Record<string, McpServerConfig>;

  // System prompt
  systemPrompt?: string | { type: 'preset'; preset: 'claude_code'; append?: string };
  settingSources?: ('user' | 'project' | 'local')[]; // Load CLAUDE.md (requires ['project'])
};
```

### 2. SDKMessage Types (Complete List)

**Use when:** Handling streaming events from query()

**Source:** [TypeScript SDK Message Types](https://platform.claude.com/docs/en/agent-sdk/typescript#message-types)

```typescript
type SDKMessage =
  | SDKAssistantMessage           // Assistant response with BetaMessage
  | SDKUserMessage                // User input
  | SDKUserMessageReplay          // Replayed user message (resume)
  | SDKResultMessage              // Final result (success or error)
  | SDKSystemMessage              // Initialization (subtype: "init")
  | SDKPartialAssistantMessage    // Streaming partial (type: "stream_event")
  | SDKCompactBoundaryMessage     // Conversation compaction boundary
  | SDKStatusMessage              // Status updates (e.g., compacting)
  | SDKHookStartedMessage         // Hook execution started
  | SDKHookProgressMessage        // Hook stdout/stderr
  | SDKHookResponseMessage        // Hook completion
  | SDKToolProgressMessage        // Tool execution progress
  | SDKAuthStatusMessage          // Authentication flow
  | SDKTaskNotificationMessage    // Background task completed/failed/stopped
  | SDKTaskStartedMessage         // Background task started
  | SDKTaskProgressMessage        // Background task progress
  | SDKFilesPersistedEvent        // File checkpoints persisted
  | SDKToolUseSummaryMessage      // Tool usage summary
  | SDKRateLimitEvent             // Rate limit info
  | SDKPromptSuggestionMessage;   // Predicted next prompt (requires promptSuggestions: true)
```

**Key message patterns:**

```typescript
// 1. System initialization (capture session_id)
if (message.type === "system" && message.subtype === "init") {
  const sessionId = message.session_id;
  const model = message.model;
  const tools = message.tools;
  const permissionMode = message.permissionMode;
}

// 2. Streaming partial messages (requires includePartialMessages: true)
if (message.type === "stream_event") {
  const event = message.event; // BetaRawMessageStreamEvent from Anthropic SDK
  // Handle: message_start, content_block_start, content_block_delta, etc.
}

// 3. Assistant message (complete turn)
if (message.type === "assistant") {
  const content = message.message.content; // Array of text/tool_use blocks
  const stopReason = message.message.stop_reason;
  const usage = message.message.usage;
}

// 4. Final result
if (message.type === "result") {
  if (message.subtype === "success") {
    console.log(message.result);
    console.log(`Cost: $${message.total_cost_usd}`);
    console.log(`Turns: ${message.num_turns}`);
  } else {
    // error_max_turns | error_during_execution | error_max_budget_usd
    console.error(message.errors);
  }
}
```

### 3. canUseTool Callback (Exact Signature)

**Use when:** Implementing custom permission logic

**Source:** [TypeScript SDK CanUseTool](https://platform.claude.com/docs/en/agent-sdk/typescript#canusetool)

```typescript
type CanUseTool = (
  toolName: string,
  input: Record<string, unknown>,
  options: {
    signal: AbortSignal;
    suggestions?: PermissionUpdate[];
    blockedPath?: string;
    decisionReason?: string;
    toolUseID: string;
    agentID?: string;
  }
) => Promise<PermissionResult>;

type PermissionResult =
  | {
      behavior: "allow";
      updatedInput?: Record<string, unknown>;
      updatedPermissions?: PermissionUpdate[];
      toolUseID?: string;
    }
  | {
      behavior: "deny";
      message: string;
      interrupt?: boolean;
      toolUseID?: string;
    };
```

**Example:**
```typescript
const canUseTool: CanUseTool = async (toolName, input, { signal, toolUseID }) => {
  if (toolName === "Bash") {
    // Show approval UI to user
    const approved = await showApprovalDialog(toolName, input);
    if (approved) {
      return { behavior: "allow" };
    }
    return { behavior: "deny", message: "User declined" };
  }
  return { behavior: "allow" };
};
```

### 4. Session Resume

**Use when:** Resuming a previous conversation

**Source:** [TypeScript SDK Sessions](https://platform.claude.com/docs/en/agent-sdk/typescript#options)

```typescript
// Capture session ID from first query
let sessionId: string | undefined;

for await (const message of query({
  prompt: "Read the authentication module",
  options: { allowedTools: ["Read"] }
})) {
  if (message.type === "system" && message.subtype === "init") {
    sessionId = message.session_id;
  }
}

// Resume with full context
for await (const message of query({
  prompt: "Now find all places that call it",
  options: { resume: sessionId }
})) {
  // Claude has full context from previous session
}

// Fork to new session ID (creates branch)
for await (const message of query({
  prompt: "Try a different approach",
  options: {
    resume: sessionId,
    forkSession: true // Creates new session_id instead of continuing original
  }
})) {
  // ...
}
```

**List past sessions:**
```typescript
import { listSessions } from "@anthropic-ai/claude-agent-sdk";

const sessions = await listSessions({
  dir: "/path/to/project",
  limit: 10
});

for (const session of sessions) {
  console.log(`${session.summary} (${session.sessionId})`);
  console.log(`Last modified: ${new Date(session.lastModified)}`);
}
```

### 5. Interrupt

**Use when:** User wants to stop an active query

**Source:** [TypeScript SDK Query Methods](https://platform.claude.com/docs/en/agent-sdk/typescript#query-object)

```typescript
const session = query({
  prompt: "Long-running task",
  options: { /* ... */ }
});

// Start iteration
(async () => {
  for await (const message of session) {
    // Handle messages
  }
})();

// Interrupt from another context (e.g., user clicks "Stop")
await session.interrupt();

// Force close and terminate process
session.close();
```

**Important:** `interrupt()` is async and returns a Promise. `close()` is synchronous and forcefully terminates.

## Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| Parsing CLI output | SDK's typed SDKMessage events | CLI output is for humans; SDK gives structured types |
| Tool execution loop | SDK's built-in tool execution | The SDK handles Read/Write/Bash/Grep/etc. out of the box |
| Permission management | canUseTool callback + permissionMode | SDK provides structured permission flow with suggestions |
| Session persistence | SDK's resume option | Sessions are automatically saved to disk (unless persistSession: false) |
| Streaming text parsing | includePartialMessages + stream_event | SDK provides typed BetaRawMessageStreamEvent from Anthropic SDK |

## Pitfalls

### 1. Electron Environment Propagation

**What happens:** The SDK spawns the Claude Code CLI as a subprocess. In Electron apps launched from Finder/Dock (macOS), the subprocess does NOT inherit the user's shell environment. If `claude` is installed via Homebrew in `/opt/homebrew/bin`, it won't be in PATH.

**Avoid by:**
- Set `pathToClaudeCodeExecutable` explicitly in Options
- OR pass full PATH in `env` option:
  ```typescript
  options: {
    env: {
      ...process.env,
      PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}`
    }
  }
  ```

**Source:** [GitHub Issue #42 - ruvnet/agentic-flow](https://github.com/ruvnet/agentic-flow/issues/42)

### 2. API Key Required (No Subscription Auth)

**What happens:** The SDK requires `ANTHROPIC_API_KEY` environment variable. Unlike the Claude Code CLI (which supports OAuth/Max subscription login), the SDK does NOT support claude.ai subscription authentication.

**Avoid by:**
- Get an API key from [platform.claude.com](https://platform.claude.com/)
- Set `ANTHROPIC_API_KEY` environment variable before launching Electron app
- OR support alternative providers:
  - Amazon Bedrock: `CLAUDE_CODE_USE_BEDROCK=1`
  - Google Vertex AI: `CLAUDE_CODE_USE_VERTEX=1`
  - Microsoft Azure: `CLAUDE_CODE_USE_FOUNDRY=1`

**Official policy:** "Unless previously approved, Anthropic does not allow third party developers to offer claude.ai login or rate limits for their products, including agents built on the Claude Agent SDK."

**Source:** [Agent SDK Overview - Authentication](https://platform.claude.com/docs/en/agent-sdk/overview), [GitHub Issue #559](https://github.com/anthropics/claude-agent-sdk-python/issues/559)

### 3. Nested Claude Code Sessions Blocked

**What happens:** If your Electron app runs inside a Claude Code session (e.g., launched by `claude`), the SDK detects `CLAUDECODE=1` env var and rejects with "Claude Code cannot be launched inside another Claude Code session".

**Avoid by:**
- Clear `CLAUDECODE` from `env` option when spawning:
  ```typescript
  options: {
    env: {
      ...process.env,
      CLAUDECODE: undefined
    }
  }
  ```

**Source:** [GitHub Issue #573](https://github.com/anthropics/claude-agent-sdk-python/issues/573)

### 4. settingSources Default Changed

**What happens:** In SDK v0.1.x, filesystem settings (`~/.claude/settings.json`, `.claude/settings.json`) were loaded by default. In v0.2.x+, `settingSources` defaults to `[]` (no filesystem settings loaded). CLAUDE.md files won't be loaded unless you explicitly set `settingSources: ['project']`.

**Avoid by:**
- To load project CLAUDE.md instructions:
  ```typescript
  options: {
    systemPrompt: { type: 'preset', preset: 'claude_code' },
    settingSources: ['project'] // Loads .claude/settings.json and CLAUDE.md
  }
  ```
- For SDK-only applications (no filesystem dependencies), omit `settingSources` (default behavior).

**Source:** [TypeScript SDK SettingSource](https://platform.claude.com/docs/en/agent-sdk/typescript#settingsource)

### 5. Subprocess Spawn in Containers/Sandboxes

**What happens:** The SDK calls `child_process.spawn()` to launch the Claude Code CLI. In Docker/Cloudflare Workers/restrictive sandboxes, spawn can fail with `ENOENT` even when `pathToClaudeCodeExecutable` is set.

**Avoid by:**
- Use custom spawn function:
  ```typescript
  import { spawn } from 'child_process';

  options: {
    spawnClaudeCodeProcess: (options) => {
      // Custom spawn logic for VMs/containers
      return spawn(options.command, options.args, {
        cwd: options.cwd,
        env: options.env,
        signal: options.signal
      });
    }
  }
  ```

**Source:** [GitHub Issue #865](https://github.com/anthropics/anthropic-sdk-typescript/issues/865), [TypeScript SDK SpawnOptions](https://platform.claude.com/docs/en/agent-sdk/typescript#spawnoptions)

## Electron Integration Architecture

**Recommended pattern:**

```
┌─────────────────────────────────────┐
│   Renderer Process (React)          │
│   - AgentPanel UI component         │
│   - Displays streaming text         │
│   - Tool use cards (approve/deny)   │
│   - Permission mode selector        │
│   - Send/interrupt controls         │
├─────────────────────────────────────┤
│   Preload Script (IPC Bridge)       │
│   - window.breadcrumbAPI.agent.*    │
│   - Typed channels (agentIpc.ts)    │
├─────────────────────────────────────┤
│   Main Process (Electron)           │
│   - AgentService class              │
│   - Wraps SDK query()               │
│   - Forwards SDKMessage → renderer  │
│   - Handles canUseTool approval     │
│   - Session management              │
│   - Subprocess lifecycle            │
└─────────────────────────────────────┘
```

**Key design points:**
1. SDK runs in main process (subprocess spawning requires Node.js APIs)
2. IPC channels forward events to renderer (similar to terminalIpc/browserIpc patterns)
3. `canUseTool` callback sends approval requests to renderer, awaits user response
4. Main process tracks active Query object for interrupt/close

## Open Questions

1. **MCP server compatibility in Electron:** Does the SDK's `mcpServers` option work when spawned from Electron main process? Need to test with stdio transport.

2. **File paths in Electron:** When `cwd` is inside `app.asar` (packaged Electron), can the SDK write session files? May need to override session persistence location.

3. **AbortController signal propagation:** Does Electron's main process → renderer IPC properly propagate abort signals for `canUseTool` callbacks?

4. **Cost tracking UI:** The SDK provides `total_cost_usd` in result messages. Should we accumulate costs across sessions for display? (Marked out-of-scope for Phase 35, but worth tracking.)

## Sources

**HIGH confidence:**
- [Agent SDK TypeScript Reference](https://platform.claude.com/docs/en/agent-sdk/typescript) - Official API docs
- [Agent SDK Overview](https://platform.claude.com/docs/en/agent-sdk/overview) - Authentication & architecture
- [GitHub: claude-agent-sdk-typescript](https://github.com/anthropics/claude-agent-sdk-typescript) - Official repository

**MEDIUM confidence:**
- [Complete Guide to Claude Agent SDK](https://nader.substack.com/p/the-complete-guide-to-building-agents) - Community guide with examples
- [Claude Agent SDK Pitfalls](https://liruifengv.com/posts/claude-agent-sdk-pitfalls-en/) - Common issues

**LOW confidence (needs validation):**
- Electron-specific environment issues - based on Python SDK issues, may differ in TypeScript
- MCP server compatibility in Electron - no direct testing evidence found
