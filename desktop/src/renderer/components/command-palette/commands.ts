import {
  Terminal,
  Globe,
  LayoutGrid,
  FolderTree,
  Puzzle,
  Settings,
  Plus,
  Search,
  SplitSquareVertical,
  Rows3,
  Trash2,
  ArrowRightLeft,
  Bug,
} from "lucide-react";
import type { SidebarView } from "../../store/appStore";

export interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: typeof Terminal;
  category: string;
  shortcut?: string;
  action: () => void;
}

interface CommandContext {
  activeProjectName: string | null;
  activeProjectId: string | null;
  activeProjectPath: string | null;
  addTab: (tab: { id: string; type: "terminal"; title: string; projectId?: string }) => void;
  addRightPanelPane: (type: "browser" | "planning") => void;
  toggleRightPanel: () => void;
  navigateToView: (view: SidebarView) => void;
  addProject: (path: string) => void;
  startDebugSession: (projectPath: string) => void;
  dispatchKey: (key: string, opts?: { meta?: boolean; shift?: boolean; alt?: boolean }) => void;
  close: () => void;
}

export function buildCommands(ctx: CommandContext): CommandItem[] {
  const { activeProjectName, activeProjectId, close } = ctx;

  return [
    {
      id: "new-terminal",
      label: "New Terminal",
      description: activeProjectName ? `In ${activeProjectName}` : "Open a terminal session",
      icon: Terminal,
      category: "Actions",
      shortcut: "⌘T",
      action: () => {
        ctx.addTab({
          id: `terminal-${Date.now()}`,
          type: "terminal",
          title: activeProjectName || "Terminal",
          projectId: activeProjectId ?? undefined,
        });
        close();
      },
    },
    {
      id: "new-browser",
      label: "Open Browser",
      description: "Open browser in right panel",
      icon: Globe,
      category: "Actions",
      shortcut: "⌘B",
      action: () => { ctx.addRightPanelPane("browser"); close(); },
    },
    {
      id: "open-planner",
      label: "Open Planner",
      description: "Open planning dashboard in right panel",
      icon: LayoutGrid,
      category: "Actions",
      action: () => { ctx.addRightPanelPane("planning"); close(); },
    },
    {
      id: "toggle-right-panel",
      label: "Toggle Right Panel",
      description: "Show or hide the right panel",
      icon: LayoutGrid,
      category: "Navigation",
      shortcut: "⌘⇧B",
      action: () => { ctx.toggleRightPanel(); close(); },
    },
    {
      id: "view-explorer",
      label: "Show Explorer",
      description: "File explorer sidebar",
      icon: FolderTree,
      category: "Navigation",
      action: () => ctx.navigateToView("explorer"),
    },
    {
      id: "view-terminals",
      label: "Show Terminals",
      description: "Terminal sessions sidebar",
      icon: Terminal,
      category: "Navigation",
      action: () => ctx.navigateToView("terminals"),
    },
    {
      id: "view-breadcrumb",
      label: "Show Breadcrumb",
      description: "Planning dashboard in right panel",
      icon: LayoutGrid,
      category: "Navigation",
      action: () => { ctx.addRightPanelPane("planning"); close(); },
    },
    {
      id: "view-browser",
      label: "Show Browser Panel",
      description: "Browser in right panel",
      icon: Globe,
      category: "Navigation",
      action: () => { ctx.addRightPanelPane("browser"); close(); },
    },
    {
      id: "view-extensions",
      label: "Show Extensions",
      description: "Extensions sidebar",
      icon: Puzzle,
      category: "Navigation",
      action: () => ctx.navigateToView("extensions"),
    },
    {
      id: "view-settings",
      label: "Show Settings",
      description: "Application settings",
      icon: Settings,
      category: "Navigation",
      action: () => ctx.navigateToView("settings"),
    },
    {
      id: "add-project",
      label: "Add Project",
      description: "Open a folder as a workspace project",
      icon: Plus,
      category: "Actions",
      action: async () => {
        const dir = await window.breadcrumbAPI?.selectDirectory();
        if (dir) ctx.addProject(dir);
        close();
      },
    },
    // Debug
    {
      id: "debug-start",
      label: "Start Debug Session",
      description: activeProjectName ? `Debug in ${activeProjectName}` : "Open AI debug assistant",
      icon: Bug,
      category: "Debug",
      action: () => {
        ctx.startDebugSession(ctx.activeProjectPath || "");
        close();
      },
    },
    // Terminal commands
    {
      id: "terminal-split-horizontal",
      label: "Split Terminal Horizontally",
      description: "Split the active terminal pane",
      icon: Rows3,
      category: "Terminal",
      shortcut: "⌘D",
      action: () => ctx.dispatchKey("d"),
    },
    {
      id: "terminal-split-vertical",
      label: "Split Terminal Vertically",
      description: "Split the active terminal pane vertically",
      icon: SplitSquareVertical,
      category: "Terminal",
      shortcut: "⌘⇧D",
      action: () => ctx.dispatchKey("D", { shift: true }),
    },
    {
      id: "terminal-search",
      label: "Search in Terminal",
      description: "Find text in terminal output",
      icon: Search,
      category: "Terminal",
      shortcut: "⌘F",
      action: () => ctx.dispatchKey("f"),
    },
    {
      id: "terminal-navigate-next",
      label: "Next Pane",
      description: "Move focus to the next terminal pane",
      icon: ArrowRightLeft,
      category: "Terminal",
      shortcut: "⌘⌥→",
      action: () => ctx.dispatchKey("ArrowRight", { alt: true }),
    },
    {
      id: "terminal-clear",
      label: "Clear Terminal",
      description: "Send clear command to active terminal",
      icon: Trash2,
      category: "Terminal",
      shortcut: "⌘L",
      action: () => {
        close();
        requestAnimationFrame(() => {
          document.dispatchEvent(new KeyboardEvent("keydown", {
            key: "l",
            metaKey: true,
            bubbles: true,
          }));
        });
      },
    },
  ];
}
