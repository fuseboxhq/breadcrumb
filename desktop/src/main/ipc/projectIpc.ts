/**
 * Project IPC handlers — persists recent projects via electron-store.
 */

import { ipcMain } from "electron";
import Store from "electron-store";
import { IPC_CHANNELS, RecentProject } from "../../shared/types";
import { syncAllSkills } from "../extensions/SkillSync";

interface ProjectStoreSchema {
  recentProjects: RecentProject[];
}

const projectStore = new Store<ProjectStoreSchema>({
  name: "projects",
  schema: {
    recentProjects: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          path: { type: "string" as const },
          name: { type: "string" as const },
          lastOpened: { type: "number" as const },
        },
        required: ["path", "name", "lastOpened"],
      },
      default: [],
    },
  },
});

let handlersRegistered = false;

export function registerProjectIPCHandlers(): () => void {
  if (handlersRegistered) return () => {};
  handlersRegistered = true;

  // Get recent projects
  ipcMain.handle(IPC_CHANNELS.PROJECT_GET_RECENT, async () => {
    try {
      const projects = projectStore.get("recentProjects", []);
      return { success: true, projects };
    } catch (error) {
      return { success: false, error: String(error), projects: [] };
    }
  });

  // Add or update a recent project
  ipcMain.handle(
    IPC_CHANNELS.PROJECT_ADD_RECENT,
    async (_, project: { path: string; name: string }) => {
      try {
        const projects = projectStore.get("recentProjects", []);
        const existing = projects.findIndex((p) => p.path === project.path);

        if (existing >= 0) {
          projects[existing] = { ...projects[existing], name: project.name, lastOpened: Date.now() };
        } else {
          projects.unshift({ path: project.path, name: project.name, lastOpened: Date.now() });
        }

        // Keep at most 20 recent projects
        const trimmed = projects.slice(0, 20);
        projectStore.set("recentProjects", trimmed);

        // Sync skills when a project is opened
        try {
          syncAllSkills(project.path);
        } catch {
          // Non-fatal — don't block project open
        }

        return { success: true };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }
  );

  // Remove a recent project
  ipcMain.handle(
    IPC_CHANNELS.PROJECT_REMOVE_RECENT,
    async (_, projectPath: string) => {
      try {
        const projects = projectStore.get("recentProjects", []);
        const filtered = projects.filter((p) => p.path !== projectPath);
        projectStore.set("recentProjects", filtered);
        return { success: true };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }
  );

  // Manual skill sync (called after creating a skill or from renderer)
  ipcMain.handle(
    IPC_CHANNELS.SKILLS_SYNC,
    async (_, projectPath: string) => {
      try {
        const result = syncAllSkills(projectPath);
        return { success: true, synced: result.synced, errors: result.errors };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }
  );

  return () => {
    ipcMain.removeHandler(IPC_CHANNELS.PROJECT_GET_RECENT);
    ipcMain.removeHandler(IPC_CHANNELS.PROJECT_ADD_RECENT);
    ipcMain.removeHandler(IPC_CHANNELS.PROJECT_REMOVE_RECENT);
    ipcMain.removeHandler(IPC_CHANNELS.SKILLS_SYNC);
    handlersRegistered = false;
  };
}
