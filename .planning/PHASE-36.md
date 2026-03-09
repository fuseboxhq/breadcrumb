# Phase 36: Agent Panel UX Overhaul — Premium Chat Experience

**Status:** in_progress
**Created:** 2026-03-09

## Objective

Overhaul the Claude Code agent panel from functional MVP into a premium, production-grade chat experience with proper markdown rendering, syntax-highlighted code blocks, streaming thinking display, tool result visualization, smooth animations, and session management — making it feel as polished as the terminal panel already does.

## Scope

**In scope:**
- Markdown rendering with syntax-highlighted code blocks (react-markdown + rehype-highlight)
- Extended thinking display (collapsible, streaming, with elapsed timer)
- Tool result rendering (show what tools returned, not just what they were called with)
- Smooth message animations (fade-in, slide-in for new messages)
- Intelligent auto-scroll (only when user is near bottom, with "scroll to bottom" button)
- Approval card redesign (larger buttons, clear context, what-would-happen preview)
- Permission mode selector redesign (segmented control with descriptions)
- Session history panel (list previous sessions, resume)
- Message copy-to-clipboard
- Streaming cursor redesign (smoother, more visible)
- Tool progress with full command visibility (expandable, not truncated)
- Error handling with recovery actions (retry button, categorized errors)
- Empty state with suggested prompts
- Input area improvements (auto-resize, input history with up arrow)
- Loading skeleton / thinking indicator before first response
- Optimistic user message rendering
- Code block copy button
- Backend changes to forward tool results to renderer

**Out of scope:**
- MCP server configuration UI
- Multi-agent orchestration
- Cost/token tracking UI
- File diff viewer for edits (use existing git diff panel)
- Slash commands or @ mentions in input
- Message reactions/ratings

## Constraints

- Frontend design skill active — follow design thinking process for UI tasks
- Must integrate with existing tab/pane architecture
- Reuse existing Tailwind theme tokens (accent, foreground, background-raised, etc.)
- Keep bundle size reasonable — lazy-load heavy deps like Shiki
- Maintain the existing IPC contract shape (extend, don't break)

## Key Research Findings

### t3code Patterns to Adopt
- **Optimistic updates**: User messages appear instantly
- **Tone-based styling**: Different opacity/colors for thinking/tool/info/error
- **Scroll anchoring**: Content expansions don't cause jarring jumps
- **Real-time thinking timer**: Shows elapsed time during reasoning
- **react-markdown + Shiki**: For markdown + syntax highlighting (with LRU cache)

### OpenCode Patterns to Adopt
- **Border color differentiation**: User vs assistant instantly distinguishable
- **Inline tool progress**: "Reading file...", "Executing command..." shown inline
- **Intelligent truncation**: Long output capped, expandable
- **Auto-jump scrolling**: Always show latest unless user scrolled up

### SDK Thinking Events
Thinking comes as `stream_event` deltas:
- `content_block_start` with `content_block.type === 'thinking'`
- `content_block_delta` with `delta.type === 'thinking_delta'` and `delta.thinking` string
- `content_block_stop` to end the block
These arrive BEFORE the text content blocks in the same assistant turn.

## Tasks

| ID | Title | Status | Complexity | Dependencies |
|----|-------|--------|------------|--------------|
| 1 | Add markdown rendering with syntax-highlighted code blocks | done | High | - |
| 2 | Implement extended thinking display with streaming and timer | done | High | - |
| 3 | Forward tool results through IPC and render in panel | done | High | - |
| 4 | Redesign message flow: animations, scroll, optimistic updates | done | High | 1 |
| 5 | Redesign approval cards and permission mode selector | done | Medium | 1 |
| 6 | Add session history panel and conversation persistence | open | High | - |
| 7 | Polish: empty state, input improvements, copy buttons, error UX | done | Medium | 1, 4 |

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Markdown renderer | react-markdown + rehype-highlight | Industry standard, tree-shakeable, supports GFM |
| Syntax highlighting | rehype-highlight | Lighter than Shiki, good enough for inline code |
| Animations | CSS transitions + Tailwind animate utilities | Already in the project, no new deps |
| Scroll behavior | IntersectionObserver for "near bottom" detection | More reliable than scroll position math |
| Thinking display | Collapsible panel with streaming text + elapsed timer | Matches Claude Code CLI and Claude.ai patterns |

## Completion Criteria

- [ ] Assistant messages render full markdown (headers, lists, bold, italic, links, tables)
- [ ] Code blocks have syntax highlighting with language detection and copy button
- [ ] Extended thinking is visible, collapsible, streams in real-time with elapsed timer
- [ ] Tool use blocks show both input AND results (file content, command output, etc.)
- [ ] New messages animate in smoothly (no jarring pops)
- [ ] Auto-scroll works intelligently (follows when near bottom, "jump to latest" button when scrolled up)
- [ ] Approval cards are clear, contextual, with properly-sized action buttons
- [ ] Permission mode selector shows descriptions and is easy to use
- [ ] Users can see and resume previous sessions
- [ ] Someone could record a 60-second demo and it would look like a real product

## Critical Files

- `desktop/src/renderer/components/agent/AgentPanel.tsx` — main component to overhaul
- `desktop/src/main/agent/AgentService.ts` — needs to forward tool results
- `desktop/src/main/ipc/agentIpc.ts` — may need new event types for tool results
- `desktop/src/preload/index.ts` — agent namespace in BreadcrumbAPI
- `desktop/src/renderer/store/appStore.ts` — agent tab/session state
- `desktop/src/shared/types/index.ts` — IPC channel definitions
