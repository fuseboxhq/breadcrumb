import { create } from "zustand";
// NOTE: Circular import with appStore (it also imports from us).
// Safe because all cross-references are inside functions, not top-level code.
// ESM live bindings resolve by the time any store action executes.
import { persistWorkspace, useAppStore } from "./appStore";

function triggerWorkspacePersist(): void {
  persistWorkspace();
}

function openPlanningPane(): void {
  const state = useAppStore.getState();
  if (!state.layout.rightPanel.panes.some((p) => p.type === "planning")) {
    state.addRightPanelPane("planning");
  }
}

export interface Project {
  id: string;
  name: string;
  path: string;
  lastOpened: number;
  terminalSessions: string[];
}

interface ProjectsState {
  projects: Project[];
  activeProjectId: string | null;
}

interface ProjectsActions {
  loadProjects: () => Promise<void>;
  addProject: (path: string, name?: string) => Project;
  removeProject: (id: string) => void;
  setActiveProject: (id: string | null) => void;
  addTerminalSession: (projectId: string, sessionId: string) => void;
  removeTerminalSession: (projectId: string, sessionId: string) => void;
  getActiveProject: () => Project | null;
}

export type ProjectsStore = ProjectsState & ProjectsActions;

export const useProjectsStore = create<ProjectsStore>((set, get) => ({
  projects: [],
  activeProjectId: null,

  loadProjects: async () => {
    const result = await window.breadcrumbAPI?.getRecentProjects();
    if (result?.success && result.projects?.length) {
      const projects: Project[] = result.projects.map((p) => ({
        id: `project-${p.lastOpened}-${Math.random().toString(36).slice(2, 7)}`,
        name: p.name,
        path: p.path,
        lastOpened: p.lastOpened,
        terminalSessions: [],
      }));
      set({ projects, activeProjectId: projects[0]?.id || null });
    }
  },

  addProject: (path, name) => {
    // Check if project with this path already exists
    const existing = get().projects.find((p) => p.path === path);
    if (existing) {
      // Just activate it and update lastOpened
      set((state) => ({
        activeProjectId: existing.id,
        projects: state.projects.map((p) =>
          p.id === existing.id ? { ...p, lastOpened: Date.now() } : p
        ),
      }));
      return existing;
    }

    const project: Project = {
      id: `project-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: name || path.split("/").pop() || "Untitled",
      path,
      lastOpened: Date.now(),
      terminalSessions: [],
    };

    set((state) => ({
      projects: [...state.projects, project],
      activeProjectId: project.id,
    }));

    // Persist to backend
    window.breadcrumbAPI?.addRecentProject({ path: project.path, name: project.name });

    // Auto-open the Breadcrumb planning pane
    openPlanningPane();

    return project;
  },

  removeProject: (id) => {
    const project = get().projects.find((p) => p.id === id);
    set((state) => {
      const newProjects = state.projects.filter((p) => p.id !== id);
      const newActiveId =
        state.activeProjectId === id
          ? newProjects[newProjects.length - 1]?.id || null
          : state.activeProjectId;
      return { projects: newProjects, activeProjectId: newActiveId };
    });

    // Persist removal to backend
    if (project) {
      window.breadcrumbAPI?.removeRecentProject(project.path);
    }
  },

  setActiveProject: (id) => {
    if (id) {
      set((state) => ({
        activeProjectId: id,
        projects: state.projects.map((p) =>
          p.id === id ? { ...p, lastOpened: Date.now() } : p
        ),
      }));
    } else {
      set({ activeProjectId: null });
    }
    triggerWorkspacePersist();
  },

  addTerminalSession: (projectId, sessionId) => {
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === projectId && !p.terminalSessions.includes(sessionId)
          ? { ...p, terminalSessions: [...p.terminalSessions, sessionId] }
          : p
      ),
    }));
  },

  removeTerminalSession: (projectId, sessionId) => {
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === projectId
          ? { ...p, terminalSessions: p.terminalSessions.filter((s) => s !== sessionId) }
          : p
      ),
    }));
  },

  getActiveProject: () => {
    const state = get();
    return state.projects.find((p) => p.id === state.activeProjectId) || null;
  },
}));

// Selector hooks
export const useActiveProject = () =>
  useProjectsStore((s) => s.projects.find((p) => p.id === s.activeProjectId) || null);

export const useProjects = () => useProjectsStore((s) => s.projects);

export const useActiveProjectId = () => useProjectsStore((s) => s.activeProjectId);

export const useProjectTerminals = (projectId: string | null) =>
  useProjectsStore((s) => {
    if (!projectId) return [];
    const project = s.projects.find((p) => p.id === projectId);
    return project?.terminalSessions || [];
  });
