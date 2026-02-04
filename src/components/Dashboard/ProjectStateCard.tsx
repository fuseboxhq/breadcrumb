import { useMemo } from 'react';
import {
  Layers,
  Activity,
  CheckCircle2,
  ListTodo,
  CheckCheck,
  Zap,
  PlayCircle,
  Clock,
} from 'lucide-react';
import type { ProjectState, Phase, PhaseProgress, BeadsIssue } from '../../types';
import { SkeletonText, Skeleton } from '../ui/Skeleton';

interface ProjectStateCardProps {
  state: ProjectState | undefined;
  isLoading: boolean;
  phases: Phase[];
  progressByEpic: Map<string, PhaseProgress>;
  readyIssues: BeadsIssue[];
  quickTasks: BeadsIssue[];
}

interface StatItem {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  accent?: boolean;
}

export function ProjectStateCard({
  state,
  isLoading,
  phases,
  progressByEpic,
  readyIssues,
  quickTasks,
}: ProjectStateCardProps) {
  const stats = useMemo((): StatItem[] => {
    const activePhases = phases.filter((p) => p.status === 'in_progress').length;
    const completedPhases = phases.filter((p) => p.status === 'complete').length;

    let totalTasks = 0;
    let tasksDone = 0;
    progressByEpic.forEach((p) => {
      totalTasks += p.total;
      tasksDone += p.done;
    });

    const openQuickTasks = quickTasks.filter((t) => t.status === 'open').length;

    return [
      {
        icon: <Layers className="h-3.5 w-3.5" />,
        label: 'Total Phases',
        value: phases.length,
      },
      {
        icon: <Activity className="h-3.5 w-3.5" />,
        label: 'Active',
        value: activePhases,
        accent: activePhases > 0,
      },
      {
        icon: <CheckCircle2 className="h-3.5 w-3.5" />,
        label: 'Completed',
        value: completedPhases,
      },
      {
        icon: <ListTodo className="h-3.5 w-3.5" />,
        label: 'Total Tasks',
        value: totalTasks,
      },
      {
        icon: <CheckCheck className="h-3.5 w-3.5" />,
        label: 'Tasks Done',
        value: tasksDone,
      },
      {
        icon: <Zap className="h-3.5 w-3.5" />,
        label: 'Quick Tasks',
        value: openQuickTasks > 0 ? `${openQuickTasks} open` : `${quickTasks.length} total`,
      },
      {
        icon: <PlayCircle className="h-3.5 w-3.5" />,
        label: 'Ready to Work',
        value: readyIssues.length,
        accent: readyIssues.length > 0,
      },
      {
        icon: <Clock className="h-3.5 w-3.5" />,
        label: 'Last Updated',
        value: state?.lastUpdated || '—',
      },
    ];
  }, [phases, progressByEpic, readyIssues, quickTasks, state]);

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

  return (
    <div className="rounded-lg border border-border bg-surface-raised p-5">
      <h3 className="text-2xs font-medium uppercase tracking-wider text-text-tertiary mb-4">
        Project Status
      </h3>
      <div className="grid grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <div className="flex items-center justify-center h-7 w-7 rounded-md bg-surface-hover text-text-tertiary flex-shrink-0 mt-0.5">
              {stat.icon}
            </div>
            <div className="min-w-0">
              <div className="text-2xs text-text-tertiary mb-0.5">{stat.label}</div>
              <div className={`text-sm font-medium truncate ${stat.accent ? 'text-accent' : 'text-text-primary'}`}>
                {stat.value}
              </div>
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
