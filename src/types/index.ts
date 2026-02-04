// Phase data from .planning/PHASE-*.md files
export interface Phase {
  id: string;           // e.g., "PHASE-01"
  title: string;
  status: 'not_started' | 'in_progress' | 'complete';
  beadsEpic: string;    // e.g., "breadcrumb-btr"
  created: string;
  completed?: string;
  content: string;      // Raw markdown content
}

// Beads issue from .beads/beads.db
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

// Project registration in ~/.breadcrumb/projects.json
export interface Project {
  path: string;
  name: string;
  registeredAt: string;
}

// Project state from .planning/STATE.md
export interface ProjectState {
  currentPhase: string | null;
  lastUpdated: string;
  activeWork: string;
  completedPhases: string[];
}

export type TabType = 'phases' | 'tasks' | 'research';
