import type { PhaseProgress } from '../../types';
import { ProgressBar } from '../ui/ProgressBar';

interface EpicOverviewCardProps {
  title: string;
  epicId: string;
  progress: PhaseProgress;
}

export function EpicOverviewCard({ title, epicId, progress }: EpicOverviewCardProps) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        <h3 className="text-sm font-medium text-gray-100">{title}</h3>
        <span className="text-xs text-gray-500 font-mono ml-auto">{epicId}</span>
      </div>

      <ProgressBar progress={progress} size="lg" />

      <div className="flex gap-4 mt-2 text-xs">
        <span className="text-green-400">{progress.done} done</span>
        <span className="text-blue-400">{progress.open} open</span>
        {progress.blocked > 0 && (
          <span className="text-red-400">{progress.blocked} blocked</span>
        )}
      </div>
    </div>
  );
}
