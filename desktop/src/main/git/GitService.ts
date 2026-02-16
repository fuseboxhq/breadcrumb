import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export type GitProvider = "github" | "gitlab" | "azure" | "other";

export interface GitInfo {
  isGitRepo: boolean;
  branch: string;
  remote: string;
  repoName: string;
  provider: GitProvider | null;
}

export interface CommitInfo {
  hash: string;
  shortHash: string;
  author: string;
  email: string;
  date: string; // ISO 8601
  subject: string;
  body: string;
  phaseLinks: string[]; // e.g. ["PHASE-23", "PHASE-24"]
  taskLinks: string[]; // e.g. ["breadcrumb-rjx.3"]
}

export interface CommitFileStats {
  path: string;
  insertions: number;
  deletions: number;
  binary: boolean;
}

export interface CommitStats {
  hash: string;
  filesChanged: number;
  totalInsertions: number;
  totalDeletions: number;
  files: CommitFileStats[];
}

export interface CommitDiff {
  hash: string;
  patch: string; // raw unified diff
  stats: CommitStats;
}

export interface CommitLogOptions {
  maxCount?: number;
  skip?: number;
  grep?: string; // filter by commit message pattern
}

const GIT_TIMEOUT_MS = 5000;
const GIT_LOG_TIMEOUT_MS = 15000;
const GIT_DIFF_TIMEOUT_MS = 30000;
const LOG_DELIMITER = "---COMMIT_DELIM---";
const FIELD_DELIMITER = "---FIELD---";

export class GitService {
  async getGitInfo(workingDirectory: string): Promise<GitInfo> {
    if (!(await this.isGitRepo(workingDirectory))) {
      return { isGitRepo: false, branch: "", remote: "", repoName: "", provider: null };
    }

    const branch = await this.getBranch(workingDirectory);
    const remote = await this.getRemote(workingDirectory);
    const { repoName, provider } = this.parseRemote(remote);

    return { isGitRepo: true, branch, remote, repoName, provider };
  }

  // ── Commit Log ──────────────────────────────────────────────────────────

  async getCommitLog(
    cwd: string,
    options: CommitLogOptions = {}
  ): Promise<{ commits: CommitInfo[]; hasMore: boolean }> {
    const { maxCount = 50, skip = 0, grep } = options;
    // Fetch one extra to detect if there are more
    const fetchCount = maxCount + 1;

    const args = [
      "log",
      `--format=${LOG_DELIMITER}%H${FIELD_DELIMITER}%an${FIELD_DELIMITER}%ae${FIELD_DELIMITER}%aI${FIELD_DELIMITER}%s${FIELD_DELIMITER}%b`,
      `--max-count=${fetchCount}`,
      `--skip=${skip}`,
    ];
    if (grep) {
      args.push(`--grep=${grep}`, "--extended-regexp");
    }

    try {
      const { stdout } = await execFileAsync("git", args, {
        cwd,
        timeout: GIT_LOG_TIMEOUT_MS,
        maxBuffer: 10 * 1024 * 1024, // 10MB
      });

      const raw = stdout
        .split(LOG_DELIMITER)
        .filter((s) => s.trim().length > 0);

      const commits: CommitInfo[] = [];
      for (const entry of raw) {
        const fields = entry.split(FIELD_DELIMITER);
        if (fields.length < 5) continue;

        const hash = fields[0].trim();
        const author = fields[1].trim();
        const email = fields[2].trim();
        const date = fields[3].trim();
        const subject = fields[4].trim();
        const body = (fields[5] || "").trim();

        const fullMessage = `${subject}\n${body}`;
        const phaseLinks = this.extractPhaseLinks(fullMessage);
        const taskLinks = this.extractTaskLinks(fullMessage);

        commits.push({
          hash,
          shortHash: hash.substring(0, 7),
          author,
          email,
          date,
          subject,
          body,
          phaseLinks,
          taskLinks,
        });
      }

      const hasMore = commits.length > maxCount;
      if (hasMore) commits.pop(); // remove the extra

      return { commits, hasMore };
    } catch {
      return { commits: [], hasMore: false };
    }
  }

  // ── Commit Diff ─────────────────────────────────────────────────────────

  async getCommitDiff(cwd: string, hash: string): Promise<CommitDiff | null> {
    try {
      const [stats, patch] = await Promise.all([
        this.getCommitStats(cwd, hash),
        this.getCommitPatch(cwd, hash),
      ]);

      if (!stats) return null;

      return { hash, patch, stats };
    } catch {
      return null;
    }
  }

  async getCommitStats(cwd: string, hash: string): Promise<CommitStats | null> {
    try {
      // Use numstat for machine-readable file stats
      const { stdout } = await execFileAsync(
        "git",
        ["show", "--numstat", "--format=", hash],
        { cwd, timeout: GIT_TIMEOUT_MS }
      );

      const files: CommitFileStats[] = [];
      let totalInsertions = 0;
      let totalDeletions = 0;

      for (const line of stdout.trim().split("\n")) {
        if (!line.trim()) continue;
        const parts = line.split("\t");
        if (parts.length < 3) continue;

        const binary = parts[0] === "-" && parts[1] === "-";
        const insertions = binary ? 0 : parseInt(parts[0], 10) || 0;
        const deletions = binary ? 0 : parseInt(parts[1], 10) || 0;
        const path = parts[2];

        files.push({ path, insertions, deletions, binary });
        totalInsertions += insertions;
        totalDeletions += deletions;
      }

      return {
        hash,
        filesChanged: files.length,
        totalInsertions,
        totalDeletions,
        files,
      };
    } catch {
      return null;
    }
  }

  private async getCommitPatch(cwd: string, hash: string): Promise<string> {
    try {
      // Use diff-filter to skip binary, limit output
      const { stdout } = await execFileAsync(
        "git",
        ["show", "--patch", "--format=", hash],
        { cwd, timeout: GIT_DIFF_TIMEOUT_MS, maxBuffer: 20 * 1024 * 1024 }
      );
      return stdout;
    } catch {
      return "";
    }
  }

  // ── Commit Message Parsing ──────────────────────────────────────────────

  private extractPhaseLinks(message: string): string[] {
    const matches = message.match(/PHASE-\d+/g);
    return matches ? [...new Set(matches)] : [];
  }

  private extractTaskLinks(message: string): string[] {
    // Match patterns like: breadcrumb-rjx.3, argus-web-9tp.1
    const matches = message.match(/[a-z]+-[a-z0-9]+(?:-[a-z0-9]+)*\.\d+/g);
    return matches ? [...new Set(matches)] : [];
  }

  // ── Existing Methods ────────────────────────────────────────────────────

  private async isGitRepo(workingDirectory: string): Promise<boolean> {
    try {
      await execFileAsync("git", ["rev-parse", "--is-inside-work-tree"], {
        cwd: workingDirectory,
        timeout: GIT_TIMEOUT_MS,
      });
      return true;
    } catch {
      return false;
    }
  }

  private async getBranch(workingDirectory: string): Promise<string> {
    try {
      const { stdout } = await execFileAsync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
        cwd: workingDirectory,
        timeout: GIT_TIMEOUT_MS,
      });
      return stdout.trim();
    } catch {
      return "";
    }
  }

  private async getRemote(workingDirectory: string): Promise<string> {
    try {
      const { stdout } = await execFileAsync("git", ["remote", "get-url", "origin"], {
        cwd: workingDirectory,
        timeout: GIT_TIMEOUT_MS,
      });
      return stdout.trim();
    } catch {
      return "";
    }
  }

  private parseRemote(remote: string): { repoName: string; provider: GitProvider | null } {
    if (!remote) return { repoName: "", provider: null };

    const githubMatch = remote.match(/github\.com[:/](.+?)(?:\.git)?$/);
    if (githubMatch) return { repoName: githubMatch[1], provider: "github" };

    const gitlabMatch = remote.match(/gitlab\.com[:/](.+?)(?:\.git)?$/);
    if (gitlabMatch) return { repoName: gitlabMatch[1], provider: "gitlab" };

    const azureMatch = remote.match(/dev\.azure\.com\/([^/]+)\/([^/]+)\/_git\/([^/]+?)(?:\.git)?$/);
    if (azureMatch) return { repoName: `${azureMatch[1]}/${azureMatch[2]}/${azureMatch[3]}`, provider: "azure" };

    const genericMatch = remote.match(/[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
    if (genericMatch) return { repoName: genericMatch[1], provider: "other" };

    return { repoName: remote, provider: "other" };
  }
}

export const gitService = new GitService();
