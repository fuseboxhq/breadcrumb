import { GitBranch, Terminal, Puzzle, Wifi, FolderOpen, PanelRight, Bug } from "lucide-react";
import { useAppStore, useRightPanelOpen, useRightPanelPanes, useDevToolsDockOpen } from "../../store/appStore";
import { useActiveProject, useProjectsStore } from "../../store/projectsStore";

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

  return (
    <div className="h-6 bg-background-raised border-t border-border flex items-center justify-between px-3 shrink-0 select-none">
      {/* Left section */}
      <div className="flex items-center gap-3">
        {/* Git branch */}
        <StatusItem icon={GitBranch} label="main" color="text-dracula-purple" />

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
          color={rightPanelOpen ? "text-primary" : undefined}
          onClick={toggleRightPanel}
        />

        {/* DevTools toggle */}
        <StatusItem
          icon={Bug}
          label="DevTools"
          color={devToolsDockOpen ? "text-dracula-orange" : undefined}
          onClick={toggleDevToolsDock}
        />

        {/* Extensions */}
        <StatusItem icon={Puzzle} label="0 extensions" />

        {/* Connection status */}
        <StatusItem icon={Wifi} label="Connected" color="text-success" />
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
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 text-2xs text-foreground-muted hover:text-foreground-secondary transition-default"
    >
      <Icon className={`w-3 h-3 ${color || ""}`} />
      <span>{label}</span>
    </button>
  );
}
