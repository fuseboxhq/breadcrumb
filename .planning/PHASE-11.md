# Phase 11: Terminal Intelligence & Interaction

**Status:** in_progress
**Beads Epic:** breadcrumb-sps
**Created:** 2026-02-12

## Objective

Transform the terminal experience from passive shell sessions into intelligent, interactive workspaces. Terminals should understand what's running inside them (Claude Code, npm, Python, etc.) and surface that context through smart pane labels. Users should be able to interact with terminal content through right-click context menus (copy, paste, zoom) and manage panes spatially — zooming a pane to fill the workspace, then restoring it with a double-click or shortcut. This phase makes the terminal feel responsive and aware.

## Scope

**In scope:**
- Smart pane naming — auto-detect the foreground process running in each pane (Claude Code, npm/pnpm/bun, python, node, vim, git, etc.) and display a friendly label
- Manual pane renaming — user can set a custom name that overrides auto-detection
- Label resolution pipeline: custom label → process label → CWD folder name → "Pane N" fallback
- ProcessDetector service in main process — poll `pty.process` every ~200ms, emit changes over IPC
- PROCESS_FRIENDLY_NAMES — mapping from raw process names to friendly display names
- Right-click context menu within terminal viewport — Copy, Paste, Select All, separator, Zoom/Maximize Pane, Split Horizontal, Split Vertical
- Pane zoom/maximize — temporarily expand a single pane to fill the entire workspace area, hiding other panes and the split layout
- Zoom restore — return to the previous split layout with all panes intact
- Double-click pane tab to toggle zoom
- Keyboard shortcut for zoom toggle: Cmd+Shift+Enter (iTerm2/Warp convention)
- Visual indicators for zoomed state (Maximize2/Minimize2 toolbar button)
- Terminal interaction polish — focus management after context menu close, consistent cursor behavior

**Out of scope:**
- File tree browsing within terminal CWD
- Terminal multiplexer features (tmux-style sessions that persist across app restart)
- Advanced process tree inspection (child processes, PIDs)
- Terminal search/find within scrollback
- Recording or replaying terminal sessions
- CSS animations for zoom transitions (optional polish, not required)

## Constraints

- Frontend design skill active — follow design thinking process for UI tasks
- Must maintain compatibility with the existing split pane system (PHASE-10 pane state in appStore)
- ProcessDetector runs in main process only — renderer receives updates via IPC
- Polling interval: 200ms (proven by VS Code at scale), macOS/Linux only (skip Windows — ConPTY doesn't update pty.process)
- Zoom is a UI-only state change — zoomed pane keeps its terminal session, other panes remain alive in background
- Right-click context menu uses Radix ContextMenu.Trigger wrapping the terminal container — simplest approach that auto-positions
- Maintain consistency with the Dracula-inspired design system

## Research Summary

**Overall Confidence:** HIGH

Three research areas investigated — see `.planning/research/PHASE-11-*.md` for details.

### Design Guidance
The `frontend-design` skill will be active during execution of UI tasks in this phase. It provides guidelines for typography, color, motion, spatial composition, and avoiding generic aesthetics.

**Process Detection** (PHASE-11-process-detection.md): Use `pty.process` property with 200ms polling on macOS/Linux (VS Code's proven approach). Returns raw process name ("node", "vim", "python"). Map through `PROCESS_FRIENDLY_NAMES` for display. All Node.js scripts (npm, pnpm, Claude Code) show as "node" — accept this limitation. Send initial value with `setTimeout(..., 0)` to avoid race condition. Clean up interval on pty exit. New IPC channel: `TERMINAL_PROCESS_CHANGE`.

**Context Menu** (PHASE-11-xterm-context-menu.md): xterm.js 5.5.0 has no built-in context menu. Wrap the terminal container div with Radix `ContextMenu.Trigger` (Approach A — simplest, auto-positions at right-click point). Use `terminal.getSelection()` for Copy, `terminal.paste(text)` for Paste (handles bracketed paste mode). Use `navigator.clipboard` for clipboard access (works in Electron renderer). Track selection state via `terminal.onSelectionChange()` to enable/disable Copy. Restore `terminal.focus()` after menu closes. No additional packages needed.

**Pane Zoom** (PHASE-11-pane-zoom.md): Use conditional rendering (not CSS `display: none`) — hide siblings, render only zoomed pane at full size. Existing ResizeObserver (80ms debounce) in TerminalInstance.tsx handles xterm.js resize automatically. Add `zoomedPane: { tabId, paneId } | null` to appStore. Keyboard shortcut: Cmd+Shift+Enter (iTerm2/Warp convention). Toolbar button with Maximize2/Minimize2 icons. Tab-scoped zoom (only affects current tab). Only show maximize button when `panes.length > 1`. Instant zoom first (like iTerm2), optional animation later.

## Recommended Approach

**Three parallel tracks converging into integration and polish.**

1. **Process Detection** (sps.1 → sps.2 → sps.3) — Main process service polls `pty.process` every 200ms, maps raw names through PROCESS_FRIENDLY_NAMES, sends changes via IPC. Renderer extends TerminalPane with `processName`/`processLabel`/`customLabel` fields. resolveLabel() utility resolves display name. Sidebar tree and pane tabs show resolved labels.

2. **Context Menu** (sps.4, parallel) — Wrap TerminalInstance container with Radix ContextMenu. Implement Copy (selection-aware), Paste, Select All, Clear Terminal. Track selection state via `terminal.onSelectionChange()`. Restore terminal focus after menu closes.

3. **Zoom** (sps.5 → sps.6) — Add `zoomedPane` to appStore. Conditional rendering in TerminalPanel: zoomed renders single pane full-size, normal renders PanelGroup split. Toolbar button with Maximize2/Minimize2 icons. Cmd+Shift+Enter keyboard shortcut. Add "Maximize Pane" to terminal context menu.

4. **Polish** (sps.7) — Smooth focus management, sidebar zoom indicator, optional transitions, final cleanup.

## Tasks

| ID | Title | Status | Complexity | Depends On |
|----|-------|--------|------------|------------|
| sps.1 | Process detection service & IPC channel | open | M | — |
| sps.2 | Pane label state & resolution pipeline | open | M | sps.1 |
| sps.3 | Pane label UI in sidebar & terminal toolbar | open | M | sps.2 |
| sps.4 | Terminal viewport context menu | open | M | — |
| sps.5 | Pane zoom state & conditional rendering | open | M | — |
| sps.6 | Zoom keyboard shortcut & context menu integration | open | L | sps.4, sps.5 |
| sps.7 | Polish — transitions, indicators & cleanup | open | L | sps.3, sps.6 |

**Dependency graph:**
```
sps.1 ──→ sps.2 ──→ sps.3 ──────────┐
                                      ├──→ sps.7
sps.4 ──────────────────┐            │
                        ├──→ sps.6 ──┘
sps.5 ─────────────────┘
```

**Parallel lanes:**
- Lane A: sps.1 → sps.2 → sps.3 (process detection → state → UI)
- Lane B: sps.4 (context menu, parallel with Lane A)
- Lane C: sps.5 (zoom state, parallel with all above)
- Merge: sps.6 (zoom + context menu integration, after sps.4 & sps.5)
- Final: sps.7 (polish, after sps.3 & sps.6)

### Task Details

**sps.1: Process detection service & IPC channel**
- Add 200ms polling of `pty.process` in TerminalService.ts for macOS/Linux
- Store current process name per session, compare before emitting (change-only)
- Send initial process name with `setTimeout(..., 0)` to yield event loop
- Add IPC channel `TERMINAL_PROCESS_CHANGE` to shared/types.ts
- Emit `{ sessionId, processName }` to renderer via `BrowserWindow.webContents.send()`
- Add `onTerminalProcessChange` listener to preload API
- Clear polling interval on pty.onExit()
- Create `PROCESS_FRIENDLY_NAMES` map: bash→bash, zsh→zsh, vim→Vim, nvim→Neovim, node→Node.js, python→Python, python3→Python, git→Git, ssh→SSH, docker→Docker, bun→Bun
- Files: `TerminalService.ts`, `shared/types.ts`, `preload/index.ts`

**sps.2: Pane label state & resolution pipeline**
- Extend `TerminalPane` interface with `processName?: string`, `processLabel?: string`, `customLabel?: string`
- Add appStore action: `updatePaneProcess(tabId, paneId, processName, processLabel)`
- Add appStore action: `setPaneCustomLabel(tabId, paneId, label)`
- Create `resolveLabel(pane: TerminalPane): string` utility — customLabel > processLabel > CWD folder name > "Pane N"
- Wire `onTerminalProcessChange` IPC listener in renderer to update matching pane's processName/processLabel
- Match by sessionId: find the tab+pane whose sessionId matches the IPC event
- Files: `appStore.ts`, new `utils/resolveLabel.ts` or inline

**sps.3: Pane label UI in sidebar & terminal toolbar** (frontend-design skill active)
- Update sidebar TerminalsTree pane nodes to show resolved labels instead of CWD
- Update TerminalPanel pane tab buttons to show resolved labels
- Add inline rename: double-click pane tab → editable input → save as customLabel
- Show process icon or badge next to label when available
- Clear custom label button (×) to revert to auto-detected name
- Files: `SidebarPanel.tsx`, `TerminalPanel.tsx`

**sps.4: Terminal viewport context menu** (frontend-design skill active)
- Wrap TerminalInstance's container div with `<ContextMenu>` from shared/ContextMenu.tsx
- Menu items: Copy (⌘C, disabled when no selection), Paste (⌘V), Select All (⌘A), separator, Clear Terminal (⌘L)
- Track `hasSelection` state via `terminal.onSelectionChange()`
- Implement handleCopy: `terminal.getSelection()` → `navigator.clipboard.writeText()`
- Implement handlePaste: `navigator.clipboard.readText()` → `terminal.paste()`
- Implement Select All: `terminal.selectAll()`
- Restore `terminal.focus()` after menu closes via Radix `onOpenChange`
- Files: `TerminalInstance.tsx`

**sps.5: Pane zoom state & conditional rendering**
- Add `zoomedPane: { tabId: string; paneId: string } | null` to appStore state
- Add actions: `togglePaneZoom(tabId, paneId)`, `clearPaneZoom()`
- Update `removePane` to clear zoom if zoomed pane is removed
- Update `removeTab` to clear zoom if tab is closed
- Conditional rendering in TerminalPanel: if `zoomedPane?.tabId === tabId`, render only zoomed pane at full size
- Add Maximize2/Minimize2 toolbar button next to split direction controls (only when `panes.length > 1`)
- Files: `appStore.ts`, `TerminalPanel.tsx`

**sps.6: Zoom keyboard shortcut & context menu integration**
- Add Cmd+Shift+Enter keyboard shortcut in TerminalPanel's existing keydown handler
- Add "Maximize Pane" / "Restore Panes" item to terminal context menu (from sps.4)
- Add "Split Horizontal" and "Split Vertical" items to context menu
- Wire zoom toggle from sidebar context menu (existing pane right-click menu)
- Files: `TerminalPanel.tsx`, `TerminalInstance.tsx`, `SidebarPanel.tsx`

**sps.7: Polish — transitions, indicators & cleanup**
- Focus management: ensure terminal focus restored after all interactions (context menu, zoom toggle, inline rename)
- Sidebar zoom indicator: show "(Zoomed)" badge or Maximize2 icon on zoomed pane node in tree
- Optional: subtle 150ms opacity transition when zooming/restoring
- Verify edge cases: zoom with 1 pane (button hidden), close zoomed pane (zoom clears), switch tabs while zoomed (tab-scoped)
- Files: multiple

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Process polling interval | 200ms | VS Code's proven interval — balances responsiveness (<250ms human perception) with negligible CPU (<0.1% with 10 terminals) |
| Process polling platform | macOS/Linux only | Windows ConPTY doesn't update pty.process after spawn |
| Node.js process detection | Show "Node.js" for all | npm, pnpm, Claude Code all show as "node" — no reliable way to distinguish without expensive process tree inspection |
| Context menu approach | Radix ContextMenu.Trigger wrapping container | Auto-positions at right-click point, handles collision, keyboard nav, accessibility — simplest approach |
| Clipboard API | navigator.clipboard | Already works in Electron renderer, simpler than IPC to main process |
| Paste method | terminal.paste() not terminal.write() | Handles bracketed paste mode, newline normalization, control sequence escaping |
| Zoom rendering | Conditional rendering | CSS display:none doesn't trigger ResizeObserver, so xterm.js won't resize. Conditional rendering lets ResizeObserver fire naturally |
| Zoom state location | Top-level appStore, not nested in TabPaneState | Zoom is temporary UI state, not pane metadata. Sidebar needs visibility. Easier to clear on tab close |
| Zoom keyboard shortcut | Cmd+Shift+Enter | iTerm2 and Warp convention. Mnemonic (Enter = go full-screen). No conflicts with existing shortcuts |
| Zoom animation | Instant first | Matches iTerm2/tmux behavior. Optional 150ms opacity fade as polish |
| Double-click target | Pane tab button, not divider | Divider is ambiguous (which pane?), pane tab has clear intent and large click target |

## Completion Criteria

- [ ] Pane labels auto-update to show the running process (e.g., "Vim", "Node.js", "Python")
- [ ] Users can manually rename panes with custom labels that persist until cleared
- [ ] Right-click within a terminal shows a styled context menu with Copy, Paste, Select All, Clear, Zoom, and Split options
- [ ] Can zoom/maximize a single pane to fill the workspace, hiding other panes
- [ ] Can restore from zoom back to the previous split layout
- [ ] Double-click on a pane tab toggles zoom
- [ ] Sidebar terminal tree reflects smart labels (process names, custom names)
- [ ] Zoom state is visually indicated (toolbar button icon changes, sidebar badge)
- [ ] Cmd+Shift+Enter toggles zoom on the active pane

## Sources

**HIGH confidence:**
- [node-pty TypeScript declarations — IPty.process](https://github.com/microsoft/node-pty/blob/main/typings/node-pty.d.ts)
- [VS Code terminalProcess.ts — 200ms _setupTitlePolling](https://github.com/microsoft/vscode)
- [xterm.js Terminal API — getSelection, paste, onSelectionChange](https://xtermjs.org/docs/api/terminal/classes/terminal/)
- [Radix UI Context Menu — Trigger/Portal positioning](https://www.radix-ui.com/primitives/docs/components/context-menu)
- [iTerm2 Documentation — Cmd+Shift+Enter zoom](https://iterm2.com/documentation-one-page.html)
- [Warp Split Panes — Maximize shortcut](https://docs.warp.dev/terminal/windows/split-panes)

**MEDIUM confidence:**
- [VS Code PR #18980 — contextmenu event for terminal](https://github.com/microsoft/vscode/pull/18980)
- [react-resizable-panels — imperative API for panel collapse](https://github.com/bvaughn/react-resizable-panels)
- [Electron Clipboard API](https://www.electronjs.org/docs/latest/api/clipboard)
