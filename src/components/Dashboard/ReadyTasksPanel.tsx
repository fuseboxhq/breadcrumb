import type { BeadsIssue } from '../../types';
import { getPriorityConfig } from '../../lib/taskUtils';

interface ReadyTasksPanelProps {
  issues: BeadsIssue[];
  isLoading: boolean;
}

export function ReadyTasksPanel({ issues, isLoading }: ReadyTasksPanelProps) {
  if (isLoading) {
    return (
      <div>
        <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Ready Tasks</h3>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border border-gray-800 rounded-lg p-3 animate-pulse">
              <div className="h-4 bg-gray-800 rounded w-3/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (issues.length === 0) {
    return (
      <div>
        <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Ready Tasks</h3>
        <p className="text-gray-600 text-sm">No tasks ready to work on.</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
        Ready Tasks <span className="text-gray-600">({issues.length})</span>
      </h3>
      <div className="space-y-2">
        {issues.slice(0, 8).map((issue) => {
          const priority = getPriorityConfig(issue.priority);
          return (
            <div
              key={issue.id}
              className="border border-gray-800 rounded-lg px-3 py-2.5 hover:bg-gray-900/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${priority.color.replace('text-', 'bg-')} flex-shrink-0`} />
                <span className="text-sm text-gray-200 truncate">{issue.title}</span>
                <span className="ml-auto text-xs text-gray-600 font-mono flex-shrink-0">{issue.id}</span>
              </div>
            </div>
          );
        })}
        {issues.length > 8 && (
          <p className="text-xs text-gray-600 text-center">+{issues.length - 8} more</p>
        )}
      </div>
    </div>
  );
}
