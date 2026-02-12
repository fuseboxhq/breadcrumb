import { useRef, useEffect, useCallback } from "react";
import { useGlobalLayoutHotkeys } from "../../hooks/useGlobalLayoutHotkeys";
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
  type ImperativePanelHandle,
  type ImperativePanelGroupHandle,
} from "react-resizable-panels";
import { ActivityBar } from "./ActivityBar";
import { SidebarPanel } from "./SidebarPanel";
import { TitleBar } from "./TitleBar";
import { TabBar } from "./TabBar";
import { WorkspaceContent } from "./WorkspaceContent";
import { RightPanel } from "./RightPanel";
import { StatusBar } from "./StatusBar";
import {
  useAppStore,
  useRightPanelOpen,
} from "../../store/appStore";
import { useSettingsLoaded, useLayoutSettings } from "../../store/settingsStore";

export function AppShell() {
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed);
  const rightPanelOpen = useRightPanelOpen();
  const settingsLoaded = useSettingsLoaded();
  const layoutSettings = useLayoutSettings();
  const rightPanelRef = useRef<ImperativePanelHandle>(null);
  const panelGroupRef = useRef<ImperativePanelGroupHandle>(null);
  const setPanelSizes = useAppStore((s) => s.setPanelSizes);
  const restoreLayout = useAppStore((s) => s.restoreLayout);
  const layoutRestoredRef = useRef(false);

  // Global hotkeys for right panel toggle and panel focus navigation
  useGlobalLayoutHotkeys();

  // Restore layout from persisted settings on mount
  useEffect(() => {
    if (!settingsLoaded || layoutRestoredRef.current) return;
    layoutRestoredRef.current = true;

    const savedPanelSizes = layoutSettings.panelSizes;
    const savedPanes = layoutSettings.rightPanel.panes.map((p) => ({
      id: p.id,
      type: p.type as "browser" | "planning",
    }));

    // Restore Zustand state
    restoreLayout({
      rightPanel: {
        isOpen: layoutSettings.rightPanel.isOpen,
        panes: savedPanes,
      },
      panelSizes: savedPanelSizes,
    });

    // Restore panel sizes imperatively (after a tick so PanelGroup is mounted)
    requestAnimationFrame(() => {
      if (panelGroupRef.current) {
        const sizes = sidebarCollapsed
          ? [savedPanelSizes.center, savedPanelSizes.rightPanel]
          : [savedPanelSizes.sidebar, savedPanelSizes.center, savedPanelSizes.rightPanel];
        try {
          panelGroupRef.current.setLayout(sizes);
        } catch {
          // Layout may not be compatible — use defaults
        }
      }
    });
  }, [settingsLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync imperative panel state when rightPanelOpen changes
  useEffect(() => {
    const panel = rightPanelRef.current;
    if (!panel) return;
    if (rightPanelOpen) {
      panel.expand();
    } else {
      panel.collapse();
    }
  }, [rightPanelOpen]);

  // Capture panel size changes for persistence
  const handleLayout = useCallback(
    (sizes: number[]) => {
      if (sidebarCollapsed) {
        // 2-panel mode: [center, rightPanel]
        setPanelSizes({
          sidebar: 0,
          center: sizes[0],
          rightPanel: sizes[1] ?? 0,
        });
      } else {
        // 3-panel mode: [sidebar, center, rightPanel]
        setPanelSizes({
          sidebar: sizes[0],
          center: sizes[1],
          rightPanel: sizes[2] ?? 0,
        });
      }
    },
    [sidebarCollapsed, setPanelSizes]
  );

  return (
    <div className="flex flex-col h-screen bg-background">
      <TitleBar />

      <div className="flex flex-1 overflow-hidden">
        {/* Activity Bar (always visible) */}
        <ActivityBar />

        {/* Main Layout: Sidebar + Center + Right Panel */}
        <PanelGroup
          ref={panelGroupRef}
          direction="horizontal"
          className="flex-1"
          onLayout={handleLayout}
        >
          {/* Sidebar Panel */}
          {!sidebarCollapsed && (
            <>
              <Panel
                defaultSize={18}
                minSize={12}
                maxSize={30}
                id="sidebar"
                order={1}
              >
                <SidebarPanel />
              </Panel>
              <PanelResizeHandle
                className="w-[3px] bg-transparent hover:bg-primary/30 active:bg-primary/50 transition-default group relative"
                aria-label="Resize sidebar"
              >
                <div className="absolute inset-y-0 left-[1px] w-px bg-border group-hover:bg-primary/40 transition-default" />
              </PanelResizeHandle>
            </>
          )}

          {/* Center — Terminal Workspace */}
          <Panel id="center" order={2} minSize={30}>
            <div className="flex flex-col h-full" role="region" aria-label="Terminal workspace">
              <TabBar />
              <WorkspaceContent />
            </div>
          </Panel>

          {/* Right Panel — Browser + Planning (collapsible) */}
          <PanelResizeHandle
            className="w-[3px] bg-transparent hover:bg-primary/30 active:bg-primary/50 transition-default group relative"
            aria-label="Resize right panel"
          >
            <div className="absolute inset-y-0 left-[1px] w-px bg-border group-hover:bg-primary/40 transition-default" />
          </PanelResizeHandle>
          <Panel
            id="right-panel"
            ref={rightPanelRef}
            order={3}
            collapsible
            defaultSize={0}
            minSize={20}
            collapsedSize={0}
            onCollapse={() => {
              const store = useAppStore.getState();
              if (store.layout.rightPanel.isOpen) {
                store.setRightPanelOpen(false);
              }
            }}
            onExpand={() => {
              const store = useAppStore.getState();
              if (!store.layout.rightPanel.isOpen) {
                store.setRightPanelOpen(true);
              }
            }}
          >
            <RightPanel />
          </Panel>
        </PanelGroup>
      </div>

      <StatusBar />
    </div>
  );
}
