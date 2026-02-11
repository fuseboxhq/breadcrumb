import { useAppStore } from "../../store/appStore";
import { TerminalPanel } from "../terminal/TerminalPanel";
import { Terminal, Globe, LayoutGrid, Sparkles } from "lucide-react";

export function WorkspaceContent() {
  const activeTab = useAppStore((s) =>
    s.tabs.find((t) => t.id === s.activeTabId)
  );

  if (!activeTab) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        No tab selected
      </div>
    );
  }

  switch (activeTab.type) {
    case "welcome":
      return <WelcomeView />;
    case "terminal":
      return <TerminalPanel tabId={activeTab.id} />;
    case "browser":
      return <BrowserPlaceholder url={activeTab.url} />;
    case "breadcrumb":
      return <BreadcrumbPlaceholder />;
    default:
      return null;
  }
}

function WelcomeView() {
  const { addTab } = useAppStore();

  const quickActions = [
    {
      icon: Terminal,
      label: "New Terminal",
      description: "Open a terminal session",
      action: () =>
        addTab({
          id: `terminal-${Date.now()}`,
          type: "terminal",
          title: "Terminal 1",
        }),
    },
    {
      icon: Globe,
      label: "Open Browser",
      description: "Browse the web or preview dev server",
      action: () =>
        addTab({
          id: `browser-${Date.now()}`,
          type: "browser",
          title: "Browser",
          url: "https://localhost:3000",
        }),
    },
    {
      icon: LayoutGrid,
      label: "Breadcrumb Planner",
      description: "View phases, tasks, and project status",
      action: () =>
        addTab({
          id: `breadcrumb-${Date.now()}`,
          type: "breadcrumb",
          title: "Planner",
        }),
    },
  ];

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="max-w-md text-center">
        <Sparkles className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
        <h1 className="text-xl font-bold mb-1">Breadcrumb IDE</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Planning, terminals, browser, and extensions in one place.
        </p>

        <div className="grid gap-3">
          {quickActions.map(({ icon: Icon, label, description, action }) => (
            <button
              key={label}
              onClick={action}
              className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors text-left"
            >
              <Icon className="w-5 h-5 text-muted-foreground shrink-0" />
              <div>
                <div className="text-sm font-medium">{label}</div>
                <div className="text-xs text-muted-foreground">{description}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}


function BrowserPlaceholder({ url }: { url?: string }) {
  return (
    <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
      <p>Browser: {url || "No URL"}</p>
    </div>
  );
}

function BreadcrumbPlaceholder() {
  return (
    <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
      <p>Breadcrumb planning panel</p>
    </div>
  );
}
