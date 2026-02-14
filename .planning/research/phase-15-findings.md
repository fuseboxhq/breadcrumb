# PHASE-15: Desktop IDE Comprehensive Review — Consolidated Findings

**Date:** 2026-02-14
**Auditors:** 5 parallel Claude Opus 4.6 agents
**Scope:** Full desktop IDE audit — UX flow, feature gaps, visual polish, code quality, integration & dead code

---

## Executive Summary

The Breadcrumb Desktop IDE is a custom Electron app (not a VS Code fork) with strong terminal and browser implementations, a unique planning dashboard, and ambitious type-level plans for AI agent integration. However, it currently functions as a **terminal-first workspace** rather than a competitive IDE — it has no code editor, no AI integration, no git UI, and no file explorer tree.

**By the numbers:**
- **Feature completeness vs Cursor/Windsurf:** ~29% (16 implemented, 4 partial, 7 stub, 29 missing)
- **Strongest areas:** Terminal (92%), Browser (80%), Planning (75%)
- **Weakest areas:** Editor & Code Intelligence (11%), AI Integration (0%), Source Control (7%)
- **IPC channels:** 35 fully wired, 6 partially wired, **30 dead** (type-only, no implementation)
- **Total findings:** 100+ across all audits

### Severity Distribution

| Severity | Count | Key Items |
|----------|-------|-----------|
| Critical | 3 | Path traversal vuln, broken cmd palette commands, broken process detection |
| High | 12 | Project persistence, keyboard gaps, event leak, default HTTPS URL, non-null assertions |
| Medium | 40+ | Feature gaps, type duplication, sync I/O, hardcoded values, polling |
| Low | 30+ | Polish, dead code, minor UX friction |

---

## CRITICAL Findings (Fix Immediately)

### C1. Path traversal vulnerability in IPC validation
- **Source:** Code Quality audit (SEC-01)
- **Files:** `main/ipc/handlers.ts:12-18`, `main/ipc/planningIpc.ts:8-14`
- **Issue:** `validatePath()` checks for `..` substring but does not verify the resolved path is within any allowed directory. `/etc/passwd` passes validation. `SYSTEM_READ_FILE` IPC can read any file on disk.
- **Fix:** Resolve path first, then verify `resolved.startsWith(allowedRoot)`. Effort: **S**

### C2. Command palette "Show Breadcrumb" / "Show Browser Panel" break the sidebar
- **Source:** UX Flow audit + Integration audit
- **Files:** `renderer/components/command-palette/CommandPalette.tsx:160-174`
- **Issue:** These commands call `setSidebarView("breadcrumb"/"browser")` but `SidebarPanel` has no cases for these views — sidebar goes blank with no recovery path except selecting a different view.
- **Fix:** Change to `addRightPanelPane("planning"/"browser")` to match ActivityBar behavior. Effort: **S**

### C3. Terminal process detection is completely broken
- **Source:** Integration audit
- **Files:** `preload/index.ts:145-150` (bridge exists), no renderer subscription
- **Issue:** `onTerminalProcessChange` is exposed in preload and main sends events, but NO renderer component subscribes. The `updatePaneProcess` store action is never called. Process-specific icons (node, vim, python), Claude instance numbering ("Claude #1"), and process-based tab titles all silently fail.
- **Fix:** Add subscription in `TerminalPanel` or `TerminalInstance` to wire `onTerminalProcessChange` → `updatePaneProcess`. Effort: **M**

---

## HIGH Priority Findings

### H1. Project state not persisted across restarts
- **Source:** UX Flow audit
- **File:** `renderer/store/projectsStore.ts`
- **Issue:** Projects stored in-memory only. User loses all projects on every app restart.
- **Fix:** Wire up `PROJECT_*` IPC channels (already defined in types) to persist via electron-store. Effort: **M**

### H2. Default browser URL uses HTTPS for localhost
- **Source:** UX Flow + Code Quality audits
- **Files:** `settingsStore.ts:51`, `main/settings/SettingsStore.ts:97`, `layout/RightPanel.tsx:130`
- **Issue:** Default is `https://localhost:3000`. Local dev servers use HTTP. First-time users always see a connection error.
- **Fix:** Change to `http://localhost:3000`. Effort: **S**

### H3. Cmd+W doesn't close single-pane terminal tabs
- **Source:** UX Flow audit
- **File:** `renderer/components/terminal/TerminalPanel.tsx`
- **Issue:** Cmd+W only closes panes when there are multiple panes. Single-pane tabs cannot be closed via keyboard.
- **Fix:** Close the entire tab when Cmd+W is pressed with a single pane. Effort: **S**

### H4. No keyboard shortcuts for tab switching
- **Source:** UX Flow audit
- **Issue:** No Ctrl+Tab, Cmd+Shift+], or Cmd+Shift+[ for switching between tabs. Users must click tab headers.
- **Fix:** Bind standard tab navigation shortcuts in `useGlobalLayoutHotkeys`. Effort: **S**

### H5. No keyboard region focus navigation
- **Source:** UX Flow audit
- **Issue:** No way to move focus between sidebar, center workspace, and right panel via keyboard. Keyboard-only users are stuck.
- **Fix:** Implement Cmd+1/2/3 for region focus or Ctrl+` for cycling. Effort: **M**

### H6. Event listener leak in extensionIpc
- **Source:** Code Quality audit (ERR-02)
- **File:** `main/ipc/extensionIpc.ts:88,105`
- **Issue:** `removeListener` is called with a new anonymous function instead of the original reference. The listener is never actually removed. Leaks on window recreation.
- **Fix:** Store handler in a variable, pass same reference to `removeListener`. Effort: **S**

### H7. Non-null assertions on potentially null browserManager
- **Source:** Code Quality audit (ERR-01)
- **File:** `main/ipc/browserIpc.ts:21-120`
- **Issue:** Every IPC handler uses `browserManager!.method()`. If null, produces unhelpful TypeError.
- **Fix:** Replace with explicit null guard returning `{ success: false, error: "Browser not initialized" }`. Effort: **S**

### H8. No extension install mechanism
- **Source:** UX Flow audit
- **File:** `renderer/components/extensions/ExtensionsPanel.tsx`
- **Issue:** Only shows installed extensions from `~/.breadcrumb/extensions/`. No marketplace, no install dialog, no documentation link.
- **Fix:** At minimum, add "Open Extensions Folder" button and a docs link. Effort: **S** (MVP) / **L** (marketplace)

### H9. StatusBar buttons without click handlers
- **Source:** Visual Polish audit
- **File:** `renderer/components/layout/StatusBar.tsx:81-88`
- **Issue:** Informational items like "main", "Connected", "0 extensions" render as `<button>` elements with no onClick. Focusable but do nothing. Accessibility issue.
- **Fix:** Render as `<span>` when no onClick provided. Effort: **S**

### H10. Tab close button uses `<span>` instead of `<button>`
- **Source:** Visual Polish audit
- **File:** `renderer/components/layout/TabBar.tsx:52-60`
- **Issue:** Close "X" is a `<span>` with onClick — not keyboard-accessible, not announced by screen readers.
- **Fix:** Use `<button>` with `aria-label="Close tab"`. Effort: **S**

### H11. 30 dead IPC channel definitions
- **Source:** Integration audit + Code Quality audit
- **File:** `shared/types/index.ts:3-86`
- **Issue:** 30 IPC channels with ~20 associated interfaces are defined but have zero implementation. Misleads developers, inflates codebase.
- **Fix:** Move to `types.planned.ts` or remove until implemented. Effort: **M**

### H12. `shell.openExternal` without URL scheme validation
- **Source:** Code Quality audit (SEC-02)
- **File:** `main/ipc/browserIpc.ts:109-116`
- **Issue:** Any URL scheme (file://, smb://, custom protocols) accepted. Could open local files or trigger protocol handlers.
- **Fix:** Validate scheme is `http:` or `https:` before calling `shell.openExternal`. Effort: **S**

---

## MEDIUM Priority Findings

### UX Flow

| ID | Finding | File | Effort |
|----|---------|------|--------|
| M1 | No onboarding on first launch | WorkspaceContent.tsx | M |
| M2 | No "Open Project" on welcome screen | WorkspaceContent.tsx | S |
| M3 | No confirmation on project removal | SidebarPanel.tsx | S |
| M4 | TabBar "+" creates ungrouped terminals | TabBar.tsx | S |
| M5 | No cleanup/restart on PTY exit | TerminalInstance.tsx | M |
| M6 | Cmd+T not globally bound despite being shown | useGlobalLayoutHotkeys.ts | S |
| M7 | Browser URL input doesn't normalize bare hostnames | BrowserPanel.tsx | S |
| M8 | Only one browser instance allowed (singleton) | BrowserViewManager.ts | L |
| M9 | Cmd+B shortcut may conflict with terminal usage | useGlobalLayoutHotkeys.ts | S |
| M10 | No way to initialize planning from UI | PlanningPanel.tsx | S |
| M11 | Planning tasks are read-only (no status toggle) | PlanningPanel.tsx | M |
| M12 | Planning navigation state lost on panel close/reopen | PlanningPanel.tsx | S |
| M13 | Cmd palette uses synthetic events (fragile) | CommandPalette.tsx | M |
| M14 | No sidebar toggle keyboard shortcut | useGlobalLayoutHotkeys.ts | S |
| M15 | 3px resize handles hard to target with mouse | AppShell.tsx | S |
| M16 | Only terminal settings exposed in settings UI | SidebarPanel.tsx | M |
| M17 | Shell paths hardcoded to macOS | SidebarPanel.tsx | S |
| M18 | Extension commands displayed but not executable | ExtensionsPanel.tsx | M |
| M19 | Activity bar items have no keyboard shortcuts | ActivityBar.tsx | S |
| M20 | Escape key handled inconsistently | Multiple | S |
| M21 | No keyboard shortcut cheat sheet | N/A | M |

### Visual Polish

| ID | Finding | File | Effort |
|----|---------|------|--------|
| M22 | Terminal theme hardcodes hex colors (fragile sync) | TerminalInstance.tsx:32-55 | M |
| M23 | Browser URL input has conflicting font-size classes | BrowserPanel.tsx:285 | S |
| M24 | Browser nav bar height (h-10) breaks toolbar hierarchy | BrowserPanel.tsx:244 | S |
| M25 | ProjectSwitcher uses div for clickable rows (a11y) | ProjectSwitcher.tsx:76-111 | S |
| M26 | No focus ring on most inline action buttons | Multiple | M |
| M27 | Task detail table doesn't handle narrow panel widths | PlanningPanel.tsx:613-638 | M |
| M28 | Terminal pane tabs have no minimum width | TerminalPanel.tsx:233 | S |

### Code Quality

| ID | Finding | File | Effort |
|----|---------|------|--------|
| M29 | Type duplication across main/renderer/preload | Multiple | M |
| M30 | Layout state partially duplicated between stores | appStore.ts + settingsStore.ts | M |
| M31 | PlanningService uses sync file I/O in main thread | PlanningService.ts | M |
| M32 | GitService uses execSync blocking main thread | GitService.ts:30,44,57 | S |
| M33 | Terminal process polling at 200ms (CPU heavy) | TerminalService.ts:436-438 | L |
| M34 | SettingsManager.setNested uses unsafe type assertions | SettingsStore.ts:121-123 | S |
| M35 | Extension manifest validation casts without full check | ExtensionManager.ts:269 | S |
| M36 | BrowserViewManager 50ms setTimeout race workaround | BrowserViewManager.ts:70-83 | M |
| M37 | 13 diagnostic console.log in BrowserViewManager | BrowserViewManager.ts | S |
| M38 | StatusBar shows 3 hardcoded values | StatusBar.tsx:21,60,63 | S |

### Integration

| ID | Finding | Effort |
|----|---------|--------|
| M39 | Planning data has no file watcher — always stale until manual refresh | M |
| M40 | Planning is 100% read-only — no CLI interop for mutations | L |
| M41 | Extensions commands wired in preload but never called from renderer | S |

---

## LOW Priority Findings (42 items — abbreviated)

<details>
<summary>Click to expand low-priority findings</summary>

**UX Flow:**
- L1: Hardcoded "main" git branch in StatusBar
- L2: No theme toggle UI (store has it, UI doesn't)
- L3: Fragile project name derivation (trailing slash)
- L4: Terminal settings refit flicker
- L5: Confusing split direction labels
- L6: DevTools dock state not persisted
- L7: No task search/filter in planning
- L8: No fuzzy match highlighting in command palette
- L9: Right panel resets proportions on reopen
- L10: No double-click to reset panel size
- L11: Settings reset has no confirmation
- L12: Extension status dots have no tooltips
- L13: Focus trap issues with Escape listener

**Visual Polish:**
- L14: Light theme defined in store but never implemented
- L15: Inconsistent dracula colors vs semantic tokens
- L16: Inconsistent hover background (bg-muted/50 vs bg-background-raised)
- L17: Section headers use mixed tracking (wider vs widest)
- L18: Welcome view uses text-2xl outside custom type scale
- L19: DevToolsDock header missing border-b
- L20: Inconsistent gap values in toolbar flex layouts
- L21: Disabled buttons use opacity-30 vs opacity-50 inconsistently
- L22: SidebarPanel slide-in has no exit animation
- L23: Command palette has no exit animation
- L24: DevToolsDock uses Terminal icon vs StatusBar uses Bug icon
- L25: RightPanel empty state weaker text opacity
- L26: Settings loading state is plain text (no skeleton)
- L27: Tab bar has no scroll shadow indicators
- L28: Browser/breadcrumb tab types use Terminal icon as placeholder

**Code Quality:**
- L29: Duplicated validatePath function
- L30: Module-level singleton pattern for BrowserViewManager
- L31: Planning store casts IPC results unsafely (as unknown as X)
- L32: projectsStore state entirely ephemeral
- L33: Preload API uses inline types instead of shared
- L34: DEFAULT_AGENTS constant in types file (data mixed with types)
- L35: handlersRegistered guard pattern duplicated in every IPC module
- L36: Extension version check uses string prefix instead of semver
- L37: Extension host worker loads untrusted code with require()
- L38: setBounds IPC fires ~60/sec during resize (with console.log)

**Integration:**
- L39: getBrowserManager() exported but never called
- L40: BrowserViewManager hide()/show()/isActive() methods unused
- L41: ~15 unused selector hooks across stores
- L42: Vestigial "browser"/"breadcrumb" in TabType union

</details>

---

## Feature Gap Summary vs Cursor/Windsurf

| Category | Completeness | Status |
|----------|-------------|--------|
| Terminal | **92%** | Production-quality. Split panes, process detection (broken wire), shell integration. |
| Browser & Preview | **80%** | WebContentsView + DevTools dock. Missing live reload. |
| Planning & Project Mgmt | **75%** | Unique differentiator. Read-only. No mutation from UI. |
| Settings & Customization | **50%** | Terminal settings only. No theme, keybindings, or general settings. |
| Command Palette & Navigation | **25%** | Working but thin (~16 commands). No file/symbol search. |
| Editor & Code Intelligence | **11%** | **No code editor.** Project list only, no file tree. |
| Source Control | **7%** | GitService reads branch. No staging, commits, diffs, or UI. |
| AI Integration | **0%** | Types defined for full agent system. Zero implementation. |
| Advanced/Differentiating | **0%** | MCP, memory, background agents — all type-only stubs. |

### Critical Path to Competitive Parity

**Tier 1 — Table Stakes (without these, not an IDE):**
1. Code Editor (Monaco/CodeMirror) — XL effort
2. File Explorer Tree — M effort
3. Quick File Open (Cmd+P) — L effort

**Tier 2 — AI Differentiation (the value proposition):**
4. AI Chat Panel — XL effort (wire existing agent types + Claude CLI)
5. Agent Tool Execution — L effort (connect to existing terminal/file IPC)
6. MCP Server Manager — L effort (implement defined IPC channels)

**Tier 3 — Workflow Completeness:**
7. Git Integration — M effort
8. LSP Integration — XL effort
9. Theme System — M effort

---

## Recommended Fix Sequence

### Sprint 1: Critical + Quick Wins (1-2 days)
All items are S effort and have high impact:

1. **C1** Fix path traversal validation — security critical
2. **C2** Fix command palette sidebar navigation — user-facing bug
3. **H2** Change default browser URL to http:// — first-run experience
4. **H3** Cmd+W close single-pane tabs — basic keyboard workflow
5. **H4** Add tab switching shortcuts — basic keyboard workflow
6. **H6** Fix event listener leak in extensionIpc — memory leak
7. **H7** Replace non-null assertions in browserIpc — error quality
8. **H9** StatusBar: render info items as span not button — a11y
9. **H10** TabBar: close button as button not span — a11y
10. **H12** Validate URL scheme in openExternal — security
11. **M37** Remove diagnostic console.log from BrowserViewManager
12. **M38** Wire StatusBar to actual git/extension data (or remove fakes)

### Sprint 2: Wiring + UX Fixes (2-3 days)

1. **C3** Wire terminal process detection subscription
2. **H1** Persist project state across restarts
3. **H5** Add keyboard region focus navigation
4. **M6** Bind Cmd+T globally for new terminal
5. **M7** Normalize bare hostnames in browser URL
6. **M14** Add sidebar toggle shortcut
7. **M19** Add activity bar keyboard shortcuts
8. **M32** Replace execSync with async in GitService
9. **M35** Improve extension manifest validation
10. **H11** Move dead IPC channels to separate file

### Sprint 3: Architecture & Polish (3-5 days)

1. **M29** Consolidate duplicated types into shared/
2. **M31** Convert PlanningService to async file I/O
3. **M33** Reduce terminal process poll interval or make adaptive
4. **M36** Replace 50ms setTimeout with explicit ready signal
5. **M11** Add task status toggling in planning UI
6. **M39** Add file watcher for planning data freshness
7. Visual polish sweep (M22-M28)
8. Component decomposition (ORG-01, ORG-02)

### Future: Feature Implementation Phase
- Code editor integration (Monaco)
- File explorer tree
- AI chat panel + agent system
- Git UI
- LSP integration

---

## Appendix: IPC Channel Status

| Status | Count | Categories |
|--------|-------|-----------|
| Fully Wired | 35 | Settings (4), Dialog (1), System (1), Terminal (6), Planning (4), Extensions (4), Browser (15) |
| Partially Wired | 6 | SETTINGS_GET, SYSTEM_READ_FILE, TERMINAL_TERMINATE, TERMINAL_PROCESS_CHANGE, GIT_INFO, EXTENSIONS_COMMANDS/EXECUTE |
| Dead (type-only) | 30 | Agent (9), AgentConfig (4), ClaudeAgents (1), Skills (1), MCP (6), Auth (5), Plans (5), ProjectRecent (3), Scratchpad (2), Memory (3) |
