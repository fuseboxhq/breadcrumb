import { useState, useEffect, useCallback } from "react";
import {
  LayoutGrid,
  CheckCircle2,
  Circle,
  Clock,
  RefreshCw,
  FolderOpen,
} from "lucide-react";

interface Phase {
  id: string;
  title: string;
  status: "complete" | "in_progress" | "not_started";
  taskCount: number;
  completedCount: number;
}

interface Task {
  id: string;
  title: string;
  status: string;
  complexity: string;
}

export function PlanningPanel() {
  const [phases, setPhases] = useState<Phase[]>([]);
  const [selectedPhase, setSelectedPhase] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [projectPath, setProjectPath] = useState<string | null>(null);

  const loadPhases = useCallback(async () => {
    if (!projectPath) return;
    setLoading(true);

    try {
      // Read .planning/STATE.md to discover phases
      // This is a simplified reader — the full version would parse markdown tables
      const response = await fetch(`file://${projectPath}/.planning/STATE.md`);
      if (!response.ok) {
        setPhases([]);
        return;
      }
      const text = await response.text();
      const parsedPhases = parseStateFile(text);
      setPhases(parsedPhases);
    } catch {
      // File not accessible from renderer sandbox — show placeholder
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
    // Get working directory
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

  const StatusIcon = ({ status }: { status: Phase["status"] }) => {
    switch (status) {
      case "complete":
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case "in_progress":
        return <Clock className="w-4 h-4 text-yellow-500" />;
      default:
        return <Circle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <LayoutGrid className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Breadcrumb Planner</h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={selectFolder}
            className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title="Open project folder"
          >
            <FolderOpen className="w-4 h-4" />
          </button>
          <button
            onClick={loadPhases}
            className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Project path */}
      {projectPath && (
        <div className="px-4 py-2 text-xs text-muted-foreground border-b border-border truncate">
          {projectPath}
        </div>
      )}

      {/* Phases */}
      <div className="flex-1 overflow-y-auto p-3">
        {phases.length === 0 ? (
          <div className="text-center py-8">
            <LayoutGrid className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-1">No phases found</p>
            <p className="text-xs text-muted-foreground">
              Open a project with .planning/ directory
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {phases.map((phase) => (
              <button
                key={phase.id}
                onClick={() =>
                  setSelectedPhase(selectedPhase === phase.id ? null : phase.id)
                }
                className={`
                  w-full text-left p-3 rounded-lg border transition-colors
                  ${selectedPhase === phase.id
                    ? "border-primary/30 bg-accent/50"
                    : "border-border hover:bg-accent/30"
                  }
                `}
              >
                <div className="flex items-center gap-2 mb-1">
                  <StatusIcon status={phase.status} />
                  <span className="text-xs font-mono text-muted-foreground">
                    {phase.id}
                  </span>
                </div>
                <div className="text-sm font-medium mb-1">{phase.title}</div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary/70 rounded-full transition-all"
                      style={{
                        width: `${phase.taskCount > 0 ? (phase.completedCount / phase.taskCount) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {phase.completedCount}/{phase.taskCount}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function parseStateFile(content: string): Phase[] {
  const phases: Phase[] = [];
  const lines = content.split("\n");

  for (const line of lines) {
    // Match lines like: PHASE-07: Desktop IDE Platform (in_progress) - 7 tasks
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
