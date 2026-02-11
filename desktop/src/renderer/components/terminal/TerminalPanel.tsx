import { useState, useCallback } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { TerminalInstance } from "./TerminalInstance";
import { Plus, SplitSquareVertical, X } from "lucide-react";

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
      if (next.length === 0) return prev; // Don't remove last pane
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
    <div className="flex flex-col h-full bg-[#0a0a0f]">
      {/* Terminal toolbar */}
      <div className="h-8 flex items-center justify-between px-2 bg-background border-b border-border shrink-0">
        <div className="flex items-center gap-1">
          {panes.map((pane) => (
            <button
              key={pane.id}
              onClick={() => setActivePane(pane.id)}
              className={`
                px-2 py-0.5 text-xs rounded transition-colors flex items-center gap-1
                ${activePane === pane.id
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground"
                }
              `}
            >
              {pane.sessionId.split("-").pop()}
              {panes.length > 1 && (
                <X
                  className="w-3 h-3 opacity-50 hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    removePane(pane.id);
                  }}
                />
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={toggleDirection}
            className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors"
            title={`Split ${splitDirection === "horizontal" ? "vertically" : "horizontally"}`}
          >
            <SplitSquareVertical className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={addPane}
            className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors"
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
                    className={
                      splitDirection === "horizontal"
                        ? "w-px bg-border hover:bg-primary/50 transition-colors"
                        : "h-px bg-border hover:bg-primary/50 transition-colors"
                    }
                  />
                )}
                <Panel minSize={10}>
                  <div
                    className={`h-full ${
                      activePane === pane.id ? "ring-1 ring-primary/30" : ""
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
