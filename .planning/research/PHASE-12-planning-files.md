# Research: Breadcrumb Planning File Format & Parsing

**Date:** 2026-02-12
**Domain:** File format parsing, markdown structure, SQLite integration
**Overall Confidence:** HIGH

## TL;DR

Breadcrumb uses a markdown-based planning format in `.planning/` with STATE.md for phase overview and PHASE-XX.md for detailed breakdowns. The current PlanningPanel.tsx implements basic STATE.md parsing with regex, reading files via the breadcrumbAPI IPC layer. Projects are managed through projectsStore (id, name, path, lastOpened). The desktop app needs a full PlanningService to parse both markdown files and `.beads/beads.db` SQLite for richer task data.

## Planning File Format

### STATE.md Structure

**Location:** `.planning/STATE.md`

**Purpose:** Project-wide phase overview and status

**Format:**
```markdown
# Project State

**Current Phase:** PHASE-12
**Last Updated:** 2026-02-12

## Active Work

PHASE-05: Add /bc:view command for opening dashboard (not_started)
PHASE-09: Terminal Experience (complete)
PHASE-10: Workspace Sidebar Overhaul (complete)

## Completed Phases

PHASE-11: Terminal Intelligence & Interaction (complete) - 7/7 tasks done
PHASE-10: Workspace Sidebar Overhaul (complete) - 7/7 tasks done
```

**Parsing pattern (from PlanningPanel.tsx):**
```regex
/^(PHASE-\d+):\s+(.+?)\s+\((complete|in_progress|not_started)\)(?:\s+-\s+(\d+)(?:\/(\d+))?\s+tasks?\s+done)?/
```

**Extracted fields:**
- `id`: PHASE-XX
- `title`: Phase description
- `status`: complete | in_progress | not_started
- `completedCount`: X in "X/Y tasks done"
- `taskCount`: Y in "X/Y tasks done"

### PHASE-XX.md Structure

**Location:** `.planning/PHASE-XX.md`

**Purpose:** Detailed phase breakdown with tasks, dependencies, research

**Sections:**
1. **Header metadata** (lines 1-6):
   - `# Phase XX: Title`
   - `**Status:** done|in_progress|not_started`
   - `**Beads Epic:** breadcrumb-xyz`
   - `**Created:** YYYY-MM-DD`

2. **Objective** - High-level goal

3. **Scope** - In scope / Out of scope bullets

4. **Constraints** - Technical and process constraints

5. **Research Summary** - Links to research files, confidence assessment

6. **Recommended Approach** - Implementation strategy

7. **Tasks** - Markdown table:
   ```markdown
   | ID | Title | Status | Complexity | Depends On |
   |----|-------|--------|------------|------------|
   | sps.1 | Process detection service & IPC channel | done | M | — |
   | sps.2 | Pane label state & resolution pipeline | done | M | sps.1 |
   ```

   **Task fields:**
   - ID: task identifier (e.g., "sps.1")
   - Title: task description
   - Status: done | in_progress | not_started | blocked
   - Complexity: S | M | L | XL
   - Depends On: comma-separated task IDs or "—"

8. **Task Details** - Detailed descriptions per task with acceptance criteria

9. **Technical Decisions** - Table of key choices with rationale

10. **Completion Criteria** - Checkbox list of acceptance criteria

11. **Sources** - Research sources with confidence levels

**Key pattern:** Tasks are NOT stored as YAML front matter or structured data — they're in a markdown table that requires parsing.

## Current Parsing Implementation

**File:** `desktop/src/renderer/components/breadcrumb/PlanningPanel.tsx`

**Current capabilities:**
- Reads STATE.md from a single project path
- Parses phase list with regex (see above)
- Displays phase cards with progress bars
- No drill-down into PHASE-XX.md files yet
- No task parsing yet
- No Beads DB integration yet

**Data flow:**
```
PlanningPanel.tsx
  → window.breadcrumbAPI.readFile(`${projectPath}/.planning/STATE.md`)
  → parseStateFile(content)
  → phases[] state
```

**Current limitations:**
- Single project only (manually selected via folder picker)
- No task detail view
- No dependency visualization
- No Beads DB querying

## Project Management System

**File:** `desktop/src/renderer/store/projectsStore.ts`

**Project interface:**
```typescript
interface Project {
  id: string;           // Generated: "project-${Date.now()}-${random}"
  name: string;         // Default: last path segment
  path: string;         // Absolute filesystem path
  lastOpened: number;   // Timestamp
  terminalSessions: string[];  // Associated terminal session IDs
}
```

**Actions:**
- `addProject(path, name?)` - Add or activate existing project
- `removeProject(id)` - Remove from workspace
- `setActiveProject(id)` - Switch active project
- `getActiveProject()` - Get current project

**Storage:** In-memory Zustand store (no persistence yet)

**Integration points:**
- Sidebar ExplorerView shows all projects
- ProjectSwitcher dropdown in titlebar
- Terminal tabs can be associated with a project via `projectId`

## Workspace Explorer Integration

**File:** `desktop/src/renderer/components/layout/SidebarPanel.tsx`

**How projects are added:**
1. User clicks "Add Project" or "Open Folder..."
2. `window.breadcrumbAPI.selectDirectory()` → IPC to Electron dialog
3. Returns absolute path
4. `addProject(path)` adds to store
5. Project name defaults to `path.split("/").pop()` (last segment)

**Available per project:**
- `project.id` - Unique identifier
- `project.name` - Display name
- `project.path` - Filesystem path (for reading `.planning/` and `.beads/`)
- `project.lastOpened` - Timestamp for sorting
- `project.terminalSessions` - Associated terminals

## IPC API for File Access

**File:** `desktop/src/preload/index.ts`

**Existing file operations:**
```typescript
interface BreadcrumbAPI {
  getWorkingDirectory: () => Promise<string>;
  readFile: (filePath: string) => Promise<{
    success: boolean;
    content: string | null
  }>;
  selectDirectory: () => Promise<string | null>;
}
```

**IPC channels (from `shared/types/index.ts`):**
- `SYSTEM_READ_FILE` - Read any file by absolute path
- `DIALOG_SELECT_DIRECTORY` - Open folder picker
- `SYSTEM_GET_WORKING_DIR` - Get app's initial CWD

**Missing for PHASE-12:**
- No SQLite query IPC endpoint yet
- No structured phase/task parsing endpoint yet
- No file listing/discovery endpoint yet

**Recommendation:** Add new IPC channels:
```typescript
PLANNING_GET_PHASES: "planning:get-phases"        // Parse STATE.md
PLANNING_GET_PHASE_DETAIL: "planning:get-phase"   // Parse PHASE-XX.md
PLANNING_QUERY_TASKS: "planning:query-tasks"      // Query Beads DB
```

## Beads Database Schema

**Location:** `.beads/beads.db` (SQLite)

**Relevant tables:**
- `issues` - Tasks/beads with full metadata
- `dependencies` - Task relationships (blocks, parent-child)
- `labels` - Task labels/tags
- `comments` - Task comments
- `events` - Change history

**Key fields in `issues` table:**
```sql
id TEXT PRIMARY KEY,
title TEXT NOT NULL,
description TEXT NOT NULL,
status TEXT NOT NULL DEFAULT 'open',
priority INTEGER NOT NULL DEFAULT 2,
issue_type TEXT NOT NULL DEFAULT 'task',
created_at DATETIME NOT NULL,
updated_at DATETIME NOT NULL,
closed_at DATETIME,
external_ref TEXT,  -- Could link to PHASE-XX task IDs
```

**Useful views:**
- `ready_issues` - Tasks with no blockers
- `blocked_issues` - Tasks with active blockers + count

**Integration approach:**
- Use `external_ref` to link Beads tasks to markdown task IDs (e.g., "sps.1")
- Query Beads DB for richer status, comments, history
- Fallback to markdown parsing if Beads not initialized

## Recommended Parsing Strategy

### 1. STATE.md Parser

**Already implemented** in PlanningPanel.tsx (lines 199-221)

**Enhancement needed:**
- Extract current phase metadata
- Parse "Active Work" vs "Completed Phases" sections separately
- Handle edge cases (missing task counts, malformed lines)

### 2. PHASE-XX.md Parser

**New implementation required**

**Approach:**
```typescript
interface PhaseDetail {
  id: string;
  title: string;
  status: string;
  beadsEpic: string;
  created: string;
  objective: string;
  scope: { inScope: string[]; outOfScope: string[] };
  constraints: string[];
  researchSummary: string;
  approach: string;
  tasks: Task[];
  decisions: Decision[];
  completionCriteria: ChecklistItem[];
  sources: string[];
}

interface Task {
  id: string;
  title: string;
  status: "done" | "in_progress" | "not_started" | "blocked";
  complexity: "S" | "M" | "L" | "XL";
  dependsOn: string[];
  details?: string;  // From "Task Details" section
}
```

**Parsing steps:**
1. Split by `## ` headers to get sections
2. Parse header metadata with regex
3. Extract tasks table (between `| ID |` header and next `##`)
4. Parse table rows with regex: `/\|\s*(\S+)\s*\|\s*(.+?)\s*\|\s*(\S+)\s*\|\s*(\S+)\s*\|\s*(.+?)\s*\|/`
5. Split "Depends On" by comma, trim
6. Match task IDs to "Task Details" subsections for descriptions

### 3. Beads DB Query Service

**New PlanningService in main process**

**Pattern to follow:** See `desktop/src/main/terminal/TerminalService.ts` for reference

**Service structure:**
```typescript
class PlanningService {
  async getPhases(projectPath: string): Promise<Phase[]>
  async getPhaseDetail(projectPath: string, phaseId: string): Promise<PhaseDetail>
  async getTasksFromBeads(projectPath: string, externalRefs: string[]): Promise<BeadsTask[]>
  async hasBeadsDb(projectPath: string): Promise<boolean>
}
```

**SQLite integration:**
```typescript
import Database from 'better-sqlite3';

const dbPath = path.join(projectPath, '.beads/beads.db');
const db = new Database(dbPath, { readonly: true });

const tasks = db.prepare(`
  SELECT * FROM issues
  WHERE external_ref IN (${externalRefs.map(() => '?').join(',')})
`).all(...externalRefs);
```

## Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| Markdown parsing | Regex + string split | Markdown AST parsers (unified/remark) are overkill for this structured format. The files follow a strict convention. |
| SQLite queries | better-sqlite3 | Already used in Beads CLI. Synchronous API is perfect for main process. |
| IPC boilerplate | Follow existing patterns in terminalIpc.ts | Consistent with codebase conventions. |

## Pitfalls

### Malformed Markdown Tables
**What happens:** Tasks table has inconsistent column counts, missing pipes, etc.
**Avoid by:**
- Strict regex with fallback to empty array
- Validate table header before parsing rows
- Log parse errors but don't crash the UI

### Missing `.planning/` Directory
**What happens:** Projects without Breadcrumb planning files show empty state
**Avoid by:**
- Check for `.planning/STATE.md` existence before parsing
- Show graceful "No planning data" state
- Don't assume all workspace projects use Breadcrumb

### SQLite File Locks
**What happens:** `.beads/beads.db` locked by CLI while reading in desktop app
**Avoid by:**
- Open database in read-only mode
- Use `better-sqlite3` with `{ readonly: true }`
- Handle SQLITE_BUSY errors gracefully

### Stale Data
**What happens:** Files change on disk, UI shows outdated data
**Avoid by:**
- Manual refresh button for MVP (no auto-watch)
- Clear cache when switching projects
- Future: add file watcher for live updates

### Task ID Collisions
**What happens:** Multiple phases use same task ID (e.g., both have "task.1")
**Avoid by:**
- Scope task IDs with phase: `${phaseId}:${taskId}`
- Use Beads `external_ref` as canonical source when available
- Warn if duplicate IDs detected

## Open Questions

1. **Should task status come from markdown or Beads DB?**
   - Markdown is canonical for phase structure
   - Beads DB has richer status transitions (open → in_progress → blocked → closed)
   - **Recommendation:** Prefer Beads status if external_ref match exists, fallback to markdown

2. **How to handle projects with `.beads/` but no `.planning/`?**
   - Beads can be used standalone
   - **Recommendation:** Show tasks from Beads DB, grouped by labels or epics

3. **Should we cache parsed data or parse on every render?**
   - Files can be large (PHASE-11.md is 200+ lines)
   - **Recommendation:** Cache in planningStore, invalidate on manual refresh

4. **Multi-project view: tabs vs unified dashboard?**
   - Current design: single Breadcrumb tab showing all projects
   - **Recommendation:** Follow PHASE-12 spec — unified dashboard with project switching

## Sources

**HIGH confidence:**
- `/Users/krsecurity/Repositories/breadcrumb/.planning/STATE.md` - Actual STATE.md format
- `/Users/krsecurity/Repositories/breadcrumb/.planning/PHASE-11.md` - Complete phase example with all sections
- `desktop/src/renderer/components/breadcrumb/PlanningPanel.tsx` - Existing parsing logic
- `desktop/src/renderer/store/projectsStore.ts` - Project data model
- `desktop/src/preload/index.ts` - IPC API surface
- `desktop/src/shared/types/index.ts` - IPC channel definitions
- `.beads/beads.db` schema - SQLite structure

**MEDIUM confidence:**
- Task table parsing approach - needs validation with edge cases
- Beads DB external_ref mapping - convention not enforced

**LOW confidence:**
- None - all information sourced from actual codebase and files
