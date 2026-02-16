import { useState, useEffect, useCallback } from "react";
import {
  LayoutGrid,
  CheckCircle2,
  Circle,
  Clock,
  RefreshCw,
  ChevronRight,
  AlertCircle,
  Database,
  FileText,
  FolderOpen,
  ArrowLeft,
  RotateCcw,
  AlertTriangle,
} from "lucide-react";
import { SkeletonCard, SkeletonList } from "../ui/Skeleton";
import { useProjects, useProjectsStore } from "../../store/projectsStore";
import {
  usePlanningStore,
  usePlanningNavigation,
  useSetPlanningNavigation,
  type DashboardView,
  type PhaseSummary,
  type PhaseDetail,
  type PhaseTask,
} from "../../store/planningStore";

// Stable empty references to avoid Zustand snapshot infinite-loop
const EMPTY_TASKS: PhaseTask[] = [];
const EMPTY_BEADS: never[] = [];
const EMPTY_PHASES: PhaseSummary[] = [];

// ── Main Dashboard ───────────────────────────────────────────────────────────

export function PlanningPanel() {
  const view = usePlanningNavigation();
  const setView = useSetPlanningNavigation();
  const projects = useProjects();
  const refreshProject = usePlanningStore((s) => s.refreshProject);
  const planningProjects = usePlanningStore((s) => s.projects);
  const [refreshing, setRefreshing] = useState(false);

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

  const navigateToProject = useCallback(
    (projectPath: string, projectName: string) => {
      setView({ kind: "project", projectPath, projectName });
    },
    []
  );

  const navigateToPhase = useCallback(
    (projectPath: string, projectName: string, phaseId: string) => {
      setView({ kind: "phase", projectPath, projectName, phaseId });
    },
    []
  );

  const navigateBack = useCallback(() => {
    if (view.kind === "phase") {
      setView({
        kind: "project",
        projectPath: view.projectPath,
        projectName: view.projectName,
      });
    } else {
      setView({ kind: "overview" });
    }
  }, [view]);

  return (
    <div className="flex-1 flex flex-col h-full bg-background">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0 bg-background-raised">
        <div className="flex items-center gap-2 min-w-0">
          {view.kind !== "overview" && (
            <button
              onClick={navigateBack}
              className="p-1 rounded-md text-foreground-muted hover:text-foreground-secondary hover:bg-muted/50 transition-default shrink-0"
              title="Back"
              aria-label="Navigate back"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          )}
          <LayoutGrid className="w-4 h-4 text-dracula-purple shrink-0" />
          <Breadcrumbs view={view} onNavigate={setView} />
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
        {view.kind === "overview" && (
          <ProjectOverview
            onSelectProject={navigateToProject}
          />
        )}
        {view.kind === "project" && (
          <ProjectPhases
            projectPath={view.projectPath}
            projectName={view.projectName}
            onSelectPhase={(phaseId) =>
              navigateToPhase(view.projectPath, view.projectName, phaseId)
            }
          />
        )}
        {view.kind === "phase" && (
          <PhaseDetailView
            projectPath={view.projectPath}
            phaseId={view.phaseId}
          />
        )}
      </div>
    </div>
  );
}

// ── Breadcrumbs ──────────────────────────────────────────────────────────────

function Breadcrumbs({
  view,
  onNavigate,
}: {
  view: DashboardView;
  onNavigate: (view: DashboardView) => void;
}) {
  return (
    <div className="flex items-center gap-1 text-sm min-w-0">
      <button
        onClick={() => onNavigate({ kind: "overview" })}
        className={`font-semibold truncate transition-default ${
          view.kind === "overview"
            ? "text-foreground"
            : "text-foreground-muted hover:text-foreground-secondary"
        }`}
      >
        Dashboard
      </button>
      {(view.kind === "project" || view.kind === "phase") && (
        <>
          <ChevronRight className="w-3 h-3 text-foreground-muted shrink-0" />
          <button
            onClick={() =>
              onNavigate({
                kind: "project",
                projectPath: view.projectPath,
                projectName: view.projectName,
              })
            }
            className={`truncate transition-default ${
              view.kind === "project"
                ? "text-foreground font-medium"
                : "text-foreground-muted hover:text-foreground-secondary"
            }`}
          >
            {view.projectName}
          </button>
        </>
      )}
      {view.kind === "phase" && (
        <>
          <ChevronRight className="w-3 h-3 text-foreground-muted shrink-0" />
          <span className="text-foreground font-medium truncate">
            {view.phaseId}
          </span>
        </>
      )}
    </div>
  );
}

// ── Project Overview (All Projects Grid) ─────────────────────────────────────

function ProjectOverview({
  onSelectProject,
}: {
  onSelectProject: (path: string, name: string) => void;
}) {
  const projects = useProjects();
  const planningData = usePlanningStore((s) => s.projects);
  const addProject = useProjectsStore((s) => s.addProject);

  if (projects.length === 0) {
    return <EmptyDashboard onAddProject={async () => {
      const dir = await window.breadcrumbAPI?.selectDirectory();
      if (dir) addProject(dir);
    }} />;
  }

  const refreshProject = usePlanningStore((s) => s.refreshProject);

  return (
    <div className="p-4 space-y-3">
      <p className="text-2xs font-semibold uppercase tracking-widest text-foreground-muted px-1">
        Projects ({projects.length})
      </p>
      <div className="grid gap-3">
        {projects.map((project) => {
          const data = planningData[project.path];
          const loading = data?.loading ?? true;
          const error = data?.error;
          const capabilities = data?.capabilities;
          const phases = data?.phases ?? [];
          const activePhase = phases.find((p) => p.isActive);
          const completedPhases = phases.filter(
            (p) => p.status === "complete"
          ).length;

          if (loading && !data?.lastFetched) {
            return <SkeletonCard key={project.id} />;
          }

          if (error && !data?.lastFetched) {
            return (
              <div key={project.id} className="p-4 rounded-xl border border-border space-y-2">
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-dracula-purple shrink-0" />
                  <span className="text-sm font-semibold text-foreground truncate">
                    {project.name}
                  </span>
                </div>
                <ErrorAlert
                  message={`Failed to load project data: ${error}`}
                  onRetry={() => refreshProject(project.path)}
                />
              </div>
            );
          }

          return (
            <button
              key={project.id}
              onClick={() => onSelectProject(project.path, project.name)}
              aria-label={`Open ${project.name} project`}
              className="group w-full text-left p-4 rounded-xl border border-border hover:border-border-strong hover:bg-background-raised transition-default"
            >
              <div className="flex items-center gap-2 mb-2.5">
                <FolderOpen className="w-4 h-4 text-dracula-purple shrink-0" />
                <span className="text-sm font-semibold text-foreground truncate">
                  {project.name}
                </span>
                <div className="ml-auto flex items-center gap-1 shrink-0">
                  {capabilities?.hasPlanning && (
                    <span title=".planning/ detected" aria-label="Has planning data">
                      <FileText className="w-3 h-3 text-dracula-green" />
                    </span>
                  )}
                  {capabilities?.hasBeads && (
                    <span title=".beads/ detected" aria-label="Has Beads database">
                      <Database className="w-3 h-3 text-dracula-cyan" />
                    </span>
                  )}
                  <ChevronRight className="w-3.5 h-3.5 text-foreground-muted opacity-0 group-hover:opacity-100 transition-default" aria-hidden="true" />
                </div>
              </div>

              {capabilities?.hasPlanning && phases.length > 0 ? (
                <>
                  {activePhase && (
                    <div className="flex items-center gap-2 mb-2">
                      <StatusBadge status={activePhase.status} />
                      <span className="text-2xs text-foreground-secondary truncate">
                        {activePhase.title}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <div
                      className="flex-1 h-1.5 bg-muted/50 rounded-full overflow-hidden"
                      role="progressbar"
                      aria-valuenow={completedPhases}
                      aria-valuemax={phases.length}
                      aria-label={`${completedPhases} of ${phases.length} phases complete`}
                    >
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${phases.length > 0 ? (completedPhases / phases.length) * 100 : 0}%`,
                          background:
                            completedPhases === phases.length
                              ? "var(--success)"
                              : "linear-gradient(90deg, var(--primary), var(--dracula-pink))",
                        }}
                      />
                    </div>
                    <span className="text-2xs text-foreground-muted tabular-nums">
                      {completedPhases}/{phases.length}
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-2xs text-foreground-muted">
                  {capabilities?.hasPlanning
                    ? "No phases found"
                    : "No planning data — initialize with /bc:init"}
                </p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Project Phases ───────────────────────────────────────────────────────────

function ProjectPhases({
  projectPath,
  projectName,
  onSelectPhase,
}: {
  projectPath: string;
  projectName: string;
  onSelectPhase: (phaseId: string) => void;
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
  const refreshProject = usePlanningStore((s) => s.refreshProject);

  if (loading && phases.length === 0) {
    return <SkeletonList rows={4} />;
  }

  if (error && phases.length === 0) {
    return (
      <div className="p-4">
        <ErrorAlert
          message={`Failed to load phases: ${error}`}
          onRetry={() => refreshProject(projectPath)}
        />
      </div>
    );
  }

  if (phases.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center animate-fade-in">
        <div className="w-12 h-12 rounded-xl bg-muted/30 flex items-center justify-center mb-4">
          <LayoutGrid className="w-6 h-6 text-foreground-muted" />
        </div>
        <p className="text-sm text-foreground-secondary mb-1">
          No phases found
        </p>
        <p className="text-2xs text-foreground-muted">
          {projectName} doesn't have any .planning/ phases yet
        </p>
      </div>
    );
  }

  // Group by status
  const active = phases.filter((p) => p.status === "in_progress" || p.isActive);
  const planned = phases.filter(
    (p) => p.status === "not_started" && !p.isActive
  );
  const completed = phases.filter((p) => p.status === "complete");

  return (
    <div className="p-4 space-y-4">
      {active.length > 0 && (
        <PhaseGroup
          label="Active"
          phases={active}
          onSelect={onSelectPhase}
        />
      )}
      {planned.length > 0 && (
        <PhaseGroup
          label="Planned"
          phases={planned}
          onSelect={onSelectPhase}
        />
      )}
      {completed.length > 0 && (
        <PhaseGroup
          label="Completed"
          phases={completed}
          onSelect={onSelectPhase}
          collapsed
        />
      )}
    </div>
  );
}

function PhaseGroup({
  label,
  phases,
  onSelect,
  collapsed: initialCollapsed = false,
}: {
  label: string;
  phases: PhaseSummary[];
  onSelect: (phaseId: string) => void;
  collapsed?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  return (
    <div>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-1.5 px-1 mb-2 text-2xs font-semibold uppercase tracking-widest text-foreground-muted hover:text-foreground-secondary transition-default"
      >
        <ChevronRight
          className={`w-3 h-3 transition-default ${
            collapsed ? "" : "rotate-90"
          }`}
        />
        {label} ({phases.length})
      </button>
      {!collapsed && (
        <div className="space-y-2">
          {phases.map((phase) => (
            <PhaseCard key={phase.id} phase={phase} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}

function PhaseCard({
  phase,
  onSelect,
}: {
  phase: PhaseSummary;
  onSelect: (phaseId: string) => void;
}) {
  const progress =
    phase.taskCount > 0 ? (phase.completedCount / phase.taskCount) * 100 : 0;

  return (
    <button
      onClick={() => onSelect(phase.id)}
      aria-label={`${phase.id}: ${phase.title} — ${phase.completedCount} of ${phase.taskCount} tasks done`}
      className="group w-full text-left p-3.5 rounded-xl border border-border hover:border-border-strong hover:bg-background-raised transition-default"
    >
      <div className="flex items-center gap-2 mb-2">
        <StatusBadge status={phase.status} />
        <span className="text-2xs font-mono text-foreground-muted">
          {phase.id}
        </span>
        <ChevronRight className="w-3 h-3 text-foreground-muted ml-auto opacity-0 group-hover:opacity-100 transition-default" />
      </div>
      <div className="text-sm font-medium text-foreground mb-2.5">
        {phase.title}
      </div>
      {phase.taskCount > 0 && (
        <div className="flex items-center gap-2">
          <div
            className="flex-1 h-1.5 bg-muted/50 rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={phase.completedCount}
            aria-valuemax={phase.taskCount}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progress}%`,
                background:
                  progress === 100
                    ? "var(--success)"
                    : "linear-gradient(90deg, var(--primary), var(--dracula-pink))",
              }}
            />
          </div>
          <span className="text-2xs text-foreground-muted tabular-nums">
            {phase.completedCount}/{phase.taskCount}
          </span>
        </div>
      )}
    </button>
  );
}

// ── Phase Detail View ────────────────────────────────────────────────────────

function PhaseDetailView({
  projectPath,
  phaseId,
}: {
  projectPath: string;
  phaseId: string;
}) {
  const fetchPhaseDetail = usePlanningStore((s) => s.fetchPhaseDetail);
  const fetchBeadsTasks = usePlanningStore((s) => s.fetchBeadsTasks);
  const detail = usePlanningStore(
    (s) => s.projects[projectPath]?.phaseDetails[phaseId] ?? null
  );
  const error = usePlanningStore(
    (s) => s.projects[projectPath]?.error ?? null
  );
  const beadsTasks = usePlanningStore((s) => {
    const d = s.projects[projectPath]?.phaseDetails[phaseId];
    if (!d?.beadsEpic) return EMPTY_BEADS;
    return s.projects[projectPath]?.beadsTasks[d.beadsEpic] ?? EMPTY_BEADS;
  });

  useEffect(() => {
    fetchPhaseDetail(projectPath, phaseId);
  }, [projectPath, phaseId, fetchPhaseDetail]);

  // Fetch beads tasks when detail loads with an epic
  useEffect(() => {
    if (detail?.beadsEpic) {
      fetchBeadsTasks(projectPath, detail.beadsEpic);
    }
  }, [projectPath, detail?.beadsEpic, fetchBeadsTasks]);

  if (!detail && error) {
    return (
      <div className="p-4">
        <ErrorAlert
          message={`Failed to load phase detail: ${error}`}
          onRetry={() => fetchPhaseDetail(projectPath, phaseId)}
        />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="p-4 space-y-2">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  const doneTasks = detail.tasks.filter((t) => t.status === "done").length;
  const checkedCriteria = detail.completionCriteria.filter(
    (c) => c.checked
  ).length;

  return (
    <div className="p-4 space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <StatusBadge status={detail.status as PhaseSummary["status"]} />
          <span className="text-2xs font-mono text-foreground-muted">
            {detail.id}
          </span>
          {detail.beadsEpic && (
            <span className="text-2xs font-mono text-dracula-cyan">
              {detail.beadsEpic}
            </span>
          )}
        </div>
        <h2 className="text-lg font-semibold text-foreground mb-1">
          {detail.title}
        </h2>
        {detail.created && (
          <p className="text-2xs text-foreground-muted">
            Created {detail.created}
          </p>
        )}
      </div>

      {/* Objective */}
      {detail.objective && (
        <Section title="Objective">
          <p className="text-sm text-foreground-secondary leading-relaxed">
            {detail.objective}
          </p>
        </Section>
      )}

      {/* Tasks */}
      {detail.tasks.length > 0 && (
        <Section
          title={`Tasks (${doneTasks}/${detail.tasks.length})`}
        >
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-background-raised border-b border-border">
                  <th className="text-left px-3 py-2 text-2xs font-semibold text-foreground-muted uppercase tracking-wider">
                    ID
                  </th>
                  <th className="text-left px-3 py-2 text-2xs font-semibold text-foreground-muted uppercase tracking-wider">
                    Title
                  </th>
                  <th className="text-left px-3 py-2 text-2xs font-semibold text-foreground-muted uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left px-3 py-2 text-2xs font-semibold text-foreground-muted uppercase tracking-wider">
                    Size
                  </th>
                </tr>
              </thead>
              <tbody>
                {detail.tasks.map((task) => (
                  <TaskRow key={task.id} task={task} />
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* Completion Criteria */}
      {detail.completionCriteria.length > 0 && (
        <Section
          title={`Completion Criteria (${checkedCriteria}/${detail.completionCriteria.length})`}
        >
          <div className="space-y-1.5">
            {detail.completionCriteria.map((criterion, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                {criterion.checked ? (
                  <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
                ) : (
                  <Circle className="w-4 h-4 text-foreground-muted shrink-0 mt-0.5" />
                )}
                <span
                  className={
                    criterion.checked
                      ? "text-foreground-muted line-through"
                      : "text-foreground-secondary"
                  }
                >
                  {criterion.text}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Scope */}
      {(detail.scope.inScope.length > 0 ||
        detail.scope.outOfScope.length > 0) && (
        <CollapsibleSection title="Scope">
          {detail.scope.inScope.length > 0 && (
            <div className="mb-3">
              <p className="text-2xs font-semibold text-foreground-muted uppercase tracking-wider mb-1.5">
                In Scope
              </p>
              <ul className="space-y-1">
                {detail.scope.inScope.map((item, i) => (
                  <li
                    key={i}
                    className="text-sm text-foreground-secondary flex items-start gap-2"
                  >
                    <span className="text-dracula-green mt-1.5 shrink-0">
                      &bull;
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {detail.scope.outOfScope.length > 0 && (
            <div>
              <p className="text-2xs font-semibold text-foreground-muted uppercase tracking-wider mb-1.5">
                Out of Scope
              </p>
              <ul className="space-y-1">
                {detail.scope.outOfScope.map((item, i) => (
                  <li
                    key={i}
                    className="text-sm text-foreground-muted flex items-start gap-2"
                  >
                    <span className="text-foreground-muted/50 mt-1.5 shrink-0">
                      &bull;
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CollapsibleSection>
      )}

      {/* Technical Decisions */}
      {detail.decisions.length > 0 && (
        <CollapsibleSection title="Technical Decisions">
          <div className="space-y-3">
            {detail.decisions.map((d, i) => (
              <div
                key={i}
                className="p-3 rounded-lg border border-border bg-background-raised"
              >
                <p className="text-sm font-medium text-foreground mb-1">
                  {d.decision}
                </p>
                <p className="text-2xs text-dracula-cyan mb-1">{d.choice}</p>
                <p className="text-2xs text-foreground-muted">{d.rationale}</p>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
}

// ── Shared Components ────────────────────────────────────────────────────────

function TaskRow({ task }: { task: PhaseTask }) {
  return (
    <tr className="border-b border-border last:border-0 hover:bg-muted/20 transition-default">
      <td className="px-3 py-2 text-2xs font-mono text-foreground-muted whitespace-nowrap">
        {task.id}
      </td>
      <td className="px-3 py-2 text-sm text-foreground">
        {task.title}
        {task.dependsOn.length > 0 && (
          <span className="ml-1.5 text-2xs text-foreground-muted">
            (needs {task.dependsOn.join(", ")})
          </span>
        )}
      </td>
      <td className="px-3 py-2">
        <TaskStatusBadge status={task.status} />
      </td>
      <td className="px-3 py-2 text-2xs text-foreground-muted font-mono">
        {task.complexity}
      </td>
    </tr>
  );
}

function TaskStatusBadge({ status }: { status: PhaseTask["status"] }) {
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
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-muted/50 text-foreground-muted text-2xs">
          <Circle className="w-3 h-3" />
          Planned
        </span>
      );
  }
}

function StatusBadge({
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
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-warning/10 text-warning text-2xs">
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

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-2xs font-semibold uppercase tracking-widest text-foreground-muted mb-2.5">
        {title}
      </h3>
      {children}
    </div>
  );
}

function CollapsibleSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-widest text-foreground-muted hover:text-foreground-secondary transition-default mb-2"
      >
        <ChevronRight
          className={`w-3 h-3 transition-default ${open ? "rotate-90" : ""}`}
        />
        {title}
      </button>
      {open && <div className="animate-fade-in">{children}</div>}
    </div>
  );
}

function ErrorAlert({
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

function EmptyDashboard({ onAddProject }: { onAddProject: () => void }) {
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
        onClick={onAddProject}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-secondary/10 text-accent-secondary text-sm font-medium hover:bg-accent-secondary/15 transition-default"
      >
        <FolderOpen className="w-4 h-4" />
        Add Project
      </button>
    </div>
  );
}
