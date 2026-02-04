import Database from 'better-sqlite3';
import { join } from 'path';

export interface BeadsIssueRow {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: number;
  issue_type: string;
  assignee: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

export interface BeadsDependencyRow {
  issue_id: string;
  depends_on_id: string;
  type: string;
}

export interface BeadsLabelRow {
  issue_id: string;
  label: string;
}

export interface BeadsIssue {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: number;
  issueType: string;
  assignee: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  parentId: string | null;
  labels: string[];
  blockedBy: string[];
  blocks: string[];
}

function openDb(projectPath: string): Database.Database {
  const dbPath = join(projectPath, '.beads', 'beads.db');
  return new Database(dbPath, { readonly: true, fileMustExist: true });
}

export function getIssues(projectPath: string, epicId?: string): BeadsIssue[] {
  const db = openDb(projectPath);
  try {
    let rows: BeadsIssueRow[];

    if (epicId) {
      // Get child issues of the given epic
      const stmt = db.prepare(`
        SELECT i.id, i.title, i.description, i.status, i.priority,
               i.issue_type, i.assignee, i.created_at, i.updated_at, i.closed_at
        FROM issues i
        INNER JOIN dependencies d ON d.issue_id = i.id AND d.depends_on_id = ? AND d.type = 'parent-child'
        WHERE i.status != 'tombstone' AND i.deleted_at IS NULL
        ORDER BY i.id
      `);
      rows = stmt.all(epicId) as BeadsIssueRow[];
    } else {
      // Get all non-deleted, non-tombstone issues
      const stmt = db.prepare(`
        SELECT id, title, description, status, priority,
               issue_type, assignee, created_at, updated_at, closed_at
        FROM issues
        WHERE status != 'tombstone' AND deleted_at IS NULL
        ORDER BY id
      `);
      rows = stmt.all() as BeadsIssueRow[];
    }

    // Batch-fetch all dependencies and labels for these issues
    const issueIds = rows.map(r => r.id);
    if (issueIds.length === 0) return [];

    const placeholders = issueIds.map(() => '?').join(',');

    const deps = db.prepare(`
      SELECT issue_id, depends_on_id, type FROM dependencies
      WHERE issue_id IN (${placeholders}) OR depends_on_id IN (${placeholders})
    `).all(...issueIds, ...issueIds) as BeadsDependencyRow[];

    const labels = db.prepare(`
      SELECT issue_id, label FROM labels
      WHERE issue_id IN (${placeholders})
    `).all(...issueIds) as BeadsLabelRow[];

    // Build lookup maps
    const parentMap = new Map<string, string>();
    const blockedByMap = new Map<string, string[]>();
    const blocksMap = new Map<string, string[]>();
    const labelMap = new Map<string, string[]>();

    for (const dep of deps) {
      if (dep.type === 'parent-child') {
        parentMap.set(dep.issue_id, dep.depends_on_id);
      } else if (dep.type === 'blocks') {
        // issue_id is blocked by depends_on_id
        const existing = blockedByMap.get(dep.issue_id) || [];
        existing.push(dep.depends_on_id);
        blockedByMap.set(dep.issue_id, existing);

        // depends_on_id blocks issue_id
        const blocking = blocksMap.get(dep.depends_on_id) || [];
        blocking.push(dep.issue_id);
        blocksMap.set(dep.depends_on_id, blocking);
      }
    }

    for (const lbl of labels) {
      const existing = labelMap.get(lbl.issue_id) || [];
      existing.push(lbl.label);
      labelMap.set(lbl.issue_id, existing);
    }

    return rows.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      status: row.status,
      priority: row.priority,
      issueType: row.issue_type,
      assignee: row.assignee,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      closedAt: row.closed_at,
      parentId: parentMap.get(row.id) || null,
      labels: labelMap.get(row.id) || [],
      blockedBy: blockedByMap.get(row.id) || [],
      blocks: blocksMap.get(row.id) || [],
    }));
  } finally {
    db.close();
  }
}

export function getIssue(projectPath: string, issueId: string): BeadsIssue | null {
  const db = openDb(projectPath);
  try {
    const row = db.prepare(`
      SELECT id, title, description, status, priority,
             issue_type, assignee, created_at, updated_at, closed_at
      FROM issues WHERE id = ? AND status != 'tombstone' AND deleted_at IS NULL
    `).get(issueId) as BeadsIssueRow | undefined;

    if (!row) return null;

    const deps = db.prepare(`
      SELECT issue_id, depends_on_id, type FROM dependencies
      WHERE issue_id = ? OR depends_on_id = ?
    `).all(issueId, issueId) as BeadsDependencyRow[];

    const labels = db.prepare(`
      SELECT label FROM labels WHERE issue_id = ?
    `).all(issueId) as { label: string }[];

    let parentId: string | null = null;
    const blockedBy: string[] = [];
    const blocks: string[] = [];

    for (const dep of deps) {
      if (dep.type === 'parent-child' && dep.issue_id === issueId) {
        parentId = dep.depends_on_id;
      } else if (dep.type === 'blocks') {
        if (dep.issue_id === issueId) {
          blockedBy.push(dep.depends_on_id);
        }
        if (dep.depends_on_id === issueId) {
          blocks.push(dep.issue_id);
        }
      }
    }

    return {
      id: row.id,
      title: row.title,
      description: row.description,
      status: row.status,
      priority: row.priority,
      issueType: row.issue_type,
      assignee: row.assignee,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      closedAt: row.closed_at,
      parentId,
      labels: labels.map(l => l.label),
      blockedBy,
      blocks,
    };
  } finally {
    db.close();
  }
}

export function getReadyIssues(projectPath: string): BeadsIssue[] {
  const db = openDb(projectPath);
  try {
    // Use the ready_issues view built into the Beads schema
    const rows = db.prepare(`
      SELECT i.id, i.title, i.description, i.status, i.priority,
             i.issue_type, i.assignee, i.created_at, i.updated_at, i.closed_at
      FROM ready_issues r
      INNER JOIN issues i ON i.id = r.id
      ORDER BY i.priority ASC, i.created_at ASC
    `).all() as BeadsIssueRow[];

    return rows.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      status: row.status,
      priority: row.priority,
      issueType: row.issue_type,
      assignee: row.assignee,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      closedAt: row.closed_at,
      parentId: null,
      labels: [],
      blockedBy: [],
      blocks: [],
    }));
  } finally {
    db.close();
  }
}
