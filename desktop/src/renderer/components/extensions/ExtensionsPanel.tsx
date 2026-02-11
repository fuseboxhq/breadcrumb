import { useState, useEffect, useCallback } from "react";
import {
  Puzzle,
  RefreshCw,
  Play,
  Square,
  AlertCircle,
  CheckCircle2,
  Circle,
  Loader2,
  Database,
  Shield,
} from "lucide-react";

interface ExtensionInfo {
  id: string;
  displayName: string;
  version: string;
  description: string;
  status: string;
  publisher: string;
  capabilities: Record<string, unknown>;
  commands: Array<{ command: string; title: string; category?: string }>;
}

export function ExtensionsPanel() {
  const [extensions, setExtensions] = useState<ExtensionInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedExt, setSelectedExt] = useState<string | null>(null);

  const loadExtensions = useCallback(async () => {
    setLoading(true);
    try {
      const exts = await window.breadcrumbAPI?.getExtensions();
      setExtensions(exts || []);
    } catch {
      setExtensions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadExtensions();

    const cleanup = window.breadcrumbAPI?.onExtensionsChanged?.((exts) => {
      if (Array.isArray(exts)) setExtensions(exts);
    });

    return () => cleanup?.();
  }, [loadExtensions]);

  const handleToggle = async (ext: ExtensionInfo) => {
    if (ext.status === "active") {
      await window.breadcrumbAPI?.deactivateExtension(ext.id);
    } else {
      await window.breadcrumbAPI?.activateExtension(ext.id);
    }
    loadExtensions();
  };

  const StatusIcon = ({ status }: { status: string }) => {
    switch (status) {
      case "active":
        return <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />;
      case "activating":
        return <Loader2 className="w-3.5 h-3.5 text-yellow-500 animate-spin" />;
      case "failed":
        return <AlertCircle className="w-3.5 h-3.5 text-red-500" />;
      case "inactive":
      case "deactivating":
        return <Circle className="w-3.5 h-3.5 text-muted-foreground" />;
      default:
        return <Circle className="w-3.5 h-3.5 text-muted-foreground" />;
    }
  };

  const getExtIcon = (ext: ExtensionInfo) => {
    if (ext.id.includes("db") || ext.id.includes("database")) {
      return <Database className="w-8 h-8 text-muted-foreground" />;
    }
    return <Puzzle className="w-8 h-8 text-muted-foreground" />;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Extensions
        </span>
        <button
          onClick={loadExtensions}
          className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          title="Refresh"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Extension list */}
      <div className="flex-1 overflow-y-auto">
        {extensions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-4 text-center">
            <Puzzle className="w-8 h-8 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground mb-1">No extensions installed</p>
            <p className="text-xs text-muted-foreground">
              Add extensions to ~/.breadcrumb/extensions/
            </p>
          </div>
        ) : (
          <div className="py-1">
            {extensions.map((ext) => (
              <div key={ext.id}>
                <button
                  onClick={() =>
                    setSelectedExt(selectedExt === ext.id ? null : ext.id)
                  }
                  className={`
                    w-full text-left px-3 py-2.5 flex items-start gap-3 transition-colors
                    ${selectedExt === ext.id ? "bg-accent/50" : "hover:bg-accent/30"}
                  `}
                >
                  <div className="shrink-0 mt-0.5">{getExtIcon(ext)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <StatusIcon status={ext.status} />
                      <span className="text-sm font-medium truncate">
                        {ext.displayName}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {ext.description || "No description"}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-muted-foreground">
                        v{ext.version}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {ext.publisher}
                      </span>
                    </div>
                  </div>
                </button>

                {/* Detail panel */}
                {selectedExt === ext.id && (
                  <div className="px-3 pb-3 border-b border-border">
                    {/* Actions */}
                    <div className="flex items-center gap-2 mb-3">
                      <button
                        onClick={() => handleToggle(ext)}
                        className={`
                          flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md transition-colors
                          ${ext.status === "active"
                            ? "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                            : "bg-green-500/10 text-green-400 hover:bg-green-500/20"
                          }
                        `}
                      >
                        {ext.status === "active" ? (
                          <>
                            <Square className="w-3 h-3" /> Deactivate
                          </>
                        ) : (
                          <>
                            <Play className="w-3 h-3" /> Activate
                          </>
                        )}
                      </button>
                    </div>

                    {/* Capabilities */}
                    {Object.keys(ext.capabilities).length > 0 && (
                      <div className="mb-3">
                        <div className="flex items-center gap-1 mb-1.5">
                          <Shield className="w-3 h-3 text-muted-foreground" />
                          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                            Capabilities
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(ext.capabilities).map(
                            ([key, value]) => (
                              <span
                                key={key}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
                              >
                                {key}: {String(value)}
                              </span>
                            )
                          )}
                        </div>
                      </div>
                    )}

                    {/* Commands */}
                    {ext.commands.length > 0 && (
                      <div>
                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                          Commands
                        </span>
                        <div className="mt-1 space-y-1">
                          {ext.commands.map((cmd) => (
                            <div
                              key={cmd.command}
                              className="text-xs text-muted-foreground flex items-center gap-1.5"
                            >
                              <span className="font-mono text-[10px] text-foreground/70">
                                {cmd.command}
                              </span>
                              <span className="text-muted-foreground">
                                — {cmd.title}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
