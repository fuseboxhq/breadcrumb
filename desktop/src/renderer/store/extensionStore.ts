/**
 * Extension contribution store — reactive tracking of active extensions
 * and their manifest-declared UI contributions (commands, views, keybindings).
 *
 * Components query this store instead of hardcoding extension-specific UI.
 * When an extension activates/deactivates, contributed UI appears/vanishes.
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
  initialized: boolean;
}

interface ExtensionActions {
  init: () => void;
  dispose: () => void;
}

// ── Store ────────────────────────────────────────────────────────────────────

let unsubscribe: (() => void) | null = null;

export const useExtensionStore = create<ExtensionState & ExtensionActions>(
  (set) => ({
    extensions: [],
    initialized: false,

    init: () => {
      // Load initial state
      window.breadcrumbAPI?.getExtensions().then((exts) => {
        set({ extensions: exts, initialized: true });
      });

      // Subscribe to live changes
      unsubscribe = window.breadcrumbAPI?.onExtensionsChanged((exts) => {
        set({ extensions: exts });
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
  return useExtensionStore((s) =>
    s.extensions.filter((e) => e.status === "active")
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
  return useExtensionStore((s) => {
    const commands: ExtensionCommand[] = [];
    for (const ext of s.extensions) {
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
  });
}

/** Commands from active extensions filtered by category (e.g. "Debug") */
export function useExtensionCommandsByCategory(
  category: string
): ExtensionCommand[] {
  return useExtensionStore((s) => {
    const commands: ExtensionCommand[] = [];
    for (const ext of s.extensions) {
      if (ext.status !== "active") continue;
      for (const cmd of ext.commands) {
        if (cmd.category === category) {
          commands.push({
            ...cmd,
            extensionId: ext.id,
            extensionDisplayName: ext.displayName,
          });
        }
      }
    }
    return commands;
  });
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
