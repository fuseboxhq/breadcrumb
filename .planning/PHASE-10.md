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

Three research areas investigated — see `.planning/research/PHASE-10-*.md` for details.

**Context Menus** (PHASE-10-context-menus.md): Use `@radix-ui/react-context-menu` v2.2.16 standalone. Battle-tested (shadcn/ui, Vercel, Linear), full accessibility, Floating UI positioning (handles viewport edges, scroll containers, submenus). 107KB unpacked, tree-shakeable. Custom React menus over native Electron menus for consistent Dracula styling. Use `data-[highlighted]` and `data-[disabled]` attributes for styling (not `:hover`). Animate entry only (not exit) to avoid repositioning bugs.

**Tree Component** (PHASE-10-tree-component.md): Build custom — no library needed for ~50 nodes. Virtualization threshold is 1000+ nodes; our max is ~160. WAI-ARIA tree view pattern: `role="tree"`, `role="treeitem"`, `role="group"`, `aria-expanded`, `aria-level`. Keyboard navigation: Arrow keys (up/down/left/right), Home/End, Enter/Space. Roving tabindex for focus management (only focused item has `tabIndex={0}`). Expand/collapse via measured `scrollHeight` transitions. Separate visual states: selected, active, focused.

**Pane State** (PHASE-10-pane-state.md): Extend `appStore` with `terminalPanes: Record<string, TabPaneState>` using Zustand's immer middleware. Currently, pane state (panes array, activePane, splitDirection, paneCwds) is entirely local in TerminalPanel.tsx — sidebar can't see it. Immer enables clean nested updates. Selector hooks per tab (`useTabPanes(tabId)`) prevent over-rendering. Cleanup via extended `removeTab` action.

## Recommended Approach

**Bottom-up: state first, then components, then interactions.**

1. **Foundation** (kcc.1): Install immer + radix context-menu. Add immer middleware to appStore. Define `TerminalPane`, `TabPaneState` interfaces and pane management actions.
2. **Migration** (kcc.2): Replace TerminalPanel's local useState with appStore selectors. This is the riskiest task — terminals must keep working.
3. **Tree primitive** (kcc.3, parallel with kcc.2): Build a reusable TreeView/TreeNode component with WAI-ARIA roles and keyboard navigation. This is a generic primitive used by both Terminals and Explorer views.
4. **Terminals tree** (kcc.4): Rebuild TerminalsView using the tree component. Project → Tab → Pane hierarchy. Click-to-focus panes. Session management actions (create, close, rename).
5. **Explorer cards** (kcc.5, parallel with kcc.3/4): Richer project cards with terminal counts, quick actions, collapsible sections.
6. **Context menus** (kcc.6): Shared ContextMenu wrapper with Dracula styling. Right-click menus on terminals, panes, and projects with relevant actions.
7. **Polish** (kcc.7): Wire keyboard nav through the full sidebar. Focus management between sections. Final visual polish.

## Tasks

| ID | Title | Status | Complexity | Depends On |
|----|-------|--------|------------|------------|
| kcc.1 | Add immer middleware & pane state to appStore | done | M | — |
| kcc.2 | Migrate TerminalPanel to shared pane store | done | L | kcc.1 |
| kcc.3 | Build accessible sidebar tree component | done | L | — |
| kcc.4 | Rebuild Terminals view as pane-aware tree | done | L | kcc.2, kcc.3 |
| kcc.5 | Enhanced Explorer view with project cards | not_started | M | — |
| kcc.6 | Context menus for terminals, panes & projects | not_started | L | kcc.4, kcc.5 |
| kcc.7 | Sidebar keyboard navigation & polish | not_started | M | kcc.4, kcc.5 |

**Dependency graph:**
```
kcc.1 ──→ kcc.2 ──┐
                   ├──→ kcc.4 ──┐
kcc.3 ────────────┘             ├──→ kcc.6
                                ├──→ kcc.7
kcc.5 ─────────────────────────┘
```

**Parallel lanes:**
- Lane A: kcc.1 → kcc.2 → kcc.4 (state → migration → terminals tree)
- Lane B: kcc.3 (tree component, parallel with Lane A)
- Lane C: kcc.5 (explorer, parallel with all above)
- Final: kcc.6, kcc.7 (context menus + polish, after 4 & 5)

### Task Details

**kcc.1: Add immer middleware & pane state to appStore**
- `npm install immer @radix-ui/react-context-menu`
- Wrap appStore's `create()` with `immer()` middleware
- Add `TerminalPane`, `TabPaneState` interfaces
- Add `terminalPanes: Record<string, TabPaneState>` to state
- Add actions: `initializeTabPanes`, `addPane`, `removePane`, `setActivePane`, `toggleSplitDirection`, `updatePaneCwd`, `clearTabPanes`
- Add selector hooks: `useTabPanes(tabId)`, `useTabPanesList(tabId)`, `useActivePane(tabId)`
- Extend `removeTab` to call `clearTabPanes`
- Files: `appStore.ts`, `package.json`

**kcc.2: Migrate TerminalPanel to shared pane store**
- Replace local `useState` (panes, activePane, splitDirection, paneCwds) with appStore selectors
- Call `initializeTabPanes(tabId, workingDirectory)` in useEffect
- Wire `addPane`, `removePane`, `setActivePane`, `toggleSplitDirection`, `updatePaneCwd` through store actions
- Update CWD-based tab title logic to use store's active pane CWD
- Verify: splitting, closing panes, switching panes, CWD tracking all still work
- Files: `TerminalPanel.tsx`

**kcc.3: Build accessible sidebar tree component**
- Create `TreeView` (role="tree") and `TreeNode` (role="treeitem") components
- WAI-ARIA: `aria-expanded`, `aria-level`, `aria-label`, `role="group"` for children
- Keyboard: ArrowDown/Up (focus next/prev), ArrowRight (expand/focus child), ArrowLeft (collapse/focus parent), Home/End, Enter/Space (activate)
- Roving tabindex: only focused node has `tabIndex={0}`
- Expand/collapse animation via measured `scrollHeight` transitions
- Visual states: selected (`bg-primary/10`), active (`bg-primary/20 border-l-2`), focused (`ring-2 ring-primary/50`)
- Generic — accepts render props or children for custom node rendering
- Files: `components/sidebar/TreeView.tsx`, `components/sidebar/TreeNode.tsx`

**kcc.4: Rebuild Terminals view as pane-aware tree**
- Replace flat terminal list in SidebarPanel with tree: Project → Terminal Tab → Split Panes
- Read pane state from `useAppStore(s => s.terminalPanes)` (now available after kcc.2)
- Show pane count badges on tab nodes, CWD labels on pane nodes
- Click pane → `setActiveTab(tabId)` + `setActivePane(tabId, paneId)`
- Session management: "New Terminal" action, close tab, rename terminal (inline edit)
- FolderOpen icons for panes, Terminal icons for tabs
- Files: `SidebarPanel.tsx` (TerminalsView), possibly extract to `components/sidebar/TerminalsTree.tsx`

**kcc.5: Enhanced Explorer view with project cards**
- Richer project cards: project name, path, terminal count, last-opened time
- Quick actions: "New Terminal" button, "Remove Project" button
- Collapsible sections per project
- Terminal count derived from `tabs.filter(t => t.projectId === project.id).length`
- Status indicators: active project highlight, number of open terminals
- Files: `SidebarPanel.tsx` (ExplorerView), possibly extract to `components/sidebar/ProjectCard.tsx`

**kcc.6: Context menus for terminals, panes & projects**
- Create shared `ContextMenuWrapper` component with Dracula-styled Radix primitives
- Terminal tab context menu: Rename, Split Horizontal, Split Vertical, Close Terminal
- Pane context menu: Copy CWD, Close Pane
- Project context menu: New Terminal, Copy Path, Remove Project
- Use `ContextMenu.Portal` for all menus, `collisionPadding={8}`, entry-only animation
- Style with `data-[highlighted]` and `data-[disabled]` attributes
- Destructive actions (Close, Remove) in red with `bg-destructive/10`
- Files: `components/shared/ContextMenu.tsx`, update TreeNode integrations

**kcc.7: Sidebar keyboard navigation & polish**
- Wire TreeView keyboard handlers into Terminals and Explorer sections
- Tab key moves between sidebar sections (Explorer → Terminals)
- Arrow keys navigate within sections
- Enter activates (switch tab, focus pane, expand project)
- Escape deselects/returns focus to terminal
- Focus ring styling for keyboard-only users
- Final visual polish: spacing, transitions, responsive behavior
- Files: `SidebarPanel.tsx`, `TreeView.tsx`

## Technical Decisions

- **Immer middleware for appStore**: Enables clean nested updates (`state.terminalPanes[tabId].activePane = paneId`) instead of verbose spread syntax. Research confirms this is the standard Zustand pattern for nested records.
- **Extend appStore, not a new store**: Pane state is logically owned by tabs (already in appStore). Avoids cross-store synchronization complexity. Sidebar uses the same `useAppStore` already imported everywhere.
- **Custom tree over library**: ~50 nodes max, no virtualization needed. react-arborist (329KB) and react-complex-tree are overkill. Custom gives full control over Dracula styling and Zustand integration.
- **Radix context menu over native Electron**: Consistent Dracula styling across platforms. Rich content (icons, badges). Radix handles positioning edge cases (viewport boundaries, scroll containers, submenus) via Floating UI.
- **Portal-based context menus**: Always use `ContextMenu.Portal` to avoid stacking context issues from sidebar's `position: relative` container.
- **Entry-only animation**: Animate fade-in on menu open, no exit animation. Exit animations block repositioning when right-clicking a second time.

## Completion Criteria

- [ ] Terminals sidebar shows a tree: Project → Terminal Tab → Split Panes with CWD labels
- [ ] Can create, close, and rename terminal sessions from the sidebar
- [ ] Can click individual panes in the sidebar to focus them in the workspace
- [ ] Explorer shows richer project cards with quick actions (new terminal, remove project)
- [ ] Right-click context menus on terminals, panes, and projects
- [ ] Tab management (close, reorder) accessible from sidebar
- [ ] Sidebar keyboard navigation (arrow keys, Enter to select)
