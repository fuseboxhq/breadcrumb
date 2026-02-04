import type { BeadsIssue, PhaseProgress } from '../types';

export const STATUS_CONFIG: Record<string, { color: string; bgColor: string; label: string; dotColor: string }> = {
  open: { color: 'text-accent-text', bgColor: 'bg-accent-muted border-accent/20', label: 'Open', dotColor: 'bg-accent' },
  in_progress: { color: 'text-status-warning', bgColor: 'bg-status-warning-muted border-status-warning/20', label: 'In Progress', dotColor: 'bg-status-warning' },
  done: { color: 'text-status-success', bgColor: 'bg-status-success-muted border-status-success/20', label: 'Done', dotColor: 'bg-status-success' },
  closed: { color: 'text-status-success', bgColor: 'bg-status-success-muted border-status-success/20', label: 'Done', dotColor: 'bg-status-success' },
  blocked: { color: 'text-status-error', bgColor: 'bg-status-error-muted border-status-error/20', label: 'Blocked', dotColor: 'bg-status-error' },
  deferred: { color: 'text-text-tertiary', bgColor: 'bg-surface-hover border-border', label: 'Deferred', dotColor: 'bg-text-tertiary' },
};

export const PRIORITY_CONFIG: Record<number, { label: string; color: string }> = {
  0: { label: 'Critical', color: 'text-status-error' },
  1: { label: 'High', color: 'text-status-warning' },
  2: { label: 'Medium', color: 'text-status-warning' },
  3: { label: 'Low', color: 'text-text-tertiary' },
  4: { label: 'Lowest', color: 'text-text-tertiary' },
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
