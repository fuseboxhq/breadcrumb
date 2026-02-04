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
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-md border transition-colors ${
        isDone
          ? 'bg-green-500/10 border-green-500/20 text-green-400'
          : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
      }`}
      title={`${issueId}: ${title}`}
    >
      <span className="font-mono">{issueId}</span>
      <span className="truncate max-w-[120px]">{title}</span>
    </button>
  );
}
