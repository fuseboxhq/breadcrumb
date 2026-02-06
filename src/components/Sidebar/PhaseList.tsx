import { useMemo } from 'react';
import clsx from 'clsx';
import { Layers, Zap } from 'lucide-react';
import type { Phase, PhaseProgress } from '../../types';
import { Spinner } from '../ui/Spinner';
import { ProgressBar } from '../ui/ProgressBar';
import { Badge } from '../ui/Badge';

interface PhaseListProps {
  phases: Phase[];
  isLoading: boolean;
  selectedPhaseId: string | null;
  onSelect: (phaseId: string) => void;
  progressByEpic: Map<string, PhaseProgress>;
  collapsed?: boolean;
  hideCompleted?: boolean;
}

const STATUS_CONFIG: Record<string, { dot: string; label: string }> = {
  not_started: { dot: 'bg-phase-not-started', label: 'Not started' },
  in_progress: { dot: 'bg-phase-in-progress', label: 'In progress' },
  complete: { dot: 'bg-phase-complete', label: 'Complete' },
};

export function PhaseList({ phases, isLoading, selectedPhaseId, onSelect, progressByEpic, collapsed, hideCompleted }: PhaseListProps) {
  const visiblePhases = useMemo(() => {
    let filtered = hideCompleted ? phases.filter(p => p.status !== 'complete') : phases;
    return [...filtered].reverse();
  }, [phases, hideCompleted]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner size="sm" />
      </div>
    );
  }

  if (phases.length === 0) {
    return (
      <div className="px-3 py-8 text-center">
        <Layers className="h-5 w-5 text-text-tertiary mx-auto mb-2" />
        <p className="text-xs text-text-tertiary">No phases yet</p>
      </div>
    );
  }

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-1 py-1">
        {visiblePhases.map((phase) => {
          const config = STATUS_CONFIG[phase.status] || STATUS_CONFIG.not_started;
          const isSelected = selectedPhaseId === phase.id;
          return (
            <button
              key={phase.id}
              onClick={() => onSelect(phase.id)}
              className={clsx(
                'w-8 h-8 rounded-md flex items-center justify-center text-2xs font-medium transition-colors',
                isSelected
                  ? 'bg-surface-active text-text-primary'
                  : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
              )}
              title={`${phase.id}: ${phase.title}`}
            >
              <span className={clsx('w-1.5 h-1.5 rounded-full', config.dot)} />
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      {visiblePhases.map((phase) => {
        const progress = progressByEpic.get(phase.beadsEpic);
        const config = STATUS_CONFIG[phase.status] || STATUS_CONFIG.not_started;
        const isSelected = selectedPhaseId === phase.id;
        const readyCount = progress ? progress.total - progress.done - progress.blocked : 0;

        return (
          <button
            key={phase.id}
            onClick={() => onSelect(phase.id)}
            className={clsx(
              'w-full text-left px-3 py-2.5 rounded-md transition-colors group',
              isSelected
                ? 'bg-surface-active text-text-primary'
                : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', config.dot)} />
              <span className="text-2xs font-mono text-text-tertiary">{phase.id}</span>
              {readyCount > 0 && (
                <Badge variant="accent" className="ml-auto">
                  <Zap className="h-2.5 w-2.5 mr-0.5" />
                  {readyCount}
                </Badge>
              )}
              {progress && progress.total > 0 && !readyCount && (
                <span className="ml-auto text-2xs text-text-tertiary tabular-nums">
                  {progress.done}/{progress.total}
                </span>
              )}
            </div>
            <div className="text-sm font-medium truncate pl-3.5">{phase.title}</div>
            {progress && progress.total > 0 && (
              <div className="mt-1.5 pl-3.5">
                <ProgressBar progress={progress} size="sm" />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
