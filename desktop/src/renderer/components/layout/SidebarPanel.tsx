import { useAppStore, type SidebarView } from "../../store/appStore";
import { useProjectsStore, useActiveProject } from "../../store/projectsStore";
import { ExtensionsPanel } from "../extensions/ExtensionsPanel";
import {
  FolderTree,
  Terminal,
  LayoutGrid,
  Globe,
  Puzzle,
  Settings,
  FolderOpen,
  Plus,
  ChevronRight,
} from "lucide-react";

const VIEW_TITLES: Record<SidebarView, { label: string; icon: typeof Terminal }> = {
  explorer: { label: "Explorer", icon: FolderTree },
  terminals: { label: "Terminals", icon: Terminal },
  breadcrumb: { label: "Breadcrumb", icon: LayoutGrid },
  browser: { label: "Browser", icon: Globe },
  extensions: { label: "Extensions", icon: Puzzle },
  settings: { label: "Settings", icon: Settings },
};

export function SidebarPanel() {
  const sidebarView = useAppStore((s) => s.sidebarView);
  const collapsed = useAppStore((s) => s.sidebarCollapsed);

  if (collapsed) return null;

  const { label, icon: Icon } = VIEW_TITLES[sidebarView];

  return (
    <div className="h-full bg-background-raised flex flex-col overflow-hidden animate-slide-in-right">
      {/* Header */}
      <div className="h-9 px-4 flex items-center gap-2 border-b border-border shrink-0">
        <Icon className="w-3.5 h-3.5 text-foreground-muted" />
        <span className="text-2xs font-semibold uppercase tracking-widest text-foreground-muted">
          {label}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <SidebarContent view={sidebarView} />
      </div>
    </div>
  );
}

function SidebarContent({ view }: { view: SidebarView }) {
  switch (view) {
    case "explorer":
      return <ExplorerView />;
    case "terminals":
      return <TerminalsView />;
    case "breadcrumb":
      return <BreadcrumbPlaceholder />;
    case "browser":
      return <BrowserPlaceholder />;
    case "extensions":
      return <ExtensionsPanel />;
    case "settings":
      return <SettingsPlaceholder />;
  }
}

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: typeof Terminal;
  title: string;
  description: string;
  action?: { label: string; onClick?: () => void };
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-12 text-center">
      <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center mb-3">
        <Icon className="w-5 h-5 text-foreground-muted" />
      </div>
      <p className="text-sm text-foreground-secondary mb-1">{title}</p>
      <p className="text-2xs text-foreground-muted mb-4">{description}</p>
      {action && (
        <button className="text-2xs text-primary hover:text-primary/80 transition-default font-medium">
          {action.label}
        </button>
      )}
    </div>
  );
}

function ExplorerView() {
  const projects = useProjectsStore((s) => s.projects);
  const activeProject = useActiveProject();
  const { addProject, setActiveProject } = useProjectsStore();
  const { addTab } = useAppStore();

  const handleAddProject = async () => {
    const dir = await window.breadcrumbAPI?.selectDirectory();
    if (dir) addProject(dir);
  };

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 py-12 text-center">
        <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center mb-3">
          <FolderOpen className="w-5 h-5 text-foreground-muted" />
        </div>
        <p className="text-sm text-foreground-secondary mb-1">No projects open</p>
        <p className="text-2xs text-foreground-muted mb-4">
          Add a project folder to get started
        </p>
        <button
          onClick={handleAddProject}
          className="text-2xs text-primary hover:text-primary/80 transition-default font-medium"
        >
          Open Folder...
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Project list */}
      <div className="flex-1 overflow-y-auto scrollbar-thin py-1">
        {projects.map((project) => {
          const isActive = project.id === activeProject?.id;
          return (
            <div key={project.id} className="px-2 mb-1">
              <button
                onClick={() => setActiveProject(project.id)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-default ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-foreground-secondary hover:bg-muted/50"
                }`}
              >
                <ChevronRight className={`w-3 h-3 shrink-0 transition-default ${isActive ? "rotate-90" : ""}`} />
                <FolderOpen className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-primary" : "text-foreground-muted"}`} />
                <span className="text-sm font-medium truncate">{project.name}</span>
                <span className="text-2xs text-foreground-muted ml-auto tabular-nums">
                  {project.terminalSessions.length}
                </span>
              </button>
              {isActive && (
                <div className="ml-7 mt-1 space-y-0.5">
                  <button
                    onClick={() =>
                      addTab({
                        id: `terminal-${Date.now()}`,
                        type: "terminal",
                        title: project.name,
                        projectId: project.id,
                      })
                    }
                    className="w-full flex items-center gap-2 px-2 py-1 rounded-md text-left text-2xs text-foreground-muted hover:text-foreground-secondary hover:bg-muted/50 transition-default"
                  >
                    <Terminal className="w-3 h-3" />
                    <span>New Terminal</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add project footer */}
      <div className="border-t border-border p-2 shrink-0">
        <button
          onClick={handleAddProject}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-foreground-muted hover:text-foreground-secondary hover:bg-muted/50 transition-default"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="text-2xs">Add Project</span>
        </button>
      </div>
    </div>
  );
}

function TerminalsView() {
  const tabs = useAppStore((s) => s.tabs);
  const { setActiveTab } = useAppStore();
  const projects = useProjectsStore((s) => s.projects);
  const terminalTabs = tabs.filter((t) => t.type === "terminal");

  if (terminalTabs.length === 0) {
    return (
      <EmptyState
        icon={Terminal}
        title="No terminals"
        description="Terminal sessions will appear here"
      />
    );
  }

  // Group terminals by project
  const grouped = new Map<string | null, typeof terminalTabs>();
  for (const tab of terminalTabs) {
    const key = tab.projectId || null;
    const list = grouped.get(key) || [];
    list.push(tab);
    grouped.set(key, list);
  }

  return (
    <div className="py-1">
      {Array.from(grouped.entries()).map(([projectId, groupTabs]) => {
        const project = projectId ? projects.find((p) => p.id === projectId) : null;
        return (
          <div key={projectId || "ungrouped"} className="mb-2">
            <div className="px-4 py-1 text-2xs font-semibold uppercase tracking-widest text-foreground-muted">
              {project?.name || "General"}
            </div>
            {groupTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="w-full flex items-center gap-2 px-4 py-1.5 text-left text-sm text-foreground-secondary hover:bg-muted/50 transition-default"
              >
                <Terminal className="w-3.5 h-3.5 text-foreground-muted" />
                <span className="truncate">{tab.title}</span>
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function BreadcrumbPlaceholder() {
  return (
    <EmptyState
      icon={LayoutGrid}
      title="Planning"
      description="Phase management will appear here"
    />
  );
}

function BrowserPlaceholder() {
  return (
    <EmptyState
      icon={Globe}
      title="Browser"
      description="Bookmarks and history"
    />
  );
}

function SettingsPlaceholder() {
  return (
    <EmptyState
      icon={Settings}
      title="Settings"
      description="Application preferences"
    />
  );
}
