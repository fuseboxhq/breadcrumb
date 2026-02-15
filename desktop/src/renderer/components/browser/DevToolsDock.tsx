import { useRef, useEffect, useCallback } from "react";
import { X, Terminal } from "lucide-react";
import { useAppStore } from "../../store/appStore";
import { useBoundsSync } from "../../hooks/useBoundsSync";

/**
 * Bottom dock panel for Chrome DevTools.
 * Contains a header bar and a content area where the DevTools WebContentsView
 * will be positioned via bounds syncing (similar to BrowserPanel pattern).
 */
export function DevToolsDock() {
  const contentRef = useRef<HTMLDivElement>(null);
  const toggleDevToolsDock = useAppStore((s) => s.toggleDevToolsDock);

  // Bounds syncing for DevTools WebContentsView
  const setDevToolsBounds = useCallback(
    (bounds: Parameters<typeof window.breadcrumbAPI.browser.setDevToolsBounds>[0]) => {
      window.breadcrumbAPI?.browser?.setDevToolsBounds(bounds);
    },
    []
  );
  useBoundsSync(contentRef, setDevToolsBounds);

  // Open/close DevTools on mount/unmount
  useEffect(() => {
    const api = window.breadcrumbAPI?.browser;
    if (!api) return;
    api.openDevTools();
    return () => { api.closeDevTools(); };
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
