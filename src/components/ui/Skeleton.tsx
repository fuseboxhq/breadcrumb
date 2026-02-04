import clsx from 'clsx';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return <div className={clsx('skeleton', className)} />;
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={clsx('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={clsx('h-3 rounded', i === lines - 1 ? 'w-2/3' : 'w-full')}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: SkeletonProps) {
  return (
    <div className={clsx('p-4 rounded-lg border border-border bg-surface-raised', className)}>
      <Skeleton className="h-4 w-1/3 rounded mb-3" />
      <SkeletonText lines={2} />
      <Skeleton className="h-1.5 w-full rounded-full mt-4" />
    </div>
  );
}
