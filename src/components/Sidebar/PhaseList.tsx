import type { Phase, PhaseProgress } from '../../types';
import { Spinner } from '../ui/Spinner';
import { ProgressBar } from '../ui/ProgressBar';

interface PhaseListProps {
  phases: Phase[];
  isLoading: boolean;
  selectedPhaseId: string | null;
  onSelect: (phaseId: string) => void;
  progressByEpic: Map<string, PhaseProgress>;
}

const STATUS_DOT: Record<string, string> = {
  not_started: 'bg-gray-500',
  in_progress: 'bg-blue-500',
  complete: 'bg-green-500',
};

export function PhaseList({ phases, isLoading, selectedPhaseId, onSelect, progressByEpic }: PhaseListProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner size="sm" />
      </div>
    );
  }

  if (phases.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm text-gray-500">
        No phases found.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {phases.map((phase) => {
        const progress = progressByEpic.get(phase.beadsEpic);
        const readyCount = progress ? progress.total - progress.done - progress.blocked : 0;
        return (
          <button
            key={phase.id}
            onClick={() => onSelect(phase.id)}
            className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
              selectedPhaseId === phase.id
                ? 'bg-gray-800 text-white'
                : 'text-gray-300 hover:bg-gray-800/50'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[phase.status] || STATUS_DOT.not_started}`} />
              <span className="text-xs text-gray-500 font-mono">{phase.id}</span>
              {readyCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-blue-500/20 text-blue-400">
                  {readyCount} ready
                </span>
              )}
              {progress && progress.total > 0 && (
                <span className="ml-auto text-xs text-gray-500 tabular-nums">
                  {progress.done}/{progress.total}
                </span>
              )}
            </div>
            <div className="mt-1 text-sm font-medium truncate pl-4">{phase.title}</div>
            {progress && progress.total > 0 && (
              <div className="mt-1.5 pl-4">
                <ProgressBar progress={progress} size="sm" />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
