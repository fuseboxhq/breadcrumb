import { useEffect } from "react";
import { useAppStore } from "../store/appStore";
import { useProjectsStore } from "../store/projectsStore";

/**
 * Global keyboard shortcuts for the layout and navigation:
 *
 * Layout:
 * - Cmd+Shift+B: Toggle right panel visibility
 * - Cmd+B: Open browser in right panel
 * - Cmd+Shift+P: Open planning in right panel
 * - Cmd+Option+I: Toggle DevTools dock
 * - Cmd+\: Toggle sidebar
 *
 * Terminal:
 * - Cmd+T: New terminal tab (in active project)
 *
 * Tab navigation:
 * - Cmd+Shift+]: Next tab
 * - Cmd+Shift+[: Previous tab
 *
 * Sidebar views:
 * - Cmd+Shift+E: Show Explorer
 * - Cmd+Shift+T: Show Terminals (Note: uses Shift to avoid conflict with Cmd+T)
 * - Cmd+Shift+X: Show Extensions
 */
export function useGlobalLayoutHotkeys() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey;
      if (!isMeta) return;

      const store = useAppStore.getState();

      // Cmd+Option+I → Toggle DevTools dock
      if (e.altKey && e.key === "i") {
        e.preventDefault();
        store.toggleDevToolsDock();
        return;
      }

      // --- Shift combos ---
      if (e.shiftKey) {
        switch (e.key) {
          // Cmd+Shift+B → Toggle right panel
          case "b":
          case "B":
            e.preventDefault();
            store.toggleRightPanel();
            return;

          // Cmd+Shift+] → Next tab
          case "]":
            e.preventDefault();
            navigateTab("next");
            return;

          // Cmd+Shift+[ → Previous tab
          case "[":
            e.preventDefault();
            navigateTab("prev");
            return;

          // Cmd+Shift+P → Open planning in right panel
          case "p":
          case "P":
            e.preventDefault();
            store.addRightPanelPane("planning");
            return;

          // Cmd+Shift+E → Show Explorer sidebar
          case "e":
          case "E":
            e.preventDefault();
            store.setSidebarView("explorer");
            return;

          // Cmd+Shift+X → Show Extensions sidebar
          case "x":
          case "X":
            e.preventDefault();
            store.setSidebarView("extensions");
            return;
        }
        return;
      }

      // --- Non-shift combos ---
      switch (e.key) {
        // Cmd+B → Open browser in right panel
        case "b":
          e.preventDefault();
          store.addRightPanelPane("browser");
          return;

        // Cmd+T → New terminal tab (scoped to active project)
        case "t":
          e.preventDefault();
          createNewTerminal();
          return;

        // Cmd+\ → Toggle sidebar
        case "\\":
          e.preventDefault();
          store.toggleSidebar();
          return;
      }
    };

    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, []);
}

/** Create a new terminal tab scoped to the active project */
function createNewTerminal() {
  const store = useAppStore.getState();
  const projectStore = useProjectsStore.getState();
  const activeProject = projectStore.projects.find(
    (p) => p.id === projectStore.activeProjectId
  );
  const count = store.tabs.filter((t) => t.type === "terminal").length + 1;
  store.addTab({
    id: `terminal-${Date.now()}`,
    type: "terminal",
    title: activeProject?.name || `Terminal ${count}`,
    projectId: activeProject?.id,
  });
}

/** Navigate to next/previous tab */
function navigateTab(direction: "next" | "prev") {
  const store = useAppStore.getState();
  const { tabs, activeTabId } = store;
  if (tabs.length < 2) return;
  const currentIndex = tabs.findIndex((t) => t.id === activeTabId);
  if (currentIndex === -1) return;
  const nextIndex =
    direction === "next"
      ? (currentIndex + 1) % tabs.length
      : (currentIndex - 1 + tabs.length) % tabs.length;
  store.setActiveTab(tabs[nextIndex].id);
}
