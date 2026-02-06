import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join, basename } from 'path';

export interface Phase {
  id: string;
  title: string;
  status: 'not_started' | 'in_progress' | 'complete';
  beadsEpic: string;
  created: string;
  completed?: string;
  content: string;
}

export interface ProjectState {
  currentPhase: string | null;
  lastUpdated: string;
  activeWork: string;
  completedPhases: string[];
}

export interface ResearchDoc {
  id: string;
  filename: string;
  content: string;
}

function parsePhaseMetadata(content: string): Omit<Phase, 'id' | 'content'> {
  const titleMatch = content.match(/^#\s+Phase\s+\d+:\s*(.+)$/m);
  const statusMatch = content.match(/\*\*Status:\*\*\s*(\S+)/);
  const epicMatch = content.match(/\*\*Beads Epic:\*\*\s*(\S+)/);
  const createdMatch = content.match(/\*\*Created:\*\*\s*(\S+)/);
  const completedMatch = content.match(/\*\*Completed:\*\*\s*(\S+)/);

  const rawStatus = statusMatch?.[1] || 'not_started';
  let status: Phase['status'] = 'not_started';
  if (rawStatus === 'in_progress' || rawStatus === 'in-progress') status = 'in_progress';
  else if (rawStatus === 'complete' || rawStatus === 'completed') status = 'complete';

  return {
    title: titleMatch?.[1]?.trim() || 'Untitled Phase',
    status,
    beadsEpic: epicMatch?.[1] || '',
    created: createdMatch?.[1] || '',
    completed: completedMatch?.[1],
  };
}

// Collect PHASE-*.md files from both flat (.planning/PHASE-XX.md) and
// nested (.planning/phases/*/PHASE-XX.md) layouts. Flat takes precedence
// if the same phase ID exists in both locations.
function findPhaseFiles(planningDir: string): { id: string; filePath: string }[] {
  const found = new Map<string, string>();
  // Matches PHASE-XX.md and PHASE-XX-slug.md (e.g. PHASE-26-close-the-review-loop.md)
  const phasePattern = /^(PHASE-\d+)(?:-[a-zA-Z0-9-]+)?\.md$/;

  // 1. Nested: .planning/phases/*/PHASE-XX.md
  const phasesDir = join(planningDir, 'phases');
  if (existsSync(phasesDir)) {
    for (const entry of readdirSync(phasesDir)) {
      const subdir = join(phasesDir, entry);
      try {
        if (!statSync(subdir).isDirectory()) continue;
      } catch { continue; }
      for (const file of readdirSync(subdir)) {
        const match = phasePattern.exec(file);
        if (match) {
          const id = match[1]; // e.g. "PHASE-26" regardless of slug
          found.set(id, join(subdir, file));
        }
      }
    }
  }

  // 2. Flat: .planning/PHASE-XX.md (overwrites nested if duplicate)
  for (const file of readdirSync(planningDir)) {
    const match = phasePattern.exec(file);
    if (match) {
      const id = match[1]; // e.g. "PHASE-26" regardless of slug
      found.set(id, join(planningDir, file));
    }
  }

  return Array.from(found.entries())
    .map(([id, filePath]) => ({ id, filePath }))
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}

export function getPhases(projectPath: string): Phase[] {
  const planningDir = join(projectPath, '.planning');
  if (!existsSync(planningDir)) return [];

  return findPhaseFiles(planningDir).map(({ id, filePath }) => {
    const content = readFileSync(filePath, 'utf-8');
    const metadata = parsePhaseMetadata(content);
    return { id, content, ...metadata };
  });
}

export function getPhase(projectPath: string, phaseId: string): Phase | null {
  const planningDir = join(projectPath, '.planning');
  // Matches exact (PHASE-XX.md) or slugged (PHASE-XX-slug.md) filenames
  const slugPattern = new RegExp(`^${phaseId}(?:-[a-zA-Z0-9-]+)?\\.md$`);

  // Try flat layout first: .planning/PHASE-XX.md or .planning/PHASE-XX-slug.md
  const flatPath = join(planningDir, `${phaseId}.md`);
  if (existsSync(flatPath)) {
    const content = readFileSync(flatPath, 'utf-8');
    return { id: phaseId, content, ...parsePhaseMetadata(content) };
  }
  // Check for slugged variant in flat layout
  for (const file of readdirSync(planningDir)) {
    if (slugPattern.test(file)) {
      const content = readFileSync(join(planningDir, file), 'utf-8');
      return { id: phaseId, content, ...parsePhaseMetadata(content) };
    }
  }

  // Try nested layout: .planning/phases/*/<phaseId>.md or slugged
  const phasesDir = join(planningDir, 'phases');
  if (existsSync(phasesDir)) {
    for (const entry of readdirSync(phasesDir)) {
      const subdir = join(phasesDir, entry);
      try {
        if (!statSync(subdir).isDirectory()) continue;
      } catch { continue; }
      // Try exact match first
      const candidate = join(subdir, `${phaseId}.md`);
      if (existsSync(candidate)) {
        const content = readFileSync(candidate, 'utf-8');
        return { id: phaseId, content, ...parsePhaseMetadata(content) };
      }
      // Try slugged variant
      for (const file of readdirSync(subdir)) {
        if (slugPattern.test(file)) {
          const content = readFileSync(join(subdir, file), 'utf-8');
          return { id: phaseId, content, ...parsePhaseMetadata(content) };
        }
      }
    }
  }

  return null;
}

export function getProjectState(projectPath: string): ProjectState {
  const statePath = join(projectPath, '.planning', 'STATE.md');
  if (!existsSync(statePath)) {
    return {
      currentPhase: null,
      lastUpdated: '',
      activeWork: '',
      completedPhases: [],
    };
  }

  const content = readFileSync(statePath, 'utf-8');

  const currentPhaseMatch = content.match(/\*\*Current Phase:\*\*\s*(\S+)/);
  const lastUpdatedMatch = content.match(/\*\*Last Updated:\*\*\s*(\S+)/);

  // Extract active work section
  const activeWorkMatch = content.match(/## Active Work\n\n([\s\S]*?)(?=\n## |$)/);

  // Extract completed phases section
  const completedMatch = content.match(/## Completed Phases\n\n([\s\S]*?)(?=\n## |$)/);
  const completedPhases: string[] = [];
  if (completedMatch?.[1]) {
    const lines = completedMatch[1].trim().split('\n');
    for (const line of lines) {
      const phaseMatch = line.match(/(PHASE-\d+)/);
      if (phaseMatch) completedPhases.push(phaseMatch[1]);
    }
  }

  return {
    currentPhase: currentPhaseMatch?.[1] === 'None' ? null : currentPhaseMatch?.[1] || null,
    lastUpdated: lastUpdatedMatch?.[1] || '',
    activeWork: activeWorkMatch?.[1]?.trim() || '',
    completedPhases,
  };
}

export function getResearchDocs(projectPath: string, phaseId?: string): ResearchDoc[] {
  if (!phaseId) return [];

  const researchDir = join(projectPath, '.planning', 'research', phaseId);
  if (!existsSync(researchDir)) return [];

  const files = readdirSync(researchDir).filter(f => f.endsWith('.md')).sort();

  return files.map(filename => {
    const filePath = join(researchDir, filename);
    const content = readFileSync(filePath, 'utf-8');
    return {
      id: basename(filename, '.md'),
      filename,
      content,
    };
  });
}
