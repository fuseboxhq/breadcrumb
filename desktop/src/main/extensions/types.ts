/**
 * Extension system type definitions.
 *
 * Follows VS Code's extension manifest pattern:
 *  - package.json with `engines.breadcrumb`, `contributes`, `activationEvents`
 *  - Capability-based permissions in `breadcrumb` section
 *  - Lifecycle: activate(context) / deactivate()
 */

// ---------- Manifest (parsed from extension package.json) ----------

export interface ExtensionManifest {
  name: string;
  displayName?: string;
  version: string;
  description?: string;
  publisher?: string;
  main: string; // entry point relative to extension dir
  engines: {
    breadcrumb: string; // semver range, e.g. "^1.0.0"
    node?: string;
  };
  activationEvents?: string[]; // e.g. ["onCommand:db.connect", "*"]
  contributes?: ExtensionContributions;
  extensionDependencies?: string[];
  breadcrumb?: {
    apiVersion?: string;
    capabilities?: ExtensionCapabilities;
  };
}

export interface ExtensionCapabilities {
  fileSystem?: "none" | "readonly" | "readwrite";
  network?: boolean;
  terminal?: boolean;
  clipboard?: boolean;
}

export interface ExtensionContributions {
  commands?: ContributedCommand[];
  views?: Record<string, ContributedView[]>;
  viewsContainers?: Record<string, ContributedViewContainer[]>;
  configuration?: ContributedConfiguration;
  keybindings?: ContributedKeybinding[];
}

export interface ContributedCommand {
  command: string;
  title: string;
  category?: string;
  icon?: string;
}

export interface ContributedView {
  id: string;
  name: string;
  when?: string;
}

export interface ContributedViewContainer {
  id: string;
  title: string;
  icon: string;
}

export interface ContributedConfiguration {
  title?: string;
  properties?: Record<string, {
    type: string;
    default?: unknown;
    description?: string;
    enum?: unknown[];
  }>;
}

export interface ContributedKeybinding {
  command: string;
  key: string;
  mac?: string;
  when?: string;
}

// ---------- Runtime state ----------

export type ExtensionStatus =
  | "discovered"
  | "activating"
  | "active"
  | "deactivating"
  | "inactive"
  | "failed";

export interface ExtensionInfo {
  id: string; // manifest name
  manifest: ExtensionManifest;
  extensionPath: string;
  status: ExtensionStatus;
  error?: string;
  activatedAt?: number;
}

// ---------- Extension Host protocol ----------

/** Messages sent from main process → Extension Host */
export type HostMessage =
  | { type: "activate"; extensionId: string; extensionPath: string; main: string; initialState?: Record<string, unknown> }
  | { type: "deactivate"; extensionId: string }
  | { type: "execute-command"; commandId: string; args: unknown[] }
  | { type: "terminal-created"; requestId: string; sessionId: string }
  | { type: "terminal-create-failed"; requestId: string; error: string }
  | { type: "modal-result"; requestId: string; result: Record<string, unknown> | null }
  | { type: "shutdown" };

/** Messages sent from Extension Host → main process */
export type HostResponse =
  | { type: "activated"; extensionId: string }
  | { type: "deactivated"; extensionId: string }
  | { type: "command-result"; commandId: string; result: unknown }
  | { type: "error"; extensionId?: string; message: string; stack?: string }
  | { type: "register-command"; extensionId: string; commandId: string }
  | { type: "log"; level: "info" | "warn" | "error"; message: string }
  | { type: "terminal-create"; requestId: string; extensionId: string; name: string; workingDirectory?: string; shell?: string }
  | { type: "state-set"; extensionId: string; key: string; value: unknown }
  | { type: "show-input-modal"; requestId: string; extensionId: string; schema: ExtensionModalSchema };

// ---------- Extension Modal Schema ----------

export interface ExtensionModalField {
  id: string;
  type: "text" | "textarea" | "select" | "images";
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: { label: string; value: string }[]; // for select type
}

export interface ExtensionModalSchema {
  title: string;
  description?: string;
  fields: ExtensionModalField[];
  submitLabel?: string;
  cancelLabel?: string;
}

// ---------- Renderer-facing extension info ----------

export interface ExtensionInfoForRenderer {
  id: string;
  displayName: string;
  version: string;
  description: string;
  status: ExtensionStatus;
  publisher: string;
  capabilities: ExtensionCapabilities;
  commands: ContributedCommand[];
  contributes: ExtensionContributions;
  activationEvents: string[];
}
