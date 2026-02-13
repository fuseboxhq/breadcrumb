import { useEffect } from "react";
import { useAppStore } from "../store/appStore";

/**
 * Global keyboard shortcuts for the 3-column layout:
 * - Cmd+Shift+B: Toggle right panel visibility
 * - Cmd+B: Open browser in right panel
 * - Cmd+Shift+P: Open planning in right panel (avoids conflict with Cmd+P)
 * - Cmd+Option+I: Toggle DevTools dock
 */
export function useGlobalLayoutHotkeys() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey;

      // Cmd+Option+I → Toggle DevTools dock
      if (isMeta && e.altKey && e.key === "i") {
        e.preventDefault();
        useAppStore.getState().toggleDevToolsDock();
        return;
      }

      // Cmd+Shift+B → Toggle right panel
      if (isMeta && e.shiftKey && e.key === "b") {
        e.preventDefault();
        useAppStore.getState().toggleRightPanel();
        return;
      }

      // Cmd+B → Open browser in right panel
      if (isMeta && !e.shiftKey && e.key === "b") {
        e.preventDefault();
        useAppStore.getState().addRightPanelPane("browser");
        return;
      }

      // Cmd+Shift+P → Open planning in right panel
      if (isMeta && e.shiftKey && e.key === "p") {
        e.preventDefault();
        useAppStore.getState().addRightPanelPane("planning");
        return;
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);
}
