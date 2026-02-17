import { ipcMain } from "electron";
import { IPC_CHANNELS } from "../../shared/types";
import { planningService } from "../planning/PlanningService";
import { validatePath } from "../utils/pathValidation";

let handlersRegistered = false;

export function registerPlanningIPCHandlers(): () => void {
  if (handlersRegistered) return () => {};
  handlersRegistered = true;

  ipcMain.handle(
    IPC_CHANNELS.PLANNING_GET_CAPABILITIES,
    async (_, { projectPath }: { projectPath: string }) => {
      try {
        const validated = validatePath(projectPath);
        const capabilities = await planningService.getProjectCapabilities(validated);
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
        const phases = await planningService.getProjectPhases(validated);
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
        const detail = await planningService.getPhaseDetail(validated, phaseId);
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
        const tasks = await planningService.getBeadsTasks(validated, epicId);
        return { success: true, data: tasks };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.PLANNING_UPDATE_TASK_DETAIL,
    async (
      _,
      {
        projectPath,
        phaseId,
        taskId,
        content,
      }: {
        projectPath: string;
        phaseId: string;
        taskId: string;
        content: string;
      }
    ) => {
      try {
        const validated = validatePath(projectPath);
        if (!/^PHASE-\d+$/.test(phaseId)) {
          return { success: false, error: "Invalid phase ID format" };
        }
        if (!/^[\w.-]+$/.test(taskId)) {
          return { success: false, error: "Invalid task ID format" };
        }
        await planningService.updateTaskDetail(validated, phaseId, taskId, content);
        return { success: true };
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
    ipcMain.removeHandler(IPC_CHANNELS.PLANNING_UPDATE_TASK_DETAIL);
    handlersRegistered = false;
  };
}
