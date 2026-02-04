import { useState } from 'react';
import clsx from 'clsx';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import type { BeadsIssue } from '../../types';
import { getStatusConfig, getPriorityConfig, isBlocked } from '../../lib/taskUtils';
import { DependencyPill } from './DependencyPill';
import { Badge } from '../ui/Badge';

interface TaskCardProps {
  issue: BeadsIssue;
  allIssues: BeadsIssue[];
}

const STATUS_VARIANT: Record<string, 'default' | 'accent' | 'success' | 'warning' | 'error'> = {
  open: 'accent',
  in_progress: 'warning',
  done: 'success',
  closed: 'success',
  blocked: 'error',
  deferred: 'default',
};

export function TaskCard({ issue, allIssues }: TaskCardProps) {
  const [expanded, setExpanded] = useState(false);
  const status = getStatusConfig(issue);
  const priority = getPriorityConfig(issue.priority);
  const blocked = isBlocked(issue);
  const statusKey = blocked ? 'blocked' : issue.status;

  return (
    <div
      className={clsx(
        'border rounded-lg transition-colors bg-surface-raised',
        expanded ? 'border-border-strong' : 'border-border',
      )}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-3.5 group"
      >
        <div className="flex items-start gap-2.5">
          <span className={clsx('w-1.5 h-1.5 mt-1.5 rounded-full flex-shrink-0', status.dotColor)} />
          <span className="flex-1 text-sm font-medium text-text-primary group-hover:text-accent-text transition-colors">
            {issue.title}
          </span>
          <span className={clsx('text-2xs font-mono', priority.color)}>P{issue.priority}</span>
          <Badge variant="default">{issue.issueType}</Badge>
          <ChevronRight className={clsx(
            'h-3.5 w-3.5 text-text-tertiary transition-transform',
            expanded && 'rotate-90',
          )} />
        </div>

        <div className="flex items-center gap-1.5 mt-2 ml-4">
          <Badge variant={STATUS_VARIANT[statusKey] || 'default'}>{status.label}</Badge>
          {issue.labels.map((label) => (
            <Badge key={label} variant="default">{label}</Badge>
          ))}
        </div>

        {blocked && issue.blockedBy.length > 0 && (
          <div className="flex items-center gap-1.5 mt-2 ml-4 text-2xs text-status-error">
            <AlertTriangle className="h-3 w-3" />
            <span>Blocked by {issue.blockedBy.length} task{issue.blockedBy.length > 1 ? 's' : ''}</span>
          </div>
        )}
      </button>

      {expanded && (
        <div className="px-3.5 pb-3.5 border-t border-border pt-3">
          {issue.description && (
            <p className="text-sm text-text-secondary mb-3 whitespace-pre-wrap">{issue.description}</p>
          )}

          {(issue.blockedBy.length > 0 || issue.blocks.length > 0) && (
            <div className="space-y-2 mb-3">
              {issue.blockedBy.length > 0 && (
                <div>
                  <span className="text-2xs text-text-tertiary block mb-1">Blocked by:</span>
                  <div className="flex flex-wrap gap-1">
                    {issue.blockedBy.map((id) => (
                      <DependencyPill key={id} issueId={id} allIssues={allIssues} />
                    ))}
                  </div>
                </div>
              )}
              {issue.blocks.length > 0 && (
                <div>
                  <span className="text-2xs text-text-tertiary block mb-1">Blocks:</span>
                  <div className="flex flex-wrap gap-1">
                    {issue.blocks.map((id) => (
                      <DependencyPill key={id} issueId={id} allIssues={allIssues} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-4 text-2xs text-text-tertiary">
            <span>ID: <span className="font-mono text-text-secondary">{issue.id}</span></span>
            {issue.assignee && <span>Assignee: {issue.assignee}</span>}
            <span>Created: {new Date(issue.createdAt).toLocaleDateString()}</span>
            {issue.closedAt && <span>Closed: {new Date(issue.closedAt).toLocaleDateString()}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
