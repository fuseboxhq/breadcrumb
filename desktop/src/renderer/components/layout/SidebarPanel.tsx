import { useAppStore, type SidebarView } from "../../store/appStore";
import { ExtensionsPanel } from "../extensions/ExtensionsPanel";
import {
  FolderTree,
  Terminal,
  LayoutGrid,
  Globe,
  Puzzle,
  Settings,
  FolderOpen,
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
      return <ExplorerPlaceholder />;
    case "terminals":
      return <TerminalsPlaceholder />;
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

function ExplorerPlaceholder() {
  return (
    <EmptyState
      icon={FolderOpen}
      title="No project open"
      description="Open a folder to browse files"
      action={{ label: "Open Folder..." }}
    />
  );
}

function TerminalsPlaceholder() {
  return (
    <EmptyState
      icon={Terminal}
      title="No terminals"
      description="Terminal sessions will appear here"
    />
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
