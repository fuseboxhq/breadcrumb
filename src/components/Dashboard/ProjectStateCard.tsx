import type { ProjectState } from '../../types';

interface ProjectStateCardProps {
  state: ProjectState | undefined;
  isLoading: boolean;
}

export function ProjectStateCard({ state, isLoading }: ProjectStateCardProps) {
  if (isLoading) {
    return (
      <div className="border border-gray-800 rounded-lg p-6 animate-pulse">
        <div className="h-4 bg-gray-800 rounded w-1/3 mb-4" />
        <div className="h-6 bg-gray-800 rounded w-2/3 mb-2" />
        <div className="h-4 bg-gray-800 rounded w-1/2" />
      </div>
    );
  }

  if (!state) {
    return (
      <div className="border border-gray-800 rounded-lg p-6 text-gray-500 text-sm">
        No project state found. Run <code className="bg-gray-800 px-1.5 py-0.5 rounded">/bc:init</code> to get started.
      </div>
    );
  }

  return (
    <div className="border border-gray-800 rounded-lg p-6">
      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Project Status</h3>
      <div className="space-y-3">
        {state.currentPhase && (
          <div>
            <span className="text-xs text-gray-500">Current Phase</span>
            <p className="text-sm font-medium text-white">{state.currentPhase}</p>
          </div>
        )}
        {state.activeWork && (
          <div>
            <span className="text-xs text-gray-500">Active Work</span>
            <p className="text-sm text-gray-300">{state.activeWork}</p>
          </div>
        )}
        <div className="flex items-center gap-4 text-xs text-gray-500">
          {state.completedPhases.length > 0 && (
            <span>{state.completedPhases.length} phase{state.completedPhases.length !== 1 ? 's' : ''} completed</span>
          )}
          {state.lastUpdated && (
            <span>Updated {state.lastUpdated}</span>
          )}
        </div>
      </div>
    </div>
  );
}
