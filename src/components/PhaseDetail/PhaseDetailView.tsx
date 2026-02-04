import { useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Phase, ContentTab } from '../../types';
import { useIssues } from '../../hooks/useIssues';
import { useResearch } from '../../hooks/useResearch';
import { computeProgress } from '../../lib/taskUtils';
import { ContentTabBar } from './ContentTabBar';
import { PhasePlanTab } from './PhasePlanTab';
import { PhaseTasksTab } from './PhaseTasksTab';
import { ResearchTab } from './ResearchTab';
import { ProgressBar } from '../ui/ProgressBar';
import { Badge } from '../ui/Badge';
import { Spinner } from '../ui/Spinner';

const STATUS_BADGE: Record<string, { variant: 'default' | 'accent' | 'success'; label: string }> = {
  not_started: { variant: 'default', label: 'Not Started' },
  in_progress: { variant: 'accent', label: 'In Progress' },
  complete: { variant: 'success', label: 'Complete' },
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
      <div className="flex items-center justify-center h-full text-status-error">
        <p className="text-sm">Error loading phase: {error.message}</p>
      </div>
    );
  }

  const badge = STATUS_BADGE[phase.status] || STATUS_BADGE.not_started;

  return (
    <div className="h-full flex flex-col">
      {/* Phase header */}
      <div className="px-8 pt-6 pb-4 border-b border-border">
        <div className="flex items-center gap-2.5 mb-2">
          <Badge variant={badge.variant}>{badge.label}</Badge>
          <span className="text-2xs text-text-tertiary font-mono">{phase.id}</span>
          {phase.beadsEpic && (
            <span className="text-2xs text-text-tertiary font-mono">{phase.beadsEpic}</span>
          )}
          {progress.total > 0 && (
            <span className="ml-auto text-sm text-text-secondary tabular-nums">
              {progress.done}/{progress.total} tasks done
            </span>
          )}
        </div>
        <h2 className="text-lg font-semibold text-text-primary mb-2">{phase.title}</h2>
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

      {/* Tab content with transitions */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.12, ease: 'easeOut' }}
          >
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
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
