// IPC Channel definitions
export const IPC_CHANNELS = {
  // Agent channels
  AGENT_CREATE: "agent:create",
  AGENT_TERMINATE: "agent:terminate",
  AGENT_SEND_MESSAGE: "agent:send-message",
  AGENT_EVENT: "agent:event",
  AGENT_STATUS: "agent:status",
  AGENT_PERMISSION_REQUEST: "agent:permission-request",
  AGENT_PERMISSION_RESPONSE: "agent:permission-response",
  AGENT_PERMISSION_ALWAYS_ALLOW: "agent:permission-always-allow",
  AGENT_PERMISSION_GET_SETTINGS: "agent:permission-get-settings",

  // Agent config channels
  AGENT_CONFIG_LIST: "agent-config:list",
  AGENT_CONFIG_CREATE: "agent-config:create",
  AGENT_CONFIG_UPDATE: "agent-config:update",
  AGENT_CONFIG_DELETE: "agent-config:delete",

  // Claude agents (from .claude/agents/ directories)
  CLAUDE_AGENTS_LIST: "claude-agents:list",

  // Skills (from .claude/skills/ directories)
  SKILLS_LIST: "skills:list",

  // MCP channels
  MCP_LIST: "mcp:list",
  MCP_START: "mcp:start",
  MCP_STOP: "mcp:stop",
  MCP_STATUS: "mcp:status",
  MCP_SAVE: "mcp:save",
  MCP_REMOVE: "mcp:remove",

  // Auth channels
  AUTH_CHECK_CLI: "auth:check-cli",
  AUTH_OPEN_CLI_LOGIN: "auth:open-cli-login",
  AUTH_SET_KEY: "auth:set-key",
  AUTH_HAS_KEY: "auth:has-key",
  AUTH_CLEAR: "auth:clear",

  // Settings channels
  SETTINGS_GET: "settings:get",
  SETTINGS_SET: "settings:set",

  // File dialog
  DIALOG_SELECT_DIRECTORY: "dialog:select-directory",

  // System
  SYSTEM_GET_WORKING_DIR: "system:get-working-dir",

  // Terminal channels (PTY-based interactive terminals)
  TERMINAL_CREATE: "terminal:create",
  TERMINAL_WRITE: "terminal:write",
  TERMINAL_RESIZE: "terminal:resize",
  TERMINAL_TERMINATE: "terminal:terminate",
  TERMINAL_DATA: "terminal:data",
  TERMINAL_EXIT: "terminal:exit",

  // Git channels
  GIT_INFO: "git:info",

  // Plans channels
  PLANS_LIST: "plans:list",
  PLANS_LIST_ARCHIVED: "plans:list-archived",
  PLANS_READ: "plans:read",
  PLANS_ARCHIVE: "plans:archive",
  PLANS_ASSOCIATE: "plans:associate",

  // Project channels
  PROJECT_GET_RECENT: "project:get-recent",
  PROJECT_ADD_RECENT: "project:add-recent",
  PROJECT_REMOVE_RECENT: "project:remove-recent",

  // Scratchpad channels
  SCRATCHPAD_READ: "scratchpad:read",
  SCRATCHPAD_WRITE: "scratchpad:write",

  // Memory channels (CLAUDE.md files)
  MEMORY_LIST: "memory:list",
  MEMORY_READ: "memory:read",
  MEMORY_WRITE: "memory:write",

  // Extension channels
  EXTENSIONS_LIST: "extensions:list",
  EXTENSIONS_ACTIVATE: "extensions:activate",
  EXTENSIONS_DEACTIVATE: "extensions:deactivate",
  EXTENSIONS_COMMANDS: "extensions:commands",
  EXTENSIONS_EXECUTE_COMMAND: "extensions:execute-command",
  EXTENSIONS_STATUS_CHANGED: "extensions:status-changed",
} as const;

// Session statistics
export interface SessionStats {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  cost: number;
  apiDurationMs: number;
  wallDurationMs: number;
  linesAdded: number;
  linesRemoved: number;
}

// Git repository information
export type GitProvider = "github" | "gitlab" | "azure" | "other";

export interface GitInfo {
  isGitRepo: boolean;
  branch: string;
  remote: string;
  repoName: string;
  provider: GitProvider | null;
}

// Plan file information
export interface PlanFile {
  id: string;
  name: string;
  filePath: string;
  isArchived: boolean;
  modifiedAt: number;
}

// Memory file types (CLAUDE.md files)
export type MemoryFileType = "global" | "project" | "project-local" | "rule";

export interface MemoryFile {
  id: string;
  name: string;
  displayName: string;
  filePath: string;
  type: MemoryFileType;
  exists: boolean;
  source: "user" | "project";
  modifiedAt?: number;
}

export interface MemoryContent extends MemoryFile {
  content: string;
}

// Recent project information
export interface RecentProject {
  path: string;
  name: string;
  lastOpened: number;
}

// Bottom panel types
export type BottomPanelMode = "scratchpad" | "terminal";

export interface BottomTerminalTab {
  id: string;
  name: string;
  shell?: string;
}

// Permission request event from agent
export interface PermissionRequestEvent {
  id: string;
  sessionId: string;
  tool: string;
  action: string;
  input?: Record<string, unknown>;
  timestamp?: number;
}

// Agent session types
export interface AgentSession {
  id: string;
  name: string;
  status: "idle" | "running" | "error";
  workingDirectory: string;
  agentConfigId: string | null;
  messages: Message[];
  createdAt: number;
  model: "default" | "sonnet" | "opus" | "haiku";
  stats: SessionStats;
  gitInfo?: GitInfo;
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  toolUse?: ToolUse[];
  isStreaming?: boolean;
}

export interface ToolUse {
  id: string;
  tool: string;
  input: Record<string, unknown>;
  output?: string;
  status: "pending" | "running" | "completed" | "error";
}

export interface PermissionRequest {
  id: string;
  sessionId: string;
  tool: string;
  action: string;
  input?: Record<string, unknown>;
  timestamp: number;
}

export interface PermissionResponse {
  sessionId: string;
  requestId: string;
  approved: boolean;
  alwaysAllow?: boolean;
}

// Claude agent definition (from .claude/agents/*.md files)
export interface ClaudeAgentDefinition {
  id: string;
  name: string;
  description: string;
  tools: string[];
  model?: "sonnet" | "opus" | "haiku";
  systemPrompt: string;
  source: "user" | "project";
  filePath: string;
}

// Skill definition (from .claude/skills/*/SKILL.md directories)
export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  allowedTools?: string[];
  prompt: string;
  source: "user" | "project";
  filePath: string;
  directoryPath: string;
}

// Agent configuration types
export interface AgentConfig {
  id: string;
  name: string;
  description?: string;
  systemPrompt?: string;
  allowedTools: string[];
  model: "sonnet" | "opus" | "haiku";
  mcpServers: string[];
  workingDirectory?: string;
  isBuiltIn: boolean;
}

// MCP Server types
export type MCPServerType = "local" | "remote";

export interface MCPServer {
  id: string;
  name: string;
  type: MCPServerType;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  status: "stopped" | "starting" | "running" | "error";
}

// Claude CLI stream-json event types
export type ClaudeStreamEvent =
  | { type: "assistant"; message: { content: ContentBlock[] } }
  | { type: "content_block_start"; index: number; content_block: ContentBlock }
  | { type: "content_block_delta"; index: number; delta: { type: string; text?: string } }
  | { type: "content_block_stop"; index: number }
  | { type: "result"; subtype: string; result?: string; is_error?: boolean }
  | { type: "system"; message: string };

export interface ContentBlock {
  type: "text" | "tool_use" | "tool_result";
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  content?: string;
}

// Default built-in agents
export const DEFAULT_AGENTS: AgentConfig[] = [
  {
    id: "general",
    name: "General",
    description: "General-purpose assistant for all tasks",
    allowedTools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep", "WebSearch", "WebFetch"],
    model: "sonnet",
    mcpServers: [],
    isBuiltIn: true,
  },
  {
    id: "explore",
    name: "Explore",
    description: "Fast codebase exploration and search",
    allowedTools: ["Read", "Glob", "Grep"],
    model: "haiku",
    mcpServers: [],
    isBuiltIn: true,
  },
  {
    id: "plan",
    name: "Plan",
    description: "Software architecture and implementation planning",
    allowedTools: ["Read", "Glob", "Grep", "WebSearch"],
    model: "opus",
    mcpServers: [],
    isBuiltIn: true,
  },
];
