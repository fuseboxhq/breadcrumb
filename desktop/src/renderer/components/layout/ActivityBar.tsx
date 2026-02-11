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
    <div className="w-12 bg-background border-r border-border flex flex-col items-center py-2 gap-1">
      {ACTIVITY_ITEMS.map(({ view, icon: Icon, label }) => {
        const isActive = sidebarView === view && !sidebarCollapsed;
        return (
          <button
            key={view}
            onClick={() => setSidebarView(view)}
            className={`
              w-10 h-10 flex items-center justify-center rounded-md transition-colors
              ${isActive
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              }
            `}
            title={label}
          >
            <Icon className="w-5 h-5" />
          </button>
        );
      })}

      <div className="flex-1" />

      <button
        onClick={() => setSidebarView("settings")}
        className={`
          w-10 h-10 flex items-center justify-center rounded-md transition-colors
          ${sidebarView === "settings" && !sidebarCollapsed
            ? "bg-accent text-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
          }
        `}
        title="Settings"
      >
        <Settings className="w-5 h-5" />
      </button>
    </div>
  );
}
