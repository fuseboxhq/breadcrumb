import { access, readFile, readdir, writeFile } from "fs/promises";
import { join } from "path";
import Database from "better-sqlite3";

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

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
  /** Per-task detail markdown blocks, keyed by task ID as found in the file */
  taskDetails: Record<string, string>;
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
  async getProjectCapabilities(projectPath: string): Promise<ProjectCapabilities> {
    const [hasPlanning, hasBeads] = await Promise.all([
      fileExists(join(projectPath, ".planning", "STATE.md")),
      fileExists(join(projectPath, ".beads", "beads.db")),
    ]);
    return { hasPlanning, hasBeads };
  }

  async getProjectPhases(projectPath: string): Promise<PhaseSummary[]> {
    const stateFile = join(projectPath, ".planning", "STATE.md");
    if (!(await fileExists(stateFile))) return [];

    const content = await readFile(stateFile, "utf-8");
    return this.parseStateFile(content);
  }

  async getPhaseDetail(projectPath: string, phaseId: string): Promise<PhaseDetail | null> {
    const phaseFile = await this.resolvePhaseFile(projectPath, phaseId);
    if (!phaseFile) return null;

    const content = await readFile(phaseFile, "utf-8");
    return this.parsePhaseFile(content, phaseId);
  }

  /**
   * Resolve phase file path — handles multiple conventions:
   * 1. `.planning/PHASE-XX.md` (exact match)
   * 2. `.planning/PHASE-XX-slug.md` (prefix match in root)
   * 3. `.planning/phases/XX-slug/PHASE-XX.md` (subdirectory match)
   * 4. `.planning/phases/XX-slug/*.md` (any .md in matching subdir)
   */
  private async resolvePhaseFile(
    projectPath: string,
    phaseId: string
  ): Promise<string | null> {
    const planningDir = join(projectPath, ".planning");

    // 1. Try exact match in root
    const exact = join(planningDir, `${phaseId}.md`);
    if (await fileExists(exact)) return exact;

    // 2. Try prefix match in root (e.g. PHASE-26-close-the-review-loop.md)
    if (!(await fileExists(planningDir))) return null;
    const prefix = `${phaseId}-`;
    const rootFiles = await readdir(planningDir);
    const rootMatch = rootFiles.find(
      (f) => f.startsWith(prefix) && f.endsWith(".md")
    );
    if (rootMatch) return join(planningDir, rootMatch);

    // 3. Try subdirectory search in .planning/phases/
    // Extract the phase number from phaseId (e.g., "PHASE-24" → "24")
    const numMatch = phaseId.match(/(\d+)$/);
    if (!numMatch) return null;
    const phaseNum = numMatch[1];

    const phasesDir = join(planningDir, "phases");
    if (!(await fileExists(phasesDir))) return null;

    try {
      const subdirs = await readdir(phasesDir);
      // Find subdirectory starting with the phase number (e.g., "24-fraud-intelligence-hub")
      const matchingDir = subdirs.find((d) => {
        const dashIdx = d.indexOf("-");
        const dirNum = dashIdx >= 0 ? d.substring(0, dashIdx) : d;
        return dirNum === phaseNum;
      });

      if (matchingDir) {
        const subdir = join(phasesDir, matchingDir);
        const subFiles = await readdir(subdir);

        // 3a. Look for PHASE-XX.md in subdirectory
        const phaseFile = subFiles.find(
          (f) => f.toUpperCase().startsWith(`PHASE-${phaseNum}`) && f.endsWith(".md")
        );
        if (phaseFile) return join(subdir, phaseFile);

        // 3b. Fall back to any .md file in the subdirectory
        const anyMd = subFiles.find((f) => f.endsWith(".md"));
        if (anyMd) return join(subdir, anyMd);
      }
    } catch {
      // Ignore errors reading phases directory
    }

    return null;
  }

  async getBeadsTasks(projectPath: string, epicId: string): Promise<BeadsTask[]> {
    const dbPath = join(projectPath, ".beads", "beads.db");
    if (!(await fileExists(dbPath))) return [];

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

  /**
   * Normalize status strings from various STATE.md conventions to the
   * canonical set: "complete", "in_progress", "not_started".
   */
  private normalizeStatus(raw: string): PhaseSummary["status"] {
    switch (raw.toLowerCase()) {
      case "done":
      case "closed":
      case "complete":
      case "completed":
        return "complete";
      case "in_progress":
        return "in_progress";
      case "not_started":
      default:
        return "not_started";
    }
  }

  private parseStateFile(content: string): PhaseSummary[] {
    const lines = content.split("\n");

    // Extract current phase — accept both "PHASE-XX" and "Phase XX" formats
    let currentPhaseId = "";
    for (const line of lines) {
      const currentMatch = line.match(
        /^\*\*Current Phase:\*\*\s*(?:PHASE-|Phase\s+)(\d+)/i
      );
      if (currentMatch) {
        currentPhaseId = `PHASE-${currentMatch[1]}`;
        break;
      }
    }

    // Match phase lines — accept both "PHASE-XX:" and "Phase XX:" formats.
    // Allow optional leading "- " (list marker) before the phase identifier.
    // Accept any status value and normalize it.
    // Deduplicate by phase ID — last occurrence wins (most detailed/recent).
    const phaseLineRegex =
      /^(?:-\s+)?(?:PHASE-|Phase\s+)(\d+):\s+(.+?)\s+\((\w+)\)(?:\s+-\s+(\d+)(?:\/(\d+))?\s+tasks?(?:\s+done)?)?/i;

    const seen = new Map<string, PhaseSummary>();
    for (const line of lines) {
      const match = line.match(phaseLineRegex);
      if (match) {
        const normalizedId = `PHASE-${match[1]}`;
        const rawStatus = match[3];
        const status = this.normalizeStatus(rawStatus);

        const taskCount = match[5]
          ? parseInt(match[5])
          : parseInt(match[4] || "0");
        const completedCount = match[5] ? parseInt(match[4] || "0") : 0;
        seen.set(normalizedId, {
          id: normalizedId,
          title: match[2].trim(),
          status,
          taskCount,
          completedCount,
          isActive: normalizedId === currentPhaseId,
        });
      }
    }

    return Array.from(seen.values());
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

    // Parse per-task detail blocks from raw content (works across ## and ### headings)
    const taskDetails = this.parseTaskDetails(content);

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
      taskDetails,
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

  /**
   * Parse the "Task Details" section into per-task markdown blocks.
   * Handles multiple format variants:
   *   - `### task-id — Title` (h3 heading)
   *   - `**task-id: Title**` (bold line)
   *   - `**task-id — Title**` (bold line with em-dash)
   */
  private parseTaskDetails(content: string): Record<string, string> {
    const details: Record<string, string> = {};

    // Find the Task Details section (## or ###)
    const sectionMatch = content.match(/^#{2,3}\s+Task Details\s*$/m);
    if (!sectionMatch || sectionMatch.index === undefined) return details;

    const sectionStart =
      sectionMatch.index + sectionMatch[0].length;

    // Find the end of the section: next ## heading (not ###)
    const rest = content.slice(sectionStart);
    const nextH2 = rest.match(/^## /m);
    const sectionBody = nextH2 && nextH2.index !== undefined
      ? rest.slice(0, nextH2.index)
      : rest;

    // Match block starts: ### id — ...  OR  **id: ...  OR  **id — ...
    const blockPattern =
      /^(?:###\s+([\w.-]+)\s*[—-]|\*\*([\w.-]+)(?:[:.]\s|\s*[—-]\s))/gm;

    const blocks: Array<{ id: string; start: number }> = [];
    let match: RegExpExecArray | null;
    while ((match = blockPattern.exec(sectionBody)) !== null) {
      const taskId = match[1] || match[2];
      blocks.push({ id: taskId, start: match.index });
    }

    for (let i = 0; i < blocks.length; i++) {
      const start = blocks[i].start;
      const end =
        i + 1 < blocks.length ? blocks[i + 1].start : sectionBody.length;
      details[blocks[i].id] = sectionBody.slice(start, end).trim();
    }

    return details;
  }

  /**
   * Replace a single task's detail block in the raw file content.
   * Returns the updated file content string.
   */
  spliceTaskDetail(
    fileContent: string,
    taskId: string,
    newBlock: string
  ): string {
    // Find Task Details section
    const sectionMatch = fileContent.match(/^#{2,3}\s+Task Details\s*$/m);
    if (!sectionMatch || sectionMatch.index === undefined) {
      throw new Error("No Task Details section found in phase file");
    }

    const sectionStart =
      sectionMatch.index + sectionMatch[0].length;
    const rest = fileContent.slice(sectionStart);
    const nextH2 = rest.match(/^## /m);
    const sectionEnd =
      nextH2 && nextH2.index !== undefined
        ? sectionStart + nextH2.index
        : fileContent.length;
    const sectionBody = fileContent.slice(sectionStart, sectionEnd);

    // Find task blocks
    const blockPattern =
      /^(?:###\s+([\w.-]+)\s*[—-]|\*\*([\w.-]+)(?:[:.]\s|\s*[—-]\s))/gm;
    const blocks: Array<{ id: string; start: number }> = [];
    let match: RegExpExecArray | null;
    while ((match = blockPattern.exec(sectionBody)) !== null) {
      blocks.push({ id: match[1] || match[2], start: match.index });
    }

    // Find matching block (with suffix normalization)
    const blockIndex = blocks.findIndex((b) => {
      if (b.id === taskId) return true;
      if (taskId.endsWith(b.id) || b.id.endsWith(taskId)) return true;
      return false;
    });

    if (blockIndex === -1) {
      throw new Error(`Task ${taskId} not found in Task Details section`);
    }

    const blockStart = sectionStart + blocks[blockIndex].start;
    const blockEnd =
      blockIndex + 1 < blocks.length
        ? sectionStart + blocks[blockIndex + 1].start
        : sectionEnd;

    // Splice: replace only this block's byte range
    const before = fileContent.slice(0, blockStart);
    const after = fileContent.slice(blockEnd);
    const normalizedNew = newBlock.trimEnd() + "\n\n";

    return before + normalizedNew + after;
  }

  /**
   * Update a single task's detail content in a phase file on disk.
   */
  async updateTaskDetail(
    projectPath: string,
    phaseId: string,
    taskId: string,
    newContent: string
  ): Promise<void> {
    const phaseFile = await this.resolvePhaseFile(projectPath, phaseId);
    if (!phaseFile) {
      throw new Error(`Phase file not found: ${phaseId}`);
    }

    const content = await readFile(phaseFile, "utf-8");
    const updated = this.spliceTaskDetail(content, taskId, newContent);
    await writeFile(phaseFile, updated, "utf-8");
  }
}

export const planningService = new PlanningService();
