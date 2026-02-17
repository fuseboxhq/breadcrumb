/**
 * SkillSync — synchronizes skill files between Breadcrumb and Claude Code.
 *
 * Source of truth: `.breadcrumb/skills/<name>.md`
 * Target: `.claude/commands/<name>.md`
 *
 * Sync is triggered:
 *  - When a project is opened (syncAllSkills)
 *  - After a skill is created or modified (syncSkill)
 *
 * Direction: .breadcrumb/skills/ → .claude/commands/ (one-way)
 * If .claude/commands/<name>.md is newer, it is preserved (bidirectional safe).
 */

import fs from "fs";
import path from "path";

const BREADCRUMB_SKILLS_DIR = ".breadcrumb/skills";
const CLAUDE_COMMANDS_DIR = ".claude/commands";

/**
 * Sync a single skill file from .breadcrumb/skills/ to .claude/commands/.
 * Creates target directories if needed.
 */
export function syncSkill(projectPath: string, skillName: string): { synced: boolean; error?: string } {
  try {
    const sourcePath = path.join(projectPath, BREADCRUMB_SKILLS_DIR, `${skillName}.md`);
    const targetPath = path.join(projectPath, CLAUDE_COMMANDS_DIR, `${skillName}.md`);

    if (!fs.existsSync(sourcePath)) {
      return { synced: false, error: `Source skill not found: ${sourcePath}` };
    }

    const sourceContent = fs.readFileSync(sourcePath, "utf-8");
    const sourceStat = fs.statSync(sourcePath);

    // Check if target exists and is newer (bidirectional safety)
    if (fs.existsSync(targetPath)) {
      const targetStat = fs.statSync(targetPath);
      const targetContent = fs.readFileSync(targetPath, "utf-8");

      // If contents are identical, no sync needed
      if (sourceContent === targetContent) {
        return { synced: false };
      }

      // If target is newer, sync from target back to source instead
      if (targetStat.mtimeMs > sourceStat.mtimeMs) {
        fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
        fs.writeFileSync(sourcePath, targetContent, "utf-8");
        console.log(`[SkillSync] Reverse synced ${skillName}: .claude/commands/ → .breadcrumb/skills/`);
        return { synced: true };
      }
    }

    // Sync source → target
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, sourceContent, "utf-8");
    console.log(`[SkillSync] Synced ${skillName}: .breadcrumb/skills/ → .claude/commands/`);
    return { synced: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[SkillSync] Error syncing ${skillName}:`, error);
    return { synced: false, error };
  }
}

/**
 * Sync all skill files in a project's .breadcrumb/skills/ directory.
 */
export function syncAllSkills(projectPath: string): { synced: number; errors: string[] } {
  const skillsDir = path.join(projectPath, BREADCRUMB_SKILLS_DIR);
  const errors: string[] = [];
  let synced = 0;

  if (!fs.existsSync(skillsDir)) {
    return { synced: 0, errors: [] };
  }

  try {
    const entries = fs.readdirSync(skillsDir);
    for (const entry of entries) {
      if (!entry.endsWith(".md")) continue;
      const skillName = entry.replace(/\.md$/, "");
      const result = syncSkill(projectPath, skillName);
      if (result.synced) synced++;
      if (result.error) errors.push(result.error);
    }
  } catch (err) {
    errors.push(String(err));
  }

  // Also check .claude/commands/ for skills that don't exist in .breadcrumb/skills/
  const claudeDir = path.join(projectPath, CLAUDE_COMMANDS_DIR);
  if (fs.existsSync(claudeDir)) {
    try {
      const claudeEntries = fs.readdirSync(claudeDir);
      for (const entry of claudeEntries) {
        if (!entry.endsWith(".md")) continue;
        const skillName = entry.replace(/\.md$/, "");
        const breadcrumbPath = path.join(skillsDir, entry);

        // If skill exists in .claude/commands/ but not in .breadcrumb/skills/, copy it
        if (!fs.existsSync(breadcrumbPath)) {
          try {
            const content = fs.readFileSync(path.join(claudeDir, entry), "utf-8");
            fs.mkdirSync(skillsDir, { recursive: true });
            fs.writeFileSync(breadcrumbPath, content, "utf-8");
            console.log(`[SkillSync] Imported ${skillName}: .claude/commands/ → .breadcrumb/skills/`);
            synced++;
          } catch (err) {
            errors.push(`Import ${skillName}: ${String(err)}`);
          }
        }
      }
    } catch {
      // Ignore read errors on claude dir
    }
  }

  if (synced > 0 || errors.length > 0) {
    console.log(`[SkillSync] Project ${projectPath}: ${synced} synced, ${errors.length} errors`);
  }

  return { synced, errors };
}
