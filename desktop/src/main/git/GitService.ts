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

const GIT_TIMEOUT_MS = 5000;

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
