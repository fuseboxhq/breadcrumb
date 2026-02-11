import { FolderOpen, ChevronRight } from "lucide-react";
import { useAppStore } from "../../store/appStore";

export function TitleBar() {
  const projectPath = useAppStore((s) => s.currentProjectPath);
  const projectName = projectPath?.split("/").pop() || "No project";

  return (
    <div className="h-10 bg-background border-b border-border flex items-center justify-between px-4 titlebar-drag-region shrink-0">
      {/* macOS traffic light spacer */}
      <div className="w-20" />

      {/* Title */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-foreground">Breadcrumb</span>
        {projectPath && (
          <>
            <ChevronRight className="w-3 h-3 text-muted-foreground" />
            <div className="no-drag flex items-center gap-1.5 px-2 py-1 rounded hover:bg-accent transition-colors">
              <FolderOpen className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground max-w-40 truncate">
                {projectName}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Spacer for symmetry */}
      <div className="w-20" />
    </div>
  );
}
