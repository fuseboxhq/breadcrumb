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
import { DevToolsDock } from "../browser/DevToolsDock";
import {
  useAppStore,
  useRightPanelOpen,
  useDevToolsDockOpen,
} from "../../store/appStore";
import { useSettingsLoaded, useLayoutSettings, useWorkspaceSettings } from "../../store/settingsStore";
import { useProjectsStore } from "../../store/projectsStore";

export function AppShell() {
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed);
  const rightPanelOpen = useRightPanelOpen();
  const devToolsDockOpen = useDevToolsDockOpen();
  const settingsLoaded = useSettingsLoaded();
  const layoutSettings = useLayoutSettings();
  const workspaceSettings = useWorkspaceSettings();
  const sidebarRef = useRef<ImperativePanelHandle>(null);
  const rightPanelRef = useRef<ImperativePanelHandle>(null);
  const devToolsDockRef = useRef<ImperativePanelHandle>(null);
  const panelGroupRef = useRef<ImperativePanelGroupHandle>(null);
  const setPanelSizes = useAppStore((s) => s.setPanelSizes);
  const restoreLayout = useAppStore((s) => s.restoreLayout);
  const layoutRestoredRef = useRef(false);

  // Global hotkeys for right panel toggle and panel focus navigation
  useGlobalLayoutHotkeys();

  // Restore layout and workspace from persisted settings on mount
  useEffect(() => {
    if (!settingsLoaded || layoutRestoredRef.current) return;
    layoutRestoredRef.current = true;

    // Restore workspace state (tabs, panes, active project) BEFORE layout
    // Wrapped in try/catch to handle corrupt or partial workspace JSON gracefully
    try {
      const restoreWorkspace = useAppStore.getState().restoreWorkspace;
      if (workspaceSettings.tabs && Array.isArray(workspaceSettings.tabs) && workspaceSettings.tabs.length > 0) {
        restoreWorkspace({
          tabs: workspaceSettings.tabs
            .filter((t) => t.type === "terminal" || t.type === "welcome" || t.type === "browser")
            .map((t) => ({
              id: t.id,
              type: t.type as "terminal" | "welcome" | "browser",
              title: t.title,
              projectId: t.projectId,
              // Restore browser tab fields
              ...(t.type === "browser" ? { browserId: t.browserId, initialUrl: t.initialUrl } : {}),
            })),
          activeTabId: workspaceSettings.activeTabId ?? null,
          terminalPanes: workspaceSettings.terminalPanes ?? {},
          activeProjectId: workspaceSettings.activeProjectId ?? null,
        });

        // Restore active project in projectsStore (resolve by path since IDs are regenerated)
        if (workspaceSettings.activeProjectId && workspaceSettings.activeProjectId !== null) {
          const projectsState = useProjectsStore.getState();
          const savedPaths = (workspaceSettings as { projectPaths?: Record<string, string> }).projectPaths || {};
          const activeProjectPath = savedPaths[workspaceSettings.activeProjectId];
          if (activeProjectPath) {
            const matchedProject = projectsState.projects.find((p) => p.path === activeProjectPath);
            if (matchedProject) {
              projectsState.setActiveProject(matchedProject.id);
            }
          }
        }
      }
    } catch {
      // Corrupt workspace state — fall back to default (welcome tab).
      // initialState in appStore already provides the welcome tab.
      console.warn("[Breadcrumb] Failed to restore workspace, using defaults");
    }

    const savedPanelSizes = layoutSettings.panelSizes;
    const savedPanes = layoutSettings.rightPanel.panes.map((p) => ({
      id: p.id,
      type: p.type as "browser" | "planning",
    }));

    // Restore right panel browser tabs from persisted layout
    const savedBrowserTabs = layoutSettings.rightPanel.browserTabs || [];
    const savedActiveBrowserTabId = layoutSettings.rightPanel.activeBrowserTabId || null;

    // Restore Zustand state
    restoreLayout({
      rightPanel: {
        isOpen: layoutSettings.rightPanel.isOpen,
        panes: savedPanes,
        browserTabs: savedBrowserTabs.map((t, i) => ({
          id: t.id,
          // Fresh browserId — old WebContentsViews don't survive restart
          browserId: `rp-restored-${Date.now()}-${i}`,
          url: t.url,
          title: t.title,
        })),
        activeBrowserTabId: savedActiveBrowserTabId,
      },
      panelSizes: savedPanelSizes,
      devToolsDockOpen: false, // Always start with DevTools closed
    });

    // Restore panel sizes imperatively (after a tick so PanelGroup is mounted)
    requestAnimationFrame(() => {
      if (panelGroupRef.current) {
        try {
          panelGroupRef.current.setLayout([
            savedPanelSizes.sidebar,
            savedPanelSizes.center,
            savedPanelSizes.rightPanel,
          ]);
        } catch {
          // Layout may not be compatible — use defaults
        }
      }
    });
  }, [settingsLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync imperative sidebar panel state when sidebarCollapsed changes
  useEffect(() => {
    const panel = sidebarRef.current;
    if (!panel) return;
    if (sidebarCollapsed) {
      panel.collapse();
    } else {
      panel.expand();
    }
  }, [sidebarCollapsed]);

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

  // Sync imperative DevTools dock panel state
  useEffect(() => {
    const panel = devToolsDockRef.current;
    if (!panel) return;
    if (devToolsDockOpen) {
      panel.expand();
    } else {
      panel.collapse();
    }
  }, [devToolsDockOpen]);

  // Capture panel size changes for persistence
  const handleLayout = useCallback(
    (sizes: number[]) => {
      // Always 3-panel mode: [sidebar, center, rightPanel]
      setPanelSizes({
        sidebar: sizes[0] ?? 0,
        center: sizes[1] ?? 0,
        rightPanel: sizes[2] ?? 0,
      });
    },
    [setPanelSizes]
  );

  return (
    <div className="flex flex-col h-screen bg-background">
      <TitleBar />

      {/* Outer vertical PanelGroup: main content (top) + DevTools dock (bottom) */}
      <PanelGroup direction="vertical" className="flex-1 overflow-hidden">
        {/* Top panel: ActivityBar + 3-column horizontal layout */}
        <Panel defaultSize={100} minSize={30} id="main-content" order={1}>
          <div className="flex h-full overflow-hidden">
            {/* Activity Bar (always visible) */}
            <ActivityBar />

            {/* Main Layout: Sidebar + Center + Right Panel */}
            <PanelGroup
              ref={panelGroupRef}
              direction="horizontal"
              className="flex-1"
              onLayout={handleLayout}
            >
              {/* Sidebar Panel (always in DOM — visibility via imperative collapse/expand) */}
              <Panel
                ref={sidebarRef}
                defaultSize={18}
                minSize={12}
                maxSize={30}
                collapsible
                collapsedSize={0}
                id="sidebar"
                order={1}
                onCollapse={() => {
                  const store = useAppStore.getState();
                  if (!store.sidebarCollapsed) {
                    store.toggleSidebar();
                  }
                }}
                onExpand={() => {
                  const store = useAppStore.getState();
                  if (store.sidebarCollapsed) {
                    store.toggleSidebar();
                  }
                }}
              >
                <SidebarPanel />
              </Panel>
              <PanelResizeHandle
                className="w-[3px] bg-transparent hover:bg-accent/30 active:bg-accent/50 transition-default group relative"
                aria-label="Resize sidebar"
              >
                <div className="absolute inset-y-0 left-[1px] w-px bg-border group-hover:bg-accent/40 transition-default" />
              </PanelResizeHandle>

              {/* Center — Terminal Workspace */}
              <Panel id="center" order={2} minSize={30}>
                <div className="flex flex-col h-full" role="region" aria-label="Terminal workspace">
                  <TabBar />
                  <WorkspaceContent />
                </div>
              </Panel>

              {/* Right Panel — Browser + Planning (collapsible) */}
              <PanelResizeHandle
                className="w-[3px] bg-transparent hover:bg-accent/30 active:bg-accent/50 transition-default group relative"
                aria-label="Resize right panel"
              >
                <div className="absolute inset-y-0 left-[1px] w-px bg-border group-hover:bg-accent/40 transition-default" />
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
        </Panel>

        {/* DevTools dock resize handle */}
        <PanelResizeHandle
          className="h-[3px] bg-transparent hover:bg-accent/30 active:bg-accent/50 transition-default group relative"
          aria-label="Resize DevTools dock"
        >
          <div className="absolute inset-x-0 top-[1px] h-px bg-border group-hover:bg-accent/40 transition-default" />
        </PanelResizeHandle>

        {/* Bottom panel: DevTools dock (collapsible, starts collapsed) */}
        <Panel
          ref={devToolsDockRef}
          id="devtools-dock"
          order={2}
          defaultSize={0}
          minSize={15}
          collapsible
          collapsedSize={0}
          onCollapse={() => {
            const store = useAppStore.getState();
            if (store.layout.devToolsDockOpen) {
              store.toggleDevToolsDock();
            }
          }}
          onExpand={() => {
            const store = useAppStore.getState();
            if (!store.layout.devToolsDockOpen) {
              store.toggleDevToolsDock();
            }
          }}
        >
          <DevToolsDock />
        </Panel>
      </PanelGroup>

      <StatusBar />
    </div>
  );
}
