import { readFileSync, readdirSync, existsSync } from 'fs';
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
  if (rawStatus === 'in_progress') status = 'in_progress';
  else if (rawStatus === 'complete') status = 'complete';

  return {
    title: titleMatch?.[1]?.trim() || 'Untitled Phase',
    status,
    beadsEpic: epicMatch?.[1] || '',
    created: createdMatch?.[1] || '',
    completed: completedMatch?.[1],
  };
}

export function getPhases(projectPath: string): Phase[] {
  const planningDir = join(projectPath, '.planning');
  if (!existsSync(planningDir)) return [];

  const files = readdirSync(planningDir).filter(f => /^PHASE-\d+\.md$/.test(f)).sort();

  return files.map(filename => {
    const filePath = join(planningDir, filename);
    const content = readFileSync(filePath, 'utf-8');
    const id = basename(filename, '.md');
    const metadata = parsePhaseMetadata(content);

    return { id, content, ...metadata };
  });
}

export function getPhase(projectPath: string, phaseId: string): Phase | null {
  const filePath = join(projectPath, '.planning', `${phaseId}.md`);
  if (!existsSync(filePath)) return null;

  const content = readFileSync(filePath, 'utf-8');
  const metadata = parsePhaseMetadata(content);

  return { id: phaseId, content, ...metadata };
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

export function getResearchDocs(projectPath: string): ResearchDoc[] {
  const researchDir = join(projectPath, '.planning', 'research');
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
