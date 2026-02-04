import { ProjectSwitcher } from './ProjectSwitcher';
import { PhaseList } from './PhaseList';
import { SidebarTabBar } from './SidebarTabBar';
import { ReadyTasksList } from './ReadyTasksList';
import type { Phase, Project, BeadsIssue, PhaseProgress, SidebarTab } from '../../types';

interface SidebarProps {
  projects: Project[];
  selectedProjectPath: string | null;
  onSelectProject: (path: string) => void;
  phases: Phase[];
  isPhasesLoading: boolean;
  selectedPhaseId: string | null;
  onSelectPhase: (phaseId: string) => void;
  sidebarTab: SidebarTab;
  onSidebarTabChange: (tab: SidebarTab) => void;
  readyIssues: BeadsIssue[];
  isReadyLoading: boolean;
  onSelectReadyTask: (issue: BeadsIssue) => void;
  progressByEpic: Map<string, PhaseProgress>;
}

export function Sidebar({
  projects,
  selectedProjectPath,
  onSelectProject,
  phases,
  isPhasesLoading,
  selectedPhaseId,
  onSelectPhase,
  sidebarTab,
  onSidebarTabChange,
  readyIssues,
  isReadyLoading,
  onSelectReadyTask,
  progressByEpic,
}: SidebarProps) {
  return (
    <aside className="w-80 border-r border-gray-800 flex flex-col bg-gray-950">
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <h1 className="text-lg font-semibold text-white">Breadcrumb</h1>
      </div>

      {/* Project switcher */}
      <div className="border-b border-gray-800">
        <ProjectSwitcher
          projects={projects}
          selectedPath={selectedProjectPath}
          onSelect={onSelectProject}
        />
      </div>

      {/* Tab bar */}
      <SidebarTabBar
        activeTab={sidebarTab}
        onChange={onSidebarTabChange}
        readyCount={readyIssues.length}
      />

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-2">
        {sidebarTab === 'phases' ? (
          <PhaseList
            phases={phases}
            isLoading={isPhasesLoading}
            selectedPhaseId={selectedPhaseId}
            onSelect={onSelectPhase}
            progressByEpic={progressByEpic}
          />
        ) : (
          <ReadyTasksList
            issues={readyIssues}
            isLoading={isReadyLoading}
            onSelectTask={onSelectReadyTask}
          />
        )}
      </div>
    </aside>
  );
}
