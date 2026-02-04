import { Layers } from 'lucide-react';
import type { PhaseProgress } from '../../types';
import { ProgressBar } from '../ui/ProgressBar';

interface EpicOverviewCardProps {
  title: string;
  epicId: string;
  progress: PhaseProgress;
}

export function EpicOverviewCard({ title, epicId, progress }: EpicOverviewCardProps) {
  return (
    <div className="bg-surface-raised border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <Layers className="h-4 w-4 text-text-tertiary" />
        <h3 className="text-sm font-medium text-text-primary">{title}</h3>
        <span className="text-2xs text-text-tertiary font-mono ml-auto">{epicId}</span>
      </div>

      <ProgressBar progress={progress} size="lg" />

      <div className="flex gap-4 mt-2 text-2xs">
        <span className="text-status-success">{progress.done} done</span>
        <span className="text-accent-text">{progress.open} open</span>
        {progress.blocked > 0 && (
          <span className="text-status-error">{progress.blocked} blocked</span>
        )}
      </div>
    </div>
  );
}
