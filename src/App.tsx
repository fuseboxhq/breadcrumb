import { useState, useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
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
import type { ContentTab } from './types';

export function App() {
  const [selectedProjectPath, setSelectedProjectPath] = useState<string | null>(null);
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);
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

  // Derive quick tasks from the Quick Tasks epic (identified by label)
  const quickTasks = useMemo(() => {
    const epic = allIssues.find(
      (i) => i.labels.includes('quick-tasks-epic') && i.parentId === null,
    );
    if (!epic) return [];
    return allIssues
      .filter((i) => i.parentId === epic.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [allIssues]);

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
    setContentTab('plan');
  };

  // Back to dashboard (deselect phase)
  const handleBackToDashboard = () => {
    setSelectedPhaseId(null);
    setContentTab('plan');
  };

  const viewKey = selectedPhaseId && phase ? `phase-${selectedPhaseId}` : 'dashboard';

  return (
    <div className="flex h-screen bg-surface text-text-primary">
      <Sidebar
        projects={projects}
        selectedProjectPath={selectedProjectPath}
        onSelectProject={handleSelectProject}
        phases={phases}
        isPhasesLoading={isPhasesLoading}
        selectedPhaseId={selectedPhaseId}
        onSelectPhase={handleSelectPhase}
        onBackToDashboard={handleBackToDashboard}
        progressByEpic={progressByEpic}
        quickTasks={quickTasks}
        isQuickTasksLoading={false}
      />
      <main className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          {selectedPhaseId && phase ? (
            <motion.div
              key={viewKey}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="h-full"
            >
              <PhaseDetailView
                phase={phase}
                projectPath={selectedProjectPath!}
                isLoading={isPhaseLoading}
                error={phaseError}
                activeTab={contentTab}
                onTabChange={setContentTab}
              />
            </motion.div>
          ) : (
            <motion.div
              key={viewKey}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="h-full"
            >
              <ProjectDashboard
                projectState={projectState}
                isStateLoading={isStateLoading}
                phases={phases}
                progressByEpic={progressByEpic}
                readyIssues={readyIssues}
                isReadyLoading={isReadyLoading}
                onSelectPhase={handleSelectPhase}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
