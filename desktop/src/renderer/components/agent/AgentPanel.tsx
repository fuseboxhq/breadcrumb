import React, { useState, useEffect, useRef, useCallback, memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import {
  Send,
  Square,
  Sparkles,
  Loader2,
  ChevronRight,
  FileEdit,
  TerminalSquare,
  Search,
  FolderSearch,
  Eye,
  FileText,
  Globe,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Brain,
  ArrowDown,
  Clipboard,
  AlertCircle,
  RotateCcw,
  Clock,
  GitBranch,
  X,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────

type PermissionMode = "default" | "acceptEdits" | "bypassPermissions" | "plan" | "dontAsk";

interface ChatMessage {
  id: string;
  type: "user" | "assistant" | "thinking" | "tool_use" | "tool_result";
  content: string;
  timestamp: number;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolUseId?: string;
  isError?: boolean;
  duration?: number;
}

interface ApprovalRequest {
  toolUseID: string;
  toolName: string;
  input: Record<string, unknown>;
  decisionReason?: string;
  suggestions?: unknown[];
}

interface AgentPanelProps {
  sessionId: string;
  cwd?: string;
}

interface SessionInfo {
  sessionId: string;
  summary: string;
  lastModified: number;
  firstPrompt?: string;
  gitBranch?: string;
  cwd?: string;
}

// ── Constants ──────────────────────────────────────────────────────────

const PERMISSION_MODES: { value: PermissionMode; label: string; desc: string }[] = [
  { value: "default", label: "Default", desc: "Prompts for dangerous operations" },
  { value: "acceptEdits", label: "Accept Edits", desc: "Auto-accept file edits" },
  { value: "plan", label: "Plan", desc: "No tool execution" },
  { value: "dontAsk", label: "Don't Ask", desc: "Deny if not pre-approved" },
  { value: "bypassPermissions", label: "Full Access", desc: "Skip all permission checks" },
];

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

const SUGGESTED_PROMPTS = [
  { label: "Explain this codebase", prompt: "Give me an overview of this codebase — what it does, the key directories, and the main technologies used." },
  { label: "Find potential issues", prompt: "Look through the codebase and identify any potential bugs, error handling issues, or code smells." },
  { label: "Write tests", prompt: "Identify the most critical paths in this codebase and help me write tests for them." },
];

// ── Utilities ──────────────────────────────────────────────────────────

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

function getToolPreview(toolName: string, input: Record<string, unknown>): string | null {
  if (toolName === "Bash" && input.command) return String(input.command);
  if (toolName === "Read" && input.file_path) return String(input.file_path);
  if (toolName === "Edit" && input.file_path) return String(input.file_path);
  if (toolName === "Write" && input.file_path) return String(input.file_path);
  if (toolName === "Grep" && input.pattern) return `/${input.pattern}/`;
  if (toolName === "Glob" && input.pattern) return String(input.pattern);
  return null;
}

// ── Main Component ─────────────────────────────────────────────────────

export function AgentPanel({ sessionId, cwd }: AgentPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingThinking, setStreamingThinking] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const [input, setInput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [permissionMode, setPermissionMode] = useState<PermissionMode>("default");
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [toolProgress, setToolProgress] = useState<string | null>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [historySessions, setHistorySessions] = useState<SessionInfo[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [resumeTarget, setResumeTarget] = useState<{ id: string; summary: string } | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sessionStarted = useRef(false);
  const currentBlockType = useRef<"thinking" | "text" | null>(null);
  const thinkingStartTime = useRef<number | null>(null);
  const inputHistory = useRef<string[]>([]);
  const historyIndex = useRef(-1);
  const historyDropdownRef = useRef<HTMLDivElement>(null);

  // IntersectionObserver for smart auto-scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const container = scrollContainerRef.current;
    if (!sentinel || !container) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsNearBottom(entry.isIntersecting),
      { root: container, threshold: 0, rootMargin: "80px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  // Auto-scroll when near bottom and content changes
  useEffect(() => {
    if (isNearBottom) {
      sentinelRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, streamingText, streamingThinking, pendingApprovals, isNearBottom]);

  const scrollToBottom = useCallback(() => {
    sentinelRef.current?.scrollIntoView({ behavior: "smooth" });
    setIsNearBottom(true);
  }, []);

  // Load session history when dropdown opens
  useEffect(() => {
    if (!showHistory || !cwd) return;
    setHistoryLoading(true);
    window.breadcrumbAPI?.agent
      ?.listSessions({ cwd, limit: 20 })
      .then((result) => {
        if (result?.success && result.sessions) {
          setHistorySessions(result.sessions as SessionInfo[]);
        }
      })
      .finally(() => setHistoryLoading(false));
  }, [showHistory, cwd]);

  // Close history dropdown on click outside
  useEffect(() => {
    if (!showHistory) return;
    const handler = (e: MouseEvent) => {
      if (historyDropdownRef.current && !historyDropdownRef.current.contains(e.target as Node)) {
        setShowHistory(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showHistory]);

  // Subscribe to agent events
  useEffect(() => {
    const api = window.breadcrumbAPI?.agent;
    if (!api) return;

    const cleanupMessage = api.onMessage(({ sessionId: sid, message }) => {
      if (sid !== sessionId) return;
      const msg = message as Record<string, unknown>;

      // ── Stream events ──
      if (msg.type === "stream_event") {
        const event = msg.event as Record<string, unknown> | undefined;
        if (!event) return;

        if (event.type === "content_block_start") {
          const block = event.content_block as Record<string, unknown> | undefined;
          if (block?.type === "thinking") {
            currentBlockType.current = "thinking";
            thinkingStartTime.current = Date.now();
            setStreamingThinking("");
          } else if (block?.type === "text") {
            currentBlockType.current = "text";
          }
          return;
        }

        if (event.type === "content_block_delta") {
          const delta = event.delta as Record<string, unknown> | undefined;
          if (delta?.type === "thinking_delta" && typeof delta.thinking === "string") {
            setStreamingThinking((prev) => prev + delta.thinking);
          } else if (delta?.type === "text_delta" && typeof delta.text === "string") {
            setStreamingText((prev) => prev + delta.text);
          }
          return;
        }

        return;
      }

      // ── Complete assistant message ──
      if (msg.type === "assistant") {
        const betaMsg = msg.message as Record<string, unknown> | undefined;
        const content = betaMsg?.content as Array<Record<string, unknown>> | undefined;

        // Extract thinking
        const thinkingBlocks = content?.filter((b) => b.type === "thinking") ?? [];
        const thinkingText = thinkingBlocks.map((b) => b.thinking as string).join("\n\n");
        if (thinkingText) {
          const elapsed = thinkingStartTime.current ? Date.now() - thinkingStartTime.current : 0;
          setMessages((prev) => [
            ...prev,
            {
              id: `thinking-${Date.now()}`,
              type: "thinking",
              content: thinkingText,
              timestamp: Date.now(),
              duration: elapsed,
            },
          ]);
        }

        // Extract text
        const textBlocks = content?.filter((b) => b.type === "text") ?? [];
        const text = textBlocks.map((b) => b.text as string).join("");
        if (text) {
          setMessages((prev) => [
            ...prev,
            {
              id: (msg.uuid as string) || `assistant-${Date.now()}`,
              type: "assistant",
              content: text,
              timestamp: Date.now(),
            },
          ]);
        }

        // Extract tool_use
        const toolBlocks = content?.filter((b) => b.type === "tool_use") ?? [];
        for (const tool of toolBlocks) {
          setMessages((prev) => [
            ...prev,
            {
              id: (tool.id as string) || `tool-${Date.now()}-${Math.random()}`,
              type: "tool_use",
              content: `Using ${tool.name}`,
              toolName: tool.name as string,
              toolInput: tool.input as Record<string, unknown>,
              toolUseId: tool.id as string,
              timestamp: Date.now(),
            },
          ]);
        }

        setStreamingThinking("");
        setStreamingText("");
        currentBlockType.current = null;
        thinkingStartTime.current = null;
        return;
      }

      // ── Tool result ──
      if (msg.type === "tool_result") {
        let resultText = "";
        const content = msg.content;
        if (typeof content === "string") {
          resultText = content;
        } else if (Array.isArray(content)) {
          resultText = (content as Array<Record<string, unknown>>)
            .map((b) => (b.type === "text" ? (b.text as string) : JSON.stringify(b)))
            .join("\n");
        }
        setMessages((prev) => [
          ...prev,
          {
            id: (msg.uuid as string) || `result-${Date.now()}-${Math.random()}`,
            type: "tool_result",
            content: resultText || "(no output)",
            toolUseId: msg.tool_use_id as string,
            isError: msg.is_error === true,
            timestamp: Date.now(),
          },
        ]);
        setToolProgress(null);
        return;
      }

      // ── Tool progress ──
      if (msg.type === "tool_progress") {
        const content = msg.content as string | undefined;
        if (content) setToolProgress(content);
        return;
      }

      // ── Result (turn complete) ──
      if (msg.type === "result") {
        setIsRunning(false);
        setStreamingText("");
        setStreamingThinking("");
        setToolProgress(null);
        currentBlockType.current = null;
        return;
      }

      // ── System init ──
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
      setStreamingThinking("");
    });

    return () => {
      cleanupMessage();
      cleanupApproval();
      cleanupError();
      cleanupDone();
    };
  }, [sessionId]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = useCallback(async () => {
    const prompt = input.trim();
    if (!prompt || isRunning) return;

    inputHistory.current = [prompt, ...inputHistory.current.slice(0, 49)];
    historyIndex.current = -1;
    setInput("");
    setError(null);
    if (inputRef.current) inputRef.current.style.height = "auto";

    // Optimistic user message
    setMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, type: "user", content: prompt, timestamp: Date.now() },
    ]);

    setIsRunning(true);
    const api = window.breadcrumbAPI?.agent;
    if (!api) return;

    if (!sessionStarted.current) {
      sessionStarted.current = true;
      const startOpts: Record<string, unknown> = {
        sessionId,
        prompt,
        cwd: cwd || "/",
        permissionMode,
      };
      // If resuming a previous session, include the resume ID
      if (resumeTarget) {
        startOpts.resume = resumeTarget.id;
        setResumeTarget(null);
      }
      const result = await api.start(startOpts as Parameters<typeof api.start>[0]);
      if (!result.success) {
        setError(result.error || "Failed to start session");
        setIsRunning(false);
        sessionStarted.current = false;
      }
    } else {
      const result = await api.send({ sessionId, prompt, permissionMode });
      if (!result.success) {
        setError(result.error || "Failed to send message");
        setIsRunning(false);
      }
    }
  }, [input, isRunning, sessionId, cwd, permissionMode, resumeTarget]);

  const handleInterrupt = useCallback(async () => {
    await window.breadcrumbAPI?.agent?.interrupt(sessionId);
  }, [sessionId]);

  const handleApproval = useCallback(
    async (toolUseID: string, decision: "allow" | "deny", alwaysAllow?: boolean) => {
      try {
        const result = await window.breadcrumbAPI?.agent?.approve({
          toolUseID,
          decision,
          alwaysAllow,
        });
        if (result && !result.success) {
          console.error("[AgentPanel] Approval failed:", result.error);
        }
      } catch (err) {
        console.error("[AgentPanel] Approval IPC error:", err);
      }
      setPendingApprovals((prev) => prev.filter((a) => a.toolUseID !== toolUseID));
    },
    []
  );

  const handleSuggestedPrompt = useCallback((prompt: string) => {
    setInput(prompt);
    inputRef.current?.focus();
  }, []);

  const handleResumeSession = useCallback(
    (session: SessionInfo) => {
      // If there's an active session, terminate it first
      if (sessionStarted.current) {
        window.breadcrumbAPI?.agent?.terminate(sessionId);
        sessionStarted.current = false;
      }
      // Reset state
      setMessages([]);
      setStreamingText("");
      setStreamingThinking("");
      setError(null);
      setPendingApprovals([]);
      setToolProgress(null);
      // Set resume target — the next handleSend will use it
      setResumeTarget({ id: session.sessionId, summary: session.summary });
      setShowHistory(false);
      inputRef.current?.focus();
    },
    [sessionId]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
        return;
      }
      if (e.key === "ArrowUp" && !input && inputHistory.current.length > 0) {
        e.preventDefault();
        const idx = Math.min(historyIndex.current + 1, inputHistory.current.length - 1);
        historyIndex.current = idx;
        setInput(inputHistory.current[idx]);
      }
      if (e.key === "ArrowDown" && historyIndex.current >= 0) {
        e.preventDefault();
        const idx = historyIndex.current - 1;
        historyIndex.current = idx;
        setInput(idx >= 0 ? inputHistory.current[idx] : "");
      }
    },
    [handleSend, input]
  );

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    historyIndex.current = -1;
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 192)}px`;
  }, []);

  const handlePermissionChange = useCallback(
    (mode: PermissionMode) => {
      setPermissionMode(mode);
      if (sessionStarted.current) {
        window.breadcrumbAPI?.agent?.setPermissionMode({ sessionId, mode });
      }
    },
    [sessionId]
  );

  const hasContent = messages.length > 0 || !!streamingText || !!streamingThinking;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="h-10 flex items-center justify-between px-4 bg-background-raised border-b border-border shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-5 h-5 rounded-md bg-[#D97757]/10 flex items-center justify-center">
            <Sparkles className="w-3 h-3 text-[#D97757]" />
          </div>
          <span className="text-xs font-semibold text-foreground tracking-tight">Claude Code</span>
          {isRunning && (
            <div className="flex items-center gap-1.5 text-2xs text-foreground-muted animate-fade-in">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>
                {streamingThinking ? "Thinking..." : toolProgress ? "Working..." : "Generating..."}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {cwd && (
            <div className="relative" ref={historyDropdownRef}>
              <button
                onClick={() => setShowHistory(!showHistory)}
                className={`p-1.5 rounded-md transition-default ${
                  showHistory
                    ? "bg-accent/10 text-accent"
                    : "text-foreground-muted hover:text-foreground-secondary hover:bg-muted/20"
                }`}
                title="Session history"
              >
                <Clock className="w-3.5 h-3.5" />
              </button>
              {showHistory && (
                <div className="absolute top-full right-0 mt-1 w-80 bg-background-raised border border-border rounded-lg shadow-lg z-30 animate-fade-in">
                  <div className="px-3 py-2 border-b border-border flex items-center justify-between">
                    <span className="text-xs font-medium text-foreground">Session History</span>
                    <button
                      onClick={() => setShowHistory(false)}
                      className="p-0.5 rounded text-foreground-muted hover:text-foreground-secondary"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {historyLoading && (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="w-4 h-4 animate-spin text-foreground-muted" />
                      </div>
                    )}
                    {!historyLoading && historySessions.length === 0 && (
                      <p className="text-xs text-foreground-muted text-center py-6">
                        No previous sessions
                      </p>
                    )}
                    {!historyLoading &&
                      historySessions.map((session) => (
                        <button
                          key={session.sessionId}
                          onClick={() => handleResumeSession(session)}
                          className="w-full text-left px-3 py-2.5 hover:bg-muted/20 transition-default border-b border-border last:border-0"
                        >
                          <p className="text-xs text-foreground font-medium truncate">
                            {session.summary || session.firstPrompt || "Untitled session"}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-2xs text-foreground-muted">
                              {formatRelativeTime(session.lastModified)}
                            </span>
                            {session.gitBranch && (
                              <span className="flex items-center gap-0.5 text-2xs text-foreground-muted">
                                <GitBranch className="w-2.5 h-2.5" />
                                {session.gitBranch}
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <PermissionSelector value={permissionMode} onChange={handlePermissionChange} />
        </div>
      </div>

      {/* Resume banner */}
      {resumeTarget && (
        <div className="px-4 py-2 bg-accent/5 border-b border-accent/20 flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-accent" />
            <span className="text-xs text-foreground-secondary">
              Resuming: <span className="font-medium text-foreground">{resumeTarget.summary}</span>
            </span>
          </div>
          <button
            onClick={() => setResumeTarget(null)}
            className="p-0.5 rounded text-foreground-muted hover:text-foreground-secondary"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Messages area — click to focus input */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto relative"
        onClick={(e) => {
          // Focus input when clicking empty space (not buttons/links/text selections)
          const target = e.target as HTMLElement;
          if (!target.closest("button, a, pre, code, [data-no-focus]") && !window.getSelection()?.toString()) {
            inputRef.current?.focus();
          }
        }}
      >
        <div className="px-4 py-4 space-y-3">
          {/* Empty state */}
          {!hasContent && !isRunning && <EmptyState onPromptClick={handleSuggestedPrompt} />}

          {/* Loading skeleton */}
          {isRunning && !hasContent && (
            <div className="flex gap-2.5 animate-fade-in">
              <div className="w-5 h-5 rounded-md bg-[#D97757]/10 flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="w-3 h-3 text-[#D97757]" />
              </div>
              <div className="flex-1 space-y-2.5 pt-1">
                <div className="skeleton h-3 w-3/4 rounded" />
                <div className="skeleton h-3 w-1/2 rounded" />
                <div className="skeleton h-3 w-5/8 rounded" />
              </div>
            </div>
          )}

          {/* Rendered messages */}
          {messages.map((msg) => (
            <MemoizedMessage key={msg.id} message={msg} />
          ))}

          {/* Streaming thinking */}
          {streamingThinking && <StreamingThinkingBlock content={streamingThinking} />}

          {/* Streaming text */}
          {streamingText && (
            <div className="flex gap-2.5 animate-fade-in">
              <div className="w-5 h-5 rounded-md bg-[#D97757]/10 flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="w-3 h-3 text-[#D97757]" />
              </div>
              <div className="flex-1 min-w-0">
                <MarkdownContent content={streamingText} />
                <span className="inline-block w-1.5 h-4 bg-[#D97757]/50 animate-pulse rounded-sm align-middle" />
              </div>
            </div>
          )}

          {/* Tool progress */}
          {toolProgress && (
            <div className="ml-8 flex items-center gap-2 px-3 py-2 text-2xs text-foreground-muted bg-muted/10 rounded-lg animate-fade-in">
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
              onAlwaysAllow={() => handleApproval(approval.toolUseID, "allow", true)}
              onDeny={() => handleApproval(approval.toolUseID, "deny")}
            />
          ))}

          {/* Error */}
          {error && (
            <ErrorCard
              error={error}
              onDismiss={() => setError(null)}
              onRetry={
                !sessionStarted.current
                  ? undefined
                  : () => {
                      setError(null);
                      const lastUserMsg = [...messages].reverse().find((m) => m.type === "user");
                      if (lastUserMsg) {
                        setInput(lastUserMsg.content);
                        inputRef.current?.focus();
                      }
                    }
              }
            />
          )}

          <div ref={sentinelRef} className="h-1" />
        </div>

        {/* Scroll to bottom */}
        {!isNearBottom && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-4 right-4 p-2 rounded-full bg-background-raised border border-border shadow-md hover:bg-background-overlay transition-default z-10"
            title="Scroll to bottom"
          >
            <ArrowDown className="w-3.5 h-3.5 text-foreground-muted" />
          </button>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-border px-4 py-3 bg-background-raised shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={isRunning ? "Waiting for response..." : "Ask Claude Code anything..."}
            disabled={isRunning}
            rows={3}
            className="flex-1 resize-none bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-foreground-muted/40 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/30 max-h-48 overflow-y-auto disabled:opacity-50 transition-default"
            style={{ minHeight: "72px" }}
          />
          {isRunning ? (
            <button
              onClick={handleInterrupt}
              className="p-2.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-default shrink-0"
              title="Stop generation"
            >
              <Square className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="p-2.5 rounded-lg bg-[#D97757] text-white hover:bg-[#c46a4d] transition-default disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
              title="Send (Enter)"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>
        <p className="text-2xs text-foreground-muted/40 mt-1.5 text-center select-none">
          Enter to send &middot; Shift+Enter for new line &middot; &uarr; for history
        </p>
      </div>
    </div>
  );
}

// ── Message Router ─────────────────────────────────────────────────────

const MemoizedMessage = memo(function MessageRouter({ message }: { message: ChatMessage }) {
  switch (message.type) {
    case "user":
      return <UserMessage content={message.content} />;
    case "assistant":
      return <AssistantMessage content={message.content} />;
    case "thinking":
      return <ThinkingBlock content={message.content} duration={message.duration} />;
    case "tool_use":
      return <ToolUseBlock toolName={message.toolName} input={message.toolInput} />;
    case "tool_result":
      return <ToolResultBlock content={message.content} isError={message.isError} />;
    default:
      return null;
  }
});

// ── User Message ───────────────────────────────────────────────────────

function UserMessage({ content }: { content: string }) {
  return (
    <div className="flex justify-end animate-fade-in">
      <div className="max-w-[85%] px-3.5 py-2.5 rounded-2xl rounded-br-md bg-primary/10">
        <p className="text-sm text-foreground whitespace-pre-wrap break-words">{content}</p>
      </div>
    </div>
  );
}

// ── Assistant Message ──────────────────────────────────────────────────

function AssistantMessage({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group flex gap-2.5 animate-fade-in">
      <div className="w-5 h-5 rounded-md bg-[#D97757]/10 flex items-center justify-center shrink-0 mt-0.5">
        <Sparkles className="w-3 h-3 text-[#D97757]" />
      </div>
      <div className="flex-1 min-w-0 relative">
        <MarkdownContent content={content} />
        <button
          onClick={handleCopy}
          className="absolute top-0 right-0 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity text-foreground-muted hover:text-foreground-secondary hover:bg-muted/30"
          title={copied ? "Copied!" : "Copy message"}
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-success" />
          ) : (
            <Clipboard className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}

// ── Thinking Block (completed) ─────────────────────────────────────────

function ThinkingBlock({ content, duration }: { content: string; duration?: number }) {
  const [expanded, setExpanded] = useState(false);
  const durationSecs = duration ? Math.round(duration / 1000) : 0;

  return (
    <div className="ml-8 animate-fade-in">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 py-1 text-xs text-foreground-muted/60 hover:text-foreground-muted transition-default"
      >
        <ChevronRight
          className={`w-3 h-3 transition-transform duration-150 ${expanded ? "rotate-90" : ""}`}
        />
        <Brain className="w-3.5 h-3.5" />
        <span>Thought{durationSecs > 0 ? ` for ${formatDuration(durationSecs)}` : ""}</span>
      </button>
      {expanded && (
        <div className="mt-1 ml-5 pl-3 border-l-2 border-foreground-muted/10 animate-fade-in">
          <pre className="text-xs text-foreground-muted/50 whitespace-pre-wrap break-words font-mono leading-relaxed max-h-64 overflow-y-auto">
            {content}
          </pre>
        </div>
      )}
    </div>
  );
}

// ── Streaming Thinking Block ───────────────────────────────────────────

function StreamingThinkingBlock({ content }: { content: string }) {
  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    startTimeRef.current = Date.now();
    const interval = setInterval(() => {
      setElapsed(Math.round((Date.now() - startTimeRef.current) / 1000));
    }, 100);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="ml-8 animate-fade-in">
      <div className="flex items-center gap-1.5 py-1 text-xs text-foreground-muted/60">
        <Loader2 className="w-3 h-3 animate-spin" />
        <Brain className="w-3.5 h-3.5" />
        <span>Thinking{elapsed > 0 ? ` for ${formatDuration(elapsed)}` : ""}...</span>
      </div>
      <div className="mt-1 ml-5 pl-3 border-l-2 border-purple-500/20">
        <pre className="text-xs text-foreground-muted/50 whitespace-pre-wrap break-words font-mono leading-relaxed max-h-48 overflow-y-auto">
          {content}
          <span className="inline-block w-1 h-3 bg-purple-400/40 animate-pulse ml-0.5 align-middle rounded-sm" />
        </pre>
      </div>
    </div>
  );
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
    <div className="ml-8 animate-fade-in">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 px-3 py-1.5 text-2xs rounded-lg border border-border hover:bg-muted/20 transition-default w-full text-left"
      >
        <ChevronRight
          className={`w-3 h-3 text-foreground-muted transition-transform duration-150 shrink-0 ${expanded ? "rotate-90" : ""}`}
        />
        <Icon className={`w-3.5 h-3.5 shrink-0 ${meta?.color ?? "text-foreground-muted"}`} />
        <span className="font-mono font-medium text-foreground-secondary">
          {meta?.label ?? toolName ?? "Tool"}
        </span>
        {preview && (
          <span className="font-mono text-foreground-muted truncate flex-1 text-right">
            {preview}
          </span>
        )}
      </button>
      {expanded && input && (
        <div className="mt-1 ml-5 rounded-lg overflow-hidden border border-border">
          <pre className="p-3 text-2xs text-foreground-muted font-mono whitespace-pre-wrap break-all overflow-x-auto max-h-48 bg-muted/10">
            {JSON.stringify(input, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

// ── Tool Result Block ──────────────────────────────────────────────────

function ToolResultBlock({ content, isError }: { content: string; isError?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = content.length > 300;
  const displayContent = expanded || !isLong ? content : content.slice(0, 300) + "...";

  return (
    <div
      className={`ml-8 animate-fade-in rounded-lg border overflow-hidden ${
        isError ? "border-destructive/20 bg-destructive/5" : "border-border bg-muted/5"
      }`}
    >
      <div className="px-3 py-1.5 flex items-center gap-2">
        {isError ? (
          <XCircle className="w-3 h-3 text-destructive shrink-0" />
        ) : (
          <CheckCircle2 className="w-3 h-3 text-success shrink-0" />
        )}
        <span className="text-2xs font-medium text-foreground-secondary">
          {isError ? "Error" : "Result"}
        </span>
      </div>
      <div className="px-3 pb-2">
        <pre className="text-2xs text-foreground-muted font-mono whitespace-pre-wrap break-all leading-relaxed max-h-64 overflow-y-auto">
          {displayContent}
        </pre>
        {isLong && !expanded && (
          <button
            onClick={() => setExpanded(true)}
            className="mt-1 text-2xs text-accent hover:underline"
          >
            Show more ({content.length} chars)
          </button>
        )}
      </div>
    </div>
  );
}

// ── Approval Card ──────────────────────────────────────────────────────

function ApprovalCard({
  approval,
  onApprove,
  onAlwaysAllow,
  onDeny,
}: {
  approval: ApprovalRequest;
  onApprove: () => void;
  onAlwaysAllow: () => void;
  onDeny: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const meta = TOOL_META[approval.toolName];
  const Icon = meta?.icon ?? TerminalSquare;
  const preview = getToolPreview(approval.toolName, approval.input);

  return (
    <div className="ml-8 border border-warning/30 rounded-xl bg-warning/5 overflow-hidden animate-fade-in" data-no-focus>
      <div className="px-4 py-3 flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-warning/10 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-warning" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">
              {meta?.label ?? approval.toolName}
            </span>
            {approval.decisionReason && (
              <span className="text-2xs text-foreground-muted bg-warning/10 px-1.5 py-0.5 rounded">
                {approval.decisionReason}
              </span>
            )}
          </div>
          {preview && (
            <p className="text-xs text-foreground-secondary font-mono mt-0.5 truncate">
              {preview}
            </p>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); setShowDetails(!showDetails); }}
            className="mt-1 text-2xs text-foreground-muted hover:text-foreground-secondary transition-default"
          >
            {showDetails ? "Hide details" : "Show details"}
          </button>
        </div>
      </div>
      {showDetails && (
        <div className="px-4 pb-3">
          <div className="bg-[#22272e] rounded-lg p-3">
            <pre className="text-2xs text-[#adbac7] font-mono whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
              {JSON.stringify(approval.input, null, 2)}
            </pre>
          </div>
        </div>
      )}
      <div className="flex border-t border-warning/20">
        <button
          onClick={(e) => { e.stopPropagation(); onDeny(); }}
          className="py-2.5 px-4 text-sm font-medium text-foreground-secondary hover:bg-destructive/10 hover:text-destructive transition-default cursor-pointer"
        >
          Deny
        </button>
        <div className="flex-1" />
        <button
          onClick={(e) => { e.stopPropagation(); onAlwaysAllow(); }}
          className="py-2.5 px-4 text-sm font-medium text-foreground-muted hover:bg-accent/10 hover:text-accent transition-default cursor-pointer"
        >
          Always Allow
        </button>
        <div className="w-px bg-warning/20" />
        <button
          onClick={(e) => { e.stopPropagation(); onApprove(); }}
          className="py-2.5 px-4 text-sm font-medium text-success hover:bg-success/10 transition-default cursor-pointer"
        >
          Allow
        </button>
      </div>
    </div>
  );
}

// ── Error Card ─────────────────────────────────────────────────────────

function ErrorCard({
  error,
  onDismiss,
  onRetry,
}: {
  error: string;
  onDismiss: () => void;
  onRetry?: () => void;
}) {
  return (
    <div className="px-4 py-3 rounded-xl bg-destructive/5 border border-destructive/20 animate-fade-in">
      <div className="flex items-start gap-2.5">
        <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-destructive font-medium">Error</p>
          <p className="text-xs text-foreground-secondary mt-0.5">{error}</p>
        </div>
        <button
          onClick={onDismiss}
          className="p-1 rounded hover:bg-destructive/10 transition-default shrink-0"
        >
          <XCircle className="w-3.5 h-3.5 text-foreground-muted" />
        </button>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 ml-6.5 flex items-center gap-1.5 text-xs text-accent hover:underline"
        >
          <RotateCcw className="w-3 h-3" />
          Retry last message
        </button>
      )}
    </div>
  );
}

// ── Empty State ────────────────────────────────────────────────────────

function EmptyState({ onPromptClick }: { onPromptClick: (prompt: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center animate-fade-in-up">
      <div className="w-12 h-12 rounded-2xl bg-[#D97757]/10 flex items-center justify-center mb-4">
        <Sparkles className="w-6 h-6 text-[#D97757]" />
      </div>
      <h2 className="text-base font-semibold text-foreground mb-1">Claude Code</h2>
      <p className="text-sm text-foreground-muted max-w-xs mb-6">
        Read, edit, and create files. Run commands. Search your codebase. And more.
      </p>
      <div className="space-y-2 w-full max-w-sm">
        {SUGGESTED_PROMPTS.map((sp) => (
          <button
            key={sp.label}
            onClick={() => onPromptClick(sp.prompt)}
            className="w-full text-left px-4 py-2.5 rounded-lg border border-border hover:bg-muted/20 hover:border-border-strong transition-default group"
          >
            <span className="text-sm text-foreground-secondary group-hover:text-foreground transition-default">
              {sp.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Permission Selector ────────────────────────────────────────────────

function PermissionSelector({
  value,
  onChange,
}: {
  value: PermissionMode;
  onChange: (mode: PermissionMode) => void;
}) {
  return (
    <div className="flex rounded-lg border border-border overflow-hidden bg-background">
      {PERMISSION_MODES.map((m) => (
        <button
          key={m.value}
          onClick={() => onChange(m.value)}
          className={`px-2 py-1 text-2xs font-medium transition-default ${
            value === m.value
              ? "bg-accent/10 text-accent"
              : "text-foreground-muted hover:text-foreground-secondary hover:bg-muted/20"
          }`}
          title={m.desc}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

// ── Markdown Content ───────────────────────────────────────────────────

const MarkdownContent = memo(function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      components={{
        pre({ children }) {
          return <CodeBlockWrapper>{children}</CodeBlockWrapper>;
        },
        code({ className, children, ...props }) {
          if (className) {
            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          }
          return (
            <code
              className="px-1.5 py-0.5 rounded bg-muted/40 text-[0.9em] font-mono text-foreground"
              {...props}
            >
              {children}
            </code>
          );
        },
        h1: ({ children }) => (
          <h1 className="text-lg font-bold text-foreground mt-4 mb-2">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-base font-semibold text-foreground mt-3 mb-1.5">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-sm font-semibold text-foreground mt-2 mb-1">{children}</h3>
        ),
        p: ({ children }) => (
          <p className="text-sm text-foreground leading-relaxed mb-2 last:mb-0">{children}</p>
        ),
        ul: ({ children }) => (
          <ul className="text-sm text-foreground list-disc pl-5 mb-2 space-y-0.5">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="text-sm text-foreground list-decimal pl-5 mb-2 space-y-0.5">{children}</ol>
        ),
        li: ({ children }) => (
          <li className="text-sm text-foreground leading-relaxed">{children}</li>
        ),
        a: ({ children, href }) => (
          <a
            href={href}
            onClick={(e) => {
              e.preventDefault();
              if (href) window.breadcrumbAPI?.browser?.openExternal(href);
            }}
            className="text-accent hover:underline cursor-pointer"
          >
            {children}
          </a>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-foreground-muted/20 pl-3 text-foreground-secondary mb-2 italic">
            {children}
          </blockquote>
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto mb-2 rounded-lg border border-border">
            <table className="text-sm w-full">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border-b border-border px-3 py-1.5 text-left text-xs font-medium text-foreground-secondary bg-muted/20">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border-b border-border px-3 py-1.5 text-sm text-foreground">
            {children}
          </td>
        ),
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        hr: () => <hr className="border-border my-3" />,
      }}
    >
      {content}
    </ReactMarkdown>
  );
});

// ── Code Block Wrapper ─────────────────────────────────────────────────

function CodeBlockWrapper({ children }: { children: React.ReactNode }) {
  const preRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);

  let language = "";
  React.Children.forEach(children, (child) => {
    if (React.isValidElement(child)) {
      const cls = String((child.props as Record<string, unknown>).className || "");
      const match = /language-(\w+)/.exec(cls);
      if (match) language = match[1];
    }
  });

  const handleCopy = async () => {
    const text = preRef.current?.textContent ?? "";
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-3 rounded-lg overflow-hidden border border-white/[0.06]">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#1c2128]">
        <span className="text-2xs text-white/30 font-mono">{language || "text"}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs text-white/30 hover:text-white/60 hover:bg-white/5 transition-default"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3" /> Copied
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" /> Copy
            </>
          )}
        </button>
      </div>
      <pre
        ref={preRef}
        className="overflow-x-auto p-4 text-sm bg-[#22272e] leading-relaxed [&>code]:bg-transparent [&>code]:p-0"
      >
        {children}
      </pre>
    </div>
  );
}
