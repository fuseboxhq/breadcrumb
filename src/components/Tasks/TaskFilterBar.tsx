import clsx from 'clsx';

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
            className={clsx(
              'px-2.5 py-1 text-2xs rounded-full transition-colors border',
              activeFilter === key
                ? 'bg-accent-muted text-accent-text border-accent/30'
                : 'text-text-tertiary hover:text-text-secondary border-transparent',
            )}
          >
            {label}
            <span className="ml-1 tabular-nums opacity-60">{counts[key]}</span>
          </button>
        ))}
      </div>

      <select
        value={sortBy}
        onChange={(e) => onSortChange(e.target.value as TaskSort)}
        className="text-2xs bg-surface-raised border border-border rounded-md px-2 py-1 text-text-secondary focus-ring"
      >
        <option value="priority">Priority</option>
        <option value="status">Status</option>
        <option value="updated">Updated</option>
      </select>
    </div>
  );
}
