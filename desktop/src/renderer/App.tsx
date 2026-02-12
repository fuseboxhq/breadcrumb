import { useEffect } from "react";
import { AppShell } from "./components/layout/AppShell";
import { CommandPalette } from "./components/command-palette/CommandPalette";
import { useSettingsStore } from "./store/settingsStore";
import { useAppStore } from "./store/appStore";
import { Toaster } from "sonner";

function App() {
  const loadSettings = useSettingsStore((s) => s.loadSettings);

  // Load settings from main process on startup + listen for changes
  useEffect(() => {
    loadSettings();
    const cleanup = window.breadcrumbAPI?.onSettingsChanged(() => {
      loadSettings();
    });
    return () => cleanup?.();
  }, [loadSettings]);

  // Listen for terminal process name changes from main process
  useEffect(() => {
    const cleanup = window.breadcrumbAPI?.onTerminalProcessChange((event) => {
      const { sessionId, processName, processLabel } = event;
      const state = useAppStore.getState();

      // Find the tab+pane that owns this sessionId
      for (const [tabId, tabPaneState] of Object.entries(state.terminalPanes)) {
        const pane = tabPaneState.panes.find((p) => p.sessionId === sessionId);
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
