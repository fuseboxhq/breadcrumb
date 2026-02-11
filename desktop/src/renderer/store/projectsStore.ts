import { create } from "zustand";

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

    return project;
  },

  removeProject: (id) => {
    set((state) => {
      const newProjects = state.projects.filter((p) => p.id !== id);
      const newActiveId =
        state.activeProjectId === id
          ? newProjects[newProjects.length - 1]?.id || null
          : state.activeProjectId;
      return { projects: newProjects, activeProjectId: newActiveId };
    });
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
