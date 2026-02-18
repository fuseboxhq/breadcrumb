import { useEffect, useState } from "react";
import { GitBranch, Terminal, Puzzle, FolderOpen, PanelRight, Bug, Sun, Moon } from "lucide-react";
import { useAppStore, useRightPanelOpen, useRightPanelPanes, useDevToolsDockOpen } from "../../store/appStore";
import { useActiveProject, useProjectsStore } from "../../store/projectsStore";
import { useTheme, useSetTheme, type ThemePreference } from "../../store/settingsStore";

export function StatusBar() {
  const tabs = useAppStore((s) => s.tabs);
  const terminalCount = tabs.filter((t) => t.type === "terminal").length;
  const activeProject = useActiveProject();
  const projectCount = useProjectsStore((s) => s.projects.length);
  const rightPanelOpen = useRightPanelOpen();
  const rightPanelPanes = useRightPanelPanes();
  const toggleRightPanel = useAppStore((s) => s.toggleRightPanel);
  const devToolsDockOpen = useDevToolsDockOpen();
  const toggleDevToolsDock = useAppStore((s) => s.toggleDevToolsDock);
  const theme = useTheme();
  const setTheme = useSetTheme();

  // Fetch real git branch for active project
  const [gitBranch, setGitBranch] = useState<string | null>(null);
  useEffect(() => {
    if (!activeProject?.path) {
      setGitBranch(null);
      return;
    }
    let cancelled = false;
    window.breadcrumbAPI?.getGitInfo(activeProject.path).then((result) => {
      if (cancelled) return;
      if (result?.success && result.gitInfo?.isGitRepo) {
        setGitBranch(result.gitInfo.branch);
      } else {
        setGitBranch(null);
      }
    });
    return () => { cancelled = true; };
  }, [activeProject?.path]);

  // Fetch real extension count
  const [extensionCount, setExtensionCount] = useState(0);
  useEffect(() => {
    window.breadcrumbAPI?.getExtensions().then((exts) => {
      if (Array.isArray(exts)) setExtensionCount(exts.length);
    });
    const cleanup = window.breadcrumbAPI?.onExtensionsChanged(() => {
      window.breadcrumbAPI?.getExtensions().then((exts) => {
        if (Array.isArray(exts)) setExtensionCount(exts.length);
      });
    });
    return () => cleanup?.();
  }, []);

  return (
    <div className="h-6 bg-background-raised border-t border-border flex items-center justify-between px-3 shrink-0 select-none">
      {/* Left section */}
      <div className="flex items-center gap-3">
        {/* Git branch — only shown when active project is a git repo */}
        {gitBranch && (
          <StatusItem icon={GitBranch} label={gitBranch} color="text-dracula-purple" />
        )}

        {/* Active project */}
        {activeProject && (
          <StatusItem
            icon={FolderOpen}
            label={projectCount > 1 ? `${activeProject.name} (+${projectCount - 1})` : activeProject.name}
            color="text-dracula-cyan"
          />
        )}

        {/* Terminal count */}
        {terminalCount > 0 && (
          <StatusItem
            icon={Terminal}
            label={`${terminalCount} terminal${terminalCount !== 1 ? "s" : ""}`}
          />
        )}
      </div>

      {/* Right section */}
      <div className="flex items-center gap-3">
        {/* Right panel toggle */}
        <StatusItem
          icon={PanelRight}
          label={rightPanelOpen ? `${rightPanelPanes.length} pane${rightPanelPanes.length !== 1 ? "s" : ""}` : "Panel"}
          color={rightPanelOpen ? "text-accent-secondary" : undefined}
          onClick={toggleRightPanel}
        />

        {/* DevTools toggle */}
        <StatusItem
          icon={Bug}
          label="DevTools"
          color={devToolsDockOpen ? "text-dracula-orange" : undefined}
          onClick={toggleDevToolsDock}
        />

        {/* Theme toggle */}
        <StatusItem
          icon={theme === "dark" ? Moon : Sun}
          label={theme === "system" ? "System" : theme === "dark" ? "Dark" : "Light"}
          onClick={() => {
            const next: ThemePreference = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
            setTheme(next);
          }}
        />

        {/* Extensions — real count */}
        <StatusItem
          icon={Puzzle}
          label={`${extensionCount} extension${extensionCount !== 1 ? "s" : ""}`}
        />
      </div>
    </div>
  );
}

function StatusItem({
  icon: Icon,
  label,
  color,
  onClick,
}: {
  icon: typeof Terminal;
  label: string;
  color?: string;
  onClick?: () => void;
}) {
  // Render as span (non-interactive) when there's no click handler
  if (!onClick) {
    return (
      <span className="flex items-center gap-1 text-2xs text-foreground-muted">
        <Icon className={`w-3 h-3 ${color || ""}`} />
        <span>{label}</span>
      </span>
    );
  }

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 text-2xs text-foreground-muted hover:text-foreground-secondary hover:bg-muted/30 px-1.5 py-0.5 -mx-1.5 rounded transition-default focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:outline-none"
    >
      <Icon className={`w-3 h-3 ${color || ""}`} />
      <span>{label}</span>
    </button>
  );
}
