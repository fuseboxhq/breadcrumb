import { useEffect, useRef, useState, useCallback } from "react";
import { Command } from "cmdk";
import { matchSorter } from "match-sorter";
import {
  Terminal,
  Globe,
  LayoutGrid,
  FolderTree,
  Puzzle,
  Settings,
  Plus,
  Search,
  Command as CommandIcon,
  Zap,
} from "lucide-react";
import { useAppStore, type SidebarView } from "../../store/appStore";

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: typeof Terminal;
  category: string;
  shortcut?: string;
  action: () => void;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const { addTab, setSidebarView } = useAppStore();

  // Register Cmd+K / Ctrl+K global listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setSearch("");
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const navigateToView = useCallback(
    (view: SidebarView) => {
      setSidebarView(view);
      setOpen(false);
    },
    [setSidebarView]
  );

  const commands: CommandItem[] = [
    {
      id: "new-terminal",
      label: "New Terminal",
      description: "Open a terminal session",
      icon: Terminal,
      category: "Actions",
      shortcut: "⌘T",
      action: () => {
        addTab({
          id: `terminal-${Date.now()}`,
          type: "terminal",
          title: `Terminal`,
        });
        setOpen(false);
      },
    },
    {
      id: "new-browser",
      label: "Open Browser",
      description: "Browse the web or preview dev server",
      icon: Globe,
      category: "Actions",
      shortcut: "⌘B",
      action: () => {
        addTab({
          id: `browser-${Date.now()}`,
          type: "browser",
          title: "Browser",
          url: "https://localhost:3000",
        });
        setOpen(false);
      },
    },
    {
      id: "open-planner",
      label: "Open Planner",
      description: "View phases, tasks, and project status",
      icon: LayoutGrid,
      category: "Actions",
      action: () => {
        addTab({
          id: `breadcrumb-${Date.now()}`,
          type: "breadcrumb",
          title: "Planner",
        });
        setOpen(false);
      },
    },
    {
      id: "view-explorer",
      label: "Show Explorer",
      description: "File explorer sidebar",
      icon: FolderTree,
      category: "Navigation",
      action: () => navigateToView("explorer"),
    },
    {
      id: "view-terminals",
      label: "Show Terminals",
      description: "Terminal sessions sidebar",
      icon: Terminal,
      category: "Navigation",
      action: () => navigateToView("terminals"),
    },
    {
      id: "view-breadcrumb",
      label: "Show Breadcrumb",
      description: "Planning sidebar",
      icon: LayoutGrid,
      category: "Navigation",
      action: () => navigateToView("breadcrumb"),
    },
    {
      id: "view-browser",
      label: "Show Browser Panel",
      description: "Browser sidebar",
      icon: Globe,
      category: "Navigation",
      action: () => navigateToView("browser"),
    },
    {
      id: "view-extensions",
      label: "Show Extensions",
      description: "Extensions sidebar",
      icon: Puzzle,
      category: "Navigation",
      action: () => navigateToView("extensions"),
    },
    {
      id: "view-settings",
      label: "Show Settings",
      description: "Application settings",
      icon: Settings,
      category: "Navigation",
      action: () => navigateToView("settings"),
    },
  ];

  const filtered = search
    ? matchSorter(commands, search, { keys: ["label", "description", "category"] })
    : commands;

  const groupedCommands = filtered.reduce(
    (acc, cmd) => {
      if (!acc[cmd.category]) acc[cmd.category] = [];
      acc[cmd.category].push(cmd);
      return acc;
    },
    {} as Record<string, CommandItem[]>
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={() => setOpen(false)}
      />

      {/* Palette */}
      <Command
        className="relative w-full max-w-lg glass border border-border-strong rounded-xl shadow-lg overflow-hidden animate-fade-in-up"
        shouldFilter={false}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="w-4 h-4 text-foreground-muted shrink-0" />
          <Command.Input
            ref={inputRef}
            value={search}
            onValueChange={setSearch}
            placeholder="Type a command..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-foreground-muted outline-none"
          />
          <kbd className="px-1.5 py-0.5 rounded bg-muted/50 text-foreground-muted text-2xs font-mono shrink-0">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <Command.List className="max-h-72 overflow-y-auto scrollbar-thin p-2">
          <Command.Empty className="px-4 py-8 text-center">
            <Zap className="w-6 h-6 text-foreground-muted mx-auto mb-2" />
            <p className="text-sm text-foreground-muted">No results found</p>
            <p className="text-2xs text-foreground-muted/60 mt-1">
              Try a different search term
            </p>
          </Command.Empty>

          {Object.entries(groupedCommands).map(([category, items]) => (
            <Command.Group
              key={category}
              heading={category}
              className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-2xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-foreground-muted"
            >
              {items.map((cmd) => (
                <Command.Item
                  key={cmd.id}
                  value={cmd.id}
                  onSelect={cmd.action}
                  className="flex items-center gap-3 px-2 py-2 rounded-lg text-sm cursor-pointer transition-default data-[selected=true]:bg-primary/10 data-[selected=true]:text-foreground text-foreground-secondary"
                >
                  <cmd.icon className="w-4 h-4 text-foreground-muted shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm">{cmd.label}</span>
                    {cmd.description && (
                      <span className="text-2xs text-foreground-muted ml-2">
                        {cmd.description}
                      </span>
                    )}
                  </div>
                  {cmd.shortcut && (
                    <kbd className="px-1.5 py-0.5 rounded bg-muted/40 text-foreground-muted text-2xs font-mono shrink-0">
                      {cmd.shortcut}
                    </kbd>
                  )}
                </Command.Item>
              ))}
            </Command.Group>
          ))}
        </Command.List>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-border text-2xs text-foreground-muted/60">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-muted/30 font-mono">↑↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-muted/30 font-mono">↵</kbd>
              Select
            </span>
          </div>
          <span className="flex items-center gap-1">
            <CommandIcon className="w-2.5 h-2.5" />K to toggle
          </span>
        </div>
      </Command>
    </div>
  );
}
