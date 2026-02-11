import {
  Terminal,
  Globe,
  LayoutGrid,
  Puzzle,
  Settings,
  FolderTree,
} from "lucide-react";
import { useAppStore, type SidebarView } from "../../store/appStore";

const ACTIVITY_ITEMS: { view: SidebarView; icon: typeof Terminal; label: string }[] = [
  { view: "explorer", icon: FolderTree, label: "Explorer" },
  { view: "terminals", icon: Terminal, label: "Terminals" },
  { view: "breadcrumb", icon: LayoutGrid, label: "Breadcrumb" },
  { view: "browser", icon: Globe, label: "Browser" },
  { view: "extensions", icon: Puzzle, label: "Extensions" },
];

export function ActivityBar() {
  const sidebarView = useAppStore((s) => s.sidebarView);
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed);
  const { setSidebarView } = useAppStore();

  return (
    <div className="w-12 bg-background border-r border-border flex flex-col items-center py-2 gap-0.5 shrink-0">
      {ACTIVITY_ITEMS.map(({ view, icon: Icon, label }) => {
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
            ? "text-primary bg-primary/10 shadow-glow"
            : "text-foreground-muted hover:text-foreground-secondary hover:bg-background-raised"
          }
        `}
        aria-label={label}
      >
        <Icon className="w-[18px] h-[18px]" />
        {/* Active indicator bar */}
        {isActive && (
          <div className="absolute left-0 top-2 bottom-2 w-[2px] rounded-r-full bg-primary" />
        )}
      </button>

      {/* Tooltip */}
      <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 rounded-md bg-background-overlay border border-border-strong text-xs text-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-default z-50 shadow-md">
        {label}
      </div>
    </div>
  );
}
