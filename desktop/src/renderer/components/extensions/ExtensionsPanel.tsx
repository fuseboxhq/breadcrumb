import { useState, useEffect, useCallback } from "react";
import {
  Puzzle,
  RefreshCw,
  Play,
  Square,
  Database,
  Shield,
  Terminal,
  FolderOpen,
} from "lucide-react";
import { SkeletonList } from "../ui/Skeleton";
import type { ExtensionInfoForRenderer } from "../../../main/extensions/types";

export function ExtensionsPanel() {
  const [extensions, setExtensions] = useState<ExtensionInfoForRenderer[]>([]);
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

  const handleToggle = async (ext: ExtensionInfoForRenderer) => {
    if (ext.status === "active") {
      await window.breadcrumbAPI?.deactivateExtension(ext.id);
    } else {
      await window.breadcrumbAPI?.activateExtension(ext.id);
    }
    loadExtensions();
  };

  const handleOpenFolder = async () => {
    const home = await window.breadcrumbAPI?.getWorkingDirectory();
    if (home) {
      window.breadcrumbAPI?.browser.openExternal(`file://${home}/.breadcrumb/extensions`);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 shrink-0">
        <span className="text-2xs font-semibold uppercase tracking-widest text-foreground-muted">
          Installed
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleOpenFolder}
            className="p-1 rounded-md text-foreground-muted hover:text-foreground-secondary hover:bg-muted/50 transition-default focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:outline-none"
            title="Open Extensions Folder"
          >
            <FolderOpen className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={loadExtensions}
            className="p-1 rounded-md text-foreground-muted hover:text-foreground-secondary hover:bg-muted/50 transition-default focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:outline-none"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Extension list */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {loading ? (
          <SkeletonList rows={3} />
        ) : extensions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-6 text-center animate-fade-in">
            <div className="w-10 h-10 rounded-xl bg-dracula-purple/10 flex items-center justify-center mb-3">
              <Puzzle className="w-5 h-5 text-dracula-purple" />
            </div>
            <p className="text-sm text-foreground-secondary mb-1">No extensions</p>
            <p className="text-2xs text-foreground-muted">
              Add extensions to ~/.breadcrumb/extensions/
            </p>
          </div>
        ) : (
          <div className="px-2 pb-2 space-y-1">
            {extensions.map((ext) => (
              <ExtensionCard
                key={ext.id}
                ext={ext}
                isSelected={selectedExt === ext.id}
                onSelect={() =>
                  setSelectedExt(selectedExt === ext.id ? null : ext.id)
                }
                onToggle={() => handleToggle(ext)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ExtensionCard({
  ext,
  isSelected,
  onSelect,
  onToggle,
}: {
  ext: ExtensionInfoForRenderer;
  isSelected: boolean;
  onSelect: () => void;
  onToggle: () => void;
}) {
  const ExtIcon = getExtIcon(ext);

  return (
    <div
      className={`rounded-lg border transition-default ${
        isSelected
          ? "border-primary/20 bg-primary/5"
          : "border-transparent hover:bg-background-raised"
      }`}
    >
      <button
        onClick={onSelect}
        className="w-full text-left p-2.5 flex items-start gap-2.5"
      >
        <div className="shrink-0 w-8 h-8 rounded-lg bg-muted/40 flex items-center justify-center">
          <ExtIcon className="w-4 h-4 text-foreground-muted" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <StatusDot status={ext.status} />
            <span className="text-sm font-medium text-foreground truncate">
              {ext.displayName}
            </span>
          </div>
          <p className="text-2xs text-foreground-muted truncate">
            {ext.description || "No description"}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-2xs text-foreground-muted/60 font-mono">
              v{ext.version}
            </span>
            <span className="text-2xs text-foreground-muted/60">
              {ext.publisher}
            </span>
          </div>
        </div>
      </button>

      {/* Detail panel */}
      {isSelected && (
        <div className="px-2.5 pb-2.5 animate-fade-in">
          {/* Actions */}
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={onToggle}
              className={`
                flex items-center gap-1.5 px-2.5 py-1 text-2xs font-medium rounded-md transition-default
                ${ext.status === "active"
                  ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
                  : "bg-success/10 text-success hover:bg-success/20"
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
                <Shield className="w-3 h-3 text-foreground-muted" />
                <span className="text-2xs font-semibold text-foreground-muted uppercase tracking-widest">
                  Capabilities
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {Object.entries(ext.capabilities).map(([key, value]) => (
                  <span
                    key={key}
                    className="text-2xs px-1.5 py-0.5 rounded-md bg-muted/40 text-foreground-muted font-mono"
                  >
                    {key}: {String(value)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Commands */}
          {ext.commands.length > 0 && (
            <div>
              <div className="flex items-center gap-1 mb-1.5">
                <Terminal className="w-3 h-3 text-foreground-muted" />
                <span className="text-2xs font-semibold text-foreground-muted uppercase tracking-widest">
                  Commands
                </span>
              </div>
              <div className="space-y-1">
                {ext.commands.map((cmd) => (
                  <button
                    key={cmd.command}
                    onClick={() => window.breadcrumbAPI?.executeExtensionCommand(cmd.command)}
                    className="w-full text-left text-2xs flex items-center gap-1.5 px-1.5 py-0.5 rounded-md hover:bg-muted/50 transition-default focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:outline-none"
                    title={`Run ${cmd.command}`}
                  >
                    <code className="font-mono text-dracula-cyan/80">
                      {cmd.command}
                    </code>
                    <span className="text-foreground-muted">
                      — {cmd.title}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: "bg-success",
    activating: "bg-warning animate-pulse",
    failed: "bg-destructive",
    inactive: "bg-foreground-muted/40",
    deactivating: "bg-foreground-muted/40",
  };

  return (
    <span
      className={`w-1.5 h-1.5 rounded-full shrink-0 ${colors[status] || colors.inactive}`}
    />
  );
}

function getExtIcon(ext: ExtensionInfoForRenderer) {
  if (ext.id.includes("db") || ext.id.includes("database")) return Database;
  return Puzzle;
}
