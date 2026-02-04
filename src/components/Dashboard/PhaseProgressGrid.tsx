import clsx from 'clsx';
import { motion } from 'motion/react';
import { Layers } from 'lucide-react';
import type { Phase, PhaseProgress } from '../../types';
import { ProgressBar } from '../ui/ProgressBar';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';

interface PhaseProgressGridProps {
  phases: Phase[];
  progressByEpic: Map<string, PhaseProgress>;
  onSelectPhase: (phaseId: string) => void;
}

const STATUS_BADGE: Record<string, { variant: 'default' | 'accent' | 'success'; label: string }> = {
  not_started: { variant: 'default', label: 'Not Started' },
  in_progress: { variant: 'accent', label: 'In Progress' },
  complete: { variant: 'success', label: 'Complete' },
};

const STATUS_BORDER: Record<string, string> = {
  not_started: 'border-border',
  in_progress: 'border-accent/30',
  complete: 'border-status-success/30',
};

const containerVariants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' as const } },
};

export function PhaseProgressGrid({ phases, progressByEpic, onSelectPhase }: PhaseProgressGridProps) {
  if (phases.length === 0) {
    return (
      <EmptyState
        icon={<Layers className="h-5 w-5" />}
        title="No phases yet"
        description="Run /bc:new-phase to create your first phase"
      />
    );
  }

  return (
    <div>
      <h3 className="text-2xs font-medium uppercase tracking-wider text-text-tertiary mb-3">Phases</h3>
      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {phases.map((phase) => {
          const progress = progressByEpic.get(phase.beadsEpic);
          const badge = STATUS_BADGE[phase.status] || STATUS_BADGE.not_started;
          const border = STATUS_BORDER[phase.status] || STATUS_BORDER.not_started;

          return (
            <motion.button
              key={phase.id}
              variants={itemVariants}
              onClick={() => onSelectPhase(phase.id)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={clsx(
                'border rounded-lg p-4 text-left transition-colors group',
                border,
                'bg-surface-raised hover:bg-surface-hover',
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xs font-mono text-text-tertiary">{phase.id}</span>
                <Badge variant={badge.variant}>{badge.label}</Badge>
              </div>
              <p className="text-sm font-medium text-text-primary mb-3 line-clamp-2 group-hover:text-accent-text transition-colors">
                {phase.title}
              </p>
              {progress && progress.total > 0 ? (
                <div>
                  <ProgressBar progress={progress} size="sm" showLabel />
                </div>
              ) : (
                <p className="text-2xs text-text-tertiary">No tasks</p>
              )}
            </motion.button>
          );
        })}
      </motion.div>
    </div>
  );
}
