import clsx from 'clsx';
import type { ReactNode } from 'react';

type BadgeVariant = 'default' | 'accent' | 'success' | 'warning' | 'error';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-surface-hover text-text-secondary',
  accent: 'bg-accent-muted text-accent-text',
  success: 'bg-status-success-muted text-status-success',
  warning: 'bg-status-warning-muted text-status-warning',
  error: 'bg-status-error-muted text-status-error',
};

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-1.5 py-0.5 rounded text-2xs font-medium',
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
