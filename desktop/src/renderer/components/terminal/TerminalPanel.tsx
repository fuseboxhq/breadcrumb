import { useCallback, useEffect, useState, useRef } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { TerminalInstance } from "./TerminalInstance";
import { useAppStore, useTabPanes, useZoomedPane, resolveLabel } from "../../store/appStore";
import { Plus, SplitSquareVertical, Rows3, X, Maximize2, Minimize2 } from "lucide-react";
import { ProcessIcon } from "../icons/ProcessIcon";
import { folderName } from "../../utils/path";

interface TerminalPanelProps {
  tabId: string;
  workingDirectory?: string;
}

export function TerminalPanel({ tabId, workingDirectory }: TerminalPanelProps) {
  // Read pane state from shared store
  const tabPaneState = useTabPanes(tabId);
  const panes = tabPaneState?.panes || [];
  const activePane = tabPaneState?.activePane || "pane-1";
  const splitDirection = tabPaneState?.splitDirection || "horizontal";

  // Inline rename state
  const [renamingPaneId, setRenamingPaneId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Store actions
  const initializeTabPanes = useAppStore((s) => s.initializeTabPanes);
  const storeAddPane = useAppStore((s) => s.addPane);
  const storeRemovePane = useAppStore((s) => s.removePane);
  const storeSetActivePane = useAppStore((s) => s.setActivePane);
  const storeToggleSplitDirection = useAppStore((s) => s.toggleSplitDirection);
  const storeUpdatePaneCwd = useAppStore((s) => s.updatePaneCwd);
  const setPaneCustomLabel = useAppStore((s) => s.setPaneCustomLabel);
  const togglePaneZoom = useAppStore((s) => s.togglePaneZoom);
  const updateTab = useAppStore((s) => s.updateTab);
  const updatePaneProcess = useAppStore((s) => s.updatePaneProcess);

  // Zoom state
  const zoomedPane = useZoomedPane();
  const isZoomed = zoomedPane?.tabId === tabId;
  const zoomedPaneData = isZoomed ? panes.find((p) => p.id === zoomedPane.paneId) : null;

  // Initialize panes on mount (idempotent)
  useEffect(() => {
    initializeTabPanes(tabId, workingDirectory);
  }, [tabId, workingDirectory, initializeTabPanes]);

  // Subscribe to terminal process changes from main process.
  // Maps sessionId → paneId for this tab's panes, then calls updatePaneProcess.
  useEffect(() => {
    const cleanup = window.breadcrumbAPI?.onTerminalProcessChange((event) => {
      const currentPanes = useAppStore.getState().terminalPanes[tabId]?.panes || [];
      const pane = currentPanes.find((p) => p.sessionId === event.sessionId);
      if (pane) {
        updatePaneProcess(tabId, pane.id, event.processName, event.processLabel);
      }
    });
    return () => cleanup?.();
  }, [tabId, updatePaneProcess]);

  // When active pane's CWD changes, update the tab title
  const handleCwdChange = useCallback((paneId: string, cwd: string) => {
    storeUpdatePaneCwd(tabId, paneId, cwd);
    // Read current active pane from store to avoid stale closures
    const state = useAppStore.getState();
    const currentActivePane = state.terminalPanes[tabId]?.activePane;
    if (paneId === currentActivePane) {
      // Don't set tab title here — the useEffect below handles it
      // reactively, avoiding stale processLabel races
    }
  }, [tabId, storeUpdatePaneCwd]);

  // When active pane switches, process label changes, or CWD changes → update tab title
  useEffect(() => {
    const pane = panes.find((p) => p.id === activePane);
    if (pane) {
      const title = pane.processLabel || (pane.cwd ? folderName(pane.cwd) : "Terminal");
      updateTab(tabId, { title });
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

  // Inline rename handlers
  const startRename = useCallback((paneId: string, currentLabel: string) => {
    setRenamingPaneId(paneId);
    setRenameValue(currentLabel);
  }, []);

  const commitRename = useCallback(() => {
    if (renamingPaneId) {
      const trimmed = renameValue.trim();
      setPaneCustomLabel(tabId, renamingPaneId, trimmed || null);
      setRenamingPaneId(null);
    }
  }, [tabId, renamingPaneId, renameValue, setPaneCustomLabel]);

  const cancelRename = useCallback(() => {
    setRenamingPaneId(null);
  }, []);

  // Focus rename input when it appears
  useEffect(() => {
    if (renamingPaneId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingPaneId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;

      // Cmd+Shift+Enter — toggle zoom on active pane
      if (meta && e.shiftKey && e.key === "Enter") {
        e.preventDefault();
        const currentPanes = useAppStore.getState().terminalPanes[tabId]?.panes || [];
        const currentActive = useAppStore.getState().terminalPanes[tabId]?.activePane;
        if (currentPanes.length > 1 && currentActive) {
          togglePaneZoom(tabId, currentActive);
        }
        return;
      }

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

      // Cmd+W — close pane (if multiple) or close entire tab (if single pane)
      if (meta && e.key === "w") {
        e.preventDefault();
        const currentPanes = useAppStore.getState().terminalPanes[tabId]?.panes || [];
        const currentActive = useAppStore.getState().terminalPanes[tabId]?.activePane;
        if (currentPanes.length > 1 && currentActive) {
          removePane(currentActive);
        } else {
          useAppStore.getState().removeTab(tabId);
        }
        return;
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
  }, [tabId, addPane, removePane, navigatePane, navigateToPaneNumber, togglePaneZoom]);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Terminal toolbar */}
      <div className="h-8 flex items-center justify-between px-2 bg-background-raised border-b border-border shrink-0">
        <div className="flex items-center gap-0.5">
          {panes.map((pane, index) => {
            const label = resolveLabel(pane, index);

            if (renamingPaneId === pane.id) {
              return (
                <input
                  key={pane.id}
                  ref={renameInputRef}
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename();
                    if (e.key === "Escape") cancelRename();
                  }}
                  className="px-2 py-0.5 text-2xs rounded-md bg-background border border-primary/30 text-foreground outline-none max-w-32 w-24"
                />
              );
            }

            return (
              <button
                key={pane.id}
                onClick={() => setActivePane(pane.id)}
                onDoubleClick={() => startRename(pane.id, pane.customLabel || "")}
                className={`
                  group px-2 py-0.5 text-2xs rounded-md transition-default flex items-center gap-1.5 max-w-32
                  ${activePane === pane.id
                    ? "bg-primary/10 text-primary"
                    : "text-foreground-muted hover:text-foreground-secondary hover:bg-muted/50"
                  }
                `}
                title={`${label}${pane.customLabel ? " (custom)" : pane.processLabel ? ` — ${pane.processLabel}` : ""}\nDouble-click to rename`}
              >
                <ProcessIcon processName={pane.processName} className="w-3 h-3 shrink-0" />
                <span className="truncate">{label}</span>
                {pane.customLabel && (
                  <span
                    title="Clear custom name"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPaneCustomLabel(tabId, pane.id, null);
                    }}
                  >
                    <X className="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-100 transition-default hover:text-foreground" />
                  </span>
                )}
                {!pane.customLabel && panes.length > 1 && (
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
          {panes.length > 1 && (
            <button
              onClick={() => togglePaneZoom(tabId, activePane)}
              className={`p-1 rounded-md transition-default focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:outline-none ${
                isZoomed
                  ? "text-primary hover:text-primary/80 hover:bg-primary/10"
                  : "text-foreground-muted hover:text-foreground-secondary hover:bg-muted/50"
              }`}
              title={isZoomed ? "Restore panes (⇧⌘↵)" : "Maximize pane (⇧⌘↵)"}
            >
              {isZoomed ? (
                <Minimize2 className="w-3.5 h-3.5" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" />
              )}
            </button>
          )}
          <button
            onClick={toggleDirection}
            className="p-1 text-foreground-muted hover:text-foreground-secondary hover:bg-muted/50 rounded-md transition-default focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:outline-none"
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
            className="p-1 text-foreground-muted hover:text-foreground-secondary hover:bg-muted/50 rounded-md transition-default focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:outline-none"
            title="Split terminal (⌘D)"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal panes */}
      <div className="flex-1 min-h-0">
        {/* Zoomed: render only the zoomed pane at full size */}
        {isZoomed && zoomedPaneData ? (
          <TerminalInstance
            sessionId={zoomedPaneData.sessionId}
            isActive={true}
            workingDirectory={workingDirectory}
            onCwdChange={(cwd) => handleCwdChange(zoomedPaneData.id, cwd)}
            onSplitHorizontal={() => addPane("horizontal")}
            onSplitVertical={() => addPane("vertical")}
            onToggleZoom={() => togglePaneZoom(tabId, zoomedPaneData.id)}
            isZoomed={true}
            canZoom={true}
          />
        ) : panes.length === 1 ? (
          <TerminalInstance
            sessionId={panes[0].sessionId}
            isActive={true}
            workingDirectory={workingDirectory}
            onCwdChange={(cwd) => handleCwdChange(panes[0].id, cwd)}
            onSplitHorizontal={() => addPane("horizontal")}
            onSplitVertical={() => addPane("vertical")}
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
                      onSplitHorizontal={() => addPane("horizontal")}
                      onSplitVertical={() => addPane("vertical")}
                      onToggleZoom={() => togglePaneZoom(tabId, pane.id)}
                      isZoomed={false}
                      canZoom={panes.length > 1}
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
