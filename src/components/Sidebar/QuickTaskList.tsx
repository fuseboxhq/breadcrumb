import clsx from 'clsx';
import { Zap } from 'lucide-react';
import type { BeadsIssue } from '../../types';
import { isDone, relativeTime } from '../../lib/taskUtils';
import { Tooltip } from '../ui/Tooltip';

interface QuickTaskListProps {
  tasks: BeadsIssue[];
  isLoading: boolean;
  collapsed?: boolean;
}

export function QuickTaskList({ tasks, isLoading, collapsed }: QuickTaskListProps) {
  const openCount = tasks.filter((t) => !isDone(t)).length;
  const displayTasks = tasks.slice(0, 5);

  if (isLoading) {
    return null;
  }

  if (collapsed) {
    if (tasks.length === 0) return null;
    return (
      <div className="flex flex-col items-center py-1">
        <Tooltip content={`Quick Tasks (${openCount} open)`} side="right">
          <div className="relative w-8 h-8 rounded-md flex items-center justify-center text-text-tertiary hover:bg-surface-hover hover:text-text-secondary transition-colors">
            <Zap className="h-3.5 w-3.5" />
            {openCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-3.5 h-3.5 rounded-full bg-accent text-[9px] font-medium text-white flex items-center justify-center px-0.5">
                {openCount}
              </span>
            )}
          </div>
        </Tooltip>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <p className="text-2xs text-text-tertiary px-3 py-2">No quick tasks yet</p>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      {displayTasks.map((task) => {
        const done = isDone(task);
        return (
          <div
            key={task.id}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-text-secondary"
          >
            <span
              className={clsx(
                'w-1.5 h-1.5 rounded-full flex-shrink-0',
                done ? 'bg-status-success' : 'bg-accent',
              )}
            />
            <span className={clsx('text-xs truncate flex-1', done && 'text-text-tertiary')}>
              {task.title}
            </span>
            <span className="text-2xs text-text-tertiary tabular-nums flex-shrink-0">
              {relativeTime(task.createdAt)}
            </span>
          </div>
        );
      })}
      {tasks.length > 5 && (
        <p className="text-2xs text-text-tertiary text-center py-0.5">
          +{tasks.length - 5} more
        </p>
      )}
    </div>
  );
}
