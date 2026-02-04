import type { Project } from '../../types';

interface ProjectSwitcherProps {
  projects: Project[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
}

export function ProjectSwitcher({ projects, selectedPath, onSelect }: ProjectSwitcherProps) {
  if (projects.length === 0) {
    return (
      <div className="px-4 py-3 text-sm text-gray-500">
        No projects registered.
      </div>
    );
  }

  if (projects.length === 1) {
    return (
      <div className="px-4 py-3">
        <div className="text-sm font-medium text-gray-200">{projects[0].name}</div>
        <div className="text-xs text-gray-500 truncate">{projects[0].path}</div>
      </div>
    );
  }

  return (
    <div className="px-3 py-2">
      <select
        value={selectedPath || ''}
        onChange={(e) => onSelect(e.target.value)}
        className="w-full bg-gray-800 text-gray-200 text-sm rounded-lg border border-gray-700 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {projects.map((p) => (
          <option key={p.path} value={p.path}>
            {p.name}
          </option>
        ))}
      </select>
    </div>
  );
}
