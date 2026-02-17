/**
 * AI Debug Assistant Extension for Breadcrumb IDE.
 *
 * Provides a per-project debug workflow:
 *  1. User triggers "Start Debug Session" command
 *  2. Extension checks for a debug skill in the active project
 *  3. If missing, offers to create it via interactive Claude session
 *  4. If present, shows the debug modal to collect issue details
 *  5. Spawns Claude Code with the debug skill + issue context
 */

const fs = require("fs");
const path = require("path");

/** @type {import("../../src/main/extensions/extensionHostWorker").ExtensionContext} */
let ctx;

function activate(context) {
  ctx = context;
  console.log("[Debug Assistant] activating...");

  // Register the main "start debug session" command
  const startCmd = breadcrumb.commands.registerCommand(
    "start",
    async (projectPath) => {
      if (!projectPath) {
        breadcrumb.window.showWarningMessage(
          "No project selected. Open a project first."
        );
        return { error: "No project path" };
      }

      // Check if debug skill exists for this project
      const skillPath = path.join(projectPath, ".breadcrumb", "skills", "debug.md");
      const hasSkill = fs.existsSync(skillPath);

      if (!hasSkill) {
        // Offer to create the debug skill
        const result = await breadcrumb.window.showInputModal({
          title: "Debug Skill Not Found",
          description: `No debug skill exists for this project yet. Would you like to create one? Claude will ask you about your project's logging setup, debug procedures, and documentation.`,
          fields: [
            {
              id: "action",
              type: "select",
              label: "What would you like to do?",
              options: [
                { label: "Create debug skill (recommended)", value: "create" },
                { label: "Skip — proceed without skill", value: "skip" },
              ],
            },
          ],
          submitLabel: "Continue",
        });

        if (!result || result.action === "skip") {
          // Proceed without skill — just show the debug modal
          return showDebugModal(projectPath, null);
        }

        // Create the skill via interactive Claude session
        return createDebugSkill(projectPath);
      }

      // Skill exists — show the debug modal
      const skillContent = fs.readFileSync(skillPath, "utf-8");
      return showDebugModal(projectPath, skillContent);
    }
  );

  // Register skill creation command
  const createSkillCmd = breadcrumb.commands.registerCommand(
    "createSkill",
    async (projectPath) => {
      if (!projectPath) {
        breadcrumb.window.showWarningMessage("No project selected.");
        return { error: "No project path" };
      }
      return createDebugSkill(projectPath);
    }
  );

  context.subscriptions.push(startCmd, createSkillCmd);
  console.log("[Debug Assistant] activated with 2 commands");
}

/**
 * Show the debug modal to collect issue details, then spawn Claude.
 */
async function showDebugModal(projectPath, skillContent) {
  const result = await breadcrumb.window.showInputModal({
    title: "Debug Issue",
    description: "Describe the issue and attach evidence. Claude will investigate using your project's debug context.",
    fields: [
      {
        id: "description",
        type: "textarea",
        label: "Issue Description",
        placeholder: "What's happening? What did you expect instead?",
        required: true,
      },
      {
        id: "consoleLogs",
        type: "textarea",
        label: "Console Logs",
        placeholder: "Paste any relevant console output, error messages, or stack traces...",
      },
      {
        id: "instanceChoice",
        type: "select",
        label: "Claude Instance",
        options: [
          { label: "New instance", value: "new" },
          { label: "Reuse last selected", value: "reuse" },
        ],
      },
    ],
    submitLabel: "Start Debug Session",
  });

  if (!result) return { cancelled: true };

  // Build the Claude Code prompt
  const prompt = buildDebugPrompt(
    result.description || "",
    result.consoleLogs || "",
    [],  // Image paths would come from the custom DebugModal override
    skillContent
  );

  // Spawn Claude Code terminal
  if (result.instanceChoice === "new" || result.instanceChoice !== "reuse") {
    const terminal = await breadcrumb.terminal.createTerminal({
      name: "Debug: Claude",
      workingDirectory: projectPath,
    });

    // Store the session ID for potential reuse
    await ctx.workspaceState.update("lastDebugSessionId", terminal.sessionId);
    await ctx.workspaceState.update("lastDebugProjectPath", projectPath);

    return {
      success: true,
      sessionId: terminal.sessionId,
      prompt,
    };
  }

  // Reuse mode — return the prompt for the caller to inject into existing terminal
  const lastSessionId = ctx.workspaceState.get("lastDebugSessionId");
  return {
    success: true,
    sessionId: lastSessionId || null,
    prompt,
    reuse: true,
  };
}

/**
 * Spawn Claude Code interactively to create a debug skill for the project.
 */
async function createDebugSkill(projectPath) {
  const skillDir = path.join(projectPath, ".breadcrumb", "skills");
  const claudeSkillDir = path.join(projectPath, ".claude", "commands");

  // Ensure directories exist
  try {
    fs.mkdirSync(skillDir, { recursive: true });
    fs.mkdirSync(claudeSkillDir, { recursive: true });
  } catch {
    // Directories may already exist
  }

  const creationPrompt = [
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
    "After gathering this information, create a debug skill file at:",
    `  ${path.join(skillDir, "debug.md")}`,
    "",
    "The skill should be a markdown file with YAML frontmatter in Claude Code skill format.",
    "It should include instructions for Claude on how to debug issues in this specific project.",
    "",
    "Example structure:",
    "```",
    "---",
    "name: debug",
    "description: Debug issues in this project using project-specific context and procedures",
    "---",
    "",
    "# Debug Skill for [Project Name]",
    "",
    "## Project Context",
    "[Overview of the project architecture]",
    "",
    "## Logging",
    "[How to find and read logs]",
    "",
    "## Common Issues",
    "[Known issues and their solutions]",
    "",
    "## Debug Procedures",
    "[Step-by-step debugging workflows]",
    "```",
    "",
    `Also create a copy at: ${path.join(claudeSkillDir, "debug.md")}`,
    "so Claude Code natively picks up the skill.",
  ].join("\n");

  const terminal = await breadcrumb.terminal.createTerminal({
    name: "Create Debug Skill",
    workingDirectory: projectPath,
  });

  await ctx.workspaceState.update("lastSkillCreationSessionId", terminal.sessionId);

  return {
    success: true,
    action: "creating-skill",
    sessionId: terminal.sessionId,
    prompt: creationPrompt,
  };
}

/**
 * Build the prompt string to send to Claude Code for debugging.
 */
function buildDebugPrompt(description, consoleLogs, imagePaths, skillContent) {
  const parts = [];

  if (skillContent) {
    parts.push("## Debug Skill Context");
    parts.push(skillContent);
    parts.push("");
  }

  if (imagePaths.length > 0) {
    parts.push("## Screenshots");
    imagePaths.forEach((p, i) => {
      parts.push(`Screenshot ${i + 1}: ${p}`);
    });
    parts.push("");
  }

  parts.push("## Issue Description");
  parts.push(description);

  if (consoleLogs) {
    parts.push("");
    parts.push("## Console Logs");
    parts.push("```");
    parts.push(consoleLogs);
    parts.push("```");
  }

  parts.push("");
  parts.push("Please investigate this issue and suggest a fix.");

  return parts.join("\n");
}

function deactivate() {
  console.log("[Debug Assistant] deactivated");
}

module.exports = { activate, deactivate };
