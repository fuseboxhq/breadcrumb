import { useCallback } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import {
  useAppStore,
  useRightPanelPanes,
  useBrowserTabs,
  useActiveBrowserTabId,
  type RightPanelPaneType,
} from "../../store/appStore";
import { BrowserPanel } from "../browser/BrowserPanel";
import { PlanningPanel } from "../breadcrumb/PlanningPanel";
import { Globe, LayoutGrid, X, PanelRight, Plus } from "lucide-react";

const PANE_META: Record<RightPanelPaneType, { label: string; icon: typeof Globe; color: string }> = {
  browser: { label: "Browser", icon: Globe, color: "text-dracula-cyan" },
  planning: { label: "Planning", icon: LayoutGrid, color: "text-dracula-purple" },
};

export function RightPanel() {
  const panes = useRightPanelPanes();
  const removeRightPanelPane = useAppStore((s) => s.removeRightPanelPane);

  if (panes.length === 0) {
    return (
      <div
        className="h-full flex items-center justify-center bg-background"
        role="region"
        aria-label="Right panel"
      >
        <div className="text-center animate-fade-in">
          <div className="w-10 h-10 rounded-xl bg-muted/30 flex items-center justify-center mx-auto mb-3">
            <PanelRight className="w-5 h-5 text-foreground-muted" />
          </div>
          <p className="text-xs text-foreground-muted">Right panel</p>
          <p className="text-2xs text-foreground-muted/60 mt-1">
            Open browser or planning from the activity bar
          </p>
        </div>
      </div>
    );
  }

  // Single pane — full height, no split
  if (panes.length === 1) {
    const pane = panes[0];
    return (
      <div
        className="h-full flex flex-col bg-background"
        role="region"
        aria-label={`Right panel: ${PANE_META[pane.type].label}`}
      >
        <PaneHeader type={pane.type} onClose={() => removeRightPanelPane(pane.id)} />
        <div className="flex-1 overflow-hidden">
          <PaneContent type={pane.type} />
        </div>
      </div>
    );
  }

  // Multiple panes — nested vertical PanelGroup
  return (
    <PanelGroup
      direction="vertical"
      className="h-full bg-background"
      role="region"
      aria-label="Right panel"
    >
      {panes.map((pane, i) => (
        <RightPanelPaneSlot key={pane.id} index={i} total={panes.length}>
          <PaneHeader type={pane.type} onClose={() => removeRightPanelPane(pane.id)} />
          <div className="flex-1 overflow-hidden">
            <PaneContent type={pane.type} />
          </div>
        </RightPanelPaneSlot>
      ))}
    </PanelGroup>
  );
}

/** Wraps a pane in a resizable Panel with resize handles between them */
function RightPanelPaneSlot({
  index,
  total,
  children,
}: {
  index: number;
  total: number;
  children: React.ReactNode;
}) {
  return (
    <>
      {index > 0 && (
        <PanelResizeHandle
          className="h-[3px] bg-transparent hover:bg-accent-secondary/30 active:bg-accent-secondary/50 transition-default group relative"
          aria-label="Resize right panel panes"
        >
          <div className="absolute inset-x-0 top-[1px] h-px bg-border group-hover:bg-accent-secondary/40 transition-default" />
        </PanelResizeHandle>
      )}
      <Panel
        id={`rp-slot-${index}`}
        order={index + 1}
        defaultSize={100 / total}
        minSize={20}
      >
        <div className="h-full flex flex-col">{children}</div>
      </Panel>
    </>
  );
}

function PaneHeader({ type, onClose }: { type: RightPanelPaneType; onClose: () => void }) {
  const meta = PANE_META[type];
  const Icon = meta.icon;

  return (
    <div className="h-8 flex items-center justify-between px-2.5 bg-background-raised border-b border-border shrink-0">
      <div className="flex items-center gap-1.5">
        <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
        <span className="text-2xs font-medium text-foreground-secondary">{meta.label}</span>
      </div>
      <button
        onClick={onClose}
        className="p-1 rounded hover:bg-muted/50 text-foreground-muted hover:text-foreground-secondary transition-default focus:outline-none focus:ring-1 focus:ring-primary/40"
        title={`Close ${meta.label}`}
        aria-label={`Close ${meta.label} pane`}
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

function PaneContent({ type }: { type: RightPanelPaneType }) {
  switch (type) {
    case "browser":
      return <BrowserTabPane />;
    case "planning":
      return <PlanningPanel />;
    default:
      return null;
  }
}

/**
 * Multi-tab browser pane for the right panel.
 * Renders a tab bar + all BrowserPanel instances (only active one is visible).
 */
function BrowserTabPane() {
  const browserTabs = useBrowserTabs();
  const activeBrowserTabId = useActiveBrowserTabId();
  const { addBrowserTab, removeBrowserTab, setActiveBrowserTab, updateBrowserTab } = useAppStore();

  const handleAddTab = useCallback(() => {
    addBrowserTab();
  }, [addBrowserTab]);

  const handleCloseTab = useCallback((e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    removeBrowserTab(tabId);
  }, [removeBrowserTab]);

  if (browserTabs.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <button
          onClick={handleAddTab}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-foreground-muted hover:text-foreground-secondary hover:bg-muted/50 transition-default"
        >
          <Plus className="w-4 h-4" />
          Open browser tab
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Browser tab bar */}
      <div className="flex items-center bg-background border-b border-border shrink-0 min-h-[28px]">
        <div className="flex-1 flex items-center overflow-x-auto scrollbar-none">
          {browserTabs.map((tab) => {
            const isActive = tab.id === activeBrowserTabId;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveBrowserTab(tab.id)}
                className={`
                  group flex items-center gap-1.5 px-2.5 py-1 text-2xs whitespace-nowrap border-r border-border/50 max-w-[160px] shrink-0 transition-default
                  ${isActive
                    ? "bg-background-raised text-foreground-secondary"
                    : "text-foreground-muted hover:text-foreground-secondary hover:bg-muted/30"
                  }
                `}
                title={tab.url}
              >
                <Globe className="w-3 h-3 shrink-0 text-dracula-cyan/70" />
                <span className="truncate">{tab.title || "New Tab"}</span>
                {browserTabs.length > 1 && (
                  <X
                    className="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-100 transition-default hover:text-destructive"
                    onClick={(e) => handleCloseTab(e, tab.id)}
                  />
                )}
              </button>
            );
          })}
        </div>
        <button
          onClick={handleAddTab}
          className="p-1.5 mx-0.5 rounded text-foreground-muted hover:text-foreground-secondary hover:bg-muted/50 transition-default shrink-0"
          title="New browser tab"
          aria-label="New browser tab"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>

      {/* Browser panels — all mounted, only active visible */}
      <div className="flex-1 relative">
        {browserTabs.map((tab) => {
          const isActive = tab.id === activeBrowserTabId;
          return (
            <div
              key={tab.id}
              className={isActive ? "h-full" : "hidden"}
            >
              <BrowserPanel
                browserId={tab.browserId}
                initialUrl={tab.url}
                isVisible={isActive}
                onUrlChange={(url) => updateBrowserTab(tab.id, { url })}
                onTitleChange={(title) => updateBrowserTab(tab.id, { title })}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
