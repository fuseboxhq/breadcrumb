# Research: SQLite Database Access for Breadcrumb Desktop App

**Date:** 2026-02-12
**Domain:** Electron, SQLite, IPC
**Overall Confidence:** HIGH

## TL;DR

Use better-sqlite3 (already in project at v12.4.1) to read `.beads/beads.db` from Electron's main process. The project already has working patterns in `server/services/beadsService.ts` - port this code to the desktop app's main process. Use the existing IPC handle/invoke pattern with typed channels in `IPC_CHANNELS`. Native module rebuilding is handled automatically by `@electron-forge/plugin-auto-unpack-natives` (already configured).

## Current State

### SQLite Library: better-sqlite3 v12.4.1
**Status:** Already installed in monorepo root
- Listed in `package.json` dependencies
- Configured in `pnpm.onlyBuiltDependencies` for native compilation
- Desktop app uses `@electron-forge/plugin-auto-unpack-natives` v7.6.0

### Working Reference Implementation
Location: `/server/services/beadsService.ts`

This file already demonstrates the exact patterns needed:
- Opening database in read-only mode: `new Database(dbPath, { readonly: true, fileMustExist: true })`
- Querying issues, dependencies, and labels tables
- Using prepared statements
- Proper database closing in finally blocks

### Beads Database Schema (`.beads/beads.db`)

Key tables for task tracking:
- **issues**: 50+ columns including id, title, description, status, priority, issue_type, created_at, updated_at, closed_at
- **dependencies**: Relationships (issue_id, depends_on_id, type) - types include 'blocks' and 'parent-child'
- **labels**: Issue labels (issue_id, label)
- **comments**: Issue comments (id, issue_id, author, text, created_at)
- **events**: Activity log (id, issue_id, event_type, actor, old_value, new_value, created_at)

Views for common queries:
- **ready_issues**: Issues with no blockers (filters out blocked items transitively)
- **blocked_issues**: Issues blocked by dependencies with count

### Existing IPC Pattern
Location: `/desktop/src/shared/types/index.ts` and `/desktop/src/main/ipc/handlers.ts`

Pattern:
1. Define channel constants in `IPC_CHANNELS` object
2. Register handlers with `ipcMain.handle(channel, handler)` in main process
3. Handlers return `{ success: true, data }` or `{ success: false, error }`
4. Cleanup function removes all handlers on shutdown

Example from `handlers.ts`:
```typescript
ipcMain.handle(IPC_CHANNELS.GIT_INFO, async (_, { workingDirectory }) => {
  try {
    const validatedPath = validatePath(workingDirectory);
    const gitInfo = gitService.getGitInfo(validatedPath);
    return { success: true, gitInfo };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});
```

## Recommended Stack

| Library | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| better-sqlite3 | 12.4.1 | SQLite access in main process | HIGH |
| @electron-forge/plugin-auto-unpack-natives | 7.6.0 | Native module unpacking | HIGH |

**No additional installation needed** - both already configured.

## Key Patterns

### 1. Database Service in Main Process
**Use when:** Creating a service to query Beads database

```typescript
// desktop/src/main/beads/BeadsService.ts
import Database from 'better-sqlite3';
import { join } from 'path';

function openDb(projectPath: string): Database.Database {
  const dbPath = join(projectPath, '.beads', 'beads.db');
  return new Database(dbPath, {
    readonly: true,      // Prevent accidental writes
    fileMustExist: true  // Fail fast if db missing
  });
}

export function getIssues(projectPath: string) {
  const db = openDb(projectPath);
  try {
    const stmt = db.prepare(`
      SELECT id, title, description, status, priority
      FROM issues
      WHERE status != 'tombstone' AND deleted_at IS NULL
      ORDER BY id
    `);
    return stmt.all();
  } finally {
    db.close(); // Always close
  }
}
```

**Source:** Existing `server/services/beadsService.ts` pattern

### 2. IPC Handler Registration
**Use when:** Exposing database queries to renderer process

```typescript
// desktop/src/main/ipc/beadsIpc.ts
import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/types';
import * as beadsService from '../beads/BeadsService';

export function registerBeadsIPCHandlers(): () => void {
  ipcMain.handle(
    IPC_CHANNELS.BEADS_LIST_ISSUES,
    async (_, { projectPath, epicId }) => {
      try {
        const issues = beadsService.getIssues(projectPath, epicId);
        return { success: true, issues };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }
  );

  return () => {
    ipcMain.removeHandler(IPC_CHANNELS.BEADS_LIST_ISSUES);
  };
}
```

**Source:** Pattern from `desktop/src/main/ipc/handlers.ts` and `terminalIpc.ts`

### 3. Typed IPC Channels
**Use when:** Adding new IPC channels

```typescript
// desktop/src/shared/types/index.ts
export const IPC_CHANNELS = {
  // ... existing channels ...

  // Beads channels
  BEADS_LIST_ISSUES: 'beads:list-issues',
  BEADS_GET_ISSUE: 'beads:get-issue',
  BEADS_GET_READY: 'beads:get-ready',
  BEADS_GET_DEPENDENCIES: 'beads:get-dependencies',
} as const;
```

### 4. Efficient Batch Queries
**Use when:** Fetching related data (dependencies, labels)

```typescript
// From beadsService.ts - fetches all dependencies in one query
const issueIds = rows.map(r => r.id);
const placeholders = issueIds.map(() => '?').join(',');

const deps = db.prepare(`
  SELECT issue_id, depends_on_id, type FROM dependencies
  WHERE issue_id IN (${placeholders})
`).all(...issueIds);

// Build lookup maps for O(1) access
const parentMap = new Map<string, string>();
for (const dep of deps) {
  if (dep.type === 'parent-child') {
    parentMap.set(dep.issue_id, dep.depends_on_id);
  }
}
```

**Why:** Avoids N+1 query problem when loading relationships.

## Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| SQLite queries in renderer | IPC to main process | Renderer can't access native modules; violates Electron security model |
| Custom blocking/dependency logic | Use `ready_issues` view | Database already has recursive CTE for transitive blocking |
| Manual DB connection pooling | Open/close per request | better-sqlite3 is synchronous; connection overhead is minimal in desktop app |
| TypeScript types for rows | Copy from beadsService.ts | Types already defined for BeadsIssueRow, BeadsDependencyRow, etc. |

## Pitfalls

### Native Module Compilation
**What happens:** better-sqlite3 requires native compilation. If binaries don't match Electron's Node version, you get "module not found" or "wrong architecture" errors.

**Avoid by:**
- The project already has `@electron-forge/plugin-auto-unpack-natives` configured
- This plugin automatically rebuilds native modules for Electron's Node version
- Native binaries are unpacked from ASAR archive at runtime
- If issues occur, verify `electron-rebuild -f -w better-sqlite3` runs successfully

**Recent compatibility note (2025):** Some users reported issues with better-sqlite3 and Electron 26+ causing crashes on database modification. Since we're read-only, this shouldn't affect us, but be aware if the pattern changes.

### Read-Only Mode Doesn't Prevent All Writes
**What happens:** `readonly: true` opens the database in read-only mode, but if the file permissions allow write and you call a write operation, SQLite might still attempt it.

**Avoid by:**
- Always use `readonly: true` option
- Consider adding `db.pragma('query_only = ON')` after opening for extra safety
- This causes any INSERT/UPDATE/DELETE to throw SQLITE_READONLY error

### Database Locking
**What happens:** Even in readonly mode, SQLite takes SHARED locks. If a write operation is happening (e.g., `bd` CLI updating issues), reads may block briefly.

**Avoid by:**
- Open/close connections quickly (don't hold open)
- Handle SQLITE_BUSY errors gracefully
- For desktop app, brief blocking (<100ms) is usually acceptable

### IPC Serialization Limits
**What happens:** Electron IPC uses structured clone algorithm. Large query results (>100MB) can cause performance issues or crashes.

**Avoid by:**
- Paginate large result sets
- Don't return full issue descriptions for list views
- Use SELECT with specific columns, not SELECT *
- For the Beads database (typical: <10,000 issues), this is unlikely to be a problem

### Path Validation
**What happens:** If projectPath comes from renderer without validation, path traversal attacks are possible.

**Avoid by:**
- Always validate paths in main process (already done in `handlers.ts` with `validatePath()`)
- Use `path.resolve()` and check for ".." segments
- Verify database exists at expected location before opening

## Open Questions

None - the pattern is well-established in the codebase.

## Sources

**HIGH confidence:**
- Existing implementation: `/server/services/beadsService.ts`
- Existing IPC patterns: `/desktop/src/main/ipc/handlers.ts`, `/desktop/src/main/ipc/terminalIpc.ts`
- Project configuration: `/package.json`, `/desktop/package.json`
- Database schema: Direct inspection via `sqlite3 .beads/beads.db .schema`

**MEDIUM confidence:**
- [Electron Forge Auto Unpack Natives Plugin](https://www.electronforge.io/config/plugins/auto-unpack-natives)
- [better-sqlite3 npm documentation](https://www.npmjs.com/package/better-sqlite3)
- [Electron IPC handle/invoke pattern](https://www.electronjs.org/docs/latest/tutorial/ipc)
- [better-sqlite3 GitHub issues on Electron compatibility](https://github.com/WiseLibs/better-sqlite3/issues)

**LOW confidence (noted for awareness):**
- better-sqlite3 + Electron 26+ crash reports (2025) - only affects write operations, not read-only
- Auto-unpack-natives issue #3934 (May 2025) - some users reported unpacking failures, but no confirmation this affects v7.6.0
