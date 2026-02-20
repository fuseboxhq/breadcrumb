/**
 * Debug modal state — controls the DebugModal visibility and
 * handles the submission flow (save images, build prompt, spawn terminal).
 */

import { create } from "zustand";
import { toast } from "sonner";
import { useAppStore } from "./appStore";

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

/**
 * Check for debug skill, then either open the debug modal or prompt to create one.
 * Used by both TabBar button and command palette — single entry point for debug flow.
 */
export async function startDebugSession(projectPath: string): Promise<void> {
  if (!projectPath) {
    toast.error("No project selected", {
      description: "Open a project first to use the debug assistant.",
    });
    return;
  }

  // Check for debug skill in Claude Code skills directory (.claude/skills/debug*/SKILL.md)
  // and legacy Breadcrumb location (.breadcrumb/skills/debug.md)
  const hasSkill = await detectDebugSkill(projectPath);

  if (hasSkill) {
    useDebugStore.getState().openDebugModal(projectPath);
    return;
  }

  // No skill found — prompt to create one
  toast("Debug skill not configured", {
    description: "Create a project-specific debug skill so Claude knows how to investigate bugs in this codebase.",
    action: {
      label: "Configure Now",
      onClick: () => spawnSkillCreation(projectPath),
    },
    duration: 10000,
  });
}

/**
 * Detect a debug skill by scanning .claude/skills/ for any directory
 * whose name starts with "debug" and contains a SKILL.md file.
 * Also checks the legacy .breadcrumb/skills/debug.md location.
 */
async function detectDebugSkill(projectPath: string): Promise<boolean> {
  const api = window.breadcrumbAPI;
  if (!api) return false;

  // Check Claude Code skills directory for debug-* skill folders
  const skillsResult = await api.listDir(`${projectPath}/.claude/skills`);
  if (skillsResult?.success) {
    const debugDirs = skillsResult.entries.filter(
      (e) => e.isDirectory && e.name.toLowerCase().startsWith("debug")
    );
    for (const dir of debugDirs) {
      const skillFile = await api.readFile(
        `${projectPath}/.claude/skills/${dir.name}/SKILL.md`
      );
      if (skillFile?.success) return true;
    }
  }

  // Legacy: check .breadcrumb/skills/debug.md
  const legacy = await api.readFile(`${projectPath}/.breadcrumb/skills/debug.md`);
  if (legacy?.success) return true;

  return false;
}

/**
 * Spawn a Claude Code terminal to interactively create a debug skill.
 */
function spawnSkillCreation(projectPath: string): void {
  const store = useAppStore.getState();
  const tabId = `debug-skill-${Date.now()}`;

  const prompt = [
    "I need you to create a debug skill for this project.",
    "",
    "Please investigate this project and then ask me questions to understand:",
    "1. What logging framework/library is used (console.log, winston, pino, etc.)",
    "2. Where error logs are typically found",
    "3. How to access the dev server / application logs",
    "4. Common debugging procedures specific to this project",
    "5. Where documentation about the architecture lives",
    "6. Any project-specific debugging tips or gotchas",
    "",
    "After gathering this information, create a debug skill at:",
    `  ${projectPath}/.claude/skills/debug/SKILL.md`,
    "",
    "The skill should be a markdown file in Claude Code skill format.",
    "It should include instructions for Claude on how to debug issues in this specific project.",
  ].join("\\n");

  store.addTab({
    id: tabId,
    type: "terminal",
    title: "Create Debug Skill",
    projectId: store.tabs.find((t) => t.projectId)?.projectId,
    initialCommand: `claude "${prompt.replace(/"/g, '\\"')}"` + "\n",
  });

  const paneId = `pane-${Date.now()}`;
  const sessionId = `debug-skill-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  useAppStore.setState((state) => {
    state.terminalPanes[tabId] = {
      splitTree: {
        type: "pane",
        pane: {
          type: "terminal",
          id: paneId,
          sessionId,
          cwd: projectPath,
          lastActivity: Date.now(),
          processLabel: "Create Debug Skill",
        },
      },
      activePane: paneId,
    };
  });
}
