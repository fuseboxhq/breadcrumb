# Phase 11: Terminal Intelligence & Interaction

**Status:** not_started
**Beads Epic:** breadcrumb-sps
**Created:** 2026-02-12

## Objective

Transform the terminal experience from passive shell sessions into intelligent, interactive workspaces. Terminals should understand what's running inside them (Claude Code, npm, Python, etc.) and surface that context through smart pane labels. Users should be able to interact with terminal content through right-click context menus (copy, paste, zoom) and manage panes spatially — zooming a pane to fill the workspace, then restoring it with a double-click or shortcut. This phase makes the terminal feel responsive and aware.

## Scope

**In scope:**
- Smart pane naming — auto-detect the foreground process running in each pane (Claude Code, npm/pnpm/bun, python, node, vim, git, etc.) and display a friendly label
- Manual pane renaming — user can set a custom name that overrides auto-detection
- Label resolution pipeline: custom label → process label → CWD folder name → "Pane N" fallback
- ProcessDetector service in main process — poll `pty.process` every ~2 seconds, emit changes over IPC
- PROCESS_LABEL_MAP — mapping from raw process names to friendly display names with icons
- Right-click context menu within terminal viewport — Copy, Paste, Select All, separator, Zoom/Maximize Pane, Split Horizontal, Split Vertical
- Pane zoom/maximize — temporarily expand a single pane to fill the entire workspace area, hiding other panes and the split layout
- Zoom restore — return to the previous split layout with all panes intact
- Double-click pane header/divider to toggle zoom
- Keyboard shortcut for zoom toggle (e.g., Cmd+Shift+M or configurable)
- Visual indicators for zoomed state (breadcrumb showing "Zoomed" or a zoom icon)
- Terminal interaction polish — smooth transitions for zoom/restore, consistent cursor behavior

**Out of scope:**
- File tree browsing within terminal CWD
- Terminal multiplexer features (tmux-style sessions that persist across app restart)
- Advanced process tree inspection (child processes, PIDs)
- Terminal search/find within scrollback
- Recording or replaying terminal sessions

## Constraints

- Frontend design skill active — follow design thinking process for UI tasks
- Must maintain compatibility with the existing split pane system (PHASE-10 pane state in appStore)
- ProcessDetector runs in main process only — renderer receives updates via IPC
- Polling interval should be configurable but default to ~2 seconds to balance responsiveness vs. overhead
- Zoom is a UI-only state change — zoomed pane keeps its terminal session, other panes remain alive in background
- Right-click within xterm.js requires intercepting the terminal's own context menu handling
- Maintain consistency with the Dracula-inspired design system

## Research Summary

Run `/bc:plan PHASE-11` to research this phase and populate this section.

## Recommended Approach

**Three parallel tracks converging into integration and polish.**

1. **Process Detection** — Main process service that polls `pty.process` for each active PTY, maps raw names through PROCESS_LABEL_MAP, sends updates to renderer via IPC. Renderer stores `processName` and `processLabel` on each `TerminalPane` in appStore.

2. **Pane Labeling** — Extend `TerminalPane` interface with `customLabel`, `processName`, `processLabel` fields. Build `resolveLabel()` utility (custom > process > CWD > fallback). Add inline rename UI on pane headers. Update sidebar tree to show resolved labels.

3. **Zoom & Context Menu** — Add `zoomedPane: { tabId, paneId } | null` to appStore. Zoom renders only the target pane at full size. Context menu intercepts xterm right-click via `xterm.attachCustomKeyEventHandler` or addon. Double-click on pane divider/header toggles zoom.

Run `/bc:plan PHASE-11` for detailed task breakdown and research.

## Tasks

| ID | Title | Status | Complexity |
|----|-------|--------|------------|
| - | No tasks yet | - | - |

Run `/bc:plan PHASE-11` to break down this phase into tasks.

## Technical Decisions

- **`pty.process` for detection**: node-pty exposes the foreground process name directly — no need for `ps` or `/proc` parsing. This is the standard cross-platform approach.
- **Polling over events**: node-pty doesn't emit process-change events. Polling at 2s intervals is the pragmatic approach used by VS Code's terminal.
- **Zoom as UI state, not layout change**: Zooming doesn't destroy or recreate panes — it temporarily hides siblings and expands the target. This preserves terminal sessions and makes restore instant.
- **Reuse existing ContextMenu primitives**: The shared `ContextMenu.tsx` from PHASE-10 (Radix-based, Dracula-styled) will be extended for terminal viewport menus, but may need to use a Radix `DropdownMenu` or manual positioning since the trigger is within xterm's canvas.

## Completion Criteria

- [ ] Pane labels auto-update to show the running process (e.g., "Claude Code", "npm run dev", "python")
- [ ] Users can manually rename panes with custom labels that persist until cleared
- [ ] Right-click within a terminal shows a styled context menu with Copy, Paste, Zoom, and Split options
- [ ] Can zoom/maximize a single pane to fill the workspace, hiding other panes
- [ ] Can restore from zoom back to the previous split layout
- [ ] Double-click on a pane header/divider toggles zoom
- [ ] Sidebar terminal tree reflects smart labels (process names, custom names)
- [ ] Zoom state is visually indicated (icon, label, or breadcrumb)
