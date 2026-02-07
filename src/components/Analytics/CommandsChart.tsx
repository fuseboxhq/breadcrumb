import { useMemo } from 'react';
import { BarList } from '@tremor/react';
import type { CommandsData } from '../../lib/analyticsApi';
import { Skeleton } from '../ui/Skeleton';

interface CommandsChartProps {
  data: CommandsData | undefined;
  isLoading: boolean;
}

export function CommandsChart({ data, isLoading }: CommandsChartProps) {
  const barData = useMemo(() => {
    if (!data?.popularity) return [];
    return data.popularity.map((c) => ({
      name: c.name,
      value: c.total,
    }));
  }, [data]);

  return (
    <div className="rounded-lg border border-border bg-surface-raised p-5">
      <h3 className="text-2xs font-medium uppercase tracking-wider text-text-tertiary mb-4">
        Command Popularity
      </h3>
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-full rounded" />
          ))}
        </div>
      ) : barData.length === 0 ? (
        <div className="h-40 flex items-center justify-center text-sm text-text-tertiary">
          No command data yet
        </div>
      ) : (
        <BarList data={barData} color="indigo" className="mt-2" />
      )}
    </div>
  );
}
