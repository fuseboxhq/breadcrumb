import { motion } from 'motion/react';
import { Download, Users, Activity, CalendarDays } from 'lucide-react';
import type { AnalyticsSummary } from '../../lib/analyticsApi';
import { Skeleton } from '../ui/Skeleton';

interface KpiCardsProps {
  data: AnalyticsSummary | undefined;
  isLoading: boolean;
}

interface KpiItem {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent?: boolean;
}

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' as const } },
};

export function KpiCards({ data, isLoading }: KpiCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-surface-raised p-4">
            <Skeleton className="h-3 w-16 rounded mb-3" />
            <Skeleton className="h-6 w-12 rounded" />
          </div>
        ))}
      </div>
    );
  }

  const kpis: KpiItem[] = [
    {
      label: 'Total Installs',
      value: data?.totalInstalls ?? 0,
      icon: <Download className="h-3.5 w-3.5" />,
    },
    {
      label: 'Unique Machines',
      value: data?.totalMachines ?? 0,
      icon: <Users className="h-3.5 w-3.5" />,
    },
    {
      label: 'Active Today',
      value: data?.dauToday ?? 0,
      icon: <Activity className="h-3.5 w-3.5" />,
      accent: (data?.dauToday ?? 0) > 0,
    },
    {
      label: 'Active This Week',
      value: data?.wauThisWeek ?? 0,
      icon: <CalendarDays className="h-3.5 w-3.5" />,
      accent: (data?.wauThisWeek ?? 0) > 0,
    },
  ];

  return (
    <motion.div
      className="grid grid-cols-2 lg:grid-cols-4 gap-3"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      {kpis.map((kpi) => (
        <motion.div
          key={kpi.label}
          variants={itemVariants}
          className="rounded-lg border border-border bg-surface-raised p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center justify-center h-6 w-6 rounded-md bg-surface-hover text-text-tertiary">
              {kpi.icon}
            </div>
            <span className="text-2xs text-text-tertiary">{kpi.label}</span>
          </div>
          <p className={`text-2xl font-semibold tabular-nums ${kpi.accent ? 'text-accent' : 'text-text-primary'}`}>
            {kpi.value.toLocaleString()}
          </p>
        </motion.div>
      ))}
    </motion.div>
  );
}
