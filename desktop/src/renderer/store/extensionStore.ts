/**
 * Extension contribution store — reactive tracking of active extensions
 * and their manifest-declared UI contributions (commands, views, keybindings).
 *
 * Components query this store instead of hardcoding extension-specific UI.
 * When an extension activates/deactivates, contributed UI appears/vanishes.
 *
 * Derived data (activeCommands) is pre-computed on every state change so that
 * selectors return stable references and never trigger infinite re-renders.
 */

import { create } from "zustand";
import type {
  ExtensionInfoForRenderer,
  ContributedCommand,
  ExtensionContributions,
} from "../../main/extensions/types";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ExtensionCommand extends ContributedCommand {
  extensionId: string;
  extensionDisplayName: string;
}

interface ExtensionState {
  extensions: ExtensionInfoForRenderer[];
  /** Pre-computed: all commands from active extensions */
  activeCommands: ExtensionCommand[];
  initialized: boolean;
}

interface ExtensionActions {
  init: () => void;
  dispose: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Derive flat command list from active extensions (called on every state change) */
function deriveActiveCommands(
  extensions: ExtensionInfoForRenderer[]
): ExtensionCommand[] {
  const commands: ExtensionCommand[] = [];
  for (const ext of extensions) {
    if (ext.status !== "active") continue;
    for (const cmd of ext.commands) {
      commands.push({
        ...cmd,
        extensionId: ext.id,
        extensionDisplayName: ext.displayName,
      });
    }
  }
  return commands;
}

// ── Store ────────────────────────────────────────────────────────────────────

let unsubscribe: (() => void) | null = null;

export const useExtensionStore = create<ExtensionState & ExtensionActions>(
  (set) => ({
    extensions: [],
    activeCommands: [],
    initialized: false,

    init: () => {
      // Load initial state
      window.breadcrumbAPI?.getExtensions().then((exts) => {
        set({
          extensions: exts,
          activeCommands: deriveActiveCommands(exts),
          initialized: true,
        });
      });

      // Subscribe to live changes
      unsubscribe =
        window.breadcrumbAPI?.onExtensionsChanged((exts) => {
          set({
            extensions: exts,
            activeCommands: deriveActiveCommands(exts),
          });
        }) ?? null;
    },

    dispose: () => {
      unsubscribe?.();
      unsubscribe = null;
    },
  })
);

// ── Selectors ────────────────────────────────────────────────────────────────

/** All extensions currently in "active" status */
export function useActiveExtensions(): ExtensionInfoForRenderer[] {
  return useExtensionStore((s) => s.extensions).filter(
    (e) => e.status === "active"
  );
}

/** Check if a specific extension is active */
export function useIsExtensionActive(extensionId: string): boolean {
  return useExtensionStore(
    (s) => s.extensions.find((e) => e.id === extensionId)?.status === "active"
  );
}

/** Flat list of all commands from active extensions, with extensionId attached */
export function useActiveExtensionCommands(): ExtensionCommand[] {
  return useExtensionStore((s) => s.activeCommands);
}

/** Commands from active extensions filtered by category (e.g. "Debug") */
export function useExtensionCommandsByCategory(
  category: string
): ExtensionCommand[] {
  // Select the stable activeCommands array, then filter outside the selector
  const commands = useExtensionStore((s) => s.activeCommands);
  return commands.filter((cmd) => cmd.category === category);
}

/** Get full contributes for a specific extension (active or not) */
export function useExtensionContributes(
  extensionId: string
): ExtensionContributions | undefined {
  return useExtensionStore(
    (s) => s.extensions.find((e) => e.id === extensionId)?.contributes
  );
}

/** Execute an extension command via IPC */
export async function executeExtensionCommand(
  commandId: string,
  ...args: unknown[]
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  const api = window.breadcrumbAPI;
  if (!api) return { success: false, error: "API not available" };
  return api.executeExtensionCommand(commandId, ...args);
}
