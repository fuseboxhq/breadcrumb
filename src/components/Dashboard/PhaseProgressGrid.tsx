import type { Phase, PhaseProgress } from '../../types';
import { ProgressBar } from '../ui/ProgressBar';

interface PhaseProgressGridProps {
  phases: Phase[];
  progressByEpic: Map<string, PhaseProgress>;
  onSelectPhase: (phaseId: string) => void;
}

const PHASE_STATUS_COLORS: Record<string, string> = {
  not_started: 'border-gray-700',
  in_progress: 'border-blue-800',
  complete: 'border-green-800',
};

const PHASE_STATUS_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  not_started: { bg: 'bg-gray-700', text: 'text-gray-300', label: 'Not Started' },
  in_progress: { bg: 'bg-blue-600', text: 'text-blue-100', label: 'In Progress' },
  complete: { bg: 'bg-green-600', text: 'text-green-100', label: 'Complete' },
};

export function PhaseProgressGrid({ phases, progressByEpic, onSelectPhase }: PhaseProgressGridProps) {
  if (phases.length === 0) {
    return (
      <div className="text-gray-500 text-sm text-center py-8">
        No phases yet. Run <code className="bg-gray-800 px-1.5 py-0.5 rounded">/bc:new-phase</code> to create one.
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Phases</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {phases.map((phase) => {
          const progress = progressByEpic.get(phase.beadsEpic);
          const badge = PHASE_STATUS_BADGES[phase.status] || PHASE_STATUS_BADGES.not_started;
          const borderColor = PHASE_STATUS_COLORS[phase.status] || PHASE_STATUS_COLORS.not_started;

          return (
            <button
              key={phase.id}
              onClick={() => onSelectPhase(phase.id)}
              className={`border ${borderColor} rounded-lg p-4 text-left hover:bg-gray-900/50 transition-colors`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-mono text-gray-500">{phase.id}</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${badge.bg} ${badge.text}`}>
                  {badge.label}
                </span>
              </div>
              <p className="text-sm font-medium text-white mb-3 line-clamp-2">{phase.title}</p>
              {progress && progress.total > 0 ? (
                <div>
                  <ProgressBar progress={progress} size="sm" />
                  <p className="text-xs text-gray-500 mt-1.5">
                    {progress.done}/{progress.total} tasks done
                  </p>
                </div>
              ) : (
                <p className="text-xs text-gray-600">No tasks</p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
