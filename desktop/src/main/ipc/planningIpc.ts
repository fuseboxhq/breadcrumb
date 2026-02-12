import { ipcMain } from "electron";
import path from "path";
import { IPC_CHANNELS } from "../../shared/types";
import { planningService } from "../planning/PlanningService";

let handlersRegistered = false;

function validatePath(inputPath: string): string {
  const resolved = path.resolve(inputPath);
  if (inputPath.includes("..")) {
    throw new Error("Path traversal not allowed");
  }
  return resolved;
}

export function registerPlanningIPCHandlers(): () => void {
  if (handlersRegistered) return () => {};
  handlersRegistered = true;

  ipcMain.handle(
    IPC_CHANNELS.PLANNING_GET_CAPABILITIES,
    async (_, { projectPath }: { projectPath: string }) => {
      try {
        const validated = validatePath(projectPath);
        const capabilities = planningService.getProjectCapabilities(validated);
        return { success: true, data: capabilities };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.PLANNING_GET_PHASES,
    async (_, { projectPath }: { projectPath: string }) => {
      try {
        const validated = validatePath(projectPath);
        const phases = planningService.getProjectPhases(validated);
        return { success: true, data: phases };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.PLANNING_GET_PHASE_DETAIL,
    async (
      _,
      { projectPath, phaseId }: { projectPath: string; phaseId: string }
    ) => {
      try {
        const validated = validatePath(projectPath);
        const detail = planningService.getPhaseDetail(validated, phaseId);
        return { success: true, data: detail };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.PLANNING_GET_BEADS_TASKS,
    async (
      _,
      { projectPath, epicId }: { projectPath: string; epicId: string }
    ) => {
      try {
        const validated = validatePath(projectPath);
        const tasks = planningService.getBeadsTasks(validated, epicId);
        return { success: true, data: tasks };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }
  );

  return () => {
    ipcMain.removeHandler(IPC_CHANNELS.PLANNING_GET_CAPABILITIES);
    ipcMain.removeHandler(IPC_CHANNELS.PLANNING_GET_PHASES);
    ipcMain.removeHandler(IPC_CHANNELS.PLANNING_GET_PHASE_DETAIL);
    ipcMain.removeHandler(IPC_CHANNELS.PLANNING_GET_BEADS_TASKS);
    handlersRegistered = false;
  };
}
