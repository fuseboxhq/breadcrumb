import { useState } from 'react';
import type { BeadsIssue } from '../../types';
import { getStatusConfig, getPriorityConfig, isBlocked } from '../../lib/taskUtils';
import { DependencyPill } from './DependencyPill';

interface TaskCardProps {
  issue: BeadsIssue;
  allIssues: BeadsIssue[];
}

export function TaskCard({ issue, allIssues }: TaskCardProps) {
  const [expanded, setExpanded] = useState(false);
  const status = getStatusConfig(issue);
  const priority = getPriorityConfig(issue.priority);
  const blocked = isBlocked(issue);

  return (
    <div
      className={`border rounded-lg transition-colors ${status.bgColor} ${
        expanded ? 'ring-1 ring-gray-700' : ''
      }`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-4"
      >
        {/* Top row: status dot + title + priority + type */}
        <div className="flex items-start gap-2">
          <span className={`w-2 h-2 mt-1.5 rounded-full flex-shrink-0 ${status.dotColor}`} />
          <span className="flex-1 text-sm font-medium text-gray-100">{issue.title}</span>
          <span className={`text-xs font-mono ${priority.color}`}>P{issue.priority}</span>
          <span className="text-xs text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">
            {issue.issueType}
          </span>
        </div>

        {/* Badges row */}
        <div className="flex items-center gap-1.5 mt-2 ml-4">
          <span className={`text-xs px-1.5 py-0.5 rounded ${status.bgColor} ${status.color} border`}>
            {status.label}
          </span>
          {issue.labels.map((label) => (
            <span
              key={label}
              className="text-xs px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700"
            >
              {label}
            </span>
          ))}
        </div>

        {/* Blocked warning */}
        {blocked && issue.blockedBy.length > 0 && (
          <div className="flex items-center gap-1.5 mt-2 ml-4 text-xs text-red-400">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span>Blocked by {issue.blockedBy.length} task{issue.blockedBy.length > 1 ? 's' : ''}</span>
          </div>
        )}
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-800/50 mt-0 pt-3">
          {issue.description && (
            <p className="text-sm text-gray-300 mb-3 whitespace-pre-wrap">{issue.description}</p>
          )}

          {/* Dependencies */}
          {(issue.blockedBy.length > 0 || issue.blocks.length > 0) && (
            <div className="space-y-2 mb-3">
              {issue.blockedBy.length > 0 && (
                <div>
                  <span className="text-xs text-gray-500 block mb-1">Blocked by:</span>
                  <div className="flex flex-wrap gap-1">
                    {issue.blockedBy.map((id) => (
                      <DependencyPill key={id} issueId={id} allIssues={allIssues} />
                    ))}
                  </div>
                </div>
              )}
              {issue.blocks.length > 0 && (
                <div>
                  <span className="text-xs text-gray-500 block mb-1">Blocks:</span>
                  <div className="flex flex-wrap gap-1">
                    {issue.blocks.map((id) => (
                      <DependencyPill key={id} issueId={id} allIssues={allIssues} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Metadata */}
          <div className="flex gap-4 text-xs text-gray-500">
            <span>ID: <span className="font-mono text-gray-400">{issue.id}</span></span>
            {issue.assignee && <span>Assignee: {issue.assignee}</span>}
            <span>Created: {new Date(issue.createdAt).toLocaleDateString()}</span>
            {issue.closedAt && <span>Closed: {new Date(issue.closedAt).toLocaleDateString()}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
