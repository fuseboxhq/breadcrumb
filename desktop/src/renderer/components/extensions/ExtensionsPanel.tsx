import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Play, Square, FolderOpen, Puzzle } from "lucide-react";
import { SkeletonList } from "../ui/Skeleton";
import {
  ExtensionDetailModal,
  resolveExtensionIcon,
} from "./ExtensionDetailModal";
import type { ExtensionInfoForRenderer } from "../../../main/extensions/types";

export function ExtensionsPanel() {
  const [extensions, setExtensions] = useState<ExtensionInfoForRenderer[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailExt, setDetailExt] = useState<ExtensionInfoForRenderer | null>(
    null
  );

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
      if (Array.isArray(exts)) {
        setExtensions(exts);
        // Keep detail modal in sync if the viewed extension changed
        if (detailExt) {
          const updated = exts.find(
            (e: ExtensionInfoForRenderer) => e.id === detailExt.id
          );
          if (updated) setDetailExt(updated);
        }
      }
    });

    return () => cleanup?.();
  }, [loadExtensions, detailExt]);

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
      window.breadcrumbAPI?.browser.openExternal(
        `file://${home}/.breadcrumb/extensions`
      );
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
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Extension list */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {loading ? (
          <SkeletonList rows={3} />
        ) : extensions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-6 text-center animate-fade-in">
            <div className="w-10 h-10 rounded-xl bg-muted/30 flex items-center justify-center mb-3">
              <Puzzle className="w-5 h-5 text-foreground-muted" />
            </div>
            <p className="text-sm text-foreground-secondary mb-1">
              No extensions
            </p>
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
                onOpenDetail={() => setDetailExt(ext)}
                onToggle={() => handleToggle(ext)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Detail modal */}
      {detailExt && (
        <ExtensionDetailModal
          ext={detailExt}
          onClose={() => setDetailExt(null)}
          onToggle={() => handleToggle(detailExt)}
        />
      )}
    </div>
  );
}

function ExtensionCard({
  ext,
  onOpenDetail,
  onToggle,
}: {
  ext: ExtensionInfoForRenderer;
  onOpenDetail: () => void;
  onToggle: () => void;
}) {
  const ExtIcon = resolveExtensionIcon(ext.icon);

  return (
    <div className="rounded-lg border border-transparent hover:bg-background-raised transition-default group">
      <div className="flex items-start gap-2.5 p-2.5">
        {/* Click on icon+text opens detail modal */}
        <button
          onClick={onOpenDetail}
          className="flex items-start gap-2.5 flex-1 min-w-0 text-left"
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

        {/* Quick toggle */}
        <button
          onClick={onToggle}
          className={`
            shrink-0 p-1.5 rounded-md text-2xs transition-default opacity-0 group-hover:opacity-100
            ${
              ext.status === "active"
                ? "text-destructive hover:bg-destructive/10"
                : "text-success hover:bg-success/10"
            }
          `}
          title={ext.status === "active" ? "Deactivate" : "Activate"}
        >
          {ext.status === "active" ? (
            <Square className="w-3.5 h-3.5" />
          ) : (
            <Play className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
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
