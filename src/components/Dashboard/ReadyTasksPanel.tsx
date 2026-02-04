import clsx from 'clsx';
import { Zap } from 'lucide-react';
import type { BeadsIssue } from '../../types';
import { getPriorityConfig } from '../../lib/taskUtils';
import { SkeletonText } from '../ui/Skeleton';

interface ReadyTasksPanelProps {
  issues: BeadsIssue[];
  isLoading: boolean;
}

export function ReadyTasksPanel({ issues, isLoading }: ReadyTasksPanelProps) {
  if (isLoading) {
    return (
      <div>
        <h3 className="text-2xs font-medium uppercase tracking-wider text-text-tertiary mb-3">Ready Tasks</h3>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg border border-border bg-surface-raised p-3">
              <SkeletonText lines={1} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (issues.length === 0) {
    return (
      <div>
        <h3 className="text-2xs font-medium uppercase tracking-wider text-text-tertiary mb-3">Ready Tasks</h3>
        <p className="text-sm text-text-tertiary">No tasks ready to work on.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-2xs font-medium uppercase tracking-wider text-text-tertiary">Ready Tasks</h3>
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-medium bg-accent-muted text-accent-text">
          <Zap className="h-2.5 w-2.5" />
          {issues.length}
        </span>
      </div>
      <div className="space-y-1">
        {issues.slice(0, 8).map((issue) => {
          const priority = getPriorityConfig(issue.priority);
          return (
            <div
              key={issue.id}
              className="flex items-center gap-2.5 rounded-md px-3 py-2 hover:bg-surface-hover transition-colors group"
            >
              <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', priorityDot(priority.color))} />
              <span className="text-sm text-text-secondary group-hover:text-text-primary truncate transition-colors">
                {issue.title}
              </span>
              <span className="ml-auto text-2xs text-text-tertiary font-mono flex-shrink-0">{issue.id}</span>
            </div>
          );
        })}
        {issues.length > 8 && (
          <p className="text-2xs text-text-tertiary text-center pt-1">+{issues.length - 8} more</p>
        )}
      </div>
    </div>
  );
}

function priorityDot(textColor: string): string {
  const map: Record<string, string> = {
    'text-red-500': 'bg-status-error',
    'text-orange-400': 'bg-status-warning',
    'text-yellow-400': 'bg-status-warning',
    'text-gray-400': 'bg-text-tertiary',
    'text-gray-500': 'bg-text-tertiary',
  };
  return map[textColor] || 'bg-text-tertiary';
}
