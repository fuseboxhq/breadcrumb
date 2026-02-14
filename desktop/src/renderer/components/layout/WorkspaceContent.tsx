import { useAppStore } from "../../store/appStore";
import { useProjectsStore } from "../../store/projectsStore";
import { TerminalPanel } from "../terminal/TerminalPanel";
import {
  Terminal,
  Sparkles,
  Zap,
  Command,
  ArrowRight,
  FolderOpen,
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

  const quickActions = [
    {
      icon: FolderOpen,
      label: "Open Project",
      description: projectCount > 0
        ? "Add another project to your workspace"
        : "Add a project folder to get started",
      shortcut: "⌘O",
      color: "text-dracula-orange",
      bgColor: "bg-dracula-orange/10",
      action: handleOpenProject,
    },
    {
      icon: Terminal,
      label: "New Terminal",
      description: activeProject
        ? `Open terminal in ${activeProject.name}`
        : "Open a terminal session",
      shortcut: "⌘T",
      color: "text-dracula-green",
      bgColor: "bg-dracula-green/10",
      action: () =>
        addTab({
          id: `terminal-${Date.now()}`,
          type: "terminal",
          title: activeProject ? activeProject.name : "Terminal",
          projectId: activeProject?.id,
        }),
    },
    {
      icon: Sparkles,
      label: "Breadcrumb Planner",
      description: "View phases, tasks, and project status",
      shortcut: "⌘⇧P",
      color: "text-dracula-purple",
      bgColor: "bg-dracula-purple/10",
      action: () => addRightPanelPane("planning"),
    },
  ];

  return (
    <div className="flex-1 flex items-center justify-center bg-background overflow-y-auto">
      <div className="max-w-lg w-full px-8 py-16 animate-fade-in-up">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-6 shadow-glow">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight mb-2">
            Welcome to Breadcrumb
          </h1>
          <p className="text-sm text-foreground-muted max-w-sm mx-auto leading-relaxed">
            Planning, terminals, browser, and extensions — all in one place.
          </p>
          {projectCount === 0 && (
            <p className="text-2xs text-foreground-muted/60 mt-3 max-w-xs mx-auto leading-relaxed">
              Start by opening a project folder. Each project gets its own terminals, planning data, and workspace context.
            </p>
          )}
        </div>

        {/* Quick Actions */}
        <div className="space-y-2 mb-10">
          <p className="text-2xs font-semibold uppercase tracking-widest text-foreground-muted px-1 mb-3">
            Quick Actions
          </p>
          {quickActions.map(
            ({ icon: Icon, label, description, shortcut, color, bgColor, action }) => (
              <button
                key={label}
                onClick={action}
                className="group w-full flex items-center gap-4 p-3.5 rounded-xl border border-border hover:border-border-strong hover:bg-background-raised transition-default text-left"
              >
                <div
                  className={`w-10 h-10 rounded-xl ${bgColor} flex items-center justify-center shrink-0 transition-default group-hover:scale-105`}
                >
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground group-hover:text-foreground">
                    {label}
                  </div>
                  <div className="text-2xs text-foreground-muted truncate">
                    {description}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <kbd className="hidden group-hover:inline-flex px-1.5 py-0.5 rounded bg-muted/50 text-foreground-muted text-2xs font-mono transition-default">
                    {shortcut}
                  </kbd>
                  <ArrowRight className="w-4 h-4 text-foreground-muted opacity-0 group-hover:opacity-100 transition-default -translate-x-1 group-hover:translate-x-0" />
                </div>
              </button>
            )
          )}
        </div>

        {/* Command palette hint */}
        <div className="text-center">
          <p className="text-2xs text-foreground-muted/60">
            Press{" "}
            <kbd className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-muted/40 text-foreground-muted text-2xs font-mono">
              <Command className="w-2.5 h-2.5" />K
            </kbd>{" "}
            to open the command palette
          </p>
        </div>
      </div>
    </div>
  );
}
