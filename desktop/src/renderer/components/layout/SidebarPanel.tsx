import { useAppStore, type SidebarView } from "../../store/appStore";
import {
  FolderTree,
  Terminal,
  LayoutGrid,
  Globe,
  Puzzle,
  Settings,
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
    <div className="w-60 bg-card border-r border-border flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-9 px-4 flex items-center gap-2 border-b border-border shrink-0">
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
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
      return <ExtensionsPlaceholder />;
    case "settings":
      return <SettingsPlaceholder />;
  }
}

function ExplorerPlaceholder() {
  return (
    <div className="text-xs text-muted-foreground">
      <p className="mb-2">No project open.</p>
      <button className="text-primary hover:underline">Open folder...</button>
    </div>
  );
}

function TerminalsPlaceholder() {
  return (
    <div className="text-xs text-muted-foreground">
      <p>Terminal sessions will appear here.</p>
    </div>
  );
}

function BreadcrumbPlaceholder() {
  return (
    <div className="text-xs text-muted-foreground">
      <p className="mb-1 font-medium text-foreground">Phases</p>
      <p>Phase management will appear here.</p>
    </div>
  );
}

function BrowserPlaceholder() {
  return (
    <div className="text-xs text-muted-foreground">
      <p>Browser bookmarks and history.</p>
    </div>
  );
}

function ExtensionsPlaceholder() {
  return (
    <div className="text-xs text-muted-foreground">
      <p>Installed extensions will appear here.</p>
    </div>
  );
}

function SettingsPlaceholder() {
  return (
    <div className="text-xs text-muted-foreground">
      <p className="mb-1 font-medium text-foreground">Settings</p>
      <p>Application settings.</p>
    </div>
  );
}
