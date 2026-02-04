import clsx from 'clsx';
import type { BeadsIssue } from '../../types';

interface DependencyPillProps {
  issueId: string;
  allIssues: BeadsIssue[];
  onClick?: (issueId: string) => void;
}

export function DependencyPill({ issueId, allIssues, onClick }: DependencyPillProps) {
  const issue = allIssues.find((i) => i.id === issueId);
  const title = issue?.title || issueId;
  const isDone = issue?.status === 'closed' || issue?.status === 'done';

  return (
    <button
      onClick={() => onClick?.(issueId)}
      className={clsx(
        'inline-flex items-center gap-1 px-2 py-0.5 text-2xs rounded-md border transition-colors',
        isDone
          ? 'bg-status-success-muted border-status-success/20 text-status-success'
          : 'bg-surface-hover border-border text-text-secondary hover:bg-surface-active',
      )}
      title={`${issueId}: ${title}`}
    >
      <span className="font-mono">{issueId}</span>
      <span className="truncate max-w-[120px]">{title}</span>
    </button>
  );
}
