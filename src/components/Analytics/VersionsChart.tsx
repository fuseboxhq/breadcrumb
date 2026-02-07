import { useMemo } from 'react';
import { BarChart } from '@tremor/react';
import type { VersionsData } from '../../lib/analyticsApi';
import { Skeleton } from '../ui/Skeleton';

interface VersionsChartProps {
  data: VersionsData | undefined;
  isLoading: boolean;
}

export function VersionsChart({ data, isLoading }: VersionsChartProps) {
  const barData = useMemo(() => {
    if (!data?.current) return [];
    return data.current.map((v) => ({
      version: v.version,
      Machines: v.count,
    }));
  }, [data]);

  return (
    <div className="rounded-lg border border-border bg-surface-raised p-5">
      <h3 className="text-2xs font-medium uppercase tracking-wider text-text-tertiary mb-4">
        Version Adoption
      </h3>
      {isLoading ? (
        <Skeleton className="h-48 w-full rounded" />
      ) : barData.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-sm text-text-tertiary">
          No version data yet
        </div>
      ) : (
        <BarChart
          className="h-48"
          data={barData}
          index="version"
          categories={['Machines']}
          colors={['emerald']}
          showLegend={false}
          showGridLines={false}
          yAxisWidth={40}
        />
      )}
    </div>
  );
}
