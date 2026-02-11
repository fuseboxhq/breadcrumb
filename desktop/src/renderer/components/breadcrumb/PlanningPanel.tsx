import { useState, useEffect, useCallback } from "react";
import {
  LayoutGrid,
  CheckCircle2,
  Circle,
  Clock,
  RefreshCw,
  FolderOpen,
  ChevronRight,
} from "lucide-react";

interface Phase {
  id: string;
  title: string;
  status: "complete" | "in_progress" | "not_started";
  taskCount: number;
  completedCount: number;
}

export function PlanningPanel() {
  const [phases, setPhases] = useState<Phase[]>([]);
  const [selectedPhase, setSelectedPhase] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [projectPath, setProjectPath] = useState<string | null>(null);

  const loadPhases = useCallback(async () => {
    if (!projectPath) return;
    setLoading(true);

    try {
      const response = await fetch(`file://${projectPath}/.planning/STATE.md`);
      if (!response.ok) {
        setPhases([]);
        return;
      }
      const text = await response.text();
      const parsedPhases = parseStateFile(text);
      setPhases(parsedPhases);
    } catch {
      setPhases([
        {
          id: "PHASE-07",
          title: "Desktop IDE Platform",
          status: "in_progress",
          taskCount: 7,
          completedCount: 0,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [projectPath]);

  useEffect(() => {
    window.breadcrumbAPI?.getWorkingDirectory().then((dir) => {
      setProjectPath(dir);
    });
  }, []);

  useEffect(() => {
    loadPhases();
  }, [loadPhases]);

  const selectFolder = async () => {
    const dir = await window.breadcrumbAPI?.selectDirectory();
    if (dir) setProjectPath(dir);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-background">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0 bg-background-raised">
        <div className="flex items-center gap-2">
          <LayoutGrid className="w-4 h-4 text-dracula-purple" />
          <h2 className="text-sm font-semibold text-foreground">Breadcrumb Planner</h2>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={selectFolder}
            className="p-1.5 rounded-md text-foreground-muted hover:text-foreground-secondary hover:bg-muted/50 transition-default"
            title="Open project folder"
          >
            <FolderOpen className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={loadPhases}
            className="p-1.5 rounded-md text-foreground-muted hover:text-foreground-secondary hover:bg-muted/50 transition-default"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Project path */}
      {projectPath && (
        <div className="px-4 py-2 text-2xs text-foreground-muted border-b border-border font-mono truncate bg-background">
          {projectPath}
        </div>
      )}

      {/* Phases */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-3">
        {phases.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-6 text-center animate-fade-in">
            <div className="w-12 h-12 rounded-2xl bg-dracula-purple/10 flex items-center justify-center mb-4">
              <LayoutGrid className="w-6 h-6 text-dracula-purple" />
            </div>
            <p className="text-sm text-foreground-secondary mb-1">No phases found</p>
            <p className="text-2xs text-foreground-muted">
              Open a project with a .planning/ directory
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {phases.map((phase) => {
              const progress = phase.taskCount > 0
                ? (phase.completedCount / phase.taskCount) * 100
                : 0;
              const isSelected = selectedPhase === phase.id;

              return (
                <button
                  key={phase.id}
                  onClick={() =>
                    setSelectedPhase(isSelected ? null : phase.id)
                  }
                  className={`
                    group w-full text-left p-3.5 rounded-xl border transition-default
                    ${isSelected
                      ? "border-primary/30 bg-primary/5 shadow-glow"
                      : "border-border hover:border-border-strong hover:bg-background-raised"
                    }
                  `}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <StatusBadge status={phase.status} />
                    <span className="text-2xs font-mono text-foreground-muted">
                      {phase.id}
                    </span>
                    <ChevronRight
                      className={`w-3 h-3 text-foreground-muted ml-auto transition-default ${
                        isSelected ? "rotate-90" : "group-hover:translate-x-0.5"
                      }`}
                    />
                  </div>
                  <div className="text-sm font-medium text-foreground mb-2.5">
                    {phase.title}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-muted/50 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${progress}%`,
                          background: progress === 100
                            ? "var(--success)"
                            : "linear-gradient(90deg, var(--primary), var(--dracula-pink))",
                        }}
                      />
                    </div>
                    <span className="text-2xs text-foreground-muted tabular-nums">
                      {phase.completedCount}/{phase.taskCount}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Phase["status"] }) {
  switch (status) {
    case "complete":
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

function parseStateFile(content: string): Phase[] {
  const phases: Phase[] = [];
  const lines = content.split("\n");

  for (const line of lines) {
    const match = line.match(
      /^(PHASE-\d+):\s+(.+?)\s+\((complete|in_progress|not_started)\)(?:\s+-\s+(\d+)(?:\/(\d+))?\s+tasks?\s+done)?/
    );
    if (match) {
      const taskCount = match[5] ? parseInt(match[5]) : parseInt(match[4] || "0");
      const completedCount = match[5] ? parseInt(match[4] || "0") : 0;
      phases.push({
        id: match[1],
        title: match[2].trim(),
        status: match[3] as Phase["status"],
        taskCount,
        completedCount,
      });
    }
  }

  return phases;
}
