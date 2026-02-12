import { useCallback, useEffect } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { TerminalInstance } from "./TerminalInstance";
import { useAppStore, useTabPanes } from "../../store/appStore";
import { Plus, SplitSquareVertical, Rows3, X, Terminal, FolderOpen } from "lucide-react";

interface TerminalPanelProps {
  tabId: string;
  workingDirectory?: string;
}

/** Extract folder name from an absolute path */
function folderName(cwd: string): string {
  const parts = cwd.replace(/\/+$/, "").split("/");
  return parts[parts.length - 1] || cwd;
}

export function TerminalPanel({ tabId, workingDirectory }: TerminalPanelProps) {
  // Read pane state from shared store
  const tabPaneState = useTabPanes(tabId);
  const panes = tabPaneState?.panes || [];
  const activePane = tabPaneState?.activePane || "pane-1";
  const splitDirection = tabPaneState?.splitDirection || "horizontal";

  // Store actions
  const initializeTabPanes = useAppStore((s) => s.initializeTabPanes);
  const storeAddPane = useAppStore((s) => s.addPane);
  const storeRemovePane = useAppStore((s) => s.removePane);
  const storeSetActivePane = useAppStore((s) => s.setActivePane);
  const storeToggleSplitDirection = useAppStore((s) => s.toggleSplitDirection);
  const storeUpdatePaneCwd = useAppStore((s) => s.updatePaneCwd);
  const updateTab = useAppStore((s) => s.updateTab);

  // Initialize panes on mount (idempotent)
  useEffect(() => {
    initializeTabPanes(tabId, workingDirectory);
  }, [tabId, workingDirectory, initializeTabPanes]);

  // When active pane's CWD changes, update the tab title
  const handleCwdChange = useCallback((paneId: string, cwd: string) => {
    storeUpdatePaneCwd(tabId, paneId, cwd);
    // Read current active pane from store to avoid stale closures
    const currentActivePane = useAppStore.getState().terminalPanes[tabId]?.activePane;
    if (paneId === currentActivePane) {
      updateTab(tabId, { title: folderName(cwd) });
    }
  }, [tabId, storeUpdatePaneCwd, updateTab]);

  // When active pane switches, update tab title to that pane's CWD
  useEffect(() => {
    const pane = panes.find((p) => p.id === activePane);
    if (pane?.cwd) {
      updateTab(tabId, { title: folderName(pane.cwd) });
    }
  }, [activePane, panes, tabId, updateTab]);

  const addPane = useCallback((direction?: "horizontal" | "vertical") => {
    storeAddPane(tabId, direction);
  }, [tabId, storeAddPane]);

  const removePane = useCallback((paneId: string) => {
    storeRemovePane(tabId, paneId);
  }, [tabId, storeRemovePane]);

  const setActivePane = useCallback((paneId: string) => {
    storeSetActivePane(tabId, paneId);
  }, [tabId, storeSetActivePane]);

  const toggleDirection = useCallback(() => {
    storeToggleSplitDirection(tabId);
  }, [tabId, storeToggleSplitDirection]);

  // Navigate to adjacent pane
  const navigatePane = useCallback((direction: "next" | "prev") => {
    const currentPanes = useAppStore.getState().terminalPanes[tabId]?.panes || [];
    const currentActive = useAppStore.getState().terminalPanes[tabId]?.activePane;
    const currentIndex = currentPanes.findIndex((p) => p.id === currentActive);
    if (currentIndex === -1) return;
    let nextIndex: number;
    if (direction === "next") {
      nextIndex = (currentIndex + 1) % currentPanes.length;
    } else {
      nextIndex = (currentIndex - 1 + currentPanes.length) % currentPanes.length;
    }
    storeSetActivePane(tabId, currentPanes[nextIndex].id);
  }, [tabId, storeSetActivePane]);

  // Navigate to specific pane by number
  const navigateToPaneNumber = useCallback((num: number) => {
    const currentPanes = useAppStore.getState().terminalPanes[tabId]?.panes || [];
    const index = num - 1;
    if (index >= 0 && index < currentPanes.length) {
      storeSetActivePane(tabId, currentPanes[index].id);
    }
  }, [tabId, storeSetActivePane]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;

      // Cmd+D — split horizontal
      if (meta && !e.shiftKey && e.key === "d") {
        e.preventDefault();
        addPane("horizontal");
        return;
      }

      // Cmd+Shift+D — split vertical
      if (meta && e.shiftKey && e.key === "D") {
        e.preventDefault();
        addPane("vertical");
        return;
      }

      // Cmd+W — close pane (only if multiple panes)
      if (meta && e.key === "w") {
        const currentPanes = useAppStore.getState().terminalPanes[tabId]?.panes || [];
        const currentActive = useAppStore.getState().terminalPanes[tabId]?.activePane;
        if (currentPanes.length > 1 && currentActive) {
          e.preventDefault();
          removePane(currentActive);
          return;
        }
      }

      // Cmd+Option+Right/Left — navigate between panes
      if (meta && e.altKey && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
        e.preventDefault();
        navigatePane(e.key === "ArrowRight" ? "next" : "prev");
        return;
      }

      // Cmd+1-9 — switch to pane by number
      if (meta && !e.shiftKey && !e.altKey) {
        const num = parseInt(e.key);
        if (num >= 1 && num <= 9) {
          e.preventDefault();
          navigateToPaneNumber(num);
          return;
        }
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [tabId, addPane, removePane, navigatePane, navigateToPaneNumber]);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Terminal toolbar */}
      <div className="h-8 flex items-center justify-between px-2 bg-background-raised border-b border-border shrink-0">
        <div className="flex items-center gap-0.5">
          {panes.map((pane, index) => {
            const label = pane.cwd ? folderName(pane.cwd) : `${index + 1}`;
            return (
              <button
                key={pane.id}
                onClick={() => setActivePane(pane.id)}
                className={`
                  group px-2 py-0.5 text-2xs rounded-md transition-default flex items-center gap-1.5 max-w-32
                  ${activePane === pane.id
                    ? "bg-primary/10 text-primary"
                    : "text-foreground-muted hover:text-foreground-secondary hover:bg-muted/50"
                  }
                `}
              >
                {pane.cwd ? <FolderOpen className="w-3 h-3 shrink-0" /> : <Terminal className="w-3 h-3 shrink-0" />}
                <span className="truncate">{label}</span>
                {panes.length > 1 && (
                  <X
                    className="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-100 transition-default hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      removePane(pane.id);
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-0.5">
          <button
            onClick={toggleDirection}
            className="p-1 text-foreground-muted hover:text-foreground-secondary hover:bg-muted/50 rounded-md transition-default"
            title={`Split ${splitDirection === "horizontal" ? "vertically" : "horizontally"} (⌘${splitDirection === "horizontal" ? "⇧D" : "D"})`}
          >
            {splitDirection === "horizontal" ? (
              <SplitSquareVertical className="w-3.5 h-3.5" />
            ) : (
              <Rows3 className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            onClick={() => addPane()}
            className="p-1 text-foreground-muted hover:text-foreground-secondary hover:bg-muted/50 rounded-md transition-default"
            title="Split terminal (⌘D)"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal panes */}
      <div className="flex-1 min-h-0">
        {panes.length === 1 ? (
          <TerminalInstance
            sessionId={panes[0].sessionId}
            isActive={true}
            workingDirectory={workingDirectory}
            onCwdChange={(cwd) => handleCwdChange(panes[0].id, cwd)}
          />
        ) : (
          <PanelGroup direction={splitDirection}>
            {panes.map((pane, index) => (
              <div key={pane.id} className="contents">
                {index > 0 && (
                  <PanelResizeHandle
                    className={`
                      group relative transition-default
                      ${splitDirection === "horizontal"
                        ? "w-[3px] bg-transparent hover:bg-primary/30 active:bg-primary/50"
                        : "h-[3px] bg-transparent hover:bg-primary/30 active:bg-primary/50"
                      }
                    `}
                  >
                    <div
                      className={`absolute transition-default ${
                        splitDirection === "horizontal"
                          ? "inset-y-0 left-[1px] w-px bg-border group-hover:bg-primary/40"
                          : "inset-x-0 top-[1px] h-px bg-border group-hover:bg-primary/40"
                      }`}
                    />
                  </PanelResizeHandle>
                )}
                <Panel minSize={10}>
                  <div
                    className={`h-full transition-default ${
                      activePane === pane.id
                        ? "ring-1 ring-primary/20 rounded-sm"
                        : panes.length > 1 ? "opacity-90 hover:opacity-100" : ""
                    }`}
                    onClick={() => setActivePane(pane.id)}
                  >
                    <TerminalInstance
                      sessionId={pane.sessionId}
                      isActive={activePane === pane.id}
                      workingDirectory={workingDirectory}
                      onCwdChange={(cwd) => handleCwdChange(pane.id, cwd)}
                    />
                  </div>
                </Panel>
              </div>
            ))}
          </PanelGroup>
        )}
      </div>
    </div>
  );
}
