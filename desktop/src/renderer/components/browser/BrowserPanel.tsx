import { useState, useCallback } from "react";
import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Globe,
  ExternalLink,
  Lock,
  Search,
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

  const isSecure = url.startsWith("https://");

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Navigation bar */}
      <div className="h-10 flex items-center gap-1.5 px-2 bg-background-raised border-b border-border shrink-0">
        <button
          className="p-1.5 rounded-md text-foreground-muted hover:text-foreground-secondary hover:bg-muted/50 transition-default"
          title="Back"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <button
          className="p-1.5 rounded-md text-foreground-muted hover:text-foreground-secondary hover:bg-muted/50 transition-default"
          title="Forward"
        >
          <ArrowRight className="w-4 h-4" />
        </button>
        <button
          className="p-1.5 rounded-md text-foreground-muted hover:text-foreground-secondary hover:bg-muted/50 transition-default"
          title="Reload"
          onClick={() => navigate(url)}
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
              className="flex-1 bg-transparent text-sm outline-none text-foreground placeholder:text-foreground-muted font-mono text-2xs"
              placeholder="Enter URL..."
            />
          </div>
        </form>

        <button
          className="p-1.5 rounded-md text-foreground-muted hover:text-foreground-secondary hover:bg-muted/50 transition-default"
          title="Open in external browser"
        >
          <ExternalLink className="w-4 h-4" />
        </button>
      </div>

      {/* Browser content area (placeholder) */}
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center animate-fade-in max-w-md px-8">
          <div className="w-16 h-16 rounded-2xl bg-dracula-cyan/10 flex items-center justify-center mx-auto mb-6">
            <Search className="w-8 h-8 text-dracula-cyan" />
          </div>
          <p className="text-sm font-medium text-foreground mb-2">Embedded Browser</p>
          <p className="text-2xs text-foreground-muted mb-4 font-mono bg-background-raised px-3 py-1.5 rounded-lg inline-block">
            {url}
          </p>
          <p className="text-2xs text-foreground-muted/60 leading-relaxed">
            Full browser embedding via Electron's WebContentsView API will render
            here with navigation controls, tab management, and security policies.
          </p>
        </div>
      </div>
    </div>
  );
}
