import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronDown, FolderOpen, Check } from 'lucide-react';
import clsx from 'clsx';
import type { Project } from '../../types';

interface ProjectSwitcherProps {
  projects: Project[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
  collapsed?: boolean;
}

export function ProjectSwitcher({ projects, selectedPath, onSelect, collapsed }: ProjectSwitcherProps) {
  const selected = projects.find((p) => p.path === selectedPath);

  if (projects.length === 0) {
    return (
      <div className={clsx('px-3 py-3', collapsed && 'px-2')}>
        <div className="text-xs text-text-tertiary">No projects</div>
      </div>
    );
  }

  if (projects.length === 1) {
    return (
      <div className={clsx('flex items-center gap-2.5 px-3 py-3', collapsed && 'justify-center px-2')}>
        <div className="flex items-center justify-center h-7 w-7 rounded-md bg-accent-muted text-accent flex-shrink-0">
          <FolderOpen className="h-3.5 w-3.5" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <div className="text-sm font-medium text-text-primary truncate">{projects[0].name}</div>
          </div>
        )}
      </div>
    );
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className={clsx(
            'flex items-center gap-2.5 w-full px-3 py-3 hover:bg-surface-hover transition-colors text-left',
            collapsed && 'justify-center px-2',
          )}
        >
          <div className="flex items-center justify-center h-7 w-7 rounded-md bg-accent-muted text-accent flex-shrink-0">
            <FolderOpen className="h-3.5 w-3.5" />
          </div>
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-text-primary truncate">
                  {selected?.name || 'Select project'}
                </div>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-text-tertiary flex-shrink-0" />
            </>
          )}
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={4}
          className="z-50 min-w-[220px] p-1 bg-surface-overlay border border-border-strong rounded-lg shadow-overlay animate-scale-in"
        >
          {projects.map((project) => (
            <DropdownMenu.Item
              key={project.path}
              onSelect={() => onSelect(project.path)}
              className="flex items-center gap-2 px-2.5 py-2 rounded-md text-sm text-text-primary cursor-pointer outline-none data-[highlighted]:bg-surface-hover transition-colors"
            >
              <FolderOpen className="h-3.5 w-3.5 text-text-tertiary flex-shrink-0" />
              <span className="flex-1 truncate">{project.name}</span>
              {project.path === selectedPath && (
                <Check className="h-3.5 w-3.5 text-accent flex-shrink-0" />
              )}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
