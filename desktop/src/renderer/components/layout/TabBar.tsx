import { X, Plus, Terminal, Globe, LayoutGrid, Sparkles } from "lucide-react";
import { useAppStore, type TabType } from "../../store/appStore";

const TAB_ICONS: Record<TabType, typeof Terminal> = {
  terminal: Terminal,
  browser: Globe,
  breadcrumb: LayoutGrid,
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
    <div className="h-9 bg-background border-b border-border flex items-center shrink-0 overflow-x-auto">
      {tabs.map((tab) => {
        const Icon = TAB_ICONS[tab.type];
        const isActive = tab.id === activeTabId;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              group h-full px-3 flex items-center gap-2 border-r border-border text-xs
              transition-colors shrink-0 max-w-44
              ${isActive
                ? "bg-card text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/30"
              }
            `}
          >
            <Icon className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{tab.title}</span>
            {tab.type !== "welcome" && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  removeTab(tab.id);
                }}
                className="ml-auto shrink-0 p-0.5 rounded hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </span>
            )}
          </button>
        );
      })}

      <button
        onClick={handleNewTerminal}
        className="h-full px-2 flex items-center text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors shrink-0"
        title="New Terminal"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
