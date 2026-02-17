/**
 * ExtensionManager: Discovers, validates, and manages extension lifecycle.
 *
 * Scans extension directories for valid manifests, starts the Extension Host
 * process, and coordinates activation/deactivation.
 *
 * Extension locations:
 *  - ~/.breadcrumb/extensions/  (user-installed)
 *  - <project>/.breadcrumb-extensions/  (workspace-local)
 *  - <app>/extensions/  (bundled)
 */

import fs from "fs";
import path from "path";
import os from "os";
import { EventEmitter } from "events";
import { ExtensionHost } from "./ExtensionHost";
import { terminalService } from "../terminal/TerminalService";
import type {
  ExtensionManifest,
  ExtensionInfo,
  ExtensionInfoForRenderer,
  ExtensionStatus,
} from "./types";

const BREADCRUMB_API_VERSION = "1.0.0";

export class ExtensionManager extends EventEmitter {
  private extensions = new Map<string, ExtensionInfo>();
  private host: ExtensionHost;
  private registeredCommands = new Map<string, string>(); // commandId → extensionId
  private extensionDirs: string[];

  constructor(private appPath: string) {
    super();
    this.host = new ExtensionHost();
    this.extensionDirs = [
      path.join(os.homedir(), ".breadcrumb", "extensions"),
      path.join(appPath, "extensions"),
    ];

    // Forward host events
    this.host.on("extension-activated", (id: string) => {
      this.setStatus(id, "active");
    });

    this.host.on("extension-deactivated", (id: string) => {
      this.setStatus(id, "inactive");
    });

    this.host.on("extension-error", (id: string, message: string) => {
      if (id) this.setStatus(id, "failed", message);
      this.emit("error", id, message);
    });

    this.host.on("command-registered", (extId: string, cmdId: string) => {
      this.registeredCommands.set(cmdId, extId);
      this.emit("commands-changed");
    });

    this.host.on("terminal-create-request", (requestId: string, extensionId: string, name: string, workingDirectory?: string, shell?: string) => {
      // Verify the extension has terminal capability
      const ext = this.extensions.get(extensionId);
      if (ext && ext.manifest.breadcrumb?.capabilities?.terminal === false) {
        this.host.send({ type: "terminal-create-failed", requestId, error: "Extension lacks terminal capability" });
        return;
      }

      const sessionId = `ext-${extensionId}-${Date.now()}`;
      try {
        terminalService.createSession({
          id: sessionId,
          name: name || extensionId,
          workingDirectory: workingDirectory || os.homedir(),
          shell,
        });
        this.emit("terminal-created", sessionId, name || extensionId, extensionId, workingDirectory);
        this.host.send({ type: "terminal-created", requestId, sessionId });
      } catch (err) {
        this.host.send({ type: "terminal-create-failed", requestId, error: String(err) });
      }
    });

    this.host.on("restarted", (attempt: number) => {
      console.log(`[ExtensionManager] host restarted (attempt ${attempt})`);
      // Re-activate all previously active extensions
      this.reactivateAll();
    });

    this.host.on("max-restarts-reached", () => {
      console.error(
        "[ExtensionManager] Extension Host permanently failed"
      );
      for (const [id, ext] of this.extensions) {
        if (ext.status === "active" || ext.status === "activating") {
          this.setStatus(id, "failed", "Extension Host crashed");
        }
      }
    });
  }

  /** Add a workspace-specific extension directory */
  addWorkspaceExtensionDir(dir: string): void {
    const extDir = path.join(dir, ".breadcrumb-extensions");
    if (!this.extensionDirs.includes(extDir)) {
      this.extensionDirs.push(extDir);
    }
  }

  /** Discover and validate all extensions from configured directories */
  async discover(): Promise<ExtensionInfo[]> {
    const discovered: ExtensionInfo[] = [];

    for (const dir of this.extensionDirs) {
      if (!fs.existsSync(dir)) continue;

      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const entry of entries) {
        if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;

        const extPath = path.join(dir, entry.name);
        const manifestPath = path.join(extPath, "package.json");

        if (!fs.existsSync(manifestPath)) continue;

        try {
          const raw = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
          const manifest = this.validateManifest(raw);
          if (!manifest) continue;

          const info: ExtensionInfo = {
            id: manifest.name,
            manifest,
            extensionPath: extPath,
            status: "discovered",
          };

          // Don't duplicate if already tracked
          if (!this.extensions.has(info.id)) {
            this.extensions.set(info.id, info);
          }
          discovered.push(info);
        } catch (err) {
          console.warn(
            `[ExtensionManager] skipping ${entry.name}: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }
    }

    this.emit("extensions-changed");
    return discovered;
  }

  /** Start the Extension Host and activate all discovered extensions */
  async startAll(): Promise<void> {
    // Only start the host if we have extensions to activate
    if (this.extensions.size === 0) {
      console.log("[ExtensionManager] no extensions discovered, host not started");
      return;
    }

    this.host.start();

    const sorted = this.sortByDependencies([...this.extensions.values()]);

    for (const ext of sorted) {
      if (ext.status !== "discovered" && ext.status !== "inactive") continue;

      // Check activation events — if "*" or empty, activate immediately
      const events = ext.manifest.activationEvents;
      if (!events || events.length === 0 || events.includes("*")) {
        await this.activateExtension(ext.id);
      }
    }
  }

  /** Activate a single extension by id */
  async activateExtension(id: string): Promise<void> {
    const ext = this.extensions.get(id);
    if (!ext) throw new Error(`Extension ${id} not found`);
    if (ext.status === "active" || ext.status === "activating") return;

    // Activate dependencies first
    if (ext.manifest.extensionDependencies) {
      for (const depId of ext.manifest.extensionDependencies) {
        const dep = this.extensions.get(depId);
        if (dep && dep.status !== "active") {
          await this.activateExtension(depId);
        }
      }
    }

    this.setStatus(id, "activating");

    if (!this.host.isRunning) {
      this.host.start();
    }

    try {
      await this.host.activateExtension(id, ext.extensionPath, ext.manifest.main);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.setStatus(id, "failed", msg);
    }
  }

  /** Deactivate a single extension */
  async deactivateExtension(id: string): Promise<void> {
    const ext = this.extensions.get(id);
    if (!ext || ext.status !== "active") return;

    this.setStatus(id, "deactivating");

    try {
      await this.host.deactivateExtension(id);
    } catch (err) {
      console.error(`[ExtensionManager] deactivation error for ${id}:`, err);
      this.setStatus(id, "inactive");
    }

    // Remove registered commands for this extension
    for (const [cmdId, extId] of this.registeredCommands) {
      if (extId === id) this.registeredCommands.delete(cmdId);
    }
  }

  /** Execute a registered command */
  async executeCommand(commandId: string, ...args: unknown[]): Promise<unknown> {
    if (!this.registeredCommands.has(commandId)) {
      throw new Error(`Command not found: ${commandId}`);
    }
    return this.host.executeCommand(commandId, args);
  }

  /** Get all registered command ids */
  getCommands(): string[] {
    return [...this.registeredCommands.keys()];
  }

  /** Get renderer-safe extension list */
  getExtensionsForRenderer(): ExtensionInfoForRenderer[] {
    return [...this.extensions.values()].map((ext) => ({
      id: ext.id,
      displayName: ext.manifest.displayName || ext.manifest.name,
      version: ext.manifest.version,
      description: ext.manifest.description || "",
      status: ext.status,
      publisher: ext.manifest.publisher || "Unknown",
      capabilities: ext.manifest.breadcrumb?.capabilities || {},
      commands: ext.manifest.contributes?.commands || [],
    }));
  }

  /** Shut down the extension system */
  async shutdown(): Promise<void> {
    for (const [id, ext] of this.extensions) {
      if (ext.status === "active") {
        await this.deactivateExtension(id);
      }
    }
    await this.host.shutdown();
  }

  // ---------- Private helpers ----------

  private validateManifest(raw: Record<string, unknown>): ExtensionManifest | null {
    // Required fields
    if (typeof raw.name !== "string" || !raw.name) return null;
    if (typeof raw.version !== "string" || !raw.version) return null;
    if (typeof raw.main !== "string" || !raw.main) return null;

    // Must have engines.breadcrumb
    const engines = raw.engines as Record<string, string> | undefined;
    if (!engines || typeof engines.breadcrumb !== "string") return null;

    // Check API version compatibility (basic check)
    const required = engines.breadcrumb;
    if (required && !this.isVersionCompatible(required)) {
      console.warn(
        `[ExtensionManager] ${raw.name} requires breadcrumb ${required}, have ${BREADCRUMB_API_VERSION}`
      );
      return null;
    }

    // Validate optional array fields are actually arrays
    if (raw.activationEvents !== undefined && !Array.isArray(raw.activationEvents)) return null;
    if (raw.extensionDependencies !== undefined && !Array.isArray(raw.extensionDependencies)) return null;

    // Validate contributes.commands if present
    if (raw.contributes !== undefined) {
      if (typeof raw.contributes !== "object" || raw.contributes === null) return null;
      const contributes = raw.contributes as Record<string, unknown>;
      if (contributes.commands !== undefined) {
        if (!Array.isArray(contributes.commands)) return null;
        for (const cmd of contributes.commands) {
          if (typeof cmd !== "object" || cmd === null) return null;
          const c = cmd as Record<string, unknown>;
          if (typeof c.command !== "string" || typeof c.title !== "string") return null;
        }
      }
    }

    return raw as unknown as ExtensionManifest;
  }

  private isVersionCompatible(range: string): boolean {
    // Simple check: accept ^1.x.x and >=1.0.0 patterns for API v1
    // Full implementation would use `semver` package
    if (range.startsWith("^1") || range.startsWith("~1") || range === "*") {
      return true;
    }
    if (range.startsWith(">=")) {
      const ver = range.slice(2).trim();
      return ver.startsWith("0") || ver.startsWith("1");
    }
    return range.startsWith("1");
  }

  private setStatus(id: string, status: ExtensionStatus, error?: string): void {
    const ext = this.extensions.get(id);
    if (!ext) return;

    ext.status = status;
    ext.error = error;
    if (status === "active") ext.activatedAt = Date.now();

    this.emit("extension-status-changed", id, status);
    this.emit("extensions-changed");
  }

  private sortByDependencies(exts: ExtensionInfo[]): ExtensionInfo[] {
    const byId = new Map(exts.map((e) => [e.id, e]));
    const visited = new Set<string>();
    const sorted: ExtensionInfo[] = [];

    function visit(ext: ExtensionInfo) {
      if (visited.has(ext.id)) return;
      visited.add(ext.id);

      for (const depId of ext.manifest.extensionDependencies || []) {
        const dep = byId.get(depId);
        if (dep) visit(dep);
      }
      sorted.push(ext);
    }

    for (const ext of exts) visit(ext);
    return sorted;
  }

  private async reactivateAll(): Promise<void> {
    for (const [id, ext] of this.extensions) {
      if (ext.status === "active" || ext.status === "activating") {
        ext.status = "discovered";
        await this.activateExtension(id);
      }
    }
  }
}
