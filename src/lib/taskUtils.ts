import type { BeadsIssue, PhaseProgress } from '../types';

export const STATUS_CONFIG: Record<string, { color: string; bgColor: string; label: string; dotColor: string }> = {
  open: { color: 'text-blue-400', bgColor: 'bg-blue-500/10 border-blue-500/20', label: 'Open', dotColor: 'bg-blue-500' },
  in_progress: { color: 'text-yellow-400', bgColor: 'bg-yellow-500/10 border-yellow-500/20', label: 'In Progress', dotColor: 'bg-yellow-500' },
  done: { color: 'text-green-400', bgColor: 'bg-green-500/10 border-green-500/20', label: 'Done', dotColor: 'bg-green-500' },
  closed: { color: 'text-green-400', bgColor: 'bg-green-500/10 border-green-500/20', label: 'Done', dotColor: 'bg-green-500' },
  blocked: { color: 'text-red-400', bgColor: 'bg-red-500/10 border-red-500/20', label: 'Blocked', dotColor: 'bg-red-500' },
  deferred: { color: 'text-gray-400', bgColor: 'bg-gray-500/10 border-gray-500/20', label: 'Deferred', dotColor: 'bg-gray-500' },
};

export const PRIORITY_CONFIG: Record<number, { label: string; color: string }> = {
  0: { label: 'Critical', color: 'text-red-500' },
  1: { label: 'High', color: 'text-orange-400' },
  2: { label: 'Medium', color: 'text-yellow-400' },
  3: { label: 'Low', color: 'text-gray-400' },
  4: { label: 'Lowest', color: 'text-gray-500' },
};

export function getStatusConfig(issue: BeadsIssue) {
  if (issue.blockedBy.length > 0 && issue.status !== 'closed' && issue.status !== 'done') {
    return STATUS_CONFIG.blocked;
  }
  return STATUS_CONFIG[issue.status] || STATUS_CONFIG.open;
}

export function getPriorityConfig(priority: number) {
  return PRIORITY_CONFIG[priority] || PRIORITY_CONFIG[2];
}

export function isBlocked(issue: BeadsIssue): boolean {
  return issue.blockedBy.length > 0 && issue.status !== 'closed' && issue.status !== 'done';
}

export function isDone(issue: BeadsIssue): boolean {
  return issue.status === 'closed' || issue.status === 'done';
}

export function computeProgress(issues: BeadsIssue[]): PhaseProgress {
  let done = 0;
  let blocked = 0;
  let open = 0;

  for (const issue of issues) {
    if (isDone(issue)) {
      done++;
    } else if (isBlocked(issue)) {
      blocked++;
    } else {
      open++;
    }
  }

  return { total: issues.length, done, open, blocked };
}

export function groupProgressByEpic(issues: BeadsIssue[]): Map<string, PhaseProgress> {
  const groups = new Map<string, BeadsIssue[]>();

  for (const issue of issues) {
    if (issue.parentId) {
      const existing = groups.get(issue.parentId) || [];
      existing.push(issue);
      groups.set(issue.parentId, existing);
    }
  }

  const result = new Map<string, PhaseProgress>();
  for (const [epicId, epicIssues] of groups) {
    result.set(epicId, computeProgress(epicIssues));
  }

  return result;
}
