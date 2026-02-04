import clsx from 'clsx';
import { FileText } from 'lucide-react';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={clsx('flex flex-col items-center justify-center py-16 px-4', className)}>
      <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-surface-hover text-text-tertiary">
        {icon || <FileText className="h-5 w-5" />}
      </div>
      <h3 className="mt-3 text-sm font-medium text-text-secondary">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-text-tertiary text-center max-w-xs">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
