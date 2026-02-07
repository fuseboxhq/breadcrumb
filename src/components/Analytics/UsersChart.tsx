import { useMemo } from 'react';
import { AreaChart } from '@tremor/react';
import type { UsersData } from '../../lib/analyticsApi';
import { Skeleton } from '../ui/Skeleton';

interface UsersChartProps {
  data: UsersData | undefined;
  isLoading: boolean;
}

export function UsersChart({ data, isLoading }: UsersChartProps) {
  const dauData = useMemo(() => {
    if (!data?.dau) return [];
    return data.dau.map((d) => ({
      date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      DAU: d.count,
    }));
  }, [data]);

  const wauData = useMemo(() => {
    if (!data?.wau) return [];
    return data.wau.map((d) => ({
      week: new Date(d.week).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      WAU: d.count,
    }));
  }, [data]);

  return (
    <div className="rounded-lg border border-border bg-surface-raised p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-2xs font-medium uppercase tracking-wider text-text-tertiary">
          Active Users
        </h3>
        {data && (
          <span className="text-2xs text-text-tertiary tabular-nums">
            {data.totalUnique.toLocaleString()} unique
          </span>
        )}
      </div>
      {isLoading ? (
        <Skeleton className="h-56 w-full rounded" />
      ) : dauData.length === 0 && wauData.length === 0 ? (
        <div className="h-56 flex items-center justify-center text-sm text-text-tertiary">
          No user data yet
        </div>
      ) : (
        <div className="space-y-6">
          {dauData.length > 0 && (
            <div>
              <p className="text-2xs text-text-tertiary mb-2">Daily Active Users</p>
              <AreaChart
                className="h-44"
                data={dauData}
                index="date"
                categories={['DAU']}
                colors={['cyan']}
                showLegend={false}
                showGridLines={false}
                yAxisWidth={40}
                curveType="monotone"
              />
            </div>
          )}
          {wauData.length > 0 && (
            <div>
              <p className="text-2xs text-text-tertiary mb-2">Weekly Active Users</p>
              <AreaChart
                className="h-44"
                data={wauData}
                index="week"
                categories={['WAU']}
                colors={['violet']}
                showLegend={false}
                showGridLines={false}
                yAxisWidth={40}
                curveType="monotone"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
