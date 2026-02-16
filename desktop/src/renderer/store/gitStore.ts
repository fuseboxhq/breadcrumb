import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type {
  CommitInfo,
  CommitDiff,
  CommitStats,
  CommitLogOptions,
} from "../../main/git/GitService";

// Re-export types for consumer convenience
export type { CommitInfo, CommitDiff, CommitStats, CommitLogOptions };

// ── Per-project git data ──────────────────────────────────────────────────

interface ProjectGitData {
  commits: CommitInfo[];
  byPhase: Record<string, CommitInfo[]>; // keyed by "PHASE-XX"
  byTask: Record<string, CommitInfo[]>; // keyed by task ID e.g. "breadcrumb-c9v.3"
  diffs: Record<string, CommitDiff>; // keyed by commit hash
  stats: Record<string, CommitStats>; // keyed by commit hash
  loading: boolean;
  loadingDiff: string | null; // hash currently loading
  error: string | null;
  hasMore: boolean;
  totalFetched: number;
}

// ── Store ─────────────────────────────────────────────────────────────────

interface GitState {
  projects: Record<string, ProjectGitData>;
}

interface GitActions {
  fetchCommits: (
    projectPath: string,
    options?: CommitLogOptions
  ) => Promise<void>;
  fetchMoreCommits: (projectPath: string) => Promise<void>;
  fetchDiff: (projectPath: string, hash: string) => Promise<void>;
  fetchStats: (projectPath: string, hash: string) => Promise<void>;
  clearProject: (projectPath: string) => void;
}

export type GitStore = GitState & GitActions;

const DEFAULT_PAGE_SIZE = 100;

function emptyProjectGitData(): ProjectGitData {
  return {
    commits: [],
    byPhase: {},
    byTask: {},
    diffs: {},
    stats: {},
    loading: false,
    loadingDiff: null,
    error: null,
    hasMore: false,
    totalFetched: 0,
  };
}

function ensureProject(
  state: GitState,
  projectPath: string
): ProjectGitData {
  if (!state.projects[projectPath]) {
    state.projects[projectPath] = emptyProjectGitData();
  }
  return state.projects[projectPath];
}

function indexCommits(data: ProjectGitData, commits: CommitInfo[]): void {
  for (const commit of commits) {
    for (const phaseId of commit.phaseLinks) {
      if (!data.byPhase[phaseId]) data.byPhase[phaseId] = [];
      // Avoid duplicates
      if (!data.byPhase[phaseId].some((c) => c.hash === commit.hash)) {
        data.byPhase[phaseId].push(commit);
      }
    }
    for (const taskId of commit.taskLinks) {
      if (!data.byTask[taskId]) data.byTask[taskId] = [];
      if (!data.byTask[taskId].some((c) => c.hash === commit.hash)) {
        data.byTask[taskId].push(commit);
      }
    }
  }
}

export const useGitStore = create<GitStore>()(
  immer((set) => ({
    projects: {},

    fetchCommits: async (projectPath, options) => {
      set((state) => {
        const p = ensureProject(state, projectPath);
        p.loading = true;
        p.error = null;
      });

      try {
        const result = await window.breadcrumbAPI?.getGitLog(projectPath, {
          maxCount: options?.maxCount ?? DEFAULT_PAGE_SIZE,
          skip: options?.skip ?? 0,
          grep: options?.grep,
        });

        if (result?.success && result.data) {
          set((state) => {
            const p = ensureProject(state, projectPath);
            const commits = result.data!.commits as unknown as CommitInfo[];

            if ((options?.skip ?? 0) === 0) {
              // Fresh fetch — replace
              p.commits = commits;
              p.byPhase = {};
              p.byTask = {};
            } else {
              // Pagination — append
              p.commits.push(...commits);
            }

            indexCommits(p, commits);
            p.hasMore = result.data!.hasMore;
            p.totalFetched = p.commits.length;
            p.loading = false;
          });
        } else {
          set((state) => {
            const p = ensureProject(state, projectPath);
            p.error = result?.error ?? "Failed to fetch commits";
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

    fetchMoreCommits: async (projectPath) => {
      const current = useGitStore.getState().projects[projectPath];
      if (!current || current.loading || !current.hasMore) return;

      const store = useGitStore.getState();
      await store.fetchCommits(projectPath, {
        maxCount: DEFAULT_PAGE_SIZE,
        skip: current.totalFetched,
      });
    },

    fetchDiff: async (projectPath, hash) => {
      // Skip if already cached
      const existing = useGitStore.getState().projects[projectPath]?.diffs[hash];
      if (existing) return;

      set((state) => {
        const p = ensureProject(state, projectPath);
        p.loadingDiff = hash;
      });

      try {
        const result = await window.breadcrumbAPI?.getGitDiff(projectPath, hash);

        if (result?.success && result.data) {
          set((state) => {
            const p = ensureProject(state, projectPath);
            p.diffs[hash] = result.data as unknown as CommitDiff;
            p.loadingDiff = null;
          });
        } else {
          set((state) => {
            const p = ensureProject(state, projectPath);
            p.loadingDiff = null;
          });
        }
      } catch {
        set((state) => {
          const p = ensureProject(state, projectPath);
          p.loadingDiff = null;
        });
      }
    },

    fetchStats: async (projectPath, hash) => {
      const existing =
        useGitStore.getState().projects[projectPath]?.stats[hash];
      if (existing) return;

      try {
        const result = await window.breadcrumbAPI?.getGitCommitStats(
          projectPath,
          hash
        );
        if (result?.success && result.data) {
          set((state) => {
            const p = ensureProject(state, projectPath);
            p.stats[hash] = result.data as unknown as CommitStats;
          });
        }
      } catch {
        // Silent fail — stats are supplementary
      }
    },

    clearProject: (projectPath) => {
      set((state) => {
        delete state.projects[projectPath];
      });
    },
  }))
);

// ── Selectors ─────────────────────────────────────────────────────────────

const EMPTY_COMMITS: CommitInfo[] = [];

export const usePhaseCommits = (
  projectPath: string | null,
  phaseId: string | null
) =>
  useGitStore((s) =>
    projectPath && phaseId
      ? s.projects[projectPath]?.byPhase[phaseId] ?? EMPTY_COMMITS
      : EMPTY_COMMITS
  );

export const useTaskCommits = (
  projectPath: string | null,
  taskId: string | null
) =>
  useGitStore((s) =>
    projectPath && taskId
      ? s.projects[projectPath]?.byTask[taskId] ?? EMPTY_COMMITS
      : EMPTY_COMMITS
  );

export const useCommitDiff = (
  projectPath: string | null,
  hash: string | null
) =>
  useGitStore((s) =>
    projectPath && hash
      ? s.projects[projectPath]?.diffs[hash] ?? null
      : null
  );

export const useGitLoading = (projectPath: string | null) =>
  useGitStore(
    (s) => (projectPath ? s.projects[projectPath]?.loading : false) ?? false
  );

export const useGitLoadingDiff = (projectPath: string | null) =>
  useGitStore(
    (s) =>
      (projectPath ? s.projects[projectPath]?.loadingDiff : null) ?? null
  );
