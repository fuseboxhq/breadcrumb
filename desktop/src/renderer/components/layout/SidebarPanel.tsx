import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useAppStore, resolveLabel, type SidebarView } from "../../store/appStore";
import { useProjectsStore, useActiveProject } from "../../store/projectsStore";
import { useSettingsStore, useTerminalSettings } from "../../store/settingsStore";
import { ExtensionsPanel } from "../extensions/ExtensionsPanel";
import { TreeView, type TreeNode as TreeNodeType } from "../sidebar/TreeView";
import {
  ContextMenu,
  MenuItem,
  MenuSeparator,
} from "../shared/ContextMenu";
import {
  FolderTree,
  Terminal,
  Puzzle,
  Settings,
  FolderOpen,
  Plus,
  ChevronRight,
  RotateCcw,
  X,
  Columns2,
  Copy,
  Trash2,
  SplitSquareVertical,
  Rows3,
  Pencil,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { ProcessIcon } from "../icons/ProcessIcon";

const VIEW_TITLES: Partial<Record<SidebarView, { label: string; icon: typeof Terminal }>> = {
  explorer: { label: "Explorer", icon: FolderTree },
  terminals: { label: "Terminals", icon: Terminal },
  extensions: { label: "Extensions", icon: Puzzle },
  settings: { label: "Settings", icon: Settings },
};

export function SidebarPanel() {
  const sidebarView = useAppStore((s) => s.sidebarView);
  const collapsed = useAppStore((s) => s.sidebarCollapsed);

  if (collapsed) return null;

  const viewMeta = VIEW_TITLES[sidebarView];
  if (!viewMeta) return null;

  const { label, icon: Icon } = viewMeta;

  return (
    <div className="h-full bg-background-raised flex flex-col overflow-hidden animate-slide-in-right">
      {/* Header */}
      <div className="h-9 px-4 flex items-center gap-2 border-b border-border shrink-0">
        <Icon className="w-3.5 h-3.5 text-foreground-muted" />
        <span className="text-2xs font-semibold uppercase tracking-widest text-foreground-muted">
          {label}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <SidebarContent view={sidebarView} />
      </div>
    </div>
  );
}

function SidebarContent({ view }: { view: SidebarView }) {
  switch (view) {
    case "explorer":
      return <ExplorerView />;
    case "terminals":
      return <TerminalsView />;
    case "extensions":
      return <ExtensionsPanel />;
    case "settings":
      return <SettingsView />;
    default:
      // breadcrumb and browser no longer render in sidebar
      // (they open in the right panel via ActivityBar)
      return null;
  }
}

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: typeof Terminal;
  title: string;
  description: string;
  action?: { label: string; onClick?: () => void };
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-12 text-center">
      <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center mb-3">
        <Icon className="w-5 h-5 text-foreground-muted" />
      </div>
      <p className="text-sm text-foreground-secondary mb-1">{title}</p>
      <p className="text-2xs text-foreground-muted mb-4">{description}</p>
      {action && (
        <button className="text-2xs text-primary hover:text-primary/80 transition-default font-medium">
          {action.label}
        </button>
      )}
    </div>
  );
}

function ExplorerView() {
  const projects = useProjectsStore((s) => s.projects);
  const activeProject = useActiveProject();
  const { addProject, removeProject, setActiveProject } = useProjectsStore();
  const tabs = useAppStore((s) => s.tabs);
  const addTab = useAppStore((s) => s.addTab);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const handleAddProject = async () => {
    const dir = await window.breadcrumbAPI?.selectDirectory();
    if (dir) addProject(dir);
  };

  const handleCopyPath = useCallback((path: string) => {
    navigator.clipboard.writeText(path);
  }, []);

  // Auto-expand when a NEW project becomes active (not on re-click)
  const prevActiveIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (activeProject && activeProject.id !== prevActiveIdRef.current) {
      prevActiveIdRef.current = activeProject.id;
      setExpandedIds((prev) => {
        const next = new Set(prev);
        next.add(activeProject.id);
        return next;
      });
    }
  }, [activeProject]);

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 py-12 text-center">
        <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center mb-3">
          <FolderOpen className="w-5 h-5 text-foreground-muted" />
        </div>
        <p className="text-sm text-foreground-secondary mb-1">No projects open</p>
        <p className="text-2xs text-foreground-muted mb-4">
          Add a project folder to get started
        </p>
        <button
          onClick={handleAddProject}
          className="text-2xs text-primary hover:text-primary/80 transition-default font-medium"
        >
          Open Folder...
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto scrollbar-thin py-1">
        {projects.map((project) => {
          const isActive = project.id === activeProject?.id;
          const isExpanded = expandedIds.has(project.id);
          const terminalCount = tabs.filter(
            (t) => t.type === "terminal" && t.projectId === project.id
          ).length;

          return (
            <div key={project.id} className="px-2 mb-0.5">
              {/* Project card with context menu */}
              <ContextMenu
                content={
                  <>
                    <MenuItem
                      icon={<Plus className="w-3.5 h-3.5" />}
                      label="New Terminal"
                      onSelect={() =>
                        addTab({
                          id: `terminal-${Date.now()}`,
                          type: "terminal",
                          title: project.name,
                          projectId: project.id,
                        })
                      }
                    />
                    <MenuItem
                      icon={<Copy className="w-3.5 h-3.5" />}
                      label="Copy Path"
                      onSelect={() => handleCopyPath(project.path)}
                    />
                    <MenuSeparator />
                    <MenuItem
                      icon={<Trash2 className="w-3.5 h-3.5" />}
                      label="Remove Project"
                      destructive
                      onSelect={() => removeProject(project.id)}
                    />
                  </>
                }
              >
                <button
                  onClick={() => {
                    if (!isActive) {
                      setActiveProject(project.id);
                    }
                    setExpandedIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(project.id)) next.delete(project.id);
                      else next.add(project.id);
                      return next;
                    });
                  }}
                  className={`group w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left transition-default ${
                    isActive
                      ? "bg-accent-secondary/10 border border-accent-secondary/20"
                      : "text-foreground-secondary hover:bg-muted/50 border border-transparent"
                  }`}
                >
                  <ChevronRight
                    className={`w-3 h-3 shrink-0 text-foreground-muted transition-transform duration-150 ${
                      isExpanded ? "rotate-90" : ""
                    }`}
                  />
                  <FolderOpen
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? "text-accent-secondary" : "text-foreground-muted"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium truncate ${isActive ? "text-accent-secondary" : ""}`}>
                      {project.name}
                    </div>
                    <div className="text-2xs text-foreground-muted truncate">
                      {project.path}
                    </div>
                  </div>
                  {terminalCount > 0 && (
                    <span className="shrink-0 flex items-center gap-0.5 text-2xs text-foreground-muted tabular-nums">
                      <Terminal className="w-2.5 h-2.5" />
                      {terminalCount}
                    </span>
                  )}
                </button>
              </ContextMenu>

              {/* Expanded project actions */}
              {isExpanded && (
                <div className="ml-5 mt-1 mb-2 space-y-0.5">
                  <button
                    onClick={() =>
                      addTab({
                        id: `terminal-${Date.now()}`,
                        type: "terminal",
                        title: project.name,
                        projectId: project.id,
                      })
                    }
                    className="w-full flex items-center gap-2 px-2 py-1 rounded-md text-left text-2xs text-foreground-muted hover:text-foreground-secondary hover:bg-muted/50 transition-default"
                  >
                    <Plus className="w-3 h-3" />
                    <span>New Terminal</span>
                  </button>
                  <button
                    onClick={() => handleCopyPath(project.path)}
                    className="w-full flex items-center gap-2 px-2 py-1 rounded-md text-left text-2xs text-foreground-muted hover:text-foreground-secondary hover:bg-muted/50 transition-default"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Copy Path</span>
                  </button>
                  <button
                    onClick={() => removeProject(project.id)}
                    className="w-full flex items-center gap-2 px-2 py-1 rounded-md text-left text-2xs text-foreground-muted hover:text-destructive hover:bg-destructive/10 transition-default"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Remove Project</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add project footer */}
      <div className="border-t border-border p-2 shrink-0">
        <button
          onClick={handleAddProject}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-foreground-muted hover:text-foreground-secondary hover:bg-muted/50 transition-default"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="text-2xs">Add Project</span>
        </button>
      </div>
    </div>
  );
}

function TerminalsView() {
  const tabs = useAppStore((s) => s.tabs);
  const activeTabId = useAppStore((s) => s.activeTabId);
  const terminalPanes = useAppStore((s) => s.terminalPanes);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const setActivePane = useAppStore((s) => s.setActivePane);
  const removeTab = useAppStore((s) => s.removeTab);
  const addTab = useAppStore((s) => s.addTab);
  const addPane = useAppStore((s) => s.addPane);
  const removePane = useAppStore((s) => s.removePane);
  const togglePaneZoom = useAppStore((s) => s.togglePaneZoom);
  const zoomedPane = useAppStore((s) => s.zoomedPane);
  const projects = useProjectsStore((s) => s.projects);
  const terminalTabs = tabs.filter((t) => t.type === "terminal");

  // Track expanded state for tree nodes
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Auto-expand project groups and active tab
  useEffect(() => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      // Expand all project groups by default
      for (const tab of terminalTabs) {
        const groupKey = `group-${tab.projectId || "ungrouped"}`;
        next.add(groupKey);
      }
      // Expand active tab if it has multiple panes
      if (activeTabId) {
        const paneState = terminalPanes[activeTabId];
        if (paneState && paneState.panes.length > 1) {
          next.add(activeTabId);
        }
      }
      return next;
    });
  }, [terminalTabs.length, activeTabId, terminalPanes]);

  const handleToggle = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelect = useCallback(
    (id: string) => {
      // If it's a pane node (format: "tabId:paneId")
      if (id.includes(":")) {
        const [tabId, paneId] = id.split(":");
        setActiveTab(tabId);
        setActivePane(tabId, paneId);
        return;
      }
      // If it's a tab node, switch to that tab
      const tab = terminalTabs.find((t) => t.id === id);
      if (tab) {
        setActiveTab(tab.id);
        return;
      }
    },
    [terminalTabs, setActiveTab, setActivePane]
  );

  // Build tree data
  const treeNodes = useMemo(() => {
    // Group terminals by project
    const grouped = new Map<string | null, typeof terminalTabs>();
    for (const tab of terminalTabs) {
      const key = tab.projectId || null;
      const list = grouped.get(key) || [];
      list.push(tab);
      grouped.set(key, list);
    }

    const nodes: TreeNodeType[] = [];

    for (const [projectId, groupTabs] of grouped.entries()) {
      const project = projectId ? projects.find((p) => p.id === projectId) : null;
      const groupId = `group-${projectId || "ungrouped"}`;

      const tabNodes: TreeNodeType[] = groupTabs.map((tab) => {
        const paneState = terminalPanes[tab.id];
        const panes = paneState?.panes || [];
        const hasMultiplePanes = panes.length > 1;

        // Build pane children (only when multiple panes)
        const paneChildren: TreeNodeType[] = hasMultiplePanes
          ? panes.map((pane, i) => {
              const isPaneZoomed = zoomedPane?.tabId === tab.id && zoomedPane?.paneId === pane.id;
              return {
                id: `${tab.id}:${pane.id}`,
                label: resolveLabel(pane, i),
                icon: <ProcessIcon processName={pane.processName} className="w-3 h-3" />,
                isActive: tab.id === activeTabId && paneState?.activePane === pane.id,
                badge: isPaneZoomed ? (
                  <Maximize2 className="w-2.5 h-2.5 text-accent-secondary" />
                ) : undefined,
              };
            })
          : [];

        // When single pane, reflect its process icon on the tab node
        const singlePane = !hasMultiplePanes && panes.length === 1 ? panes[0] : null;
        const tabIcon = <ProcessIcon processName={singlePane?.processName} className="w-3.5 h-3.5" />;

        return {
          id: tab.id,
          label: tab.title,
          icon: tabIcon,
          isActive: tab.id === activeTabId,
          children: paneChildren.length > 0 ? paneChildren : undefined,
          expanded: expandedIds.has(tab.id),
          badge: hasMultiplePanes ? (
            <span className="flex items-center gap-0.5">
              <Columns2 className="w-2.5 h-2.5" />
              {panes.length}
            </span>
          ) : undefined,
        };
      });

      nodes.push({
        id: groupId,
        label: project?.name || "General",
        icon: <FolderTree className="w-3.5 h-3.5" />,
        children: tabNodes,
        expanded: expandedIds.has(groupId),
      });
    }

    return nodes;
  }, [terminalTabs, projects, terminalPanes, activeTabId, expandedIds, zoomedPane]);

  if (terminalTabs.length === 0) {
    return (
      <EmptyState
        icon={Terminal}
        title="No terminals"
        description="Terminal sessions will appear here"
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto scrollbar-thin py-1">
        <TreeView
          nodes={treeNodes}
          label="Terminal sessions"
          selectedId={activeTabId}
          onSelect={handleSelect}
          onToggle={handleToggle}
          onEscape={() => {
            // Return focus to the active terminal pane
            const terminalEl = document.querySelector<HTMLElement>(".xterm-helper-textarea");
            terminalEl?.focus();
          }}
          renderActions={(node) => {
            // Only show close button on terminal tab nodes (not groups or panes)
            const isTab = terminalTabs.some((t) => t.id === node.id);
            if (!isTab) return null;
            return (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeTab(node.id);
                }}
                className="p-0.5 rounded hover:bg-destructive/20 hover:text-destructive transition-default"
                title="Close terminal"
              >
                <X className="w-3 h-3" />
              </button>
            );
          }}
          renderContextMenu={(node, children) => {
            const isTab = terminalTabs.some((t) => t.id === node.id);
            const isPane = node.id.includes(":");
            const isGroup = node.id.startsWith("group-");

            if (isTab) {
              return (
                <ContextMenu
                  content={
                    <>
                      <MenuItem
                        icon={<SplitSquareVertical className="w-3.5 h-3.5" />}
                        label="Split Horizontal"
                        shortcut="⌘D"
                        onSelect={() => addPane(node.id, "horizontal")}
                      />
                      <MenuItem
                        icon={<Rows3 className="w-3.5 h-3.5" />}
                        label="Split Vertical"
                        shortcut="⇧⌘D"
                        onSelect={() => addPane(node.id, "vertical")}
                      />
                      <MenuSeparator />
                      <MenuItem
                        icon={<X className="w-3.5 h-3.5" />}
                        label="Close Terminal"
                        shortcut="⌘W"
                        destructive
                        onSelect={() => removeTab(node.id)}
                      />
                    </>
                  }
                >
                  {children}
                </ContextMenu>
              );
            }

            if (isPane) {
              const [tabId, paneId] = node.id.split(":");
              const paneState = terminalPanes[tabId];
              const pane = paneState?.panes.find((p) => p.id === paneId);
              const isPaneZoomed = zoomedPane?.tabId === tabId && zoomedPane?.paneId === paneId;
              const canZoom = (paneState?.panes.length || 0) > 1;
              return (
                <ContextMenu
                  content={
                    <>
                      <MenuItem
                        icon={<Pencil className="w-3.5 h-3.5" />}
                        label="Rename Pane"
                        onSelect={() => {
                          setActiveTab(tabId);
                          setActivePane(tabId, paneId);
                        }}
                      />
                      {canZoom && (
                        <MenuItem
                          icon={isPaneZoomed
                            ? <Minimize2 className="w-3.5 h-3.5" />
                            : <Maximize2 className="w-3.5 h-3.5" />
                          }
                          label={isPaneZoomed ? "Restore Panes" : "Maximize Pane"}
                          shortcut="⇧⌘↵"
                          onSelect={() => togglePaneZoom(tabId, paneId)}
                        />
                      )}
                      {pane?.cwd && (
                        <MenuItem
                          icon={<Copy className="w-3.5 h-3.5" />}
                          label="Copy CWD"
                          onSelect={() => navigator.clipboard.writeText(pane.cwd)}
                        />
                      )}
                      <MenuSeparator />
                      <MenuItem
                        icon={<X className="w-3.5 h-3.5" />}
                        label="Close Pane"
                        destructive
                        onSelect={() => removePane(tabId, paneId)}
                      />
                    </>
                  }
                >
                  {children}
                </ContextMenu>
              );
            }

            if (isGroup) {
              const projectId = node.id.replace("group-", "");
              const project = projectId !== "ungrouped"
                ? projects.find((p) => p.id === projectId)
                : null;
              return (
                <ContextMenu
                  content={
                    <MenuItem
                      icon={<Plus className="w-3.5 h-3.5" />}
                      label="New Terminal"
                      onSelect={() =>
                        addTab({
                          id: `terminal-${Date.now()}`,
                          type: "terminal",
                          title: project?.name || "Terminal",
                          projectId: project?.id,
                        })
                      }
                    />
                  }
                >
                  {children}
                </ContextMenu>
              );
            }

            return <>{children}</>;
          }}
        />
      </div>

      {/* New terminal footer */}
      <div className="border-t border-border p-2 shrink-0">
        <button
          onClick={() => {
            const activeProject = projects.find((p) =>
              terminalTabs.some((t) => t.projectId === p.id)
            );
            addTab({
              id: `terminal-${Date.now()}`,
              type: "terminal",
              title: activeProject?.name || "Terminal",
              projectId: activeProject?.id,
            });
          }}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-foreground-muted hover:text-foreground-secondary hover:bg-muted/50 transition-default"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="text-2xs">New Terminal</span>
        </button>
      </div>
    </div>
  );
}


function SettingsView() {
  const { loadSettings, updateTerminalSetting, resetSettings, loaded } = useSettingsStore();
  const terminal = useTerminalSettings();

  useEffect(() => {
    if (!loaded) loadSettings();
  }, [loaded, loadSettings]);

  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-32">
        <span className="text-2xs text-foreground-muted">Loading settings...</span>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-4">
      {/* Terminal section */}
      <div>
        <h3 className="text-2xs font-semibold uppercase tracking-widest text-foreground-muted mb-3">
          Terminal
        </h3>
        <div className="space-y-3">
          {/* Font Family */}
          <SettingRow label="Font Family">
            <select
              value={terminal.fontFamily}
              onChange={(e) => updateTerminalSetting("fontFamily", e.target.value)}
              className="w-full bg-background border border-border rounded-md px-2 py-1.5 text-sm text-foreground outline-none focus:border-primary/50 transition-default"
            >
              <option value="'JetBrains Mono', 'SF Mono', 'Fira Code', 'Cascadia Code', Menlo, Monaco, monospace">
                JetBrains Mono
              </option>
              <option value="'SF Mono', Menlo, Monaco, monospace">SF Mono</option>
              <option value="'Fira Code', monospace">Fira Code</option>
              <option value="'Cascadia Code', monospace">Cascadia Code</option>
              <option value="Menlo, Monaco, monospace">Menlo</option>
              <option value="Monaco, monospace">Monaco</option>
            </select>
          </SettingRow>

          {/* Font Size */}
          <SettingRow label="Font Size">
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={8}
                max={32}
                value={terminal.fontSize}
                onChange={(e) => updateTerminalSetting("fontSize", Number(e.target.value))}
                className="flex-1 accent-primary"
              />
              <span className="text-sm text-foreground tabular-nums w-8 text-right">
                {terminal.fontSize}
              </span>
            </div>
          </SettingRow>

          {/* Scrollback */}
          <SettingRow label="Scrollback Lines">
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={100000}
                step={1000}
                value={terminal.scrollback}
                onChange={(e) => updateTerminalSetting("scrollback", Number(e.target.value))}
                className="flex-1 accent-primary"
              />
              <span className="text-sm text-foreground tabular-nums w-14 text-right">
                {terminal.scrollback.toLocaleString()}
              </span>
            </div>
          </SettingRow>

          {/* Cursor Style */}
          <SettingRow label="Cursor Style">
            <div className="flex gap-1">
              {(["block", "underline", "bar"] as const).map((style) => (
                <button
                  key={style}
                  onClick={() => updateTerminalSetting("cursorStyle", style)}
                  className={`px-3 py-1.5 text-sm rounded-md transition-default capitalize ${
                    terminal.cursorStyle === style
                      ? "bg-accent-secondary/20 text-accent-secondary border border-accent-secondary/30"
                      : "bg-background border border-border text-foreground-secondary hover:bg-muted/50"
                  }`}
                >
                  {style}
                </button>
              ))}
            </div>
          </SettingRow>

          {/* Cursor Blink */}
          <SettingRow label="Cursor Blink">
            <button
              onClick={() => updateTerminalSetting("cursorBlink", !terminal.cursorBlink)}
              className={`relative w-9 h-5 rounded-full transition-default ${
                terminal.cursorBlink ? "bg-primary" : "bg-muted"
              }`}
            >
              <div
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-default ${
                  terminal.cursorBlink ? "left-[18px]" : "left-0.5"
                }`}
              />
            </button>
          </SettingRow>

          {/* Default Shell */}
          <SettingRow label="Default Shell">
            <select
              value={terminal.defaultShell}
              onChange={(e) => updateTerminalSetting("defaultShell", e.target.value)}
              className="w-full bg-background border border-border rounded-md px-2 py-1.5 text-sm text-foreground outline-none focus:border-primary/50 transition-default"
            >
              <option value="/bin/zsh">zsh</option>
              <option value="/bin/bash">bash</option>
              <option value="/usr/local/bin/fish">fish</option>
            </select>
          </SettingRow>
        </div>
      </div>

      {/* Reset */}
      <div className="pt-2 border-t border-border">
        <button
          onClick={resetSettings}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-foreground-muted hover:text-destructive hover:bg-destructive/10 rounded-md transition-default"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset to Defaults
        </button>
      </div>
    </div>
  );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-2xs font-medium text-foreground-secondary">{label}</label>
      {children}
    </div>
  );
}
