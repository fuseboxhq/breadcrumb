import {
  Terminal,
  Globe,
  LayoutGrid,
  Puzzle,
  Settings,
  FolderTree,
} from "lucide-react";
import { useAppStore, useRightPanelPanes, type SidebarView } from "../../store/appStore";

// Views that toggle sidebar panels
const SIDEBAR_ITEMS: { view: SidebarView; icon: typeof Terminal; label: string }[] = [
  { view: "explorer", icon: FolderTree, label: "Explorer" },
  { view: "terminals", icon: Terminal, label: "Terminals" },
  { view: "extensions", icon: Puzzle, label: "Extensions" },
];

// Views that open in the right panel
const RIGHT_PANEL_ITEMS: { type: "browser" | "planning"; icon: typeof Terminal; label: string }[] = [
  { type: "planning", icon: LayoutGrid, label: "Breadcrumb" },
  { type: "browser", icon: Globe, label: "Browser" },
];

export function ActivityBar() {
  const sidebarView = useAppStore((s) => s.sidebarView);
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed);
  const rightPanelPanes = useRightPanelPanes();
  const { setSidebarView, addRightPanelPane, removeRightPanelPane } = useAppStore();

  return (
    <div className="w-12 bg-background border-r border-border flex flex-col items-center py-2 gap-0.5 shrink-0">
      {/* Sidebar toggle items */}
      {SIDEBAR_ITEMS.map(({ view, icon: Icon, label }) => {
        const isActive = sidebarView === view && !sidebarCollapsed;
        return (
          <ActivityButton
            key={view}
            icon={Icon}
            label={label}
            isActive={isActive}
            onClick={() => setSidebarView(view)}
          />
        );
      })}

      {/* Separator between sidebar and right-panel groups */}
      <div className="w-6 h-px bg-border my-1" />

      {/* Right panel launchers */}
      {RIGHT_PANEL_ITEMS.map(({ type, icon: Icon, label }) => {
        const isActive = rightPanelPanes.some((p) => p.type === type);
        return (
          <ActivityButton
            key={type}
            icon={Icon}
            label={label}
            isActive={isActive}
            onClick={() => {
              if (isActive) {
                // Toggle off: remove the pane
                const pane = rightPanelPanes.find((p) => p.type === type);
                if (pane) removeRightPanelPane(pane.id);
              } else {
                addRightPanelPane(type);
              }
            }}
          />
        );
      })}

      <div className="flex-1" />

      <ActivityButton
        icon={Settings}
        label="Settings"
        isActive={sidebarView === "settings" && !sidebarCollapsed}
        onClick={() => setSidebarView("settings")}
      />
    </div>
  );
}

function ActivityButton({
  icon: Icon,
  label,
  isActive,
  onClick,
}: {
  icon: typeof Terminal;
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <div className="relative group">
      <button
        onClick={onClick}
        className={`
          relative w-10 h-10 flex items-center justify-center rounded-lg transition-default
          ${isActive
            ? "text-accent bg-accent/10"
            : "text-foreground-muted hover:text-foreground-secondary hover:bg-background-raised"
          }
        `}
        aria-label={label}
      >
        <Icon className="w-5 h-5" />
        {/* Active indicator bar */}
        {isActive && (
          <div className="absolute left-0 top-2 bottom-2 w-[2px] rounded-r-full bg-accent" />
        )}
      </button>

      {/* Tooltip */}
      <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 rounded-md bg-background-overlay border border-border-strong text-xs text-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-default z-50 shadow-md">
        {label}
      </div>
    </div>
  );
}
