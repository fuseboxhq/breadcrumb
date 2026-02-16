import { X, Plus, Terminal, Zap, GitCompareArrows, Pin } from "lucide-react";
import { useAppStore, type TabType } from "../../store/appStore";
import { useProjectsStore } from "../../store/projectsStore";
import {
  ContextMenu,
  MenuItem,
  MenuSeparator,
} from "../shared/ContextMenu";

const TAB_ICONS: Record<TabType, typeof Terminal> = {
  terminal: Terminal,
  welcome: Zap,
  diff: GitCompareArrows,
};

export function TabBar() {
  const tabs = useAppStore((s) => s.tabs);
  const activeTabId = useAppStore((s) => s.activeTabId);
  const { setActiveTab, removeTab, addTab, pinDiffTab } = useAppStore();
  const activeProject = useProjectsStore((s) =>
    s.projects.find((p) => p.id === s.activeProjectId) || null
  );

  const handleNewTerminal = () => {
    const id = `terminal-${Date.now()}`;
    addTab({
      id,
      type: "terminal",
      title: activeProject ? activeProject.name : `Terminal ${tabs.filter((t) => t.type === "terminal").length + 1}`,
      projectId: activeProject?.id,
    });
  };

  return (
    <div className="h-9 bg-background flex items-end shrink-0 overflow-x-auto scrollbar-thin">
      {tabs.map((tab) => {
        const Icon = TAB_ICONS[tab.type];
        const isActive = tab.id === activeTabId;
        const isDiff = tab.type === "diff";
        const isUnpinned = isDiff && !tab.pinned;

        const tabButton = (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              group relative h-full px-3 flex items-center gap-2 text-xs shrink-0 max-w-48
              transition-default border-r border-border/50
              ${isActive
                ? "bg-background-raised text-foreground"
                : "text-foreground-muted hover:text-foreground-secondary hover:bg-background-raised/50"
              }
            `}
          >
            {/* Active tab indicator — accent underline at top */}
            {isActive && (
              <div className="absolute top-0 left-1 right-1 h-[2px] rounded-b-full bg-accent-secondary" />
            )}

            <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-accent-secondary" : ""}`} />
            <span className={`truncate ${isUnpinned ? "italic text-foreground-muted" : ""}`}>
              {tab.title}
            </span>

            {tab.type !== "welcome" && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeTab(tab.id);
                }}
                aria-label={`Close ${tab.title}`}
                className="ml-auto shrink-0 p-0.5 rounded hover:bg-muted/50 hover:text-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:outline-none transition-default"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </button>
        );

        // Wrap diff tabs with context menu
        if (isDiff) {
          return (
            <ContextMenu
              key={tab.id}
              content={
                <>
                  {!tab.pinned && (
                    <MenuItem
                      icon={<Pin className="w-3.5 h-3.5" />}
                      label="Pin Diff"
                      onSelect={() => pinDiffTab(tab.id)}
                    />
                  )}
                  {tab.pinned && (
                    <MenuItem
                      icon={<Pin className="w-3.5 h-3.5" />}
                      label="Pinned"
                      disabled
                    />
                  )}
                  <MenuSeparator />
                  <MenuItem
                    icon={<X className="w-3.5 h-3.5" />}
                    label="Close Diff"
                    destructive
                    onSelect={() => removeTab(tab.id)}
                  />
                </>
              }
            >
              {tabButton}
            </ContextMenu>
          );
        }

        return tabButton;
      })}

      <button
        onClick={handleNewTerminal}
        className="h-full px-2.5 flex items-center text-foreground-muted hover:text-foreground-secondary hover:bg-background-raised/50 transition-default shrink-0 focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:outline-none"
        title="New Terminal"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>

      {/* Fill remaining space */}
      <div className="flex-1 h-full border-b border-border/50" />
    </div>
  );
}
