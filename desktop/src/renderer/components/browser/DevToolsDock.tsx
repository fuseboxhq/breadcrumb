import { useRef, useEffect } from "react";
import { X, Terminal } from "lucide-react";
import { useAppStore } from "../../store/appStore";

/**
 * Bottom dock panel for Chrome DevTools.
 * Contains a header bar and a content area where the DevTools WebContentsView
 * will be positioned via bounds syncing (similar to BrowserPanel pattern).
 */
export function DevToolsDock() {
  const contentRef = useRef<HTMLDivElement>(null);
  const toggleDevToolsDock = useAppStore((s) => s.toggleDevToolsDock);

  // Bounds syncing for DevTools WebContentsView
  useEffect(() => {
    const el = contentRef.current;
    const api = window.breadcrumbAPI?.browser;
    if (!el || !api) return;

    let rafId: number | null = null;

    const sendBounds = () => {
      const rect = el.getBoundingClientRect();
      const width = Math.round(rect.width);
      const height = Math.round(rect.height);

      if (width < 10 || height < 10) {
        api.setDevToolsBounds({ x: -10000, y: -10000, width: 1, height: 1 });
        return;
      }

      api.setDevToolsBounds({
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width,
        height,
      });
    };

    const resizeObserver = new ResizeObserver(() => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        sendBounds();
      });
    });

    resizeObserver.observe(el);
    sendBounds();

    // Open DevTools when dock mounts
    api.openDevTools();

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      api.setDevToolsBounds({ x: -10000, y: -10000, width: 1, height: 1 });
      api.closeDevTools();
    };
  }, []);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Dock header */}
      <div className="h-8 flex items-center justify-between px-3 bg-background-raised border-t border-border shrink-0">
        <div className="flex items-center gap-1.5">
          <Terminal className="w-3.5 h-3.5 text-dracula-orange" />
          <span className="text-2xs font-medium text-foreground-secondary">DevTools</span>
          <span className="text-2xs text-foreground-muted/50 ml-1">Cmd+Option+I</span>
        </div>
        <button
          onClick={toggleDevToolsDock}
          className="p-1 rounded hover:bg-muted/50 text-foreground-muted hover:text-foreground-secondary transition-default"
          title="Close DevTools"
          aria-label="Close DevTools dock"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* DevTools content area — WebContentsView overlays this div */}
      <div ref={contentRef} className="flex-1" />
    </div>
  );
}
