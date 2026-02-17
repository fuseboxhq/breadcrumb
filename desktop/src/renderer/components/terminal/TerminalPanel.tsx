import { useCallback, useEffect, useState, useRef } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { TerminalInstance } from "./TerminalInstance";
import { useAppStore, useTabPanes, useZoomedPane, resolveLabel, isTerminalPane } from "../../store/appStore";
import type { TerminalPaneData, ContentPane } from "../../store/appStore";
import { Plus, SplitSquareVertical, Rows3, X, Maximize2, Minimize2, Sparkles, Globe, GitCompareArrows } from "lucide-react";
import { ProcessIcon } from "../icons/ProcessIcon";
import { PaneContentRenderer } from "../panes/PaneContentRenderer";
import { folderName } from "../../utils/path";

interface TerminalPanelProps {
  tabId: string;
  workingDirectory?: string;
  /** Whether this tab is the active/visible tab in the workspace */
  isTabActive?: boolean;
}

export function TerminalPanel({ tabId, workingDirectory, isTabActive = true }: TerminalPanelProps) {
  // Read pane state from shared store (all pane types for universal rendering)
  const tabPaneState = useTabPanes(tabId);
  const panes = tabPaneState?.panes || [];
  const terminalPanes = panes.filter(isTerminalPane);
  const activePane = tabPaneState?.activePane || "pane-1";
  const splitDirection = tabPaneState?.splitDirection || "horizontal";

  // Read initial command from tab (e.g. "claude\n")
  const initialCommand = useAppStore(
    (s) => s.tabs.find((t) => t.id === tabId)?.initialCommand
  );

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
      const pane = currentPanes.find(
        (p) => p.type === "terminal" && p.sessionId === event.sessionId
      );
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
    if (pane && pane.type === "terminal") {
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

  // Clear initial command after it's been sent to the PTY
  const clearInitialCommand = useCallback(() => {
    updateTab(tabId, { initialCommand: undefined });
  }, [tabId, updateTab]);

  // Clear a pane-level initial command after it's been sent
  const clearPaneInitialCommand = useCallback((paneId: string) => {
    useAppStore.setState((state) => {
      const p = state.terminalPanes[tabId]?.panes.find((pp) => pp.id === paneId);
      if (p && p.type === "terminal") p.initialCommand = undefined;
    });
  }, [tabId]);

  // Close pane on shell exit — if last pane, close the whole tab
  const handleProcessExit = useCallback((paneId: string, _exitCode: number) => {
    const currentPanes = useAppStore.getState().terminalPanes[tabId]?.panes || [];
    if (currentPanes.length > 1) {
      storeRemovePane(tabId, paneId);
    } else {
      useAppStore.getState().removeTab(tabId);
    }
  }, [tabId, storeRemovePane]);

  // Launch Claude Code in a new pane within the current terminal tab
  const handleLaunchClaude = useCallback(() => {
    storeAddPane(tabId, undefined, "claude\n");
  }, [tabId, storeAddPane]);

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
            const isTerminal = pane.type === "terminal";
            const termPane = isTerminal ? (pane as TerminalPaneData) : null;

            if (isTerminal && renamingPaneId === pane.id) {
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
                onDoubleClick={isTerminal ? () => startRename(pane.id, termPane?.customLabel || "") : undefined}
                className={`
                  group px-2 py-0.5 text-2xs rounded-md transition-default flex items-center gap-1.5 max-w-32
                  ${activePane === pane.id
                    ? "bg-accent-secondary/10 text-accent-secondary"
                    : "text-foreground-muted hover:text-foreground-secondary hover:bg-muted/50"
                  }
                `}
                title={`${label}${isTerminal ? (termPane?.customLabel ? " (custom)" : termPane?.processLabel ? ` — ${termPane.processLabel}` : "") : ""}`}
              >
                <PaneIcon pane={pane} />
                <span className="truncate">{label}</span>
                {isTerminal && termPane?.customLabel && (
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
                {!(isTerminal && termPane?.customLabel) && panes.length > 1 && (
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
                  ? "text-accent-secondary hover:text-accent-secondary/80 hover:bg-accent-secondary/10"
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
          <div className="w-px h-3.5 bg-border/50 mx-0.5" />
          <button
            onClick={handleLaunchClaude}
            className="p-1 text-foreground-muted hover:text-[#D97757] hover:bg-[#D97757]/10 rounded-md transition-default focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:outline-none"
            title="Launch Claude Code"
          >
            <Sparkles className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Content panes — universal rendering for all pane types */}
      <div className="flex-1 min-h-0">
        {/* Zoomed: render only the zoomed pane at full size */}
        {isZoomed && zoomedPaneData ? (
          <PaneContentRenderer
            pane={zoomedPaneData}
            tabId={tabId}
            isActive={true}
            isTabActive={isTabActive}
            workingDirectory={workingDirectory}
            onCwdChange={handleCwdChange}
            onProcessExit={handleProcessExit}
            onSplitHorizontal={() => addPane("horizontal")}
            onSplitVertical={() => addPane("vertical")}
            onToggleZoom={() => togglePaneZoom(tabId, zoomedPaneData.id)}
            isZoomed={true}
            canZoom={true}
          />
        ) : (
          /* Always render through PanelGroup — even for a single pane.
             This preserves the component tree when panes are added (e.g. tab merge),
             so existing TerminalInstances stay mounted and keep their xterm content. */
          <PanelGroup direction={splitDirection}>
            {panes.map((pane, index) => (
              <div key={pane.id} className="contents">
                {index > 0 && (
                  <PanelResizeHandle
                    className={`
                      group relative transition-default
                      ${splitDirection === "horizontal"
                        ? "w-[3px] bg-transparent hover:bg-accent-secondary/30 active:bg-accent-secondary/50"
                        : "h-[3px] bg-transparent hover:bg-accent-secondary/30 active:bg-accent-secondary/50"
                      }
                    `}
                  >
                    <div
                      className={`absolute transition-default ${
                        splitDirection === "horizontal"
                          ? "inset-y-0 left-[1px] w-px bg-border group-hover:bg-accent-secondary/40"
                          : "inset-x-0 top-[1px] h-px bg-border group-hover:bg-accent-secondary/40"
                      }`}
                    />
                  </PanelResizeHandle>
                )}
                <Panel id={pane.id} order={index} minSize={10}>
                  <div
                    className={`h-full ${
                      panes.length > 1
                        ? activePane === pane.id
                          ? "ring-1 ring-accent-secondary/20 rounded-sm transition-default"
                          : "opacity-90 hover:opacity-100 transition-default"
                        : ""
                    }`}
                    onClick={() => setActivePane(pane.id)}
                  >
                    <PaneContentRenderer
                      pane={pane}
                      tabId={tabId}
                      isActive={panes.length === 1 || activePane === pane.id}
                      isTabActive={isTabActive}
                      workingDirectory={workingDirectory}
                      tabInitialCommand={index === 0 ? initialCommand : undefined}
                      onCwdChange={handleCwdChange}
                      onProcessExit={handleProcessExit}
                      onSplitHorizontal={() => addPane("horizontal")}
                      onSplitVertical={() => addPane("vertical")}
                      onToggleZoom={() => togglePaneZoom(tabId, pane.id)}
                      isZoomed={false}
                      canZoom={panes.length > 1}
                      onInitialCommandSent={index === 0 ? clearInitialCommand : undefined}
                      onPaneInitialCommandSent={clearPaneInitialCommand}
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

/** Icon for pane tab based on content type */
function PaneIcon({ pane }: { pane: ContentPane }) {
  switch (pane.type) {
    case "terminal":
      return <ProcessIcon processName={(pane as TerminalPaneData).processName} className="w-3 h-3 shrink-0" />;
    case "browser":
      return <Globe className="w-3 h-3 shrink-0 text-dracula-cyan/70" />;
    case "diff":
      return <GitCompareArrows className="w-3 h-3 shrink-0 text-dracula-orange/70" />;
    default:
      return null;
  }
}
