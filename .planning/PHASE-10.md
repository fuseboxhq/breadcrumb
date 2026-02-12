# Phase 10: Workspace Sidebar Overhaul

**Status:** not_started
**Beads Epic:** breadcrumb-kcc
**Created:** 2026-02-12

## Objective

Rebuild the Explorer and Terminals sidebar views into a full workspace management interface. The current sidebar is bare — Explorer only shows project names with a "New Terminal" action, and the Terminals view is a flat list with no awareness of split panes, no session management, and no way to interact with individual terminals beyond clicking to switch tabs. This phase transforms the sidebar into the primary workspace control surface where users can manage projects, terminals, panes, and tabs without touching the tab bar or keyboard shortcuts.

## Scope

**In scope:**
- Pane-aware Terminals sidebar — show individual split panes within each terminal tab, with CWD labels, status indicators, click-to-focus
- Terminal session management — create, close, rename terminals and panes from the sidebar
- Enhanced Explorer view — richer project cards with status info, terminal counts, quick actions, remove project
- Tab management integration — reorder tabs, close tabs, context menus from sidebar
- Shared state refactoring — expose pane-level state from TerminalPanel so the sidebar can see and control individual panes
- Context menus on right-click for terminals, panes, and projects
- Keyboard navigation within the sidebar tree

**Out of scope:**
- File tree / file browsing (future phase)
- Git status indicators in Explorer
- Drag-and-drop between sidebar sections
- File editing or preview from sidebar

## Constraints

- Frontend design skill active — follow design thinking process for UI tasks
- Maintain consistency with the existing Dracula-inspired design system
- Refactoring stores and breaking out new components is encouraged where it improves clarity
- Must work well with the multi-project workspace model from PHASE-09

## Research Summary

Run `/bc:plan PHASE-10` to research this phase and populate this section.

## Recommended Approach

Run `/bc:plan PHASE-10` to research and define the approach.

## Tasks

| ID | Title | Status | Complexity |
|----|-------|--------|------------|
| - | No tasks yet | - | - |

Run `/bc:plan PHASE-10` to break down this phase into tasks.

## Technical Decisions

- Pane state needs to be lifted out of TerminalPanel's local useState into a shared store (or exposed via context/callbacks) so the sidebar can read and control it
- Context menus should use a shared ContextMenu component (Radix-style pattern or custom) for consistency
- Terminal tree structure: Project → Tab → Pane hierarchy

## Completion Criteria

- [ ] Terminals sidebar shows a tree: Project → Terminal Tab → Split Panes with CWD labels
- [ ] Can create, close, and rename terminal sessions from the sidebar
- [ ] Can click individual panes in the sidebar to focus them in the workspace
- [ ] Explorer shows richer project cards with quick actions (new terminal, remove project)
- [ ] Right-click context menus on terminals, panes, and projects
- [ ] Tab management (close, reorder) accessible from sidebar
- [ ] Sidebar keyboard navigation (arrow keys, Enter to select)
