import type { SidebarTab } from '../../types';

interface SidebarTabBarProps {
  activeTab: SidebarTab;
  onChange: (tab: SidebarTab) => void;
  readyCount: number;
}

export function SidebarTabBar({ activeTab, onChange, readyCount }: SidebarTabBarProps) {
  return (
    <div className="flex border-b border-gray-800">
      <button
        onClick={() => onChange('phases')}
        className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
          activeTab === 'phases'
            ? 'text-white border-b-2 border-blue-500'
            : 'text-gray-400 hover:text-gray-200'
        }`}
      >
        Phases
      </button>
      <button
        onClick={() => onChange('ready')}
        className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
          activeTab === 'ready'
            ? 'text-white border-b-2 border-blue-500'
            : 'text-gray-400 hover:text-gray-200'
        }`}
      >
        Ready
        {readyCount > 0 && (
          <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-blue-500/20 text-blue-400">
            {readyCount}
          </span>
        )}
      </button>
    </div>
  );
}
