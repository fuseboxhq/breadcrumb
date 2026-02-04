import clsx from 'clsx';
import type { PhaseProgress } from '../../types';

interface ProgressBarProps {
  progress: PhaseProgress;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

const SIZE_CLASSES = {
  sm: 'h-1',
  md: 'h-1.5',
  lg: 'h-2',
};

export function ProgressBar({ progress, size = 'sm', showLabel = false, className }: ProgressBarProps) {
  const { total, done, open, blocked } = progress;
  if (total === 0) return null;

  const donePercent = (done / total) * 100;
  const openPercent = (open / total) * 100;
  const blockedPercent = (blocked / total) * 100;

  return (
    <div className={clsx('flex items-center gap-2', className)}>
      <div className={clsx('flex-1 bg-surface-hover rounded-full overflow-hidden flex', SIZE_CLASSES[size])}>
        {donePercent > 0 && (
          <div
            className="bg-status-success transition-all duration-300 ease-out"
            style={{ width: `${donePercent}%` }}
          />
        )}
        {openPercent > 0 && (
          <div
            className="bg-accent transition-all duration-300 ease-out"
            style={{ width: `${openPercent}%` }}
          />
        )}
        {blockedPercent > 0 && (
          <div
            className="bg-status-error transition-all duration-300 ease-out"
            style={{ width: `${blockedPercent}%` }}
          />
        )}
      </div>
      {showLabel && (
        <span className="text-xs text-text-secondary tabular-nums whitespace-nowrap">
          {done}/{total}
        </span>
      )}
    </div>
  );
}
