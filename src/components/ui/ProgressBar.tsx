import type { PhaseProgress } from '../../types';

interface ProgressBarProps {
  progress: PhaseProgress;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const SIZE_CLASSES = {
  sm: 'h-1',
  md: 'h-1.5',
  lg: 'h-2.5',
};

export function ProgressBar({ progress, size = 'sm', showLabel = false }: ProgressBarProps) {
  const { total, done, open, blocked } = progress;
  if (total === 0) return null;

  const donePercent = (done / total) * 100;
  const openPercent = (open / total) * 100;
  const blockedPercent = (blocked / total) * 100;

  return (
    <div className="flex items-center gap-2">
      <div className={`flex-1 ${SIZE_CLASSES[size]} bg-gray-800 rounded-full overflow-hidden flex`}>
        {donePercent > 0 && (
          <div className="bg-green-500 transition-all duration-300" style={{ width: `${donePercent}%` }} />
        )}
        {openPercent > 0 && (
          <div className="bg-blue-500 transition-all duration-300" style={{ width: `${openPercent}%` }} />
        )}
        {blockedPercent > 0 && (
          <div className="bg-red-500 transition-all duration-300" style={{ width: `${blockedPercent}%` }} />
        )}
      </div>
      {showLabel && (
        <span className="text-xs text-gray-400 tabular-nums whitespace-nowrap">
          {done}/{total}
        </span>
      )}
    </div>
  );
}
