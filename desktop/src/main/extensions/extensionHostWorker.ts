/**
 * Extension Host Worker — runs in a child_process fork.
 *
 * This file is the entry point for the isolated Extension Host process.
 * It receives messages from the main process, loads extension modules,
 * and manages their lifecycle (activate/deactivate).
 *
 * Extensions get a `context` object with:
 *  - subscriptions: Disposable[] for cleanup
 *  - extensionPath: absolute path to extension directory
 *  - breadcrumb: API namespace for registering commands, etc.
 */

import type { HostMessage, HostResponse } from "./types";

interface Disposable {
  dispose(): void;
}

interface ExtensionContext {
  subscriptions: Disposable[];
  extensionPath: string;
  extensionId: string;
}

interface ExtensionModule {
  activate(context: ExtensionContext): void | Promise<void>;
  deactivate?(): void | Promise<void>;
}

interface LoadedExtension {
  id: string;
  module: ExtensionModule;
  context: ExtensionContext;
}

// ---------- State ----------

const extensions = new Map<string, LoadedExtension>();
const commands = new Map<string, (...args: unknown[]) => unknown>();

// ---------- API exposed to extensions ----------

const breadcrumb = {
  commands: {
    registerCommand(
      commandId: string,
      handler: (...args: unknown[]) => unknown
    ): Disposable {
      commands.set(commandId, handler);
      sendToMain({
        type: "register-command",
        extensionId: "", // filled in by activate wrapper
        commandId,
      });
      return {
        dispose() {
          commands.delete(commandId);
        },
      };
    },
    async executeCommand(
      commandId: string,
      ...args: unknown[]
    ): Promise<unknown> {
      const handler = commands.get(commandId);
      if (!handler) throw new Error(`Unknown command: ${commandId}`);
      return handler(...args);
    },
  },
  window: {
    showInformationMessage(message: string): void {
      sendToMain({ type: "log", level: "info", message });
    },
    showWarningMessage(message: string): void {
      sendToMain({ type: "log", level: "warn", message });
    },
    showErrorMessage(message: string): void {
      sendToMain({ type: "log", level: "error", message });
    },
  },
};

// ---------- Message handling ----------

function sendToMain(msg: HostResponse): void {
  process.send?.(msg);
}

async function handleActivate(
  extensionId: string,
  extensionPath: string,
  main: string
): Promise<void> {
  try {
    // Resolve the extension entry point
    const entryPoint = require.resolve(main, { paths: [extensionPath] });

    // Load the extension module
    const mod: ExtensionModule = require(entryPoint);

    if (typeof mod.activate !== "function") {
      throw new Error(`Extension ${extensionId} has no activate() export`);
    }

    // Create context
    const context: ExtensionContext = {
      subscriptions: [],
      extensionPath,
      extensionId,
    };

    // Patch command registration to include extensionId
    const origRegister = breadcrumb.commands.registerCommand;
    breadcrumb.commands.registerCommand = (commandId, handler) => {
      const fullId = commandId.startsWith(`${extensionId}.`)
        ? commandId
        : `${extensionId}.${commandId}`;
      commands.set(fullId, handler);
      sendToMain({
        type: "register-command",
        extensionId,
        commandId: fullId,
      });
      return {
        dispose() {
          commands.delete(fullId);
        },
      };
    };

    // Inject API into global scope so extensions can access `breadcrumb.*`
    // Cast required: TypeScript doesn't know about dynamically-added globals
    (globalThis as Record<string, unknown>).breadcrumb = breadcrumb;

    // Activate
    await mod.activate(context);

    // Restore original
    breadcrumb.commands.registerCommand = origRegister;

    extensions.set(extensionId, { id: extensionId, module: mod, context });
    sendToMain({ type: "activated", extensionId });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    sendToMain({
      type: "error",
      extensionId,
      message: error.message,
      stack: error.stack,
    });
  }
}

async function handleDeactivate(extensionId: string): Promise<void> {
  const ext = extensions.get(extensionId);
  if (!ext) {
    sendToMain({ type: "deactivated", extensionId });
    return;
  }

  try {
    // Call deactivate if defined
    if (typeof ext.module.deactivate === "function") {
      await ext.module.deactivate();
    }

    // Dispose all subscriptions
    for (const sub of ext.context.subscriptions) {
      try {
        sub.dispose();
      } catch {
        // Best effort cleanup
      }
    }

    // Clear require cache for hot reload support
    const extPath = ext.context.extensionPath;
    for (const key of Object.keys(require.cache)) {
      if (key.startsWith(extPath)) {
        delete require.cache[key];
      }
    }

    extensions.delete(extensionId);
    sendToMain({ type: "deactivated", extensionId });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    sendToMain({
      type: "error",
      extensionId,
      message: `Deactivation failed: ${error.message}`,
    });
    // Still mark as deactivated
    extensions.delete(extensionId);
    sendToMain({ type: "deactivated", extensionId });
  }
}

async function handleCommand(
  commandId: string,
  args: unknown[]
): Promise<void> {
  try {
    const handler = commands.get(commandId);
    if (!handler) {
      sendToMain({
        type: "error",
        message: `Unknown command: ${commandId}`,
      });
      return;
    }
    const result = await handler(...args);
    sendToMain({ type: "command-result", commandId, result });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    sendToMain({
      type: "error",
      message: `Command ${commandId} failed: ${error.message}`,
    });
  }
}

async function handleShutdown(): Promise<void> {
  // Deactivate all extensions
  for (const [id] of extensions) {
    await handleDeactivate(id);
  }
  process.exit(0);
}

// ---------- Process message listener ----------

process.on("message", async (msg: HostMessage) => {
  switch (msg.type) {
    case "activate":
      await handleActivate(msg.extensionId, msg.extensionPath, msg.main);
      break;
    case "deactivate":
      await handleDeactivate(msg.extensionId);
      break;
    case "execute-command":
      await handleCommand(msg.commandId, msg.args);
      break;
    case "shutdown":
      await handleShutdown();
      break;
  }
});

// Catch unhandled errors so they don't kill the host silently
process.on("uncaughtException", (err) => {
  sendToMain({
    type: "error",
    message: `Uncaught exception: ${err.message}`,
    stack: err.stack,
  });
});

process.on("unhandledRejection", (reason) => {
  const msg =
    reason instanceof Error ? reason.message : String(reason);
  sendToMain({
    type: "error",
    message: `Unhandled rejection: ${msg}`,
  });
});

console.log("[ExtensionHostWorker] ready");
