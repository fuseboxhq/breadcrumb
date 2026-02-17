/**
 * Debug modal state — controls the DebugModal visibility and
 * handles the submission flow (save images, build prompt, spawn terminal).
 */

import { create } from "zustand";

interface DebugState {
  isOpen: boolean;
  projectPath: string | null;
}

interface DebugActions {
  openDebugModal: (projectPath: string) => void;
  closeDebugModal: () => void;
}

export const useDebugStore = create<DebugState & DebugActions>((set) => ({
  isOpen: false,
  projectPath: null,

  openDebugModal: (projectPath) => set({ isOpen: true, projectPath }),
  closeDebugModal: () => set({ isOpen: false, projectPath: null }),
}));
