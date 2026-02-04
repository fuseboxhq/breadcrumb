import type { BeadsIssue } from '../../types';
import { getPriorityConfig } from '../../lib/taskUtils';
import { Spinner } from '../ui/Spinner';

interface ReadyTasksListProps {
  issues: BeadsIssue[];
  isLoading: boolean;
  onSelectTask: (issue: BeadsIssue) => void;
}

export function ReadyTasksList({ issues, isLoading, onSelectTask }: ReadyTasksListProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner size="sm" />
      </div>
    );
  }

  if (issues.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-gray-500 text-sm">
        No tasks ready to work on
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 p-2">
      {issues.map((issue) => {
        const priority = getPriorityConfig(issue.priority);
        return (
          <button
            key={issue.id}
            onClick={() => onSelectTask(issue)}
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-800/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${priority.color.replace('text-', 'bg-')}`} />
              <span className="text-sm text-gray-200 truncate">{issue.title}</span>
            </div>
            <div className="flex items-center gap-2 mt-1 ml-4">
              <span className="text-xs text-gray-500 font-mono">{issue.id}</span>
              {issue.labels.length > 0 && (
                <span className="text-xs text-gray-500">{issue.labels[0]}</span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
