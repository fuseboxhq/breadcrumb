import { useState, useCallback } from "react";
import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Globe,
  ExternalLink,
} from "lucide-react";

interface BrowserPanelProps {
  initialUrl?: string;
}

export function BrowserPanel({ initialUrl }: BrowserPanelProps) {
  const [url, setUrl] = useState(initialUrl || "https://google.com");
  const [inputUrl, setInputUrl] = useState(url);
  const [loading, setLoading] = useState(false);

  const navigate = useCallback((newUrl: string) => {
    let formatted = newUrl;
    if (!formatted.startsWith("http://") && !formatted.startsWith("https://")) {
      formatted = `https://${formatted}`;
    }
    setUrl(formatted);
    setInputUrl(formatted);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(inputUrl);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Navigation bar */}
      <div className="h-10 flex items-center gap-2 px-2 bg-background border-b border-border shrink-0">
        <button
          className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          title="Back"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <button
          className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          title="Forward"
        >
          <ArrowRight className="w-4 h-4" />
        </button>
        <button
          className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          title="Reload"
          onClick={() => navigate(url)}
        >
          <RotateCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>

        {/* URL bar */}
        <form onSubmit={handleSubmit} className="flex-1">
          <div className="flex items-center gap-2 bg-card border border-border rounded-md px-3 py-1">
            <Globe className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <input
              type="text"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground"
              placeholder="Enter URL..."
            />
          </div>
        </form>

        <button
          className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          title="Open in external browser"
        >
          <ExternalLink className="w-4 h-4" />
        </button>
      </div>

      {/* Browser content area */}
      {/* NOTE: Actual WebContentsView embedding requires main process integration.
         This is a placeholder that shows the URL. The full implementation will use
         Electron's WebContentsView API managed from the main process. */}
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-zinc-900">
        <div className="text-center">
          <Globe className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-sm text-foreground mb-1">Embedded Browser</p>
          <p className="text-xs text-muted-foreground mb-4">
            WebContentsView will render: {url}
          </p>
          <p className="text-xs text-muted-foreground max-w-sm">
            Full browser embedding via Electron's WebContentsView API will be
            wired in the main process with navigation controls, tab management,
            and security policies.
          </p>
        </div>
      </div>
    </div>
  );
}
