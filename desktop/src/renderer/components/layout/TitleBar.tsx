import { Zap, ChevronRight } from "lucide-react";
import { ProjectSwitcher } from "./ProjectSwitcher";

export function TitleBar() {
  return (
    <div className="h-11 bg-background border-b border-border flex items-center justify-between px-4 titlebar-drag-region shrink-0 relative">
      {/* Subtle bottom accent line */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent-secondary/25 to-transparent" />

      {/* macOS traffic light spacer */}
      <div className="w-[72px] shrink-0" />

      {/* Center: app title + project switcher */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-accent-secondary" />
          <span className="text-sm font-semibold text-foreground tracking-tight">
            Breadcrumb
          </span>
        </div>
        <ChevronRight className="w-3 h-3 text-foreground-muted/50" />
        <ProjectSwitcher />
      </div>

      {/* Right spacer for symmetry */}
      <div className="w-[72px] shrink-0" />
    </div>
  );
}
