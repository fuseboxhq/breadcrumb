import { useMemo } from 'react';
import type { Phase, ContentTab } from '../../types';
import { useIssues } from '../../hooks/useIssues';
import { useResearch } from '../../hooks/useResearch';
import { computeProgress } from '../../lib/taskUtils';
import { ContentTabBar } from './ContentTabBar';
import { PhasePlanTab } from './PhasePlanTab';
import { PhaseTasksTab } from './PhaseTasksTab';
import { ResearchTab } from './ResearchTab';
import { ProgressBar } from '../ui/ProgressBar';
import { Spinner } from '../ui/Spinner';

const STATUS_COLORS: Record<string, string> = {
  not_started: 'bg-gray-600 text-gray-200',
  in_progress: 'bg-blue-600 text-blue-100',
  complete: 'bg-green-600 text-green-100',
};

const STATUS_LABELS: Record<string, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  complete: 'Complete',
};

interface PhaseDetailViewProps {
  phase: Phase;
  projectPath: string;
  isLoading: boolean;
  error: Error | null;
  activeTab: ContentTab;
  onTabChange: (tab: ContentTab) => void;
}

export function PhaseDetailView({
  phase,
  projectPath,
  isLoading,
  error,
  activeTab,
  onTabChange,
}: PhaseDetailViewProps) {
  const { data: epicIssues = [], isLoading: isIssuesLoading } = useIssues(projectPath, phase.beadsEpic);
  const { data: research = [], isLoading: isResearchLoading } = useResearch(projectPath);

  const progress = useMemo(() => computeProgress(epicIssues), [epicIssues]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-red-400">
        <p>Error loading phase: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Phase header */}
      <div className="px-8 pt-6 pb-4 border-b border-gray-800">
        <div className="flex items-center gap-3 mb-2">
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[phase.status] || STATUS_COLORS.not_started}`}>
            {STATUS_LABELS[phase.status] || phase.status}
          </span>
          <span className="text-sm text-gray-500 font-mono">{phase.id}</span>
          {phase.beadsEpic && (
            <span className="text-sm text-gray-600 font-mono">{phase.beadsEpic}</span>
          )}
          {progress.total > 0 && (
            <span className="ml-auto text-sm text-gray-400 tabular-nums">
              {progress.done}/{progress.total} tasks done
            </span>
          )}
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">{phase.title}</h2>
        {progress.total > 0 && (
          <div className="max-w-md">
            <ProgressBar progress={progress} size="md" />
          </div>
        )}
      </div>

      {/* Tab bar */}
      <ContentTabBar
        activeTab={activeTab}
        onChange={onTabChange}
        taskCount={epicIssues.length}
        researchCount={research.length}
      />

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'plan' && <PhasePlanTab phase={phase} />}
        {activeTab === 'tasks' && (
          <PhaseTasksTab
            issues={epicIssues}
            isLoading={isIssuesLoading}
            phaseTitle={phase.title}
            epicId={phase.beadsEpic}
          />
        )}
        {activeTab === 'research' && (
          <ResearchTab docs={research} isLoading={isResearchLoading} />
        )}
      </div>
    </div>
  );
}
