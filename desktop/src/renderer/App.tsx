import { useEffect } from "react";
import { AppShell } from "./components/layout/AppShell";
import { CommandPalette } from "./components/command-palette/CommandPalette";
import { useSettingsStore } from "./store/settingsStore";
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
