import { useState, useCallback, useEffect, useRef } from "react";
import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Globe,
  ExternalLink,
  Lock,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";

interface BrowserPanelProps {
  initialUrl?: string;
}

export function BrowserPanel({ initialUrl }: BrowserPanelProps) {
  const [url, setUrl] = useState(initialUrl || "https://localhost:3000");
  const [inputUrl, setInputUrl] = useState(url);
  const [loading, setLoading] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [pageTitle, setPageTitle] = useState("");
  const [error, setError] = useState<{ code: number; description: string; url: string } | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const createdRef = useRef(false);

  // Create/destroy browser WebContentsView on mount/unmount
  useEffect(() => {
    const api = window.breadcrumbAPI?.browser;
    if (!api) return;

    let destroyed = false;

    const init = async () => {
      await api.create();
      if (destroyed) {
        await api.destroy();
        return;
      }
      createdRef.current = true;

      // Navigate to initial URL after creation
      await api.navigate(initialUrl || "https://localhost:3000");
    };

    init();

    return () => {
      destroyed = true;
      if (createdRef.current) {
        api.destroy();
        createdRef.current = false;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Bounds syncing: ResizeObserver + rAF throttled IPC
  useEffect(() => {
    const el = contentRef.current;
    const api = window.breadcrumbAPI?.browser;
    if (!el || !api) return;

    let rafId: number | null = null;

    const sendBounds = () => {
      const rect = el.getBoundingClientRect();
      const width = Math.round(rect.width);
      const height = Math.round(rect.height);

      // Hide view when content area is too small (panel collapsed)
      if (width < 10 || height < 10) {
        api.setBounds({ x: -10000, y: -10000, width: 1, height: 1 });
        return;
      }

      api.setBounds({
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

    // Send initial bounds
    sendBounds();

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      resizeObserver.disconnect();

      // Move view off-screen on unmount (before destroy fires)
      api.setBounds({ x: -10000, y: -10000, width: 1, height: 1 });
    };
  }, []);

  // Subscribe to navigation events from main process
  useEffect(() => {
    const api = window.breadcrumbAPI?.browser;
    if (!api) return;

    const unsubNavigate = api.onNavigate((data) => {
      setUrl(data.url);
      setInputUrl(data.url);
      setCanGoBack(data.canGoBack);
      setCanGoForward(data.canGoForward);
      setError(null); // Clear error on successful navigation
    });

    const unsubLoading = api.onLoadingChange((data) => {
      setLoading(data.isLoading);
    });

    const unsubTitle = api.onTitleChange((data) => {
      setPageTitle(data.title);
    });

    const unsubError = api.onError((data) => {
      setError({
        code: data.errorCode,
        description: data.errorDescription,
        url: data.validatedURL,
      });
    });

    return () => {
      unsubNavigate();
      unsubLoading();
      unsubTitle();
      unsubError();
    };
  }, []);

  // Navigation handlers
  const handleNavigate = useCallback((newUrl: string) => {
    const api = window.breadcrumbAPI?.browser;
    if (!api) return;
    api.navigate(newUrl);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleNavigate(inputUrl);
  };

  const handleBack = useCallback(() => {
    window.breadcrumbAPI?.browser?.goBack();
  }, []);

  const handleForward = useCallback(() => {
    window.breadcrumbAPI?.browser?.goForward();
  }, []);

  const handleReload = useCallback(() => {
    window.breadcrumbAPI?.browser?.reload();
  }, []);

  const handleOpenExternal = useCallback(() => {
    window.breadcrumbAPI?.browser?.openExternal(url);
  }, [url]);

  const handleRetry = useCallback(() => {
    setError(null);
    window.breadcrumbAPI?.browser?.reload();
  }, []);

  const isSecure = url.startsWith("https://");

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Navigation bar */}
      <div className="h-10 flex items-center gap-1.5 px-2 bg-background-raised border-b border-border shrink-0">
        <button
          className="p-1.5 rounded-md text-foreground-muted hover:text-foreground-secondary hover:bg-muted/50 transition-default disabled:opacity-30 disabled:pointer-events-none"
          title="Back"
          aria-label="Go back"
          onClick={handleBack}
          disabled={!canGoBack}
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <button
          className="p-1.5 rounded-md text-foreground-muted hover:text-foreground-secondary hover:bg-muted/50 transition-default disabled:opacity-30 disabled:pointer-events-none"
          title="Forward"
          aria-label="Go forward"
          onClick={handleForward}
          disabled={!canGoForward}
        >
          <ArrowRight className="w-4 h-4" />
        </button>
        <button
          className="p-1.5 rounded-md text-foreground-muted hover:text-foreground-secondary hover:bg-muted/50 transition-default"
          title="Reload"
          aria-label="Reload page"
          onClick={handleReload}
        >
          <RotateCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>

        {/* URL bar */}
        <form onSubmit={handleSubmit} className="flex-1">
          <div className="flex items-center gap-2 bg-background border border-border hover:border-border-strong focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/20 rounded-lg px-3 py-1.5 transition-default">
            {isSecure ? (
              <Lock className="w-3 h-3 text-dracula-green shrink-0" />
            ) : (
              <Globe className="w-3 h-3 text-foreground-muted shrink-0" />
            )}
            <input
              type="text"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              onFocus={(e) => e.target.select()}
              className="flex-1 bg-transparent text-sm outline-none text-foreground placeholder:text-foreground-muted font-mono text-2xs"
              placeholder="Enter URL..."
              aria-label="URL address bar"
            />
          </div>
        </form>

        <button
          className="p-1.5 rounded-md text-foreground-muted hover:text-foreground-secondary hover:bg-muted/50 transition-default"
          title="Open in external browser"
          aria-label="Open in external browser"
          onClick={handleOpenExternal}
        >
          <ExternalLink className="w-4 h-4" />
        </button>
      </div>

      {/* Browser content area — WebContentsView overlays this div */}
      <div ref={contentRef} className="flex-1 relative">
        {error && <BrowserError error={error} onRetry={handleRetry} />}
      </div>
    </div>
  );
}

function BrowserError({
  error,
  onRetry,
}: {
  error: { code: number; description: string; url: string };
  onRetry: () => void;
}) {
  const isConnectionRefused = error.code === -102 || error.code === -106;
  const isDns = error.code === -105 || error.code === -137;

  let title = "Page failed to load";
  let hint = error.description;

  if (isConnectionRefused) {
    title = "Connection refused";
    hint = "Make sure your dev server is running, then retry.";
  } else if (isDns) {
    title = "Server not found";
    hint = "Check the URL and your network connection.";
  }

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background">
      <div className="text-center animate-fade-in max-w-sm px-8">
        <div className="w-14 h-14 rounded-2xl bg-dracula-red/10 flex items-center justify-center mx-auto mb-5">
          <AlertTriangle className="w-7 h-7 text-dracula-red" />
        </div>
        <p className="text-sm font-medium text-foreground mb-1.5">{title}</p>
        <p className="text-2xs text-foreground-muted mb-1 font-mono bg-background-raised px-3 py-1.5 rounded-lg inline-block break-all">
          {error.url}
        </p>
        <p className="text-2xs text-foreground-muted/70 mb-5">{hint}</p>
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-medium transition-default"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry
        </button>
      </div>
    </div>
  );
}
