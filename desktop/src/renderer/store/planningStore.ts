import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ProjectCapabilities {
  hasPlanning: boolean;
  hasBeads: boolean;
}

export interface PhaseSummary {
  id: string;
  title: string;
  status: "complete" | "in_progress" | "not_started";
  taskCount: number;
  completedCount: number;
  isActive: boolean;
}

export interface PhaseTask {
  id: string;
  title: string;
  status: "done" | "in_progress" | "not_started" | "blocked";
  complexity: string;
  dependsOn: string[];
}

export interface CompletionCriterion {
  text: string;
  checked: boolean;
}

export interface TechnicalDecision {
  decision: string;
  choice: string;
  rationale: string;
}

export interface PhaseDetail {
  id: string;
  title: string;
  status: string;
  beadsEpic: string;
  created: string;
  objective: string;
  scope: { inScope: string[]; outOfScope: string[] };
  constraints: string[];
  tasks: PhaseTask[];
  completionCriteria: CompletionCriterion[];
  decisions: TechnicalDecision[];
}

export interface BeadsTask {
  id: string;
  title: string;
  status: string;
  priority: number;
  issueType: string;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  parentId: string | null;
  blockedBy: string[];
  blocks: string[];
}

// Per-project cached data
interface ProjectPlanningData {
  capabilities: ProjectCapabilities | null;
  phases: PhaseSummary[];
  phaseDetails: Record<string, PhaseDetail>;
  beadsTasks: Record<string, BeadsTask[]>; // keyed by epicId
  loading: boolean;
  error: string | null;
  lastFetched: number | null;
}

// ── State ────────────────────────────────────────────────────────────────────

interface PlanningState {
  projects: Record<string, ProjectPlanningData>;
}

interface PlanningActions {
  fetchCapabilities: (projectPath: string) => Promise<void>;
  fetchPhases: (projectPath: string) => Promise<void>;
  fetchPhaseDetail: (projectPath: string, phaseId: string) => Promise<void>;
  fetchBeadsTasks: (projectPath: string, epicId: string) => Promise<void>;
  refreshProject: (projectPath: string) => Promise<void>;
  clearProject: (projectPath: string) => void;
}

export type PlanningStore = PlanningState & PlanningActions;

function emptyProjectData(): ProjectPlanningData {
  return {
    capabilities: null,
    phases: [],
    phaseDetails: {},
    beadsTasks: {},
    loading: false,
    error: null,
    lastFetched: null,
  };
}

function ensureProject(
  state: PlanningState,
  projectPath: string
): ProjectPlanningData {
  if (!state.projects[projectPath]) {
    state.projects[projectPath] = emptyProjectData();
  }
  return state.projects[projectPath];
}

// ── Store ────────────────────────────────────────────────────────────────────

export const usePlanningStore = create<PlanningStore>()(
  immer((set) => ({
    projects: {},

    fetchCapabilities: async (projectPath) => {
      set((state) => {
        const p = ensureProject(state, projectPath);
        p.loading = true;
        p.error = null;
      });

      try {
        const result =
          await window.breadcrumbAPI?.getPlanningCapabilities(projectPath);
        if (result?.success && result.data) {
          set((state) => {
            const p = ensureProject(state, projectPath);
            p.capabilities = result.data as ProjectCapabilities;
            p.loading = false;
          });
        } else {
          set((state) => {
            const p = ensureProject(state, projectPath);
            p.capabilities = { hasPlanning: false, hasBeads: false };
            p.loading = false;
          });
        }
      } catch (error) {
        set((state) => {
          const p = ensureProject(state, projectPath);
          p.error = String(error);
          p.loading = false;
        });
      }
    },

    fetchPhases: async (projectPath) => {
      set((state) => {
        const p = ensureProject(state, projectPath);
        p.loading = true;
        p.error = null;
      });

      try {
        const result =
          await window.breadcrumbAPI?.getPlanningPhases(projectPath);
        if (result?.success && result.data) {
          set((state) => {
            const p = ensureProject(state, projectPath);
            p.phases = result.data as PhaseSummary[];
            p.loading = false;
            p.lastFetched = Date.now();
          });
        } else {
          set((state) => {
            const p = ensureProject(state, projectPath);
            p.phases = [];
            p.loading = false;
            p.lastFetched = Date.now();
          });
        }
      } catch (error) {
        set((state) => {
          const p = ensureProject(state, projectPath);
          p.error = String(error);
          p.loading = false;
        });
      }
    },

    fetchPhaseDetail: async (projectPath, phaseId) => {
      try {
        const result =
          await window.breadcrumbAPI?.getPlanningPhaseDetail(
            projectPath,
            phaseId
          );
        if (result?.success && result.data) {
          set((state) => {
            const p = ensureProject(state, projectPath);
            p.phaseDetails[phaseId] = result.data as unknown as PhaseDetail;
            p.error = null;
          });
        } else if (result && !result.success) {
          set((state) => {
            const p = ensureProject(state, projectPath);
            p.error = result.error || `Failed to load ${phaseId}`;
          });
        } else {
          // data is null — file doesn't exist
          set((state) => {
            const p = ensureProject(state, projectPath);
            p.error = `Phase file not found: ${phaseId}.md`;
          });
        }
      } catch (error) {
        set((state) => {
          const p = ensureProject(state, projectPath);
          p.error = String(error);
        });
      }
    },

    fetchBeadsTasks: async (projectPath, epicId) => {
      try {
        const result =
          await window.breadcrumbAPI?.getPlanningBeadsTasks(
            projectPath,
            epicId
          );
        if (result?.success && result.data) {
          set((state) => {
            const p = ensureProject(state, projectPath);
            p.beadsTasks[epicId] = result.data as unknown as BeadsTask[];
          });
        } else if (result && !result.success) {
          console.warn(`[planningStore] beads tasks error: ${result.error}`);
        }
        // If data is empty/null, that's fine — no beads tasks for this epic
      } catch (error) {
        set((state) => {
          const p = ensureProject(state, projectPath);
          p.error = String(error);
        });
      }
    },

    refreshProject: async (projectPath) => {
      const store = usePlanningStore.getState();
      await store.fetchCapabilities(projectPath);
      const caps = usePlanningStore.getState().projects[projectPath]?.capabilities;
      if (caps?.hasPlanning) {
        await store.fetchPhases(projectPath);
      }
    },

    clearProject: (projectPath) => {
      set((state) => {
        delete state.projects[projectPath];
      });
    },
  }))
);

// ── Selectors ────────────────────────────────────────────────────────────────

// Stable empty references — returning new [] in a Zustand selector causes
// infinite re-renders because React's useSyncExternalStore compares by reference.
const EMPTY_PHASES: PhaseSummary[] = [];
const EMPTY_BEADS_TASKS: BeadsTask[] = [];

export const useProjectCapabilities = (projectPath: string | null) =>
  usePlanningStore(
    (s) => (projectPath ? s.projects[projectPath]?.capabilities : null) ?? null
  );

export const useProjectPhases = (projectPath: string | null) =>
  usePlanningStore(
    (s) => (projectPath ? s.projects[projectPath]?.phases : null) ?? EMPTY_PHASES
  );

export const usePhaseDetail = (
  projectPath: string | null,
  phaseId: string | null
) =>
  usePlanningStore((s) =>
    projectPath && phaseId
      ? s.projects[projectPath]?.phaseDetails[phaseId] ?? null
      : null
  );

export const useProjectBeadsTasks = (
  projectPath: string | null,
  epicId: string | null
) =>
  usePlanningStore((s) =>
    projectPath && epicId
      ? s.projects[projectPath]?.beadsTasks[epicId] ?? EMPTY_BEADS_TASKS
      : EMPTY_BEADS_TASKS
  );

export const useProjectPlanningLoading = (projectPath: string | null) =>
  usePlanningStore(
    (s) => (projectPath ? s.projects[projectPath]?.loading : false) ?? false
  );

export const useProjectPlanningError = (projectPath: string | null) =>
  usePlanningStore(
    (s) => (projectPath ? s.projects[projectPath]?.error : null) ?? null
  );
