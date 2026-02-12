import { readFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import Database from "better-sqlite3";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ProjectCapabilities {
  hasPlanning: boolean;
  hasBeads: boolean;
}

export interface PhaseSummary {
  id: string;
  title: string;
  status: "complete" | "in_progress" | "not_started";
  taskCount: number;
  completedCount: number;
  isActive: boolean;
}

export interface PhaseTask {
  id: string;
  title: string;
  status: "done" | "in_progress" | "not_started" | "blocked";
  complexity: string;
  dependsOn: string[];
}

export interface CompletionCriterion {
  text: string;
  checked: boolean;
}

export interface TechnicalDecision {
  decision: string;
  choice: string;
  rationale: string;
}

export interface PhaseDetail {
  id: string;
  title: string;
  status: string;
  beadsEpic: string;
  created: string;
  objective: string;
  scope: { inScope: string[]; outOfScope: string[] };
  constraints: string[];
  tasks: PhaseTask[];
  completionCriteria: CompletionCriterion[];
  decisions: TechnicalDecision[];
}

export interface BeadsTask {
  id: string;
  title: string;
  status: string;
  priority: number;
  issueType: string;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  parentId: string | null;
  blockedBy: string[];
  blocks: string[];
}

// ── Service ──────────────────────────────────────────────────────────────────

export class PlanningService {
  getProjectCapabilities(projectPath: string): ProjectCapabilities {
    return {
      hasPlanning: existsSync(join(projectPath, ".planning", "STATE.md")),
      hasBeads: existsSync(join(projectPath, ".beads", "beads.db")),
    };
  }

  getProjectPhases(projectPath: string): PhaseSummary[] {
    const stateFile = join(projectPath, ".planning", "STATE.md");
    if (!existsSync(stateFile)) return [];

    const content = readFileSync(stateFile, "utf-8");
    return this.parseStateFile(content);
  }

  getPhaseDetail(projectPath: string, phaseId: string): PhaseDetail | null {
    const phaseFile = this.resolvePhaseFile(projectPath, phaseId);
    if (!phaseFile) return null;

    const content = readFileSync(phaseFile, "utf-8");
    return this.parsePhaseFile(content, phaseId);
  }

  /**
   * Resolve phase file path — handles both `PHASE-XX.md` and
   * slugified names like `PHASE-XX-some-title.md`.
   */
  private resolvePhaseFile(
    projectPath: string,
    phaseId: string
  ): string | null {
    const planningDir = join(projectPath, ".planning");

    // Try exact match first
    const exact = join(planningDir, `${phaseId}.md`);
    if (existsSync(exact)) return exact;

    // Try prefix match (e.g. PHASE-26-close-the-review-loop.md)
    if (!existsSync(planningDir)) return null;
    const prefix = `${phaseId}-`;
    const files = readdirSync(planningDir);
    const match = files.find(
      (f) => f.startsWith(prefix) && f.endsWith(".md")
    );
    return match ? join(planningDir, match) : null;
  }

  getBeadsTasks(projectPath: string, epicId: string): BeadsTask[] {
    const dbPath = join(projectPath, ".beads", "beads.db");
    if (!existsSync(dbPath)) return [];

    const db = new Database(dbPath, { readonly: true, fileMustExist: true });
    try {
      db.pragma("query_only = ON");

      // Get child issues of the epic
      const rows = db
        .prepare(
          `
        SELECT i.id, i.title, i.status, i.priority,
               i.issue_type, i.created_at, i.updated_at, i.closed_at
        FROM issues i
        INNER JOIN dependencies d ON d.issue_id = i.id AND d.depends_on_id = ? AND d.type = 'parent-child'
        WHERE i.status != 'tombstone' AND i.deleted_at IS NULL
        ORDER BY i.id
      `
        )
        .all(epicId) as Array<{
        id: string;
        title: string;
        status: string;
        priority: number;
        issue_type: string;
        created_at: string;
        updated_at: string;
        closed_at: string | null;
      }>;

      if (rows.length === 0) return [];

      // Batch-fetch dependencies
      const issueIds = rows.map((r) => r.id);
      const placeholders = issueIds.map(() => "?").join(",");

      const deps = db
        .prepare(
          `
        SELECT issue_id, depends_on_id, type FROM dependencies
        WHERE (issue_id IN (${placeholders}) OR depends_on_id IN (${placeholders}))
          AND type = 'blocks'
      `
        )
        .all(...issueIds, ...issueIds) as Array<{
        issue_id: string;
        depends_on_id: string;
        type: string;
      }>;

      const blockedByMap = new Map<string, string[]>();
      const blocksMap = new Map<string, string[]>();

      for (const dep of deps) {
        const existing = blockedByMap.get(dep.issue_id) || [];
        existing.push(dep.depends_on_id);
        blockedByMap.set(dep.issue_id, existing);

        const blocking = blocksMap.get(dep.depends_on_id) || [];
        blocking.push(dep.issue_id);
        blocksMap.set(dep.depends_on_id, blocking);
      }

      return rows.map((row) => ({
        id: row.id,
        title: row.title,
        status: row.status,
        priority: row.priority,
        issueType: row.issue_type,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        closedAt: row.closed_at,
        parentId: epicId,
        blockedBy: blockedByMap.get(row.id) || [],
        blocks: blocksMap.get(row.id) || [],
      }));
    } finally {
      db.close();
    }
  }

  // ── Parsers ──────────────────────────────────────────────────────────────

  private parseStateFile(content: string): PhaseSummary[] {
    const phases: PhaseSummary[] = [];
    const lines = content.split("\n");

    // Extract current phase
    let currentPhaseId = "";
    for (const line of lines) {
      const currentMatch = line.match(/^\*\*Current Phase:\*\*\s*(PHASE-\d+)/);
      if (currentMatch) {
        currentPhaseId = currentMatch[1];
        break;
      }
    }

    for (const line of lines) {
      const match = line.match(
        /^(PHASE-\d+):\s+(.+?)\s+\((complete|in_progress|not_started)\)(?:\s+-\s+(\d+)(?:\/(\d+))?\s+tasks?\s+done)?/
      );
      if (match) {
        const taskCount = match[5]
          ? parseInt(match[5])
          : parseInt(match[4] || "0");
        const completedCount = match[5] ? parseInt(match[4] || "0") : 0;
        phases.push({
          id: match[1],
          title: match[2].trim(),
          status: match[3] as PhaseSummary["status"],
          taskCount,
          completedCount,
          isActive: match[1] === currentPhaseId,
        });
      }
    }

    return phases;
  }

  private parsePhaseFile(content: string, phaseId: string): PhaseDetail {
    const lines = content.split("\n");

    // Parse header metadata
    let title = phaseId;
    let status = "not_started";
    let beadsEpic = "";
    let created = "";

    const titleMatch = lines[0]?.match(/^#\s+Phase\s+\d+:\s+(.+)/);
    if (titleMatch) title = titleMatch[1].trim();

    for (const line of lines.slice(0, 10)) {
      const statusMatch = line.match(/^\*\*Status:\*\*\s*(\S+)/);
      if (statusMatch) status = statusMatch[1];

      const epicMatch = line.match(/^\*\*Beads Epic:\*\*\s*(\S+)/);
      if (epicMatch) beadsEpic = epicMatch[1];

      const createdMatch = line.match(/^\*\*Created:\*\*\s*(.+)/);
      if (createdMatch) created = createdMatch[1].trim();
    }

    // Split into sections by ## headers
    const sections = this.splitSections(content);

    return {
      id: phaseId,
      title,
      status,
      beadsEpic,
      created,
      objective: this.extractSection(sections, "Objective"),
      scope: this.parseScope(this.extractSection(sections, "Scope")),
      constraints: this.parseBulletList(
        this.extractSection(sections, "Constraints")
      ),
      tasks: this.parseTasksTable(this.extractSection(sections, "Tasks")),
      completionCriteria: this.parseCompletionCriteria(
        this.extractSection(sections, "Completion Criteria")
      ),
      decisions: this.parseDecisions(
        this.extractSection(sections, "Technical Decisions")
      ),
    };
  }

  private splitSections(content: string): Map<string, string> {
    const sections = new Map<string, string>();
    const parts = content.split(/^## /m);

    for (const part of parts.slice(1)) {
      const newlineIdx = part.indexOf("\n");
      if (newlineIdx === -1) continue;
      const heading = part.slice(0, newlineIdx).trim();
      const body = part.slice(newlineIdx + 1).trim();
      sections.set(heading, body);
    }

    return sections;
  }

  private extractSection(sections: Map<string, string>, name: string): string {
    return sections.get(name) || "";
  }

  private parseScope(text: string): {
    inScope: string[];
    outOfScope: string[];
  } {
    const inScope: string[] = [];
    const outOfScope: string[] = [];

    let currentList = inScope;
    for (const line of text.split("\n")) {
      if (line.match(/\*\*In scope:\*\*/i)) {
        currentList = inScope;
        continue;
      }
      if (line.match(/\*\*Out of scope:\*\*/i)) {
        currentList = outOfScope;
        continue;
      }
      const bullet = line.match(/^-\s+(.+)/);
      if (bullet) {
        currentList.push(bullet[1].trim());
      }
    }

    return { inScope, outOfScope };
  }

  private parseBulletList(text: string): string[] {
    const items: string[] = [];
    for (const line of text.split("\n")) {
      const match = line.match(/^-\s+(.+)/);
      if (match) items.push(match[1].trim());
    }
    return items;
  }

  private parseTasksTable(text: string): PhaseTask[] {
    const tasks: PhaseTask[] = [];
    const lines = text.split("\n");

    // Find the table — look for the header row with | ID |
    let inTable = false;
    let headerSeen = false;

    for (const line of lines) {
      // Detect header row
      if (!inTable && line.match(/\|\s*ID\s*\|/i)) {
        inTable = true;
        headerSeen = false;
        continue;
      }

      // Skip separator row (|---|---|...)
      if (inTable && !headerSeen && line.match(/^\|[\s-|]+\|$/)) {
        headerSeen = true;
        continue;
      }

      // Parse data rows
      if (inTable && headerSeen) {
        // Stop at empty line or non-table line
        if (!line.trim() || !line.includes("|")) {
          inTable = false;
          continue;
        }

        const cells = line
          .split("|")
          .map((c) => c.trim())
          .filter(Boolean);
        if (cells.length < 4) continue;

        // Skip placeholder rows
        if (cells[0] === "-" || cells[0] === "—") continue;

        const dependsOnRaw = cells[4] || "—";
        const dependsOn =
          dependsOnRaw === "—" || dependsOnRaw === "-"
            ? []
            : dependsOnRaw.split(",").map((d) => d.trim());

        tasks.push({
          id: cells[0],
          title: cells[1],
          status: this.normalizeTaskStatus(cells[2]),
          complexity: cells[3],
          dependsOn,
        });
      }
    }

    return tasks;
  }

  private normalizeTaskStatus(
    raw: string
  ): "done" | "in_progress" | "not_started" | "blocked" {
    const lower = raw.toLowerCase().trim();
    if (lower === "done" || lower === "complete" || lower === "closed")
      return "done";
    if (lower === "in_progress" || lower === "in progress" || lower === "active")
      return "in_progress";
    if (lower === "blocked") return "blocked";
    return "not_started";
  }

  private parseCompletionCriteria(text: string): CompletionCriterion[] {
    const criteria: CompletionCriterion[] = [];
    for (const line of text.split("\n")) {
      const checkedMatch = line.match(/^-\s+\[x\]\s+(.+)/i);
      if (checkedMatch) {
        criteria.push({ text: checkedMatch[1].trim(), checked: true });
        continue;
      }
      const uncheckedMatch = line.match(/^-\s+\[\s?\]\s+(.+)/);
      if (uncheckedMatch) {
        criteria.push({ text: uncheckedMatch[1].trim(), checked: false });
      }
    }
    return criteria;
  }

  private parseDecisions(text: string): TechnicalDecision[] {
    const decisions: TechnicalDecision[] = [];
    const lines = text.split("\n");

    let inTable = false;
    let headerSeen = false;

    for (const line of lines) {
      if (!inTable && line.match(/\|\s*Decision\s*\|/i)) {
        inTable = true;
        headerSeen = false;
        continue;
      }

      if (inTable && !headerSeen && line.match(/^\|[\s-|]+\|$/)) {
        headerSeen = true;
        continue;
      }

      if (inTable && headerSeen) {
        if (!line.trim() || !line.includes("|")) {
          inTable = false;
          continue;
        }

        const cells = line
          .split("|")
          .map((c) => c.trim())
          .filter(Boolean);
        if (cells.length < 3) continue;

        decisions.push({
          decision: cells[0],
          choice: cells[1],
          rationale: cells[2],
        });
      }
    }

    return decisions;
  }
}

export const planningService = new PlanningService();
