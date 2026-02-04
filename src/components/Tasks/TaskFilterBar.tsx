export type TaskFilter = 'all' | 'open' | 'blocked' | 'done';
export type TaskSort = 'priority' | 'status' | 'updated';

interface TaskFilterBarProps {
  activeFilter: TaskFilter;
  onFilterChange: (filter: TaskFilter) => void;
  sortBy: TaskSort;
  onSortChange: (sort: TaskSort) => void;
  counts: { all: number; open: number; blocked: number; done: number };
}

const FILTERS: { key: TaskFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'blocked', label: 'Blocked' },
  { key: 'done', label: 'Done' },
];

export function TaskFilterBar({ activeFilter, onFilterChange, sortBy, onSortChange, counts }: TaskFilterBarProps) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => onFilterChange(key)}
            className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
              activeFilter === key
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : 'text-gray-400 hover:text-gray-200 border border-transparent'
            }`}
          >
            {label}
            <span className="ml-1 opacity-60">{counts[key]}</span>
          </button>
        ))}
      </div>

      <select
        value={sortBy}
        onChange={(e) => onSortChange(e.target.value as TaskSort)}
        className="text-xs bg-gray-900 border border-gray-700 rounded px-2 py-1 text-gray-300"
      >
        <option value="priority">Priority</option>
        <option value="status">Status</option>
        <option value="updated">Updated</option>
      </select>
    </div>
  );
}
