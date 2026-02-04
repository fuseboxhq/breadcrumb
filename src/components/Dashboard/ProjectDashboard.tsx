import type { Phase, BeadsIssue, PhaseProgress, ProjectState } from '../../types';
import { ProjectStateCard } from './ProjectStateCard';
import { PhaseProgressGrid } from './PhaseProgressGrid';
import { ReadyTasksPanel } from './ReadyTasksPanel';

interface ProjectDashboardProps {
  projectState: ProjectState | undefined;
  isStateLoading: boolean;
  phases: Phase[];
  progressByEpic: Map<string, PhaseProgress>;
  readyIssues: BeadsIssue[];
  isReadyLoading: boolean;
  onSelectPhase: (phaseId: string) => void;
}

export function ProjectDashboard({
  projectState,
  isStateLoading,
  phases,
  progressByEpic,
  readyIssues,
  isReadyLoading,
  onSelectPhase,
}: ProjectDashboardProps) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto p-8 space-y-8">
        <div>
          <h2 className="text-xl font-semibold text-white mb-1">Project Dashboard</h2>
          <p className="text-sm text-gray-500">Overview of phases, tasks, and progress</p>
        </div>

        <ProjectStateCard state={projectState} isLoading={isStateLoading} />

        <PhaseProgressGrid
          phases={phases}
          progressByEpic={progressByEpic}
          onSelectPhase={onSelectPhase}
        />

        <ReadyTasksPanel issues={readyIssues} isLoading={isReadyLoading} />
      </div>
    </div>
  );
}
