/**
 * ExtensionHost: Runs extensions in an isolated child process.
 *
 * Each Extension Host is a Node.js child_process that loads and runs
 * extension code. This provides OS-level isolation — a misbehaving
 * extension can't crash the IDE, only its host process.
 *
 * Communication uses structured JSON messages over IPC (child_process fork).
 */

import { fork, type ChildProcess } from "child_process";
import path from "path";
import fs from "fs";
import { EventEmitter } from "events";
import type { HostMessage, HostResponse } from "./types";

// The worker is built as a separate Vite entry and placed alongside the main bundle.
// In dev: .vite/build/extensionHostWorker.js
// In production: same directory as main.js inside the asar
function resolveWorkerPath(): string {
  // Check sibling to current file first (Vite build output)
  const sibling = path.join(__dirname, "extensionHostWorker.js");
  if (fs.existsSync(sibling)) return sibling;

  // Fallback: check .vite/build/ from app root
  const viteBuild = path.resolve(__dirname, "..", "..", ".vite", "build", "extensionHostWorker.js");
  if (fs.existsSync(viteBuild)) return viteBuild;

  return sibling; // Default, will error at fork time
}
const MAX_RESTART_ATTEMPTS = 3;
const RESTART_BACKOFF_BASE = 1000; // ms

export class ExtensionHost extends EventEmitter {
  private process: ChildProcess | null = null;
  private restartCount = 0;
  private shutdownRequested = false;
  private pendingRequests = new Map<
    string,
    { resolve: (v: unknown) => void; reject: (e: Error) => void }
  >();

  start(): void {
    if (this.process) return;

    const workerPath = resolveWorkerPath();
    console.log(`[ExtensionHost] worker path: ${workerPath}`);

    this.process = fork(workerPath, [], {
      stdio: ["pipe", "pipe", "pipe", "ipc"],
      env: {
        ...process.env,
        BREADCRUMB_EXTENSION_HOST: "1",
      },
    });

    this.process.on("message", (msg: HostResponse) => {
      this.handleMessage(msg);
    });

    this.process.stdout?.on("data", (data: Buffer) => {
      console.log(`[ExtensionHost] ${data.toString().trim()}`);
    });

    this.process.stderr?.on("data", (data: Buffer) => {
      console.error(`[ExtensionHost] ${data.toString().trim()}`);
    });

    this.process.on("error", (err) => {
      console.error("[ExtensionHost] process error:", err.message);
      this.handleCrash();
    });

    this.process.on("exit", (code, signal) => {
      if (!this.shutdownRequested) {
        console.error(
          `[ExtensionHost] exited unexpectedly (code=${code}, signal=${signal})`
        );
        this.handleCrash();
      }
      this.process = null;
    });

    this.restartCount = 0;
    console.log("[ExtensionHost] started");
  }

  async send(msg: HostMessage): Promise<void> {
    if (!this.process) {
      throw new Error("Extension Host not running");
    }
    this.process.send(msg);
  }

  async activateExtension(
    extensionId: string,
    extensionPath: string,
    main: string,
    initialState?: Record<string, unknown>
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(`activate:${extensionId}`);
        reject(new Error(`Extension ${extensionId} activation timed out`));
      }, 10_000);

      this.pendingRequests.set(`activate:${extensionId}`, {
        resolve: (v) => {
          clearTimeout(timeout);
          resolve(v as void);
        },
        reject: (e) => {
          clearTimeout(timeout);
          reject(e);
        },
      });

      this.send({
        type: "activate",
        extensionId,
        extensionPath,
        main,
        initialState,
      }).catch(reject);
    });
  }

  async deactivateExtension(extensionId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(`deactivate:${extensionId}`);
        resolve(); // Don't fail on deactivation timeout
      }, 5_000);

      this.pendingRequests.set(`deactivate:${extensionId}`, {
        resolve: (v) => {
          clearTimeout(timeout);
          resolve(v as void);
        },
        reject: (e) => {
          clearTimeout(timeout);
          reject(e);
        },
      });

      this.send({ type: "deactivate", extensionId }).catch(reject);
    });
  }

  async executeCommand(commandId: string, args: unknown[]): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(`command:${commandId}`);
        reject(new Error(`Command ${commandId} timed out`));
      }, 30_000);

      this.pendingRequests.set(`command:${commandId}`, {
        resolve: (v) => {
          clearTimeout(timeout);
          resolve(v);
        },
        reject: (e) => {
          clearTimeout(timeout);
          reject(e);
        },
      });

      this.send({
        type: "execute-command",
        commandId,
        args,
      }).catch(reject);
    });
  }

  async shutdown(): Promise<void> {
    this.shutdownRequested = true;

    // Reject all pending
    for (const [key, { reject }] of this.pendingRequests) {
      reject(new Error("Extension Host shutting down"));
      this.pendingRequests.delete(key);
    }

    if (this.process) {
      try {
        await this.send({ type: "shutdown" });
      } catch {
        // Process may already be dead
      }
      // Give 3s for graceful exit, then kill
      const killTimer = setTimeout(() => {
        this.process?.kill("SIGKILL");
      }, 3000);

      await new Promise<void>((resolve) => {
        if (!this.process) {
          resolve();
          return;
        }
        this.process.once("exit", () => {
          clearTimeout(killTimer);
          resolve();
        });
      });
    }
  }

  get isRunning(): boolean {
    return this.process !== null && !this.process.killed;
  }

  private handleMessage(msg: HostResponse): void {
    switch (msg.type) {
      case "activated": {
        const pending = this.pendingRequests.get(
          `activate:${msg.extensionId}`
        );
        pending?.resolve(undefined);
        this.pendingRequests.delete(`activate:${msg.extensionId}`);
        this.emit("extension-activated", msg.extensionId);
        break;
      }
      case "deactivated": {
        const pending = this.pendingRequests.get(
          `deactivate:${msg.extensionId}`
        );
        pending?.resolve(undefined);
        this.pendingRequests.delete(`deactivate:${msg.extensionId}`);
        this.emit("extension-deactivated", msg.extensionId);
        break;
      }
      case "command-result": {
        const pending = this.pendingRequests.get(
          `command:${msg.commandId}`
        );
        pending?.resolve(msg.result);
        this.pendingRequests.delete(`command:${msg.commandId}`);
        break;
      }
      case "register-command": {
        this.emit("command-registered", msg.extensionId, msg.commandId);
        break;
      }
      case "terminal-create": {
        this.emit("terminal-create-request", msg.requestId, msg.extensionId, msg.name, msg.workingDirectory, msg.shell);
        break;
      }
      case "state-set": {
        this.emit("state-set", msg.extensionId, msg.key, msg.value);
        break;
      }
      case "show-input-modal": {
        this.emit("show-input-modal", msg.requestId, msg.extensionId, msg.schema);
        break;
      }
      case "error": {
        const key = msg.extensionId
          ? `activate:${msg.extensionId}`
          : undefined;
        if (key) {
          const pending = this.pendingRequests.get(key);
          pending?.reject(new Error(msg.message));
          this.pendingRequests.delete(key);
        }
        this.emit("extension-error", msg.extensionId, msg.message);
        console.error(
          `[ExtensionHost] error${msg.extensionId ? ` (${msg.extensionId})` : ""}:`,
          msg.message
        );
        break;
      }
      case "log": {
        const prefix = `[ExtensionHost]`;
        if (msg.level === "error") console.error(prefix, msg.message);
        else if (msg.level === "warn") console.warn(prefix, msg.message);
        else console.log(prefix, msg.message);
        break;
      }
    }
  }

  private handleCrash(): void {
    this.process = null;

    // Reject all pending requests
    for (const [key, { reject }] of this.pendingRequests) {
      reject(new Error("Extension Host crashed"));
      this.pendingRequests.delete(key);
    }

    if (this.shutdownRequested) return;

    if (this.restartCount < MAX_RESTART_ATTEMPTS) {
      this.restartCount++;
      const delay = RESTART_BACKOFF_BASE * Math.pow(2, this.restartCount - 1);
      console.log(
        `[ExtensionHost] restarting in ${delay}ms (attempt ${this.restartCount}/${MAX_RESTART_ATTEMPTS})`
      );
      setTimeout(() => {
        if (!this.shutdownRequested) {
          this.start();
          this.emit("restarted", this.restartCount);
        }
      }, delay);
    } else {
      console.error(
        "[ExtensionHost] max restart attempts reached, giving up"
      );
      this.emit("max-restarts-reached");
    }
  }
}
