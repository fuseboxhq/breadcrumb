import { useState } from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useAnalyticsSummary,
  useInstalls,
  useUsers,
  useCommands,
  useOsBreakdown,
  useVersions,
} from '../../hooks/useAnalytics';
import { KpiCards } from './KpiCards';
import { InstallsChart } from './InstallsChart';
import { UsersChart } from './UsersChart';
import { CommandsChart } from './CommandsChart';
import { OsChart } from './OsChart';
import { VersionsChart } from './VersionsChart';

interface AnalyticsDashboardProps {
  onBack: () => void;
}

const PERIOD_OPTIONS = [
  { label: '7d', value: 7 },
  { label: '30d', value: 30 },
  { label: '90d', value: 90 },
] as const;

export function AnalyticsDashboard({ onBack }: AnalyticsDashboardProps) {
  const [days, setDays] = useState(30);
  const queryClient = useQueryClient();

  const { data: summary, isLoading: summaryLoading } = useAnalyticsSummary();
  const { data: installs, isLoading: installsLoading } = useInstalls(days);
  const { data: users, isLoading: usersLoading } = useUsers(days);
  const { data: commands, isLoading: commandsLoading } = useCommands(days);
  const { data: os, isLoading: osLoading } = useOsBreakdown(days);
  const { data: versions, isLoading: versionsLoading } = useVersions(days);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['analytics'] });
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-surface-hover transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Analytics</h2>
              <p className="text-sm text-text-tertiary">Install tracking, usage, and adoption metrics</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Period selector */}
            <div className="flex items-center rounded-md border border-border bg-surface-raised">
              {PERIOD_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDays(opt.value)}
                  className={`px-2.5 py-1 text-2xs font-medium transition-colors ${
                    days === opt.value
                      ? 'text-accent bg-accent-muted'
                      : 'text-text-tertiary hover:text-text-secondary'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button
              onClick={handleRefresh}
              className="p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-surface-hover transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <KpiCards data={summary} isLoading={summaryLoading} />

        {/* Charts — 2 column grid for medium+ screens */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <InstallsChart data={installs} isLoading={installsLoading} />
          <UsersChart data={users} isLoading={usersLoading} />
          <CommandsChart data={commands} isLoading={commandsLoading} />
          <OsChart data={os} isLoading={osLoading} />
        </div>

        {/* Version adoption — full width */}
        <VersionsChart data={versions} isLoading={versionsLoading} />
      </div>
    </div>
  );
}
