import clsx from 'clsx';
import { Activity, CheckCircle2, Clock } from 'lucide-react';
import type { ProjectState } from '../../types';
import { SkeletonText, Skeleton } from '../ui/Skeleton';

interface ProjectStateCardProps {
  state: ProjectState | undefined;
  isLoading: boolean;
}

export function ProjectStateCard({ state, isLoading }: ProjectStateCardProps) {
  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-surface-raised p-5">
        <Skeleton className="h-3 w-24 rounded mb-4" />
        <SkeletonText lines={2} />
      </div>
    );
  }

  if (!state) {
    return (
      <div className="rounded-lg border border-border bg-surface-raised p-5">
        <p className="text-sm text-text-tertiary">
          No project state found. Run{' '}
          <code className="bg-surface-hover px-1.5 py-0.5 rounded text-accent-text font-mono text-xs">/bc:init</code>{' '}
          to get started.
        </p>
      </div>
    );
  }

  const stats = [
    state.currentPhase && {
      icon: <Activity className="h-3.5 w-3.5" />,
      label: 'Current Phase',
      value: state.currentPhase,
    },
    state.completedPhases.length > 0 && {
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      label: 'Completed',
      value: `${state.completedPhases.length} phase${state.completedPhases.length !== 1 ? 's' : ''}`,
    },
    state.lastUpdated && {
      icon: <Clock className="h-3.5 w-3.5" />,
      label: 'Last Updated',
      value: state.lastUpdated,
    },
  ].filter(Boolean) as { icon: React.ReactNode; label: string; value: string }[];

  return (
    <div className="rounded-lg border border-border bg-surface-raised p-5">
      <h3 className="text-2xs font-medium uppercase tracking-wider text-text-tertiary mb-4">
        Project Status
      </h3>
      <div className={clsx('grid gap-4', stats.length > 2 ? 'grid-cols-3' : `grid-cols-${stats.length}`)}>
        {stats.map((stat, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <div className="flex items-center justify-center h-7 w-7 rounded-md bg-surface-hover text-text-tertiary flex-shrink-0 mt-0.5">
              {stat.icon}
            </div>
            <div className="min-w-0">
              <div className="text-2xs text-text-tertiary mb-0.5">{stat.label}</div>
              <div className="text-sm font-medium text-text-primary truncate">{stat.value}</div>
            </div>
          </div>
        ))}
      </div>
      {state.activeWork && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="text-2xs text-text-tertiary mb-1">Active Work</div>
          <p className="text-sm text-text-secondary">{state.activeWork}</p>
        </div>
      )}
    </div>
  );
}
