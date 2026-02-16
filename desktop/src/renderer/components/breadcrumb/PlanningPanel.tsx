import { useState, useEffect, useCallback, useMemo } from "react";
import {
  LayoutGrid,
  CheckCircle2,
  Circle,
  Clock,
  RefreshCw,
  ChevronRight,
  AlertCircle,
  FolderOpen,
  AlertTriangle,
  RotateCcw,
  ListChecks,
} from "lucide-react";
import { SkeletonList } from "../ui/Skeleton";
import {
  useProjects,
  useActiveProjectId,
  useProjectsStore,
} from "../../store/projectsStore";
import {
  usePlanningStore,
  type PhaseSummary,
  type PhaseTask,
  type PhaseDetail,
} from "../../store/planningStore";

// Stable empty references to avoid Zustand snapshot infinite-loop
const EMPTY_PHASES: PhaseSummary[] = [];

// ── Main Dashboard ───────────────────────────────────────────────────────────

export function PlanningPanel() {
  const projects = useProjects();
  const activeProjectId = useActiveProjectId();
  const projectsStore = useProjectsStore.getState;
  const refreshProject = usePlanningStore((s) => s.refreshProject);
  const planningProjects = usePlanningStore((s) => s.projects);
  const [refreshing, setRefreshing] = useState(false);

  // Selected project path — defaults to active project
  const [selectedProjectPath, setSelectedProjectPath] = useState<string | null>(
    null
  );

  // Sync selection with active project
  useEffect(() => {
    if (activeProjectId) {
      const project = projectsStore().projects.find(
        (p) => p.id === activeProjectId
      );
      if (project) {
        setSelectedProjectPath(project.path);
      }
    }
  }, [activeProjectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-fetch all projects on mount
  useEffect(() => {
    for (const project of projects) {
      const cached = planningProjects[project.path];
      if (!cached?.lastFetched) {
        refreshProject(project.path);
      }
    }
  }, [projects.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    const promises = projects.map((p) => refreshProject(p.path));
    await Promise.all(promises);
    setRefreshing(false);
  }, [projects, refreshProject]);

  const selectedProject = useMemo(
    () => projects.find((p) => p.path === selectedProjectPath) ?? null,
    [projects, selectedProjectPath]
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-background">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0 bg-background-raised">
        <div className="flex items-center gap-2 min-w-0">
          <LayoutGrid className="w-4 h-4 text-accent-secondary shrink-0" />
          <span className="text-sm font-medium text-foreground truncate">
            Dashboard
          </span>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-1.5 rounded-md text-foreground-muted hover:text-foreground-secondary hover:bg-muted/50 transition-default shrink-0 disabled:opacity-50"
          title="Refresh all projects"
          aria-label="Refresh all projects"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`}
          />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {projects.length === 0 ? (
          <EmptyDashboard />
        ) : (
          <div className="flex flex-col">
            {/* Portfolio Header */}
            <PortfolioHeader
              selectedProjectPath={selectedProjectPath}
              onSelectProject={setSelectedProjectPath}
            />

            {/* Dashboard Body */}
            {selectedProject && (
              <DashboardBody
                projectPath={selectedProject.path}
                projectName={selectedProject.name}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Portfolio Header ─────────────────────────────────────────────────────────

function PortfolioHeader({
  selectedProjectPath,
  onSelectProject,
}: {
  selectedProjectPath: string | null;
  onSelectProject: (path: string) => void;
}) {
  const projects = useProjects();
  const planningData = usePlanningStore((s) => s.projects);

  return (
    <div className="border-b border-border">
      <div className="px-4 pt-3 pb-1">
        <p className="text-2xs font-medium uppercase tracking-wider text-foreground-muted">
          Projects ({projects.length})
        </p>
      </div>
      <div className="px-2 pb-2">
        {projects.map((project) => {
          const data = planningData[project.path];
          const phases = data?.phases ?? [];
          const completedPhases = phases.filter(
            (p) => p.status === "complete"
          ).length;
          const totalPhases = phases.length;
          const isSelected = project.path === selectedProjectPath;
          const loading = data?.loading && !data?.lastFetched;
          const activePhase = phases.find((p) => p.isActive);

          return (
            <button
              key={project.id}
              onClick={() => onSelectProject(project.path)}
              className={`group w-full flex items-center gap-3 px-2 py-2 rounded-lg transition-default ${
                isSelected
                  ? "bg-accent-secondary/8 text-foreground"
                  : "text-foreground-secondary hover:bg-muted/30 hover:text-foreground"
              }`}
              aria-label={`Select ${project.name}`}
              aria-pressed={isSelected}
            >
              {/* Selection indicator */}
              <div
                className={`w-0.5 h-6 rounded-full shrink-0 transition-default ${
                  isSelected ? "bg-accent-secondary" : "bg-transparent"
                }`}
              />

              {/* Project info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-sm truncate ${
                      isSelected ? "font-medium" : ""
                    }`}
                  >
                    {project.name}
                  </span>
                  {activePhase && (
                    <span className="text-2xs text-foreground-muted font-mono truncate">
                      {activePhase.id}
                    </span>
                  )}
                </div>
              </div>

              {/* Progress */}
              {!loading && totalPhases > 0 && (
                <div className="flex items-center gap-2 shrink-0">
                  <div
                    className="w-12 h-1 bg-muted/50 rounded-full overflow-hidden"
                    role="progressbar"
                    aria-valuenow={completedPhases}
                    aria-valuemax={totalPhases}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${totalPhases > 0 ? (completedPhases / totalPhases) * 100 : 0}%`,
                        backgroundColor:
                          completedPhases === totalPhases
                            ? "hsl(var(--success))"
                            : "hsl(var(--accent-secondary))",
                      }}
                    />
                  </div>
                  <span className="text-2xs text-foreground-muted tabular-nums w-7 text-right">
                    {completedPhases}/{totalPhases}
                  </span>
                </div>
              )}

              {loading && (
                <div className="w-12 h-1 bg-muted/30 rounded-full animate-pulse shrink-0" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Dashboard Body ───────────────────────────────────────────────────────────

function DashboardBody({
  projectPath,
  projectName,
}: {
  projectPath: string;
  projectName: string;
}) {
  const phases = usePlanningStore(
    (s) => s.projects[projectPath]?.phases ?? EMPTY_PHASES
  );
  const loading = usePlanningStore(
    (s) => s.projects[projectPath]?.loading ?? false
  );
  const error = usePlanningStore(
    (s) => s.projects[projectPath]?.error ?? null
  );
  const capabilities = usePlanningStore(
    (s) => s.projects[projectPath]?.capabilities ?? null
  );
  const refreshProject = usePlanningStore((s) => s.refreshProject);

  // Progress summary
  const completedPhases = phases.filter((p) => p.status === "complete").length;
  const totalTasks = phases.reduce((sum, p) => sum + p.taskCount, 0);
  const completedTasks = phases.reduce((sum, p) => sum + p.completedCount, 0);

  if (loading && phases.length === 0) {
    return <SkeletonList rows={4} />;
  }

  if (error && phases.length === 0) {
    return (
      <div className="p-4">
        <ErrorAlert
          message={`Failed to load: ${error}`}
          onRetry={() => refreshProject(projectPath)}
        />
      </div>
    );
  }

  if (!capabilities?.hasPlanning) {
    return (
      <EmptySection
        icon={FolderOpen}
        title="No planning data"
        description={`Initialize with /bc:init in ${projectName}`}
      />
    );
  }

  if (phases.length === 0) {
    return (
      <EmptySection
        icon={LayoutGrid}
        title="No phases yet"
        description="Create one with /bc:new-phase or /bc:roadmap"
      />
    );
  }

  return (
    <div className="flex flex-col">
      {/* Progress Summary */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-2xs text-foreground-muted">Phases</span>
            <span className="text-sm font-medium text-foreground tabular-nums">
              {completedPhases}/{phases.length}
            </span>
          </div>
          {totalTasks > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-2xs text-foreground-muted">Tasks</span>
              <span className="text-sm font-medium text-foreground tabular-nums">
                {completedTasks}/{totalTasks}
              </span>
            </div>
          )}
          <div className="flex-1" />
          <div
            className="w-24 h-1 bg-muted/50 rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={completedTasks}
            aria-valuemax={totalTasks}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0}%`,
                backgroundColor:
                  completedTasks === totalTasks && totalTasks > 0
                    ? "hsl(var(--success))"
                    : "hsl(var(--accent-secondary))",
              }}
            />
          </div>
        </div>
      </div>

      {/* Phase Pipeline */}
      <PhasePipeline phases={phases} projectPath={projectPath} />

      {/* Active Task List — will be built in rjx.4 */}
      <ActiveTaskListStub phases={phases} />
    </div>
  );
}

// ── Phase Pipeline ───────────────────────────────────────────────────────────

function PhasePipeline({
  phases,
  projectPath,
}: {
  phases: PhaseSummary[];
  projectPath: string;
}) {
  const [expandedPhase, setExpandedPhase] = useState<string | null>(null);

  // Sort: active first, then planned, then completed
  const sortedPhases = useMemo(() => {
    const active = phases.filter(
      (p) => p.status === "in_progress" || p.isActive
    );
    const planned = phases.filter(
      (p) => p.status === "not_started" && !p.isActive
    );
    const completed = phases.filter((p) => p.status === "complete");
    return [...active, ...planned, ...completed];
  }, [phases]);

  const toggleExpand = useCallback(
    (phaseId: string) => {
      setExpandedPhase((prev) => (prev === phaseId ? null : phaseId));
    },
    []
  );

  return (
    <div className="px-4 py-3 border-b border-border">
      <p className="text-2xs font-medium uppercase tracking-wider text-foreground-muted mb-3">
        Phase Pipeline
      </p>
      <div className="relative">
        {sortedPhases.map((phase, index) => {
          const isLast = index === sortedPhases.length - 1;
          const isActive =
            phase.status === "in_progress" || phase.isActive;
          const isComplete = phase.status === "complete";
          const isExpanded = expandedPhase === phase.id;
          const progress =
            phase.taskCount > 0
              ? (phase.completedCount / phase.taskCount) * 100
              : 0;

          return (
            <div key={phase.id} className="relative">
              {/* Vertical connector line */}
              {!isLast && (
                <div
                  className={`absolute left-[7px] top-[28px] w-px transition-colors ${
                    isActive
                      ? "bg-accent-secondary/40"
                      : isComplete
                        ? "bg-success/30"
                        : "bg-border"
                  }`}
                  style={{
                    bottom: "0px",
                  }}
                />
              )}

              {/* Phase row */}
              <button
                onClick={() => toggleExpand(phase.id)}
                className={`group relative w-full flex items-center gap-2.5 py-2 text-left transition-default rounded-md -mx-1 px-1 ${
                  isActive
                    ? "hover:bg-accent-secondary/5"
                    : "hover:bg-muted/20"
                }`}
                aria-expanded={isExpanded}
                aria-label={`${phase.title} — ${phase.completedCount} of ${phase.taskCount} tasks done`}
              >
                {/* Status icon */}
                <PhaseStatusIcon
                  status={phase.status}
                  isActive={phase.isActive}
                />

                {/* Phase info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-sm truncate ${
                        isActive
                          ? "text-foreground font-medium"
                          : isComplete
                            ? "text-foreground-muted"
                            : "text-foreground-secondary"
                      }`}
                    >
                      {phase.title}
                    </span>
                  </div>

                  {/* Progress bar + task count */}
                  {phase.taskCount > 0 && (
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="w-16 h-[3px] bg-muted/40 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${progress}%`,
                            backgroundColor: isComplete
                              ? "hsl(var(--success))"
                              : "hsl(var(--accent-secondary))",
                          }}
                        />
                      </div>
                      <span className="text-2xs text-foreground-muted tabular-nums">
                        {phase.completedCount}/{phase.taskCount}
                      </span>
                    </div>
                  )}
                </div>

                {/* Expand chevron */}
                {phase.taskCount > 0 && (
                  <ChevronRight
                    className={`w-3.5 h-3.5 text-foreground-muted shrink-0 transition-transform duration-150 ${
                      isExpanded ? "rotate-90" : ""
                    }`}
                  />
                )}
              </button>

              {/* Expanded task list — placeholder for rjx.3 */}
              {isExpanded && phase.taskCount > 0 && (
                <PhaseTasksExpanded
                  projectPath={projectPath}
                  phaseId={phase.id}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Placeholder for rjx.3 — inline task expansion
function PhaseTasksExpanded({
  projectPath,
  phaseId,
}: {
  projectPath: string;
  phaseId: string;
}) {
  const fetchPhaseDetail = usePlanningStore((s) => s.fetchPhaseDetail);
  const detail = usePlanningStore(
    (s) => s.projects[projectPath]?.phaseDetails[phaseId] ?? null
  );

  useEffect(() => {
    if (!detail) {
      fetchPhaseDetail(projectPath, phaseId);
    }
  }, [projectPath, phaseId, detail, fetchPhaseDetail]);

  if (!detail) {
    return (
      <div className="ml-6 pl-3 border-l border-border py-2">
        <div className="space-y-1.5">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-5 bg-muted/20 rounded animate-pulse"
              style={{ width: `${70 - i * 10}%` }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (detail.tasks.length === 0) {
    return (
      <div className="ml-6 pl-3 border-l border-border py-2">
        <p className="text-2xs text-foreground-muted">
          No tasks — run /bc:plan {phaseId}
        </p>
      </div>
    );
  }

  return (
    <div className="ml-6 pl-3 border-l border-border py-1">
      {detail.tasks.map((task) => (
        <div
          key={task.id}
          className="flex items-center gap-2 py-1"
        >
          <TaskStatusDot status={task.status} />
          <span
            className={`text-2xs truncate flex-1 ${
              task.status === "done"
                ? "text-foreground-muted line-through"
                : task.status === "in_progress"
                  ? "text-foreground"
                  : "text-foreground-secondary"
            }`}
          >
            {task.title}
          </span>
        </div>
      ))}
    </div>
  );
}

function TaskStatusDot({ status }: { status: PhaseTask["status"] }) {
  switch (status) {
    case "done":
      return <CheckCircle2 className="w-3 h-3 text-success shrink-0" />;
    case "in_progress":
      return <Clock className="w-3 h-3 text-warning shrink-0" />;
    case "blocked":
      return <AlertCircle className="w-3 h-3 text-destructive shrink-0" />;
    default:
      return <Circle className="w-3 h-3 text-accent-secondary shrink-0" />;
  }
}

function ActiveTaskListStub({ phases }: { phases: PhaseSummary[] }) {
  const activePhasesExist = phases.some(
    (p) => p.status === "in_progress" || p.isActive
  );

  if (!activePhasesExist) return null;

  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-2 mb-3">
        <ListChecks className="w-3.5 h-3.5 text-foreground-muted" />
        <p className="text-2xs font-medium uppercase tracking-wider text-foreground-muted">
          Active Work
        </p>
      </div>
      <p className="text-2xs text-foreground-muted">
        Expand a phase above to see its tasks
      </p>
    </div>
  );
}

// ── Shared Components ────────────────────────────────────────────────────────

function PhaseStatusIcon({
  status,
  isActive,
}: {
  status: PhaseSummary["status"];
  isActive: boolean;
}) {
  if (status === "complete") {
    return <CheckCircle2 className="w-4 h-4 text-success shrink-0" />;
  }
  if (status === "in_progress" || isActive) {
    return (
      <div className="w-4 h-4 shrink-0 flex items-center justify-center">
        <div className="w-2.5 h-2.5 rounded-full bg-accent-secondary shadow-glow-teal" />
      </div>
    );
  }
  return (
    <div className="w-4 h-4 shrink-0 flex items-center justify-center">
      <div className="w-2 h-2 rounded-full border border-foreground-muted/40" />
    </div>
  );
}

export function StatusBadge({
  status,
}: {
  status: "complete" | "in_progress" | "not_started" | string;
}) {
  switch (status) {
    case "complete":
    case "done":
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-success/10 text-success text-2xs">
          <CheckCircle2 className="w-3 h-3" />
          Done
        </span>
      );
    case "in_progress":
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-accent-secondary/10 text-accent-secondary text-2xs">
          <Clock className="w-3 h-3" />
          Active
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-muted/50 text-foreground-muted text-2xs">
          <Circle className="w-3 h-3" />
          Planned
        </span>
      );
  }
}

export function TaskStatusBadge({ status }: { status: PhaseTask["status"] }) {
  switch (status) {
    case "done":
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-success/10 text-success text-2xs">
          <CheckCircle2 className="w-3 h-3" />
          Done
        </span>
      );
    case "in_progress":
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-warning/10 text-warning text-2xs">
          <Clock className="w-3 h-3" />
          Active
        </span>
      );
    case "blocked":
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-destructive/10 text-destructive text-2xs">
          <AlertCircle className="w-3 h-3" />
          Blocked
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-accent-secondary/10 text-accent-secondary text-2xs">
          <Circle className="w-3 h-3" />
          Ready
        </span>
      );
  }
}

function EmptyDashboard() {
  const addProject = useProjectsStore((s) => s.addProject);

  const handleAdd = async () => {
    const dir = await window.breadcrumbAPI?.selectDirectory();
    if (dir) addProject(dir);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center animate-fade-in">
      <div className="w-12 h-12 rounded-xl bg-muted/30 flex items-center justify-center mb-4">
        <LayoutGrid className="w-6 h-6 text-foreground-muted" />
      </div>
      <p className="text-sm font-medium text-foreground-secondary mb-1">
        No projects in workspace
      </p>
      <p className="text-2xs text-foreground-muted mb-4 max-w-xs">
        Add a project folder to see its phases, tasks, and progress.
      </p>
      <button
        onClick={handleAdd}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-secondary/10 text-accent-secondary text-sm font-medium hover:bg-accent-secondary/15 transition-default"
      >
        <FolderOpen className="w-4 h-4" />
        Add Project
      </button>
    </div>
  );
}

function EmptySection({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center animate-fade-in">
      <div className="w-10 h-10 rounded-xl bg-muted/30 flex items-center justify-center mb-3">
        <Icon className="w-5 h-5 text-foreground-muted" />
      </div>
      <p className="text-sm text-foreground-secondary mb-0.5">{title}</p>
      <p className="text-2xs text-foreground-muted">{description}</p>
    </div>
  );
}

export function ErrorAlert({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex items-start gap-2.5 p-3 rounded-lg border border-destructive/30 bg-destructive/5 animate-fade-in">
      <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground-secondary">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-2xs font-medium text-destructive hover:bg-destructive/10 transition-default shrink-0"
          aria-label="Retry loading"
        >
          <RotateCcw className="w-3 h-3" />
          Retry
        </button>
      )}
    </div>
  );
}
