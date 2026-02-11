import { useState, useCallback } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { TerminalInstance } from "./TerminalInstance";
import { Plus, SplitSquareVertical, X, Terminal } from "lucide-react";

interface TerminalPane {
  id: string;
  sessionId: string;
}

interface TerminalPanelProps {
  tabId: string;
}

export function TerminalPanel({ tabId }: TerminalPanelProps) {
  const [panes, setPanes] = useState<TerminalPane[]>([
    { id: "pane-1", sessionId: `${tabId}-1` },
  ]);
  const [activePane, setActivePane] = useState("pane-1");
  const [splitDirection, setSplitDirection] = useState<"horizontal" | "vertical">("horizontal");

  const addPane = useCallback(() => {
    const id = `pane-${Date.now()}`;
    const sessionId = `${tabId}-${Date.now()}`;
    setPanes((prev) => [...prev, { id, sessionId }]);
    setActivePane(id);
  }, [tabId]);

  const removePane = useCallback((paneId: string) => {
    setPanes((prev) => {
      const next = prev.filter((p) => p.id !== paneId);
      if (next.length === 0) return prev;
      return next;
    });
    setActivePane((prev) => {
      if (prev === paneId) {
        const remaining = panes.filter((p) => p.id !== paneId);
        return remaining[remaining.length - 1]?.id || panes[0].id;
      }
      return prev;
    });
  }, [panes]);

  const toggleDirection = useCallback(() => {
    setSplitDirection((d) => (d === "horizontal" ? "vertical" : "horizontal"));
  }, []);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Terminal toolbar */}
      <div className="h-8 flex items-center justify-between px-2 bg-background-raised border-b border-border shrink-0">
        <div className="flex items-center gap-0.5">
          {panes.map((pane, index) => (
            <button
              key={pane.id}
              onClick={() => setActivePane(pane.id)}
              className={`
                group px-2 py-0.5 text-2xs rounded-md transition-default flex items-center gap-1.5
                ${activePane === pane.id
                  ? "bg-primary/10 text-primary"
                  : "text-foreground-muted hover:text-foreground-secondary hover:bg-muted/50"
                }
              `}
            >
              <Terminal className="w-3 h-3" />
              <span>{index + 1}</span>
              {panes.length > 1 && (
                <X
                  className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-default hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    removePane(pane.id);
                  }}
                />
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-0.5">
          <button
            onClick={toggleDirection}
            className="p-1 text-foreground-muted hover:text-foreground-secondary hover:bg-muted/50 rounded-md transition-default"
            title={`Split ${splitDirection === "horizontal" ? "vertically" : "horizontally"}`}
          >
            <SplitSquareVertical className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={addPane}
            className="p-1 text-foreground-muted hover:text-foreground-secondary hover:bg-muted/50 rounded-md transition-default"
            title="Split terminal"
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
                      activePane === pane.id ? "ring-1 ring-primary/20" : ""
                    }`}
                    onClick={() => setActivePane(pane.id)}
                  >
                    <TerminalInstance
                      sessionId={pane.sessionId}
                      isActive={activePane === pane.id}
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
