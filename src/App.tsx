import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar/Sidebar';
import { PhaseViewer } from './components/PhaseViewer/PhaseViewer';
import { useProjects } from './hooks/useProjects';
import { usePhases, usePhase } from './hooks/usePhases';
import { useWatchProject } from './hooks/useWatchProject';

export function App() {
  const [selectedProjectPath, setSelectedProjectPath] = useState<string | null>(null);
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);

  const { data: projects = [] } = useProjects();
  const { data: phases = [], isLoading: isPhasesLoading } = usePhases(selectedProjectPath);
  const { data: phase, isLoading: isPhaseLoading, error: phaseError } = usePhase(selectedProjectPath, selectedPhaseId);

  // Enable real-time updates
  useWatchProject(selectedProjectPath);

  // Auto-select first project
  useEffect(() => {
    if (projects.length > 0 && !selectedProjectPath) {
      setSelectedProjectPath(projects[0].path);
    }
  }, [projects, selectedProjectPath]);

  // Auto-select first phase when project changes
  useEffect(() => {
    if (phases.length > 0 && !selectedPhaseId) {
      setSelectedPhaseId(phases[0].id);
    }
  }, [phases, selectedPhaseId]);

  // Reset phase selection when project changes
  const handleSelectProject = (path: string) => {
    setSelectedProjectPath(path);
    setSelectedPhaseId(null);
  };

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100">
      <Sidebar
        projects={projects}
        selectedProjectPath={selectedProjectPath}
        onSelectProject={handleSelectProject}
        phases={phases}
        isPhasesLoading={isPhasesLoading}
        selectedPhaseId={selectedPhaseId}
        onSelectPhase={setSelectedPhaseId}
      />
      <main className="flex-1 overflow-hidden">
        <PhaseViewer
          phase={phase}
          isLoading={isPhaseLoading}
          error={phaseError}
        />
      </main>
    </div>
  );
}
