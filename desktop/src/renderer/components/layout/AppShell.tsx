import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { ActivityBar } from "./ActivityBar";
import { SidebarPanel } from "./SidebarPanel";
import { TitleBar } from "./TitleBar";
import { TabBar } from "./TabBar";
import { WorkspaceContent } from "./WorkspaceContent";
import { useAppStore } from "../../store/appStore";

export function AppShell() {
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed);

  return (
    <div className="flex flex-col h-screen dark">
      <TitleBar />

      <div className="flex flex-1 overflow-hidden">
        {/* Activity Bar (always visible) */}
        <ActivityBar />

        {/* Main Layout: Sidebar + Workspace */}
        <PanelGroup direction="horizontal" className="flex-1">
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
              <PanelResizeHandle className="w-px bg-border hover:bg-primary/50 transition-colors" />
            </>
          )}

          {/* Workspace */}
          <Panel id="workspace" order={2}>
            <div className="flex flex-col h-full">
              <TabBar />

              {/* Content area — will support further splits */}
              <PanelGroup direction="vertical" className="flex-1">
                <Panel id="editor" order={1}>
                  <WorkspaceContent />
                </Panel>
              </PanelGroup>
            </div>
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}
