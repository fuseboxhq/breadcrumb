import { useCallback, useEffect, useState, useRef } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { TerminalInstance } from "./TerminalInstance";
import { useAppStore, useTabPanes, useZoomedPane, resolveLabel, isTerminalPane, flattenPanes, getRootDirection, findPaneNode } from "../../store/appStore";
import type { TerminalPaneData, ContentPane, SplitNode } from "../../store/appStore";
import { Plus, SplitSquareVertical, Rows3, X, Maximize2, Minimize2, Sparkles, Globe, GitCompareArrows, Bug, LayoutGrid, GripVertical } from "lucide-react";
import { ProcessIcon } from "../icons/ProcessIcon";
import { PaneContentRenderer } from "../panes/PaneContentRenderer";
import { startDebugSession } from "../../store/debugStore";
import { folderName } from "../../utils/path";

const PANE_DRAG_MIME = "application/breadcrumb-pane";

type DropZone = "center" | "top" | "bottom" | "left" | "right" | null;

/** Detect which drop zone the cursor is in, with 25% edge threshold. */
function detectDropZone(e: React.DragEvent, rect: DOMRect): DropZone {
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const w = rect.width;
  const h = rect.height;

  const edgeX = Math.max(w * 0.25, 40);
  const edgeY = Math.max(h * 0.25, 40);

  // Ensure center zone is at least 20% of each dimension
  const centerLeft = Math.min(edgeX, w * 0.4);
  const centerTop = Math.min(edgeY, h * 0.4);

  if (x < centerLeft) return "left";
  if (x > w - centerLeft) return "right";
  if (y < centerTop) return "top";
  if (y > h - centerTop) return "bottom";
  return "center";
}

/** Map drop zone edge to split direction for docking. */
function zoneToDirection(zone: DropZone): "horizontal" | "vertical" | null {
  if (zone === "left" || zone === "right") return "horizontal";
  if (zone === "top" || zone === "bottom") return "vertical";
  return null; // center = swap
}

interface TerminalPanelProps {
  tabId: string;
  workingDirectory?: string;
  /** Whether this tab is the active/visible tab in the workspace */
  isTabActive?: boolean;
}

export function TerminalPanel({ tabId, workingDirectory, isTabActive = true }: TerminalPanelProps) {
  // Read pane state from shared store (all pane types for universal rendering)
  const tabPaneState = useTabPanes(tabId);
  const panes = tabPaneState ? flattenPanes(tabPaneState.splitTree) : [];
  const terminalPanes = panes.filter(isTerminalPane);
  const activePane = tabPaneState?.activePane || "pane-1";
  const splitDirection = tabPaneState ? getRootDirection(tabPaneState.splitTree) : "horizontal";

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
  const create2x2GridLayout = useAppStore((s) => s.create2x2GridLayout);
  const storeSwapPanes = useAppStore((s) => s.swapPanes);
  const storeDockPane = useAppStore((s) => s.dockPane);
  const storeUpdateSizes = useAppStore((s) => s.updateSplitTreeSizes);
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
      const ts = useAppStore.getState().terminalPanes[tabId];
      const currentPanes = ts ? flattenPanes(ts.splitTree) : [];
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
    const ts = useAppStore.getState().terminalPanes[tabId];
    const currentPanes = ts ? flattenPanes(ts.splitTree) : [];
    const currentActive = ts?.activePane;
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
    const ts2 = useAppStore.getState().terminalPanes[tabId];
    const currentPanes = ts2 ? flattenPanes(ts2.splitTree) : [];
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
      const ts = state.terminalPanes[tabId];
      if (!ts) return;
      const node = findPaneNode(ts.splitTree, paneId);
      if (node && node.pane.type === "terminal") node.pane.initialCommand = undefined;
    });
  }, [tabId]);

  // Close pane on shell exit — if last pane, close the whole tab
  const handleProcessExit = useCallback((paneId: string, _exitCode: number) => {
    const ts3 = useAppStore.getState().terminalPanes[tabId];
    const currentPanes = ts3 ? flattenPanes(ts3.splitTree) : [];
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
        const ts = useAppStore.getState().terminalPanes[tabId];
      const currentPanes = ts ? flattenPanes(ts.splitTree) : [];
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
        const ts = useAppStore.getState().terminalPanes[tabId];
      const currentPanes = ts ? flattenPanes(ts.splitTree) : [];
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
                    ? "bg-accent/10 text-accent"
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
                  ? "text-accent hover:text-accent/80 hover:bg-accent/10"
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
          <button
            onClick={() => create2x2GridLayout(tabId)}
            className="p-1 text-foreground-muted hover:text-foreground-secondary hover:bg-muted/50 rounded-md transition-default focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:outline-none"
            title="2×2 Grid layout"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-3.5 bg-border/50 mx-0.5" />
          <button
            onClick={handleLaunchClaude}
            className="p-1 text-foreground-muted hover:text-[#D97757] hover:bg-[#D97757]/10 rounded-md transition-default focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:outline-none"
            title="Launch Claude Code"
          >
            <Sparkles className="w-3.5 h-3.5" />
          </button>
          {workingDirectory && (
            <button
              onClick={() => startDebugSession(workingDirectory)}
              className="p-1 text-foreground-muted hover:text-destructive hover:bg-destructive/10 rounded-md transition-default focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:outline-none"
              title="Debug with Claude"
            >
              <Bug className="w-3.5 h-3.5" />
            </button>
          )}
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
        ) : tabPaneState ? (
          /* Recursively render the split tree. Maps SplitNode tree to nested
             PanelGroup → Panel → PanelGroup structures from react-resizable-panels. */
          <SplitTreeRenderer
            node={tabPaneState.splitTree}
            tabId={tabId}
            activePane={activePane}
            isTabActive={isTabActive}
            totalPaneCount={panes.length}
            workingDirectory={workingDirectory}
            initialCommand={initialCommand}
            onSetActivePane={setActivePane}
            onCwdChange={handleCwdChange}
            onProcessExit={handleProcessExit}
            onAddPane={addPane}
            onTogglePaneZoom={(paneId) => togglePaneZoom(tabId, paneId)}
            onClearInitialCommand={clearInitialCommand}
            onClearPaneInitialCommand={clearPaneInitialCommand}
            onSwapPanes={(id1, id2) => storeSwapPanes(tabId, id1, id2)}
            onDockPane={(draggedId, targetId, dir) => storeDockPane(tabId, draggedId, targetId, dir)}
            onSizesChange={(panelIds, sizes) => storeUpdateSizes(tabId, panelIds, sizes)}
          />
        ) : null}
      </div>
    </div>
  );
}

// ─── Recursive Split Tree Renderer ──────────────────────────────────────────────

interface SplitTreeRendererProps {
  node: SplitNode;
  tabId: string;
  activePane: string;
  isTabActive: boolean;
  totalPaneCount: number;
  workingDirectory?: string;
  initialCommand?: string;
  onSetActivePane: (paneId: string) => void;
  onCwdChange: (paneId: string, cwd: string) => void;
  onProcessExit: (paneId: string, exitCode: number) => void;
  onAddPane: (direction?: "horizontal" | "vertical") => void;
  onTogglePaneZoom: (paneId: string) => void;
  onClearInitialCommand: () => void;
  onClearPaneInitialCommand: (paneId: string) => void;
  onSwapPanes: (paneId1: string, paneId2: string) => void;
  onDockPane: (draggedPaneId: string, targetPaneId: string, direction: "horizontal" | "vertical") => void;
  onSizesChange: (panelIds: string[], sizes: number[]) => void;
  /** Whether this is the first pane in the overall tree (for tab-level initialCommand) */
  isFirstPane?: boolean;
}

/** Recursively renders a SplitNode tree into nested PanelGroup/Panel structures. */
function SplitTreeRenderer({
  node,
  tabId,
  activePane,
  isTabActive,
  totalPaneCount,
  workingDirectory,
  initialCommand,
  onSetActivePane,
  onCwdChange,
  onProcessExit,
  onAddPane,
  onTogglePaneZoom,
  onClearInitialCommand,
  onClearPaneInitialCommand,
  onSwapPanes,
  onDockPane,
  onSizesChange,
  isFirstPane = true,
}: SplitTreeRendererProps) {
  // Leaf node — render a single pane with drag-and-drop
  if (node.type === "pane") {
    return (
      <PaneDropTarget
        pane={node.pane}
        tabId={tabId}
        activePane={activePane}
        isTabActive={isTabActive}
        isFirstPane={isFirstPane}
        totalPaneCount={totalPaneCount}
        workingDirectory={workingDirectory}
        initialCommand={initialCommand}
        onSetActivePane={onSetActivePane}
        onCwdChange={onCwdChange}
        onProcessExit={onProcessExit}
        onAddPane={onAddPane}
        onTogglePaneZoom={onTogglePaneZoom}
        onClearInitialCommand={onClearInitialCommand}
        onClearPaneInitialCommand={onClearPaneInitialCommand}
        onSwapPanes={onSwapPanes}
        onDockPane={onDockPane}
      />
    );
  }

  // Split node — render nested PanelGroup with resize handles
  const { direction, children, sizes } = node;

  // Capture panel IDs for onLayout callback
  const childIds = children.map((c, i) =>
    c.type === "pane" ? c.pane.id : `split-${i}`
  );
  const handleLayout = useCallback((newSizes: number[]) => {
    onSizesChange(childIds, newSizes);
  }, [onSizesChange, childIds.join(",")]);

  return (
    <PanelGroup direction={direction} onLayout={handleLayout}>
      {children.map((child, index) => {
        // Track whether this child contains the first pane in the tree
        const childIsFirst = isFirstPane && index === 0;

        return (
          <div key={child.type === "pane" ? child.pane.id : `split-${index}`} className="contents">
            {index > 0 && (
              <PanelResizeHandle
                className={`
                  group relative transition-default
                  ${direction === "horizontal"
                    ? "w-[3px] bg-transparent hover:bg-accent/30 active:bg-accent/50"
                    : "h-[3px] bg-transparent hover:bg-accent/30 active:bg-accent/50"
                  }
                `}
              >
                <div
                  className={`absolute transition-default ${
                    direction === "horizontal"
                      ? "inset-y-0 left-[1px] w-px bg-border group-hover:bg-accent/40"
                      : "inset-x-0 top-[1px] h-px bg-border group-hover:bg-accent/40"
                  }`}
                />
              </PanelResizeHandle>
            )}
            <Panel
              id={child.type === "pane" ? child.pane.id : undefined}
              order={index}
              defaultSize={sizes[index]}
              minSize={5}
            >
              <SplitTreeRenderer
                node={child}
                tabId={tabId}
                activePane={activePane}
                isTabActive={isTabActive}
                totalPaneCount={totalPaneCount}
                workingDirectory={workingDirectory}
                initialCommand={initialCommand}
                onSetActivePane={onSetActivePane}
                onCwdChange={onCwdChange}
                onProcessExit={onProcessExit}
                onAddPane={onAddPane}
                onTogglePaneZoom={onTogglePaneZoom}
                onClearInitialCommand={onClearInitialCommand}
                onClearPaneInitialCommand={onClearPaneInitialCommand}
                onSwapPanes={onSwapPanes}
                onDockPane={onDockPane}
                onSizesChange={onSizesChange}
                isFirstPane={childIsFirst}
              />
            </Panel>
          </div>
        );
      })}
    </PanelGroup>
  );
}

// ─── Pane Drop Target (drag-and-drop wrapper for each pane) ─────────────────

interface PaneDropTargetProps {
  pane: ContentPane;
  tabId: string;
  activePane: string;
  isTabActive: boolean;
  isFirstPane: boolean;
  totalPaneCount: number;
  workingDirectory?: string;
  initialCommand?: string;
  onSetActivePane: (paneId: string) => void;
  onCwdChange: (paneId: string, cwd: string) => void;
  onProcessExit: (paneId: string, exitCode: number) => void;
  onAddPane: (direction?: "horizontal" | "vertical") => void;
  onTogglePaneZoom: (paneId: string) => void;
  onClearInitialCommand: () => void;
  onClearPaneInitialCommand: (paneId: string) => void;
  onSwapPanes: (paneId1: string, paneId2: string) => void;
  onDockPane: (draggedPaneId: string, targetPaneId: string, direction: "horizontal" | "vertical") => void;
}

function PaneDropTarget({
  pane,
  tabId,
  activePane,
  isTabActive,
  isFirstPane,
  totalPaneCount,
  workingDirectory,
  initialCommand,
  onSetActivePane,
  onCwdChange,
  onProcessExit,
  onAddPane,
  onTogglePaneZoom,
  onClearInitialCommand,
  onClearPaneInitialCommand,
  onSwapPanes,
  onDockPane,
}: PaneDropTargetProps) {
  const isActive = totalPaneCount === 1 || activePane === pane.id;
  const containerRef = useRef<HTMLDivElement>(null);
  const [dropZone, setDropZone] = useState<DropZone>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.dataTransfer.setData(PANE_DRAG_MIME, JSON.stringify({ paneId: pane.id, tabId }));
    e.dataTransfer.effectAllowed = "move";
    setIsDragging(true);
  }, [pane.id, tabId]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes(PANE_DRAG_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropZone(detectDropZone(e, rect));
    }
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes(PANE_DRAG_MIME)) return;
    e.preventDefault();
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!containerRef.current?.contains(e.relatedTarget as Node)) {
      setDropZone(null);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const zone = dropZone;
    setDropZone(null);

    const raw = e.dataTransfer.getData(PANE_DRAG_MIME);
    if (!raw) return;

    try {
      const { paneId: draggedId, tabId: dragTabId } = JSON.parse(raw) as { paneId: string; tabId: string };
      if (draggedId === pane.id) return; // Can't drop on self
      if (dragTabId !== tabId) return; // Cross-tab not supported yet

      if (zone === "center") {
        onSwapPanes(draggedId, pane.id);
      } else if (zone) {
        const dir = zoneToDirection(zone);
        if (dir) {
          onDockPane(draggedId, pane.id, dir);
        }
      }
    } catch {
      // ignore malformed data
    }
  }, [dropZone, pane.id, tabId, onSwapPanes, onDockPane]);

  // Drop zone overlay — always rendered for smooth opacity transition
  const showOverlay = dropZone != null && !isDragging;

  const zoneOverlay = (
    <div className={`absolute inset-0 pointer-events-none z-10 transition-opacity duration-150 ${showOverlay ? "opacity-100" : "opacity-0"}`}>
      {dropZone === "center" && (
        <div className="absolute inset-2 border-2 border-dashed border-accent/60 rounded-md bg-accent/10 flex items-center justify-center">
          <span className="text-2xs text-accent font-medium bg-background/80 px-2 py-0.5 rounded">Swap</span>
        </div>
      )}
      {dropZone === "left" && (
        <div className="absolute inset-y-0 left-0 w-1/4 bg-blue-500/15 border-r-2 border-blue-400/60 rounded-l-sm" />
      )}
      {dropZone === "right" && (
        <div className="absolute inset-y-0 right-0 w-1/4 bg-blue-500/15 border-l-2 border-blue-400/60 rounded-r-sm" />
      )}
      {dropZone === "top" && (
        <div className="absolute inset-x-0 top-0 h-1/4 bg-blue-500/15 border-b-2 border-blue-400/60 rounded-t-sm" />
      )}
      {dropZone === "bottom" && (
        <div className="absolute inset-x-0 bottom-0 h-1/4 bg-blue-500/15 border-t-2 border-blue-400/60 rounded-b-sm" />
      )}
    </div>
  );

  return (
    <div
      ref={containerRef}
      className={`group/pane h-full w-full relative ${
        totalPaneCount > 1
          ? isActive
            ? "ring-1 ring-accent/20 rounded-sm transition-default"
            : "opacity-90 hover:opacity-100 transition-default"
          : ""
      } ${isDragging ? "opacity-50" : ""}`}
      onClick={() => onSetActivePane(pane.id)}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag handle — only visible on hover when multiple panes */}
      {totalPaneCount > 1 && (
        <div
          draggable
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          className="absolute top-0 left-0 z-20 p-0.5 opacity-0 group-hover/pane:opacity-60 hover:!opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
          title="Drag to rearrange"
        >
          <GripVertical className="w-3 h-3 text-foreground-muted" />
        </div>
      )}

      {zoneOverlay}

      <PaneContentRenderer
        pane={pane}
        tabId={tabId}
        isActive={isActive}
        isTabActive={isTabActive}
        workingDirectory={workingDirectory}
        tabInitialCommand={isFirstPane ? initialCommand : undefined}
        onCwdChange={onCwdChange}
        onProcessExit={onProcessExit}
        onSplitHorizontal={() => onAddPane("horizontal")}
        onSplitVertical={() => onAddPane("vertical")}
        onToggleZoom={() => onTogglePaneZoom(pane.id)}
        isZoomed={false}
        canZoom={totalPaneCount > 1}
        onInitialCommandSent={isFirstPane ? onClearInitialCommand : undefined}
        onPaneInitialCommandSent={onClearPaneInitialCommand}
      />
    </div>
  );
}

/** Icon for pane tab based on content type */
function PaneIcon({ pane }: { pane: ContentPane }) {
  switch (pane.type) {
    case "terminal":
      return <ProcessIcon processName={(pane as TerminalPaneData).processName} className="w-3 h-3 shrink-0" />;
    case "browser":
      return <Globe className="w-3 h-3 shrink-0 text-info/70" />;
    case "diff":
      return <GitCompareArrows className="w-3 h-3 shrink-0 text-warning/70" />;
    default:
      return null;
  }
}
