import { useState, useMemo } from 'react';
import type { BeadsIssue, PhaseProgress } from '../../types';
import { EpicOverviewCard } from '../Tasks/EpicOverviewCard';
import { TaskFilterBar, type TaskFilter, type TaskSort } from '../Tasks/TaskFilterBar';
import { TaskCard } from '../Tasks/TaskCard';
import { Spinner } from '../ui/Spinner';
import { EmptyState } from '../ui/EmptyState';
import { isBlocked, isDone, computeProgress } from '../../lib/taskUtils';

interface PhaseTasksTabProps {
  issues: BeadsIssue[];
  isLoading: boolean;
  phaseTitle: string;
  epicId: string;
}

export function PhaseTasksTab({ issues, isLoading, phaseTitle, epicId }: PhaseTasksTabProps) {
  const [filter, setFilter] = useState<TaskFilter>('all');
  const [sortBy, setSortBy] = useState<TaskSort>('priority');

  const progress: PhaseProgress = useMemo(() => computeProgress(issues), [issues]);

  const counts = useMemo(() => {
    let open = 0;
    let blocked = 0;
    let done = 0;
    for (const issue of issues) {
      if (isDone(issue)) done++;
      else if (isBlocked(issue)) blocked++;
      else open++;
    }
    return { all: issues.length, open, blocked, done };
  }, [issues]);

  const filteredIssues = useMemo(() => {
    let result = [...issues];

    switch (filter) {
      case 'open':
        result = result.filter((i) => !isDone(i) && !isBlocked(i));
        break;
      case 'blocked':
        result = result.filter((i) => isBlocked(i));
        break;
      case 'done':
        result = result.filter((i) => isDone(i));
        break;
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case 'priority':
          return a.priority - b.priority || a.createdAt.localeCompare(b.createdAt);
        case 'status': {
          const order: Record<string, number> = { open: 0, in_progress: 1, blocked: 2, done: 3, closed: 3 };
          const aOrder = isBlocked(a) ? 2 : (order[a.status] ?? 0);
          const bOrder = isBlocked(b) ? 2 : (order[b.status] ?? 0);
          return aOrder - bOrder || a.priority - b.priority;
        }
        case 'updated':
          return b.updatedAt.localeCompare(a.updatedAt);
        default:
          return 0;
      }
    });

    return result;
  }, [issues, filter, sortBy]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  if (issues.length === 0) {
    return (
      <EmptyState
        title="No tasks yet"
        description="Run /bc:plan to break this phase into tasks"
        className="py-16"
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-8 py-6 space-y-4">
      <EpicOverviewCard title={phaseTitle} epicId={epicId} progress={progress} />

      <TaskFilterBar
        activeFilter={filter}
        onFilterChange={setFilter}
        sortBy={sortBy}
        onSortChange={setSortBy}
        counts={counts}
      />

      <div className="space-y-2">
        {filteredIssues.map((issue) => (
          <TaskCard key={issue.id} issue={issue} allIssues={issues} />
        ))}
      </div>

      {filteredIssues.length === 0 && (
        <p className="text-center text-text-tertiary py-8 text-sm">
          No tasks match this filter.
        </p>
      )}
    </div>
  );
}
