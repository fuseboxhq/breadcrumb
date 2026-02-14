import { X, Plus, Terminal, Sparkles } from "lucide-react";
import { useAppStore, type TabType } from "../../store/appStore";

const TAB_ICONS: Record<TabType, typeof Terminal> = {
  terminal: Terminal,
  browser: Terminal, // browser tabs no longer used in center
  breadcrumb: Terminal, // breadcrumb tabs no longer used in center
  welcome: Sparkles,
};

export function TabBar() {
  const tabs = useAppStore((s) => s.tabs);
  const activeTabId = useAppStore((s) => s.activeTabId);
  const { setActiveTab, removeTab, addTab } = useAppStore();

  const handleNewTerminal = () => {
    const id = `terminal-${Date.now()}`;
    addTab({
      id,
      type: "terminal",
      title: `Terminal ${tabs.filter((t) => t.type === "terminal").length + 1}`,
    });
  };

  return (
    <div className="h-9 bg-background flex items-end shrink-0 overflow-x-auto scrollbar-thin">
      {tabs.map((tab) => {
        const Icon = TAB_ICONS[tab.type];
        const isActive = tab.id === activeTabId;
        return (
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
              <div className="absolute top-0 left-1 right-1 h-[2px] rounded-b-full bg-primary" />
            )}

            <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-primary" : ""}`} />
            <span className="truncate">{tab.title}</span>

            {tab.type !== "welcome" && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeTab(tab.id);
                }}
                aria-label={`Close ${tab.title}`}
                className="ml-auto shrink-0 p-0.5 rounded hover:bg-muted/80 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-default"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </button>
        );
      })}

      <button
        onClick={handleNewTerminal}
        className="h-full px-2.5 flex items-center text-foreground-muted hover:text-foreground-secondary hover:bg-background-raised/50 transition-default shrink-0"
        title="New Terminal"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>

      {/* Fill remaining space */}
      <div className="flex-1 h-full border-b border-border/50" />
    </div>
  );
}
