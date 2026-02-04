import { ProjectSwitcher } from './ProjectSwitcher';
import { PhaseList } from './PhaseList';
import type { Phase, Project } from '../../types';

interface SidebarProps {
  projects: Project[];
  selectedProjectPath: string | null;
  onSelectProject: (path: string) => void;
  phases: Phase[];
  isPhasesLoading: boolean;
  selectedPhaseId: string | null;
  onSelectPhase: (phaseId: string) => void;
}

export function Sidebar({
  projects,
  selectedProjectPath,
  onSelectProject,
  phases,
  isPhasesLoading,
  selectedPhaseId,
  onSelectPhase,
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

      {/* Phase list */}
      <div className="flex-1 overflow-y-auto p-2">
        <PhaseList
          phases={phases}
          isLoading={isPhasesLoading}
          selectedPhaseId={selectedPhaseId}
          onSelect={onSelectPhase}
        />
      </div>
    </aside>
  );
}
