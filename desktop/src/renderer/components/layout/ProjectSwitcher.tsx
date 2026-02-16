import { useState, useRef, useEffect } from "react";
import {
  ChevronDown,
  FolderOpen,
  Plus,
  X,
  Check,
} from "lucide-react";
import { useProjectsStore, useActiveProject } from "../../store/projectsStore";

export function ProjectSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const projects = useProjectsStore((s) => s.projects);
  const activeProject = useActiveProject();
  const { addProject, setActiveProject, removeProject } = useProjectsStore();

  // Close dropdown on outside click or Escape
  useEffect(() => {
    if (!isOpen) {
      setConfirmingRemove(null);
      return;
    }
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleAddProject = async () => {
    const dir = await window.breadcrumbAPI?.selectDirectory();
    if (dir) {
      addProject(dir);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative no-drag" ref={dropdownRef}>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md hover:bg-background-raised transition-default"
      >
        <FolderOpen className="w-3.5 h-3.5 text-foreground-secondary" />
        <span className="text-sm text-foreground-secondary max-w-48 truncate">
          {activeProject?.name || "No project"}
        </span>
        <ChevronDown className={`w-3 h-3 text-foreground-muted transition-default ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-72 rounded-xl border border-border bg-background-overlay shadow-lg z-50 overflow-hidden animate-fade-in">
          {/* Header */}
          <div className="px-3 py-2 border-b border-border">
            <p className="text-2xs font-semibold uppercase tracking-widest text-foreground-muted">
              Projects
            </p>
          </div>

          {/* Project list */}
          <div className="max-h-64 overflow-y-auto scrollbar-thin py-1">
            {projects.length === 0 ? (
              <div className="px-3 py-4 text-center">
                <p className="text-sm text-foreground-muted">No projects open</p>
                <p className="text-2xs text-foreground-muted/60 mt-1">
                  Add a project folder to get started
                </p>
              </div>
            ) : (
              projects.map((project) => {
                const isActive = project.id === activeProject?.id;
                return (
                  <button
                    key={project.id}
                    className={`group w-full flex items-center gap-2 px-3 py-2 mx-1 rounded-lg cursor-pointer transition-default text-left ${
                      isActive
                        ? "bg-accent-secondary/10 text-accent-secondary"
                        : "text-foreground hover:bg-muted/50"
                    }`}
                    onClick={() => {
                      setActiveProject(project.id);
                      setIsOpen(false);
                    }}
                  >
                    <FolderOpen className={`w-4 h-4 shrink-0 ${isActive ? "text-accent-secondary" : "text-foreground-muted"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{project.name}</div>
                      <div className="text-2xs text-foreground-muted truncate font-mono">
                        {project.path}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {isActive && (
                        <Check className="w-3.5 h-3.5 text-accent-secondary" />
                      )}
                      {confirmingRemove === project.id ? (
                        <div className="flex items-center gap-1 animate-fade-in">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeProject(project.id);
                              setConfirmingRemove(null);
                            }}
                            className="px-1.5 py-0.5 rounded text-2xs font-medium bg-destructive/15 text-destructive hover:bg-destructive/25 transition-default"
                          >
                            Remove
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmingRemove(null);
                            }}
                            className="p-0.5 rounded hover:bg-muted/50 transition-default"
                          >
                            <X className="w-3 h-3 text-foreground-muted" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmingRemove(project.id);
                          }}
                          className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-muted/50 transition-default"
                          title="Remove project"
                        >
                          <X className="w-3 h-3 text-foreground-muted hover:text-destructive" />
                        </button>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Add project button */}
          <div className="border-t border-border p-1">
            <button
              onClick={handleAddProject}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-foreground-secondary hover:bg-muted/50 transition-default"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm">Add Project...</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
