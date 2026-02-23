import { useEffect } from "react";
import { AppShell } from "./components/layout/AppShell";
import { CommandPalette } from "./components/command-palette/CommandPalette";
import { ExtensionModal } from "./components/extensions/ExtensionModal";
import { useSettingsStore, useResolvedTheme } from "./store/settingsStore";
import { useAppStore, flushWorkspacePersist, flattenPanes } from "./store/appStore";
import { useProjectsStore } from "./store/projectsStore";
import { useExtensionStore } from "./store/extensionStore";
import { Toaster } from "sonner";

function App() {
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const loadProjects = useProjectsStore((s) => s.loadProjects);
  const resolvedTheme = useResolvedTheme();

  // Load settings and projects from main process on startup
  useEffect(() => {
    loadSettings();
    loadProjects();
    const cleanup = window.breadcrumbAPI?.onSettingsChanged(() => {
      loadSettings();
    });
    return () => cleanup?.();
  }, [loadSettings, loadProjects]);

  // Initialize extension contribution store (tracks active extensions + their UI contributions)
  useEffect(() => {
    useExtensionStore.getState().init();
    return () => useExtensionStore.getState().dispose();
  }, []);

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
          splitTree: {
            type: "pane",
            pane: {
              type: "terminal",
              id: paneId,
              sessionId,
              cwd: workingDirectory || "",
              lastActivity: Date.now(),
              processLabel: name,
            },
          },
          activePane: paneId,
        };
      });
    });
    return () => cleanup?.();
  }, []);

  // Listen for extension-spawned browser tab creation from main process
  useEffect(() => {
    const cleanup = window.breadcrumbAPI?.onExtensionBrowserOpened?.((data) => {
      const store = useAppStore.getState();
      // Open the browser pane in the right panel (no-ops if already open)
      store.addRightPanelPane("browser");
      // If a specific URL was requested, add a new tab for it
      if (data.url) {
        store.addBrowserTab(data.url);
      }
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
        const panes = flattenPanes(tabPaneState.splitTree);
        const pane = panes.find(
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
      <Toaster
        theme={resolvedTheme}
        position="bottom-right"
        toastOptions={{
          style: {
            background: `hsl(var(--background-overlay))`,
            border: "1px solid hsl(var(--border-strong))",
            color: `hsl(var(--foreground))`,
            fontSize: "13px",
          },
        }}
        visibleToasts={3}
      />
    </>
  );
}

export default App;
