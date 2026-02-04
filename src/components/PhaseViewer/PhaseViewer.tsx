import { MarkdownRenderer } from './MarkdownRenderer';
import { Spinner } from '../ui/Spinner';
import type { Phase } from '../../types';

interface PhaseViewerProps {
  phase: Phase | undefined;
  isLoading: boolean;
  error: Error | null;
}

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

export function PhaseViewer({ phase, isLoading, error }: PhaseViewerProps) {
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

  if (!phase) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <div className="text-center">
          <h2 className="text-xl font-medium mb-2">Select a phase</h2>
          <p className="text-sm">Choose a phase from the sidebar to view its details.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto p-8">
        {/* Phase header */}
        <div className="mb-6 flex items-center gap-3">
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[phase.status] || STATUS_COLORS.not_started}`}>
            {STATUS_LABELS[phase.status] || phase.status}
          </span>
          <span className="text-sm text-gray-500">{phase.id}</span>
          {phase.beadsEpic && (
            <span className="text-sm text-gray-600 font-mono">{phase.beadsEpic}</span>
          )}
        </div>

        <MarkdownRenderer content={phase.content} />
      </div>
    </div>
  );
}
