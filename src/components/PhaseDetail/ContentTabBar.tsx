import clsx from 'clsx';
import type { ContentTab } from '../../types';

interface ContentTabBarProps {
  activeTab: ContentTab;
  onChange: (tab: ContentTab) => void;
  taskCount?: number;
  researchCount?: number;
}

const TABS: { key: ContentTab; label: string }[] = [
  { key: 'plan', label: 'Plan' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'research', label: 'Research' },
];

export function ContentTabBar({ activeTab, onChange, taskCount, researchCount }: ContentTabBarProps) {
  return (
    <div className="flex border-b border-border px-4">
      {TABS.map(({ key, label }) => {
        const count = key === 'tasks' ? taskCount : key === 'research' ? researchCount : undefined;
        const isActive = activeTab === key;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={clsx(
              'relative px-3 py-2.5 text-sm font-medium transition-colors',
              isActive
                ? 'text-text-primary'
                : 'text-text-tertiary hover:text-text-secondary',
            )}
          >
            {label}
            {count !== undefined && count > 0 && (
              <span className={clsx(
                'ml-1.5 text-2xs tabular-nums',
                isActive ? 'text-text-secondary' : 'text-text-tertiary',
              )}>
                {count}
              </span>
            )}
            {isActive && (
              <span className="absolute inset-x-0 -bottom-px h-0.5 bg-accent rounded-full" />
            )}
          </button>
        );
      })}
    </div>
  );
}
