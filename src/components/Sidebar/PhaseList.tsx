import type { Phase } from '../../types';
import { Spinner } from '../ui/Spinner';

interface PhaseListProps {
  phases: Phase[];
  isLoading: boolean;
  selectedPhaseId: string | null;
  onSelect: (phaseId: string) => void;
}

const STATUS_DOT: Record<string, string> = {
  not_started: 'bg-gray-500',
  in_progress: 'bg-blue-500',
  complete: 'bg-green-500',
};

export function PhaseList({ phases, isLoading, selectedPhaseId, onSelect }: PhaseListProps) {
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
      {phases.map((phase) => (
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
          </div>
          <div className="mt-1 text-sm font-medium truncate pl-4">{phase.title}</div>
        </button>
      ))}
    </div>
  );
}
