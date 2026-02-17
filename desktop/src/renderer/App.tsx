import { useEffect, useCallback } from "react";
import { AppShell } from "./components/layout/AppShell";
import { CommandPalette } from "./components/command-palette/CommandPalette";
import { ExtensionModal } from "./components/extensions/ExtensionModal";
import { DebugModal, type DebugSubmitData } from "./components/debug/DebugModal";
import { useSettingsStore } from "./store/settingsStore";
import { useAppStore, flushWorkspacePersist } from "./store/appStore";
import { useProjectsStore } from "./store/projectsStore";
import { useDebugStore } from "./store/debugStore";
import { Toaster } from "sonner";

function App() {
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const loadProjects = useProjectsStore((s) => s.loadProjects);
  const debugIsOpen = useDebugStore((s) => s.isOpen);
  const debugProjectPath = useDebugStore((s) => s.projectPath);
  const closeDebugModal = useDebugStore((s) => s.closeDebugModal);

  // Handle debug modal submission — save images, build prompt, spawn Claude
  const handleDebugSubmit = useCallback(
    async (data: DebugSubmitData) => {
      const projectPath = debugProjectPath;
      closeDebugModal();

      if (!projectPath) return;

      // Build the Claude Code prompt
      const parts: string[] = [];

      if (data.imagePaths.length > 0) {
        parts.push("## Screenshots");
        data.imagePaths.forEach((p, i) => {
          parts.push(`Screenshot ${i + 1}: ${p}`);
        });
        parts.push("");
      }

      parts.push("## Issue Description");
      parts.push(data.description);

      if (data.consoleLogs) {
        parts.push("");
        parts.push("## Console Logs");
        parts.push("```");
        parts.push(data.consoleLogs);
        parts.push("```");
      }

      parts.push("");
      parts.push("Please investigate this issue and suggest a fix.");

      const prompt = parts.join("\n");

      // Spawn a new terminal tab with Claude
      const store = useAppStore.getState();
      const tabId = `debug-${Date.now()}`;
      const paneId = `pane-${Date.now()}`;
      const sessionId = `debug-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      store.addTab({
        id: tabId,
        type: "terminal",
        title: "Debug: Claude",
        projectId: store.tabs.find((t) => t.projectId)?.projectId,
        initialCommand: `claude "${prompt.replace(/"/g, '\\"').replace(/\n/g, "\\n")}"\n`,
      });

      useAppStore.setState((state) => {
        state.terminalPanes[tabId] = {
          panes: [
            {
              type: "terminal",
              id: paneId,
              sessionId,
              cwd: projectPath,
              lastActivity: Date.now(),
              processLabel: "Debug: Claude",
            },
          ],
          activePane: paneId,
          splitDirection: "horizontal",
        };
      });
    },
    [debugProjectPath, closeDebugModal]
  );

  // Load settings and projects from main process on startup
  useEffect(() => {
    loadSettings();
    loadProjects();
    const cleanup = window.breadcrumbAPI?.onSettingsChanged(() => {
      loadSettings();
    });
    return () => cleanup?.();
  }, [loadSettings, loadProjects]);

  // Flush pending workspace writes before window closes (handles app quit / reload)
  useEffect(() => {
    const handleBeforeUnload = () => {
      flushWorkspacePersist();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // Listen for extension-spawned terminal creation from main process
  useEffect(() => {
    const cleanup = window.breadcrumbAPI?.onExtensionTerminalCreated?.((data) => {
      const { sessionId, name, workingDirectory } = data;
      const store = useAppStore.getState();

      // Create a new terminal tab for the extension-spawned terminal
      const tabId = `ext-tab-${Date.now()}`;
      const paneId = `pane-${Date.now()}`;

      store.addTab({
        id: tabId,
        type: "terminal",
        title: name,
      });

      // Directly set up pane state with the pre-created sessionId
      useAppStore.setState((state) => {
        state.terminalPanes[tabId] = {
          panes: [
            {
              type: "terminal",
              id: paneId,
              sessionId,
              cwd: workingDirectory || "",
              lastActivity: Date.now(),
              processLabel: name,
            },
          ],
          activePane: paneId,
          splitDirection: "horizontal",
        };
      });
    });
    return () => cleanup?.();
  }, []);

  // Listen for terminal process name changes from main process
  useEffect(() => {
    const cleanup = window.breadcrumbAPI?.onTerminalProcessChange((event) => {
      const { sessionId, processName, processLabel } = event;
      const state = useAppStore.getState();

      // Find the tab+pane that owns this sessionId
      for (const [tabId, tabPaneState] of Object.entries(state.terminalPanes)) {
        const pane = tabPaneState.panes.find(
          (p) => p.type === "terminal" && p.sessionId === sessionId
        );
        if (pane) {
          state.updatePaneProcess(tabId, pane.id, processName, processLabel);
          break;
        }
      }
    });
    return () => cleanup?.();
  }, []);

  return (
    <>
      <AppShell />
      <CommandPalette />
      <ExtensionModal />
      <DebugModal
        isOpen={debugIsOpen}
        onClose={closeDebugModal}
        onSubmit={handleDebugSubmit}
      />
      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          style: {
            background: "var(--background-overlay)",
            border: "1px solid var(--border-strong)",
            color: "var(--foreground)",
            fontSize: "13px",
          },
        }}
        visibleToasts={3}
      />
    </>
  );
}

export default App;
