import { useState, useEffect, useMemo } from 'react';
import { Sidebar } from './components/Sidebar/Sidebar';
import { PhaseDetailView } from './components/PhaseDetail/PhaseDetailView';
import { ProjectDashboard } from './components/Dashboard/ProjectDashboard';
import { useProjects } from './hooks/useProjects';
import { usePhases, usePhase } from './hooks/usePhases';
import { useIssues } from './hooks/useIssues';
import { useProjectState } from './hooks/useProjectState';
import { useReadyIssues } from './hooks/useReadyIssues';
import { useWatchProject } from './hooks/useWatchProject';
import { groupProgressByEpic } from './lib/taskUtils';
import type { SidebarTab, ContentTab, BeadsIssue } from './types';

export function App() {
  const [selectedProjectPath, setSelectedProjectPath] = useState<string | null>(null);
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('phases');
  const [contentTab, setContentTab] = useState<ContentTab>('plan');

  const { data: projects = [] } = useProjects();
  const { data: phases = [], isLoading: isPhasesLoading } = usePhases(selectedProjectPath);
  const { data: phase, isLoading: isPhaseLoading, error: phaseError } = usePhase(selectedProjectPath, selectedPhaseId);
  const { data: allIssues = [] } = useIssues(selectedProjectPath);
  const { data: projectState, isLoading: isStateLoading } = useProjectState(selectedProjectPath);
  const { data: readyIssues = [], isLoading: isReadyLoading } = useReadyIssues(selectedProjectPath);

  // Enable real-time updates
  useWatchProject(selectedProjectPath);

  // Compute per-epic progress from all issues
  const progressByEpic = useMemo(() => groupProgressByEpic(allIssues), [allIssues]);

  // Auto-select first project
  useEffect(() => {
    if (projects.length > 0 && !selectedProjectPath) {
      setSelectedProjectPath(projects[0].path);
    }
  }, [projects, selectedProjectPath]);

  // Reset phase selection and content tab when project changes
  const handleSelectProject = (path: string) => {
    setSelectedProjectPath(path);
    setSelectedPhaseId(null);
    setContentTab('plan');
  };

  // Select a phase (from sidebar or dashboard)
  const handleSelectPhase = (phaseId: string) => {
    setSelectedPhaseId(phaseId);
    setSidebarTab('phases');
    setContentTab('plan');
  };

  // Handle clicking a ready task — navigate to its phase's tasks tab
  const handleSelectReadyTask = (issue: BeadsIssue) => {
    let ownerPhase;
    if (issue.parentId) {
      // Subtask — find the phase that owns the parent epic
      ownerPhase = phases.find((p) => p.beadsEpic === issue.parentId);
    } else {
      // Epic itself — match directly
      ownerPhase = phases.find((p) => p.beadsEpic === issue.id);
    }
    if (ownerPhase) {
      setSelectedPhaseId(ownerPhase.id);
      setSidebarTab('phases');
      setContentTab('tasks');
    }
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
        onSelectPhase={handleSelectPhase}
        sidebarTab={sidebarTab}
        onSidebarTabChange={setSidebarTab}
        readyIssues={readyIssues}
        isReadyLoading={isReadyLoading}
        onSelectReadyTask={handleSelectReadyTask}
        progressByEpic={progressByEpic}
      />
      <main className="flex-1 overflow-hidden">
        {selectedPhaseId && phase ? (
          <PhaseDetailView
            phase={phase}
            projectPath={selectedProjectPath!}
            isLoading={isPhaseLoading}
            error={phaseError}
            activeTab={contentTab}
            onTabChange={setContentTab}
          />
        ) : (
          <ProjectDashboard
            projectState={projectState}
            isStateLoading={isStateLoading}
            phases={phases}
            progressByEpic={progressByEpic}
            readyIssues={readyIssues}
            isReadyLoading={isReadyLoading}
            onSelectPhase={handleSelectPhase}
          />
        )}
      </main>
    </div>
  );
}
