import { useMemo } from 'react';
import { AreaChart } from '@tremor/react';
import type { InstallsData } from '../../lib/analyticsApi';
import { Skeleton } from '../ui/Skeleton';

interface InstallsChartProps {
  data: InstallsData | undefined;
  isLoading: boolean;
}

export function InstallsChart({ data, isLoading }: InstallsChartProps) {
  const chartData = useMemo(() => {
    if (!data?.daily) return [];
    return data.daily.map((d) => ({
      date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      Installs: d.count,
    }));
  }, [data]);

  return (
    <div className="rounded-lg border border-border bg-surface-raised p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-2xs font-medium uppercase tracking-wider text-text-tertiary">
          Installs Over Time
        </h3>
        {data && (
          <span className="text-2xs text-text-tertiary tabular-nums">
            {data.total.toLocaleString()} total
          </span>
        )}
      </div>
      {isLoading ? (
        <Skeleton className="h-56 w-full rounded" />
      ) : chartData.length === 0 ? (
        <div className="h-56 flex items-center justify-center text-sm text-text-tertiary">
          No install data yet
        </div>
      ) : (
        <AreaChart
          className="h-56"
          data={chartData}
          index="date"
          categories={['Installs']}
          colors={['indigo']}
          showLegend={false}
          showGridLines={false}
          yAxisWidth={40}
          curveType="monotone"
        />
      )}
    </div>
  );
}
