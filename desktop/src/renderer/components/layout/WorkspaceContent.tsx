import { useAppStore } from "../../store/appStore";
import { useProjectsStore } from "../../store/projectsStore";
import { TerminalPanel } from "../terminal/TerminalPanel";
import {
  Terminal,
  Zap,
  Command,
  FolderOpen,
  LayoutGrid,
} from "lucide-react";

export function WorkspaceContent() {
  const activeTab = useAppStore((s) =>
    s.tabs.find((t) => t.id === s.activeTabId)
  );
  const projects = useProjectsStore((s) => s.projects);

  if (!activeTab) {
    return <EmptyWorkspace />;
  }

  // Resolve project working directory for terminal tabs
  const projectDir = activeTab.projectId
    ? projects.find((p) => p.id === activeTab.projectId)?.path
    : undefined;

  switch (activeTab.type) {
    case "welcome":
      return <WelcomeView />;
    case "terminal":
      return <TerminalPanel tabId={activeTab.id} workingDirectory={projectDir} />;
    default:
      return <EmptyWorkspace />;
  }
}

function EmptyWorkspace() {
  return (
    <div className="flex-1 flex items-center justify-center bg-background">
      <div className="text-center animate-fade-in">
        <div className="w-12 h-12 rounded-2xl bg-muted/30 flex items-center justify-center mx-auto mb-4">
          <Zap className="w-6 h-6 text-foreground-muted" />
        </div>
        <p className="text-sm text-foreground-muted">No tab selected</p>
        <p className="text-2xs text-foreground-muted/60 mt-1">
          Open a tab from the activity bar or press{" "}
          <kbd className="px-1.5 py-0.5 rounded bg-muted/50 text-foreground-secondary text-2xs font-mono">
            ⌘K
          </kbd>
        </p>
      </div>
    </div>
  );
}

function WelcomeView() {
  const { addTab, addRightPanelPane } = useAppStore();
  const { addProject } = useProjectsStore();
  const activeProject = useProjectsStore((s) =>
    s.projects.find((p) => p.id === s.activeProjectId) || null
  );
  const projectCount = useProjectsStore((s) => s.projects.length);

  const handleOpenProject = async () => {
    const dir = await window.breadcrumbAPI?.selectDirectory();
    if (dir) addProject(dir);
  };

  return (
    <div className="flex-1 flex items-center justify-center bg-background overflow-y-auto">
      <div className="max-w-md w-full px-8 py-16 animate-fade-in-up">
        {/* Wordmark */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-1 h-8 rounded-full bg-accent-secondary" />
            <h1 className="text-xl font-semibold text-foreground tracking-tight">
              Breadcrumb
            </h1>
          </div>
          <p className="text-sm text-foreground-secondary leading-relaxed">
            {projectCount === 0
              ? "Open a project folder to begin. Each project gets its own terminals, planning data, and context."
              : `${projectCount} project${projectCount !== 1 ? "s" : ""} in workspace. Open a terminal or start planning.`
            }
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-1 mb-12">
          <WelcomeAction
            icon={FolderOpen}
            label="Open project"
            shortcut="⌘O"
            onClick={handleOpenProject}
          />
          <WelcomeAction
            icon={Terminal}
            label={activeProject ? `Terminal in ${activeProject.name}` : "New terminal"}
            shortcut="⌘T"
            onClick={() =>
              addTab({
                id: `terminal-${Date.now()}`,
                type: "terminal",
                title: activeProject ? activeProject.name : "Terminal",
                projectId: activeProject?.id,
              })
            }
          />
          <WelcomeAction
            icon={LayoutGrid}
            label="Breadcrumb planner"
            shortcut="⌘⇧P"
            onClick={() => addRightPanelPane("planning")}
          />
        </div>

        {/* Keyboard hint */}
        <p className="text-2xs text-foreground-muted">
          <kbd className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-muted/40 text-foreground-muted text-2xs font-mono mr-1.5">
            <Command className="w-2.5 h-2.5" />K
          </kbd>
          Command palette
        </p>
      </div>
    </div>
  );
}

function WelcomeAction({
  icon: Icon,
  label,
  shortcut,
  onClick,
}: {
  icon: typeof Terminal;
  label: string;
  shortcut: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group w-full flex items-center gap-3 px-3 py-2.5 -mx-3 rounded-lg text-left transition-default hover:bg-background-raised"
    >
      <Icon className="w-4 h-4 text-foreground-muted shrink-0 group-hover:text-accent-secondary transition-default" />
      <span className="flex-1 text-sm text-foreground-secondary group-hover:text-foreground transition-default">
        {label}
      </span>
      <kbd className="text-2xs text-foreground-muted/60 font-mono opacity-0 group-hover:opacity-100 transition-default">
        {shortcut}
      </kbd>
    </button>
  );
}
