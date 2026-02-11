import { execSync } from "child_process";

export type GitProvider = "github" | "gitlab" | "azure" | "other";

export interface GitInfo {
  isGitRepo: boolean;
  branch: string;
  remote: string;
  repoName: string;
  provider: GitProvider | null;
}

const GIT_TIMEOUT_MS = 5000;

export class GitService {
  getGitInfo(workingDirectory: string): GitInfo {
    if (!this.isGitRepo(workingDirectory)) {
      return { isGitRepo: false, branch: "", remote: "", repoName: "", provider: null };
    }

    const branch = this.getBranch(workingDirectory);
    const remote = this.getRemote(workingDirectory);
    const { repoName, provider } = this.parseRemote(remote);

    return { isGitRepo: true, branch, remote, repoName, provider };
  }

  private isGitRepo(workingDirectory: string): boolean {
    try {
      execSync("git rev-parse --is-inside-work-tree", {
        cwd: workingDirectory,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
        timeout: GIT_TIMEOUT_MS,
      });
      return true;
    } catch {
      return false;
    }
  }

  private getBranch(workingDirectory: string): string {
    try {
      return execSync("git rev-parse --abbrev-ref HEAD", {
        cwd: workingDirectory,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
        timeout: GIT_TIMEOUT_MS,
      }).trim();
    } catch {
      return "";
    }
  }

  private getRemote(workingDirectory: string): string {
    try {
      return execSync("git remote get-url origin", {
        cwd: workingDirectory,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
        timeout: GIT_TIMEOUT_MS,
      }).trim();
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
