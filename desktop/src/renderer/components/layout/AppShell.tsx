import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { ActivityBar } from "./ActivityBar";
import { SidebarPanel } from "./SidebarPanel";
import { TitleBar } from "./TitleBar";
import { TabBar } from "./TabBar";
import { WorkspaceContent } from "./WorkspaceContent";
import { StatusBar } from "./StatusBar";
import { useAppStore } from "../../store/appStore";

export function AppShell() {
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed);

  return (
    <div className="flex flex-col h-screen bg-background">
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
              <PanelResizeHandle className="w-[3px] bg-transparent hover:bg-primary/30 active:bg-primary/50 transition-default group relative">
                {/* Visible grab line */}
                <div className="absolute inset-y-0 left-[1px] w-px bg-border group-hover:bg-primary/40 transition-default" />
              </PanelResizeHandle>
            </>
          )}

          {/* Workspace */}
          <Panel id="workspace" order={2}>
            <div className="flex flex-col h-full">
              <TabBar />

              {/* Content area */}
              <PanelGroup direction="vertical" className="flex-1">
                <Panel id="editor" order={1}>
                  <WorkspaceContent />
                </Panel>
              </PanelGroup>
            </div>
          </Panel>
        </PanelGroup>
      </div>

      <StatusBar />
    </div>
  );
}
