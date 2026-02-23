import { useEffect, useCallback } from "react";
import {
  Bug,
  Globe,
  Database,
  Puzzle,
  Wrench,
  Code,
  Shield,
  Zap,
  X,
  Play,
  Square,
  Terminal,
  Keyboard,
  LayoutGrid,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ExtensionInfoForRenderer } from "../../../main/extensions/types";
import { executeExtensionCommand } from "../../store/extensionStore";

// ── Icon resolver ─────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, LucideIcon> = {
  bug: Bug,
  globe: Globe,
  database: Database,
  puzzle: Puzzle,
  wrench: Wrench,
  code: Code,
  shield: Shield,
  zap: Zap,
  terminal: Terminal,
};

export function resolveExtensionIcon(name?: string): LucideIcon {
  return ICON_MAP[name || "puzzle"] || Puzzle;
}

// ── Modal ─────────────────────────────────────────────────────────────────────

interface ExtensionDetailModalProps {
  ext: ExtensionInfoForRenderer;
  onClose: () => void;
  onToggle: () => void;
}

export function ExtensionDetailModal({
  ext,
  onClose,
  onToggle,
}: ExtensionDetailModalProps) {
  const Icon = resolveExtensionIcon(ext.icon);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const hasCapabilities = Object.keys(ext.capabilities).length > 0;
  const hasCommands = ext.commands.length > 0;
  const hasViews =
    ext.contributes?.views && Object.keys(ext.contributes.views).length > 0;
  const hasKeybindings =
    ext.contributes?.keybindings && ext.contributes.keybindings.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg glass border border-border-strong rounded-xl shadow-lg overflow-hidden animate-fade-in-up">
        {/* Header */}
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className="shrink-0 w-10 h-10 rounded-xl bg-muted/40 flex items-center justify-center">
              <Icon className="w-5 h-5 text-foreground-muted" />
            </div>

            {/* Title + meta */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <h2 className="text-base font-semibold text-foreground truncate">
                  {ext.displayName}
                </h2>
                <StatusBadge status={ext.status} />
              </div>
              <div className="flex items-center gap-2 text-2xs text-foreground-muted">
                <span className="font-mono">v{ext.version}</span>
                <span>&middot;</span>
                <span>{ext.publisher}</span>
              </div>
            </div>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-1 rounded-md text-foreground-muted hover:text-foreground-secondary hover:bg-muted/50 transition-default"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Categories */}
          {ext.categories.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {ext.categories.map((cat) => (
                <span
                  key={cat}
                  className="text-2xs px-2 py-0.5 rounded-full bg-accent/10 text-accent font-medium"
                >
                  {cat}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Content — scrollable */}
        <div className="px-5 pb-4 max-h-[50vh] overflow-y-auto scrollbar-thin space-y-4">
          {/* Description */}
          {ext.description && (
            <p className="text-sm text-foreground-secondary leading-relaxed">
              {ext.description}
            </p>
          )}

          {/* Capabilities */}
          {hasCapabilities && (
            <Section icon={Shield} label="Capabilities">
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(ext.capabilities).map(([key, value]) => (
                  <span
                    key={key}
                    className="text-2xs px-2 py-0.5 rounded-md bg-muted/40 text-foreground-muted font-mono"
                  >
                    {key}: {String(value)}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {/* Commands */}
          {hasCommands && (
            <Section icon={Terminal} label="Commands">
              <div className="space-y-1">
                {ext.commands.map((cmd) => (
                  <button
                    key={cmd.command}
                    onClick={() => executeExtensionCommand(cmd.command)}
                    className="w-full text-left text-2xs flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 transition-default group"
                    title={`Run ${cmd.command}`}
                  >
                    <Play className="w-3 h-3 text-foreground-muted/40 group-hover:text-accent transition-default shrink-0" />
                    <span className="font-medium text-foreground-secondary">
                      {cmd.title}
                    </span>
                    <code className="ml-auto font-mono text-foreground-muted/60 truncate">
                      {cmd.command}
                    </code>
                  </button>
                ))}
              </div>
            </Section>
          )}

          {/* Views */}
          {hasViews && (
            <Section icon={LayoutGrid} label="Views">
              <div className="space-y-1">
                {Object.entries(ext.contributes!.views!).map(
                  ([container, views]) =>
                    views.map((view) => (
                      <div
                        key={view.id}
                        className="text-2xs flex items-center gap-2 px-2 py-1"
                      >
                        <code className="font-mono text-accent/80">
                          {view.id}
                        </code>
                        <span className="text-foreground-muted">
                          {view.name}
                        </span>
                        <span className="text-foreground-muted/50 ml-auto">
                          {container}
                        </span>
                      </div>
                    ))
                )}
              </div>
            </Section>
          )}

          {/* Keybindings */}
          {hasKeybindings && (
            <Section icon={Keyboard} label="Keybindings">
              <div className="space-y-1">
                {ext.contributes!.keybindings!.map((kb) => (
                  <div
                    key={kb.command}
                    className="text-2xs flex items-center gap-2 px-2 py-1"
                  >
                    <kbd className="px-1.5 py-0.5 rounded bg-muted/40 text-foreground-muted font-mono">
                      {kb.mac || kb.key}
                    </kbd>
                    <span className="text-foreground-muted">&rarr;</span>
                    <code className="font-mono text-foreground-secondary">
                      {kb.command}
                    </code>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border">
          <div className="text-2xs text-foreground-muted/60">
            {ext.activationEvents.length > 0 && (
              <span>
                Activation:{" "}
                {ext.activationEvents.join(", ")}
              </span>
            )}
          </div>
          <button
            onClick={onToggle}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 text-2xs font-medium rounded-md transition-default
              ${
                ext.status === "active"
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
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Section({
  icon: SectionIcon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <SectionIcon className="w-3 h-3 text-foreground-muted" />
        <span className="text-2xs font-semibold text-foreground-muted uppercase tracking-widest">
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-success/15 text-success",
    activating: "bg-warning/15 text-warning",
    failed: "bg-destructive/15 text-destructive",
    inactive: "bg-muted/40 text-foreground-muted",
    discovered: "bg-muted/40 text-foreground-muted",
    deactivating: "bg-muted/40 text-foreground-muted",
  };

  return (
    <span
      className={`text-2xs px-1.5 py-0.5 rounded-md font-medium ${styles[status] || styles.inactive}`}
    >
      {status}
    </span>
  );
}
