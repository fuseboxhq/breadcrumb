import { useState, useEffect, useRef, useCallback } from "react";
import {
  Send,
  Square,
  Sparkles,
  Loader2,
  ChevronDown,
  FileEdit,
  TerminalSquare,
  Search,
  FolderSearch,
  Eye,
  FileText,
  Globe,
  CheckCircle2,
  XCircle,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────

type PermissionMode = "default" | "acceptEdits" | "bypassPermissions" | "plan" | "dontAsk";

interface AgentMessage {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  timestamp: number;
}

interface ApprovalRequest {
  toolUseID: string;
  toolName: string;
  input: Record<string, unknown>;
  decisionReason?: string;
}

interface AgentPanelProps {
  sessionId: string;
  cwd?: string;
}

// ── Permission Mode Labels ─────────────────────────────────────────────

const PERMISSION_MODES: { value: PermissionMode; label: string; description: string }[] = [
  { value: "default", label: "Default", description: "Prompts for dangerous operations" },
  { value: "acceptEdits", label: "Accept Edits", description: "Auto-accept file edits" },
  { value: "plan", label: "Plan Only", description: "No tool execution" },
  { value: "dontAsk", label: "Don't Ask", description: "Deny if not pre-approved" },
  { value: "bypassPermissions", label: "Full Access", description: "Skip all permission checks" },
];

// ── Component ──────────────────────────────────────────────────────────

export function AgentPanel({ sessionId, cwd }: AgentPanelProps) {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [input, setInput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [permissionMode, setPermissionMode] = useState<PermissionMode>("default");
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [toolProgress, setToolProgress] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sessionStarted = useRef(false);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingText, pendingApprovals, scrollToBottom]);

  // Subscribe to agent events
  useEffect(() => {
    const api = window.breadcrumbAPI?.agent;
    if (!api) return;

    const cleanupMessage = api.onMessage(({ sessionId: sid, message }) => {
      if (sid !== sessionId) return;
      const msg = message as Record<string, unknown>;

      // Handle streaming partial messages
      if (msg.type === "stream_event") {
        const event = msg.event as Record<string, unknown> | undefined;
        const delta = event?.delta as Record<string, unknown> | undefined;
        if (delta?.type === "text_delta" && typeof delta.text === "string") {
          setStreamingText((prev) => prev + delta.text);
        }
        return;
      }

      // Handle complete assistant message
      if (msg.type === "assistant") {
        const betaMsg = msg.message as Record<string, unknown> | undefined;
        const content = betaMsg?.content as Array<Record<string, unknown>> | undefined;
        const textBlocks = content?.filter((b) => b.type === "text") ?? [];
        const text = textBlocks.map((b) => b.text as string).join("");

        if (text) {
          setMessages((prev) => [
            ...prev,
            {
              id: (msg.uuid as string) || `assistant-${Date.now()}`,
              role: "assistant",
              content: text,
              timestamp: Date.now(),
            },
          ]);
        }
        setStreamingText("");

        // Extract tool use blocks
        const toolBlocks = content?.filter((b) => b.type === "tool_use") ?? [];
        for (const tool of toolBlocks) {
          setMessages((prev) => [
            ...prev,
            {
              id: (tool.id as string) || `tool-${Date.now()}`,
              role: "tool",
              content: `Using ${tool.name}`,
              toolName: tool.name as string,
              toolInput: tool.input as Record<string, unknown>,
              timestamp: Date.now(),
            },
          ]);
        }
        return;
      }

      // Handle tool progress
      if (msg.type === "tool_progress") {
        const content = msg.content as string | undefined;
        if (content) setToolProgress(content);
        return;
      }

      // Handle result
      if (msg.type === "result") {
        setIsRunning(false);
        setStreamingText("");
        setToolProgress(null);
        return;
      }

      // Handle system init
      if (msg.type === "system" && msg.subtype === "init") {
        setIsRunning(true);
        return;
      }
    });

    const cleanupApproval = api.onApprovalRequest((data) => {
      if (data.sessionId !== sessionId) return;
      setPendingApprovals((prev) => [...prev, data]);
    });

    const cleanupError = api.onError(({ sessionId: sid, error: err }) => {
      if (sid !== sessionId) return;
      setError(err);
      setIsRunning(false);
    });

    const cleanupDone = api.onDone(({ sessionId: sid }) => {
      if (sid !== sessionId) return;
      setIsRunning(false);
      setStreamingText("");
    });

    return () => {
      cleanupMessage();
      cleanupApproval();
      cleanupError();
      cleanupDone();
    };
  }, [sessionId]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = useCallback(async () => {
    const prompt = input.trim();
    if (!prompt || isRunning) return;

    setInput("");
    setError(null);

    // Add user message
    setMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        role: "user",
        content: prompt,
        timestamp: Date.now(),
      },
    ]);

    setIsRunning(true);
    const api = window.breadcrumbAPI?.agent;
    if (!api) return;

    if (!sessionStarted.current) {
      sessionStarted.current = true;
      const result = await api.start({
        sessionId,
        prompt,
        cwd: cwd || process.cwd?.() || "/",
        permissionMode,
      });
      if (!result.success) {
        setError(result.error || "Failed to start session");
        setIsRunning(false);
        sessionStarted.current = false;
      }
    } else {
      const result = await api.send({
        sessionId,
        prompt,
        permissionMode,
      });
      if (!result.success) {
        setError(result.error || "Failed to send message");
        setIsRunning(false);
      }
    }
  }, [input, isRunning, sessionId, cwd, permissionMode]);

  const handleInterrupt = useCallback(async () => {
    await window.breadcrumbAPI?.agent?.interrupt(sessionId);
  }, [sessionId]);

  const handleApproval = useCallback(
    async (toolUseID: string, decision: "allow" | "deny") => {
      await window.breadcrumbAPI?.agent?.approve({ toolUseID, decision });
      setPendingApprovals((prev) => prev.filter((a) => a.toolUseID !== toolUseID));
    },
    []
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="h-9 flex items-center justify-between px-3 bg-background-raised border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-[#D97757]" />
          <span className="text-xs font-medium text-foreground">Claude Code</span>
          {isRunning && (
            <Loader2 className="w-3 h-3 text-foreground-muted animate-spin" />
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {/* Permission mode selector */}
          <select
            value={permissionMode}
            onChange={(e) => {
              const mode = e.target.value as PermissionMode;
              setPermissionMode(mode);
              if (sessionStarted.current) {
                window.breadcrumbAPI?.agent?.setPermissionMode({
                  sessionId,
                  mode,
                });
              }
            }}
            className="h-6 px-1.5 text-2xs bg-background border border-border rounded text-foreground-secondary focus:outline-none focus:ring-1 focus:ring-primary/30"
          >
            {PERMISSION_MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && !streamingText && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-10 h-10 rounded-xl bg-[#D97757]/10 flex items-center justify-center mb-3">
              <Sparkles className="w-5 h-5 text-[#D97757]" />
            </div>
            <p className="text-sm text-foreground-secondary mb-1">
              Claude Code Agent
            </p>
            <p className="text-2xs text-foreground-muted max-w-xs">
              Ask Claude to read, edit, and create files, run commands, search your codebase, and more.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* Streaming text */}
        {streamingText && (
          <div className="flex gap-2.5">
            <div className="w-5 h-5 rounded-md bg-[#D97757]/10 flex items-center justify-center shrink-0 mt-0.5">
              <Sparkles className="w-3 h-3 text-[#D97757]" />
            </div>
            <div className="flex-1 min-w-0">
              <pre className="text-sm text-foreground whitespace-pre-wrap break-words font-mono leading-relaxed">
                {streamingText}
                <span className="inline-block w-1.5 h-4 bg-foreground-muted/40 animate-pulse ml-0.5 align-middle" />
              </pre>
            </div>
          </div>
        )}

        {/* Tool progress indicator */}
        {toolProgress && (
          <div className="ml-7.5 flex items-center gap-2 px-3 py-1.5 text-2xs text-foreground-muted">
            <Loader2 className="w-3 h-3 animate-spin shrink-0" />
            <span className="font-mono truncate">{toolProgress}</span>
          </div>
        )}

        {/* Pending approvals */}
        {pendingApprovals.map((approval) => (
          <ApprovalCard
            key={approval.toolUseID}
            approval={approval}
            onApprove={() => handleApproval(approval.toolUseID, "allow")}
            onDeny={() => handleApproval(approval.toolUseID, "deny")}
          />
        ))}

        {/* Error */}
        {error && (
          <div className="px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-border px-3 py-2.5 bg-background-raised shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Claude Code..."
            rows={1}
            className="flex-1 resize-none bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted/50 focus:outline-none focus:ring-1 focus:ring-primary/30 max-h-32 overflow-y-auto"
            style={{ minHeight: "36px" }}
          />
          {isRunning ? (
            <button
              onClick={handleInterrupt}
              className="p-2 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-default shrink-0"
              title="Stop"
            >
              <Square className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-default disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
              title="Send (Enter)"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Message Bubble ─────────────────────────────────────────────────────

function MessageBubble({ message }: { message: AgentMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] px-3 py-2 rounded-lg bg-primary/10 text-sm text-foreground">
          <pre className="whitespace-pre-wrap break-words font-sans">{message.content}</pre>
        </div>
      </div>
    );
  }

  if (message.role === "tool") {
    return <ToolUseBlock toolName={message.toolName} input={message.toolInput} />;
  }

  // Assistant message
  return (
    <div className="flex gap-2.5">
      <div className="w-5 h-5 rounded-md bg-[#D97757]/10 flex items-center justify-center shrink-0 mt-0.5">
        <Sparkles className="w-3 h-3 text-[#D97757]" />
      </div>
      <div className="flex-1 min-w-0">
        <pre className="text-sm text-foreground whitespace-pre-wrap break-words font-mono leading-relaxed">
          {message.content}
        </pre>
      </div>
    </div>
  );
}

// ── Tool Icons ─────────────────────────────────────────────────────────

const TOOL_META: Record<string, { icon: typeof FileEdit; color: string; label: string }> = {
  Read: { icon: Eye, color: "text-info", label: "Read File" },
  Edit: { icon: FileEdit, color: "text-warning", label: "Edit File" },
  Write: { icon: FileText, color: "text-warning", label: "Write File" },
  Bash: { icon: TerminalSquare, color: "text-success", label: "Run Command" },
  Grep: { icon: Search, color: "text-info", label: "Search Content" },
  Glob: { icon: FolderSearch, color: "text-info", label: "Find Files" },
  WebFetch: { icon: Globe, color: "text-accent", label: "Fetch URL" },
  WebSearch: { icon: Globe, color: "text-accent", label: "Web Search" },
};

function getToolPreview(toolName: string, input: Record<string, unknown>): string | null {
  if (toolName === "Bash" && input.command) return String(input.command);
  if (toolName === "Read" && input.file_path) return String(input.file_path);
  if (toolName === "Edit" && input.file_path) return String(input.file_path);
  if (toolName === "Write" && input.file_path) return String(input.file_path);
  if (toolName === "Grep" && input.pattern) return `/${input.pattern}/`;
  if (toolName === "Glob" && input.pattern) return String(input.pattern);
  return null;
}

// ── Tool Use Block ─────────────────────────────────────────────────────

function ToolUseBlock({
  toolName,
  input,
}: {
  toolName?: string;
  input?: Record<string, unknown>;
}) {
  const [expanded, setExpanded] = useState(false);
  const meta = toolName ? TOOL_META[toolName] : undefined;
  const Icon = meta?.icon ?? TerminalSquare;
  const preview = toolName && input ? getToolPreview(toolName, input) : null;

  return (
    <div className="ml-7.5 border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-2xs text-foreground-secondary hover:bg-muted/20 transition-default"
      >
        <ChevronDown
          className={`w-3 h-3 transition-transform shrink-0 ${expanded ? "" : "-rotate-90"}`}
        />
        <Icon className={`w-3 h-3 shrink-0 ${meta?.color ?? "text-foreground-muted"}`} />
        <span className="font-mono font-medium">{meta?.label ?? toolName ?? "Tool"}</span>
        {preview && (
          <span className="font-mono text-foreground-muted truncate max-w-[200px]">
            {preview}
          </span>
        )}
      </button>
      {expanded && input && (
        <div className="px-3 py-2 border-t border-border bg-muted/10">
          <pre className="text-2xs text-foreground-muted font-mono whitespace-pre-wrap break-all overflow-x-auto max-h-48">
            {JSON.stringify(input, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

// ── Approval Card ──────────────────────────────────────────────────────

function ApprovalCard({
  approval,
  onApprove,
  onDeny,
}: {
  approval: ApprovalRequest;
  onApprove: () => void;
  onDeny: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="ml-7.5 border border-warning/30 rounded-lg bg-warning/5 overflow-hidden">
      <div className="px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 text-xs text-warning font-medium"
          >
            <ChevronDown
              className={`w-3 h-3 transition-transform ${expanded ? "" : "-rotate-90"}`}
            />
            <span className="font-mono">{approval.toolName}</span>
          </button>
          {approval.decisionReason && (
            <span className="text-2xs text-foreground-muted">
              {approval.decisionReason}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={onApprove}
            className="px-2.5 py-1 text-2xs font-medium rounded bg-success/10 text-success hover:bg-success/20 transition-default"
          >
            Allow
          </button>
          <button
            onClick={onDeny}
            className="px-2.5 py-1 text-2xs font-medium rounded bg-destructive/10 text-destructive hover:bg-destructive/20 transition-default"
          >
            Deny
          </button>
        </div>
      </div>
      {expanded && (
        <div className="px-3 py-2 border-t border-warning/20 bg-warning/5">
          <pre className="text-2xs text-foreground-muted font-mono whitespace-pre-wrap break-all overflow-x-auto max-h-48">
            {JSON.stringify(approval.input, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
