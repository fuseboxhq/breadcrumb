import { useState, useCallback } from "react";
import { X, Plus, Terminal, Zap, GitCompareArrows, Pin, Globe, Bug } from "lucide-react";
import { useAppStore, type TabType } from "../../store/appStore";
import { useProjectsStore } from "../../store/projectsStore";
import { startDebugSession } from "../../store/debugStore";
import {
  ContextMenu,
  MenuItem,
  MenuSeparator,
} from "../shared/ContextMenu";

const BROWSER_TAB_MIME = "application/breadcrumb-browser-tab";
const TERMINAL_TAB_MIME = "application/breadcrumb-terminal-tab";

const TAB_ICONS: Record<TabType, typeof Terminal> = {
  terminal: Terminal,
  welcome: Zap,
  diff: GitCompareArrows,
  browser: Globe,
};

export function TabBar() {
  const tabs = useAppStore((s) => s.tabs);
  const activeTabId = useAppStore((s) => s.activeTabId);
  const { setActiveTab, removeTab, addTab, pinDiffTab, openBrowserTab, mergeTabInto } = useAppStore();
  const activeProject = useProjectsStore((s) =>
    s.projects.find((p) => p.id === s.activeProjectId) || null
  );
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragOverTabId, setDragOverTabId] = useState<string | null>(null);
  const [draggingTabId, setDraggingTabId] = useState<string | null>(null);

  const handleNewTerminal = () => {
    const id = `terminal-${Date.now()}`;
    addTab({
      id,
      type: "terminal",
      title: activeProject ? activeProject.name : `Terminal ${tabs.filter((t) => t.type === "terminal").length + 1}`,
      projectId: activeProject?.id,
    });
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes(BROWSER_TAB_MIME)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only reset when leaving the container, not when entering children
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const raw = e.dataTransfer.getData(BROWSER_TAB_MIME);
    if (!raw) return;
    try {
      const { url } = JSON.parse(raw) as { url: string; title: string };
      if (url) openBrowserTab(url);
    } catch {
      // ignore malformed data
    }
  }, [openBrowserTab]);

  // ── Terminal tab drag-and-drop (merge tabs) ───────────────────────────
  const handleTabDragStart = useCallback((e: React.DragEvent, tabId: string) => {
    e.dataTransfer.setData(TERMINAL_TAB_MIME, tabId);
    e.dataTransfer.effectAllowed = "move";
    setDraggingTabId(tabId);
  }, []);

  const handleTabDragEnd = useCallback(() => {
    setDraggingTabId(null);
    setDragOverTabId(null);
  }, []);

  const handleTabDragOver = useCallback((e: React.DragEvent, targetTabId: string) => {
    if (!e.dataTransfer.types.includes(TERMINAL_TAB_MIME)) return;
    e.preventDefault();
    e.stopPropagation(); // Prevent container's browser-tab drop zone
    e.dataTransfer.dropEffect = "move";
    setDragOverTabId(targetTabId);
  }, []);

  const handleTabDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverTabId(null);
    }
  }, []);

  const handleTabDrop = useCallback((e: React.DragEvent, targetTabId: string, targetTabType: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverTabId(null);
    setDraggingTabId(null);
    const sourceTabId = e.dataTransfer.getData(TERMINAL_TAB_MIME);
    if (!sourceTabId || targetTabType !== "terminal") return;
    mergeTabInto(sourceTabId, targetTabId);
  }, [mergeTabInto]);

  return (
    <div
      className="h-9 bg-background flex items-end shrink-0 overflow-x-auto scrollbar-thin"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {tabs.map((tab) => {
        const Icon = TAB_ICONS[tab.type];
        const isActive = tab.id === activeTabId;
        const isDiff = tab.type === "diff";
        const isUnpinned = isDiff && !tab.pinned;
        const isTerminal = tab.type === "terminal";
        const isDragTarget = dragOverTabId === tab.id && draggingTabId !== tab.id;
        const isDragging = draggingTabId === tab.id;

        const tabButton = (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            draggable={isTerminal}
            onDragStart={isTerminal ? (e) => handleTabDragStart(e, tab.id) : undefined}
            onDragEnd={isTerminal ? handleTabDragEnd : undefined}
            onDragOver={isTerminal ? (e) => handleTabDragOver(e, tab.id) : undefined}
            onDragLeave={isTerminal ? handleTabDragLeave : undefined}
            onDrop={isTerminal ? (e) => handleTabDrop(e, tab.id, tab.type) : undefined}
            className={`
              group relative h-full px-3 flex items-center gap-2 text-xs shrink-0 max-w-48
              transition-default border-r border-border/50
              ${isActive
                ? "bg-background-raised text-foreground"
                : "text-foreground-muted hover:text-foreground-secondary hover:bg-background-raised/50"
              }
              ${isDragging ? "opacity-40" : ""}
              ${isDragTarget ? "ring-2 ring-inset ring-accent-secondary bg-accent-secondary/15" : ""}
            `}
          >
            {/* Active tab indicator — accent underline at top */}
            {isActive && !isDragTarget && (
              <div className="absolute top-0 left-1 right-1 h-[2px] rounded-b-full bg-accent-secondary" />
            )}

            {/* Merge overlay when dragging a tab onto this one */}
            {isDragTarget && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-2xs text-accent-secondary font-medium bg-background-raised/80 px-1.5 py-0.5 rounded">
                  Merge
                </span>
              </div>
            )}

            <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-accent-secondary" : ""} ${isDragTarget ? "opacity-0" : ""}`} />
            <span className={`truncate ${isUnpinned ? "italic text-foreground-muted" : ""} ${isDragTarget ? "opacity-0" : ""}`}>
              {tab.title}
            </span>

            {tab.type !== "welcome" && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  removeTab(tab.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation();
                    removeTab(tab.id);
                  }
                }}
                aria-label={`Close ${tab.title}`}
                className="ml-auto shrink-0 p-0.5 rounded hover:bg-muted/50 hover:text-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:outline-none transition-default"
              >
                <X className="w-3 h-3" />
              </span>
            )}
          </button>
        );

        // Wrap diff tabs with context menu
        if (isDiff) {
          return (
            <ContextMenu
              key={tab.id}
              content={
                <>
                  {!tab.pinned && (
                    <MenuItem
                      icon={<Pin className="w-3.5 h-3.5" />}
                      label="Pin Diff"
                      onSelect={() => pinDiffTab(tab.id)}
                    />
                  )}
                  {tab.pinned && (
                    <MenuItem
                      icon={<Pin className="w-3.5 h-3.5" />}
                      label="Pinned"
                      disabled
                    />
                  )}
                  <MenuSeparator />
                  <MenuItem
                    icon={<X className="w-3.5 h-3.5" />}
                    label="Close Diff"
                    destructive
                    onSelect={() => removeTab(tab.id)}
                  />
                </>
              }
            >
              {tabButton}
            </ContextMenu>
          );
        }

        return tabButton;
      })}

      <button
        onClick={handleNewTerminal}
        className="h-full px-2.5 flex items-center text-foreground-muted hover:text-foreground-secondary hover:bg-background-raised/50 transition-default shrink-0 focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:outline-none"
        title="New Terminal"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>

      <button
        onClick={() => startDebugSession(activeProject?.path || "")}
        className="h-full px-2.5 flex items-center text-foreground-muted hover:text-accent-error hover:bg-background-raised/50 transition-default shrink-0 focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:outline-none"
        title="Debug with Claude"
      >
        <Bug className="w-3.5 h-3.5" />
      </button>

      {/* Fill remaining space — also serves as drop zone */}
      <div className={`flex-1 h-full border-b transition-default ${isDragOver ? "border-accent-secondary bg-accent-secondary/10 border-dashed" : "border-border/50"}`}>
        {isDragOver && (
          <div className="h-full flex items-center justify-center">
            <span className="text-2xs text-accent-secondary font-medium">Drop to open tab</span>
          </div>
        )}
      </div>
    </div>
  );
}
