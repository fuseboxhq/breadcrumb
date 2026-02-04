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
    <div className="flex border-b border-gray-800">
      {TABS.map(({ key, label }) => {
        const count = key === 'tasks' ? taskCount : key === 'research' ? researchCount : undefined;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === key
                ? 'text-white border-b-2 border-blue-500'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {label}
            {count !== undefined && count > 0 && (
              <span className="ml-1.5 text-xs opacity-60">{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
