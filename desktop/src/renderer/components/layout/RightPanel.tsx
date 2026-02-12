import { useRightPanelPanes } from "../../store/appStore";
import { BrowserPanel } from "../browser/BrowserPanel";
import { PlanningPanel } from "../breadcrumb/PlanningPanel";
import { Globe, LayoutGrid } from "lucide-react";

export function RightPanel() {
  const panes = useRightPanelPanes();

  if (panes.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-10 h-10 rounded-xl bg-muted/30 flex items-center justify-center mx-auto mb-3">
            <LayoutGrid className="w-5 h-5 text-foreground-muted" />
          </div>
          <p className="text-xs text-foreground-muted">Right panel</p>
          <p className="text-2xs text-foreground-muted/60 mt-1">
            Open browser or planning from the sidebar
          </p>
        </div>
      </div>
    );
  }

  // Single pane — render full height
  if (panes.length === 1) {
    return (
      <div className="h-full flex flex-col bg-background">
        <PaneContent type={panes[0].type} />
      </div>
    );
  }

  // Multiple panes — stacked vertically (pli.3 will add PanelGroup split)
  return (
    <div className="h-full flex flex-col bg-background">
      {panes.map((pane, i) => (
        <div key={pane.id} className={`flex-1 ${i > 0 ? "border-t border-border" : ""}`}>
          <PaneContent type={pane.type} />
        </div>
      ))}
    </div>
  );
}

function PaneContent({ type }: { type: "browser" | "planning" }) {
  switch (type) {
    case "browser":
      return <BrowserPanel initialUrl="https://localhost:3000" />;
    case "planning":
      return <PlanningPanel />;
    default:
      return null;
  }
}

function PaneIcon({ type }: { type: "browser" | "planning" }) {
  switch (type) {
    case "browser":
      return <Globe className="w-3 h-3" />;
    case "planning":
      return <LayoutGrid className="w-3 h-3" />;
    default:
      return null;
  }
}
