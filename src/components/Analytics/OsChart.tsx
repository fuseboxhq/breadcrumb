import { useMemo } from 'react';
import { DonutChart, BarList } from '@tremor/react';
import type { OsData } from '../../lib/analyticsApi';
import { Skeleton } from '../ui/Skeleton';

interface OsChartProps {
  data: OsData | undefined;
  isLoading: boolean;
}

const OS_COLORS: Record<string, string> = {
  darwin: 'slate',
  linux: 'amber',
  win32: 'cyan',
  unknown: 'gray',
};

export function OsChart({ data, isLoading }: OsChartProps) {
  const osData = useMemo(() => {
    if (!data?.byOs) return [];
    return data.byOs.map((d) => ({
      name: formatOs(d.os),
      value: d.count,
    }));
  }, [data]);

  const archData = useMemo(() => {
    if (!data?.byArch) return [];
    return data.byArch.map((d) => ({
      name: d.arch,
      value: d.count,
    }));
  }, [data]);

  const colors = useMemo(() => {
    if (!data?.byOs) return ['indigo'];
    return data.byOs.map((d) => OS_COLORS[d.os] || 'gray');
  }, [data]);

  return (
    <div className="rounded-lg border border-border bg-surface-raised p-5">
      <h3 className="text-2xs font-medium uppercase tracking-wider text-text-tertiary mb-4">
        Platform Distribution
      </h3>
      {isLoading ? (
        <Skeleton className="h-48 w-full rounded" />
      ) : osData.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-sm text-text-tertiary">
          No platform data yet
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-2xs text-text-tertiary mb-3">Operating System</p>
            <DonutChart
              data={osData}
              category="value"
              index="name"
              colors={colors}
              className="h-36"
              showAnimation
              showTooltip
            />
          </div>
          <div>
            <p className="text-2xs text-text-tertiary mb-3">Architecture</p>
            <BarList data={archData} color="violet" className="mt-1" />
          </div>
        </div>
      )}
    </div>
  );
}

function formatOs(os: string): string {
  switch (os) {
    case 'darwin': return 'macOS';
    case 'linux': return 'Linux';
    case 'win32': return 'Windows';
    default: return os;
  }
}
