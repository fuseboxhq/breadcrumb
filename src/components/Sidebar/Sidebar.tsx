import { useState, useCallback } from 'react';
import clsx from 'clsx';
import { PanelLeftClose, PanelLeft, LayoutDashboard } from 'lucide-react';
import { ProjectSwitcher } from './ProjectSwitcher';
import { PhaseList } from './PhaseList';
import { QuickTaskList } from './QuickTaskList';
import { Tooltip } from '../ui/Tooltip';
import type { Phase, Project, PhaseProgress, BeadsIssue } from '../../types';

interface SidebarProps {
  projects: Project[];
  selectedProjectPath: string | null;
  onSelectProject: (path: string) => void;
  phases: Phase[];
  isPhasesLoading: boolean;
  selectedPhaseId: string | null;
  onSelectPhase: (phaseId: string) => void;
  onBackToDashboard: () => void;
  progressByEpic: Map<string, PhaseProgress>;
  quickTasks: BeadsIssue[];
  isQuickTasksLoading: boolean;
}

export function Sidebar({
  projects,
  selectedProjectPath,
  onSelectProject,
  phases,
  isPhasesLoading,
  selectedPhaseId,
  onSelectPhase,
  onBackToDashboard,
  progressByEpic,
  quickTasks,
  isQuickTasksLoading,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('bc-sidebar-collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('bc-sidebar-collapsed', String(next));
      } catch {}
      return next;
    });
  }, []);

  return (
    <aside
      className={clsx(
        'flex flex-col bg-surface-raised border-r border-border transition-[width] duration-200 ease-out flex-shrink-0',
        collapsed ? 'w-13' : 'w-72',
      )}
    >
      {/* Header with logo + collapse toggle */}
      <div className={clsx(
        'flex items-center h-12 border-b border-border flex-shrink-0',
        collapsed ? 'flex-col justify-center gap-0.5 px-2' : 'justify-between px-3',
      )}>
        {collapsed ? (
          <>
            <Tooltip content="Dashboard" side="right">
              <button
                onClick={onBackToDashboard}
                className="p-1.5 rounded-md text-text-tertiary hover:text-accent hover:bg-surface-hover transition-colors"
              >
                <LayoutDashboard className="h-4 w-4" />
              </button>
            </Tooltip>
          </>
        ) : (
          <button
            onClick={onBackToDashboard}
            className="flex items-center gap-2 text-sm font-semibold text-text-primary hover:text-accent transition-colors"
          >
            <LayoutDashboard className="h-4 w-4" />
            Breadcrumb
          </button>
        )}
        {!collapsed && (
          <Tooltip content="Collapse sidebar" side="right">
            <button
              onClick={toggleCollapsed}
              className="p-1.5 rounded-md text-text-tertiary hover:text-text-secondary hover:bg-surface-hover transition-colors"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </Tooltip>
        )}
      </div>
      {/* Expand toggle when collapsed — below header */}
      {collapsed && (
        <div className="flex justify-center py-1 border-b border-border flex-shrink-0">
          <Tooltip content="Expand sidebar" side="right">
            <button
              onClick={toggleCollapsed}
              className="p-1.5 rounded-md text-text-tertiary hover:text-text-secondary hover:bg-surface-hover transition-colors"
            >
              <PanelLeft className="h-4 w-4" />
            </button>
          </Tooltip>
        </div>
      )}

      {/* Project switcher */}
      <div className="border-b border-border flex-shrink-0">
        <ProjectSwitcher
          projects={projects}
          selectedPath={selectedProjectPath}
          onSelect={onSelectProject}
          collapsed={collapsed}
        />
      </div>

      {/* Scrollable sections container */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Phases section */}
        <div className="flex-[3] min-h-0 flex flex-col">
          {!collapsed && (
            <div className="px-3 pt-3 pb-1 flex-shrink-0">
              <span className="text-2xs font-medium uppercase tracking-wider text-text-tertiary">
                Phases
              </span>
            </div>
          )}
          <div className="flex-1 overflow-y-auto px-1.5 py-1">
            <PhaseList
              phases={phases}
              isLoading={isPhasesLoading}
              selectedPhaseId={selectedPhaseId}
              onSelect={onSelectPhase}
              progressByEpic={progressByEpic}
              collapsed={collapsed}
            />
          </div>
        </div>

        {/* Quick Tasks section */}
        <div className="flex-[2] min-h-0 flex flex-col border-t border-border">
          {!collapsed && (
            <div className="px-3 pt-3 pb-1 flex-shrink-0">
              <span className="text-2xs font-medium uppercase tracking-wider text-text-tertiary">
                Quick Tasks
              </span>
            </div>
          )}
          <div className="flex-1 overflow-y-auto px-1.5 py-1">
            <QuickTaskList
              tasks={quickTasks}
              isLoading={isQuickTasksLoading}
              collapsed={collapsed}
            />
          </div>
        </div>
      </div>
    </aside>
  );
}
