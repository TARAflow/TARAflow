// ==================== GIT SERVICE ====================
// Git operations using simple-git
// Handles: status, commit, push, branch management

import simpleGit, { SimpleGit, SimpleGitOptions } from "simple-git";
import type {
  GitStatus,
  GitCommitResult,
  GitBranchSummary,
  GitPushResult,
  GitLogSummary,
  GitRemote,
  GitOperationResult,
} from "audit/models/git-types";
import type { AuditConfig } from "audit/models/audit-types";
import { credentialService } from "./credential-service-main";
import { resolveGitSigning, signingFromConfig } from "./git-signing";

// ==================== GIT SERVICE ====================

export class GitService {
  private git: SimpleGit;
  private repoPath: string;

  constructor(repoPath: string) {
    this.repoPath = repoPath;

    const options: Partial<SimpleGitOptions> = {
      baseDir: repoPath,
      binary: "git",
      maxConcurrentProcesses: 6,
    };

    this.git = simpleGit(options);
  }

  // ==================== REPOSITORY INIT ====================

  /**
   * Initialize Git repository if not already initialized
   */
  async initRepository(): Promise<GitOperationResult<void>> {
    try {
      const isRepo = await this.git.checkIsRepo();
      if (!isRepo) {
        await this.git.init();
        return { success: true };
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to initialize repository: ${error}`,
      };
    }
  }

  /**
   * Check if repository is initialized
   */
  async isRepository(): Promise<boolean> {
    try {
      return await this.git.checkIsRepo();
    } catch (error) {
      return false;
    }
  }

  // ==================== STATUS ====================

  /**
   * Get current repository status
   */
  async getStatus(): Promise<GitOperationResult<GitStatus>> {
    try {
      const status = (await this.git.status()) as GitStatus;
      return { success: true, data: status };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get status: ${error}`,
      };
    }
  }

  /**
   * Check if working directory is clean
   */
  async isClean(): Promise<boolean> {
    try {
      const status = await this.git.status();
      return status.isClean();
    } catch (error) {
      return false;
    }
  }

  // ==================== COMMIT ====================

  /**
   * Stage all changes
   */
  async stageAll(): Promise<GitOperationResult<void>> {
    try {
      await this.git.add(".");
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to stage changes: ${error}`,
      };
    }
  }

  /**
   * Commit staged changes
   * @param message - Commit message
   * @param config - Audit configuration (for author info)
   */
  async commit(
    message: string,
    config: AuditConfig,
    signThisCommit: boolean = true, // NEW — comes from CommitOptions.signCommit
  ): Promise<GitOperationResult<GitCommitResult>> {
    try {
      await this.git.addConfig("user.name", config.author.name);
      await this.git.addConfig("user.email", config.author.email);

      // Signing: one decision, both formats, per-commit toggle honoured.
      const decision = resolveGitSigning(
        signingFromConfig(config),
        signThisCommit,
      );
      for (const [key, value] of decision.config) {
        await this.git.addConfig(key, value);
      }

      const result = (await this.git.commit(message)) as GitCommitResult;
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: `Failed to commit: ${error}` };
    }
  }

  // ==================== BRANCHES ====================

  /**
   * Get all branches
   */
  async getBranches(): Promise<GitOperationResult<GitBranchSummary>> {
    try {
      const branches = (await this.git.branchLocal()) as GitBranchSummary;
      return { success: true, data: branches };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get branches: ${error}`,
      };
    }
  }

  /**
   * Get current branch name
   */
  async getCurrentBranch(): Promise<string | null> {
    try {
      const branch = await this.git.revparse(["--abbrev-ref", "HEAD"]);
      return branch.trim();
    } catch (error) {
      console.error("Failed to get current branch:", error);
      return null;
    }
  }

  /**
   * Create new branch
   * @param branchName - Name of the new branch
   * @param checkout - Switch to new branch after creation (default: true)
   */
  async createBranch(
    branchName: string,
    checkout: boolean = true,
  ): Promise<GitOperationResult<void>> {
    try {
      if (checkout) {
        await this.git.checkoutLocalBranch(branchName);
      } else {
        await this.git.branch([branchName]);
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to create branch: ${error}`,
      };
    }
  }

  /**
   * Switch to existing branch
   * @param branchName - Branch to checkout
   */
  async checkoutBranch(branchName: string): Promise<GitOperationResult<void>> {
    try {
      await this.git.checkout(branchName);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to checkout branch: ${error}`,
      };
    }
  }

  /**
   * Check if branch exists
   * @param branchName - Branch name to check
   */
  async branchExists(branchName: string): Promise<boolean> {
    try {
      const branches = await this.git.branchLocal();
      return branches.all.includes(branchName);
    } catch (error) {
      return false;
    }
  }

  // ==================== REMOTE ====================

  /**
   * Add remote repository
   * @param name - Remote name (e.g., "origin")
   * @param url - Remote URL
   */
  async addRemote(
    name: string,
    url: string,
  ): Promise<GitOperationResult<void>> {
    try {
      await this.git.addRemote(name, url);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to add remote: ${error}`,
      };
    }
  }

  /**
   * Get remote repositories
   */
  async getRemotes(): Promise<GitOperationResult<GitRemote[]>> {
    try {
      const remotes = (await this.git.getRemotes(true)) as GitRemote[];
      return { success: true, data: remotes };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get remotes: ${error}`,
      };
    }
  }

  /**
   * Check if remote exists
   * @param name - Remote name
   */
  async remoteExists(name: string): Promise<boolean> {
    try {
      const remotes = await this.git.getRemotes();
      return remotes.some((r) => r.name === name);
    } catch (error) {
      return false;
    }
  }

  // ==================== PUSH ====================

  /**
   * Push to remote
   * @param remote - Remote name (default: "origin")
   * @param branch - Branch name (current branch if not specified)
   * @param config - Audit configuration (for authentication)
   */
  async push(
    remote: string = "origin",
    branch?: string,
    config?: AuditConfig,
  ): Promise<GitOperationResult<GitPushResult>> {
    try {
      // Get current branch if not specified
      if (!branch) {
        const currentBranch = await this.getCurrentBranch();
        if (!currentBranch) {
          return {
            success: false,
            error: "Could not determine current branch",
          };
        }
        branch = currentBranch;
      }

      // Setup authentication if PAT is configured
      if (config?.auth.method === "pat" && config.auth.patAccount) {
        const token = await credentialService.getGitToken(
          config.auth.patAccount,
        );
        if (token) {
          // Inject token into remote URL temporarily
          const remotes = await this.git.getRemotes(true);
          const remoteObj = remotes.find((r) => r.name === remote);
          if (remoteObj) {
            const urlWithAuth = this.injectTokenIntoUrl(
              remoteObj.refs.push,
              token,
            );
            await this.git.remote(["set-url", remote, urlWithAuth]);
          }
        }
      }

      // Push with upstream tracking
      const result = await this.git.push([remote, branch, "--set-upstream"]);

      // Transform simple-git result to our GitPushResult
      const transformedResult: GitPushResult = {
        pushed: result.pushed || [],
        branch: result.branch,
        //update: result.update,
        repo: result.repo,
        ref: result.ref,
      };

      return { success: true, data: transformedResult };
    } catch (error) {
      return {
        success: false,
        error: `Failed to push: ${error}`,
      };
    }
  }

  /**
   * Inject Personal Access Token into HTTPS URL
   * @param url - Original URL
   * @param token - Personal Access Token
   */
  private injectTokenIntoUrl(url: string, token: string): string {
    // GitHub/GitLab format: https://TOKEN@github.com/user/repo.git
    if (url.startsWith("https://")) {
      return url.replace("https://", `https://${token}@`);
    }
    return url;
  }

  // ==================== LOG ====================

  /**
   * Get commit history
   * @param maxCount - Maximum number of commits (default: 10)
   */
  async getLog(
    maxCount: number = 10,
  ): Promise<GitOperationResult<GitLogSummary>> {
    try {
      const log = await this.git.log({ maxCount });
      // Transform simple-git LogResult to our GitLogSummary
      const transformedLog: GitLogSummary = {
        all: [...log.all].map((entry) => ({
          hash: entry.hash,
          date: entry.date,
          message: entry.message,
          author_name: entry.author_name,
          author_email: entry.author_email,
          body: entry.body,
          refs: entry.refs,
        })),
        total: log.total,
        latest: log.latest
          ? {
              hash: log.latest.hash,
              date: log.latest.date,
              message: log.latest.message,
              author_name: log.latest.author_name,
              author_email: log.latest.author_email,
              body: log.latest.body,
              refs: log.latest.refs,
            }
          : null,
      };

      return { success: true, data: transformedLog };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get log: ${error}`,
      };
    }
  }

  /**
   * Get latest commit
   */
  async getLatestCommit(): Promise<GitOperationResult<any>> {
    try {
      const log = await this.git.log({ maxCount: 1 });
      if (log.all.length === 0) {
        return { success: false, error: "No commits found" };
      }
      return { success: true, data: log.all[0] };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get latest commit: ${error}`,
      };
    }
  }

  // ==================== DIFF ====================

  /**
   * Get diff for a file
   * @param filePath - Path to file
   */
  async getDiff(filePath?: string): Promise<GitOperationResult<string>> {
    try {
      const diff = filePath
        ? await this.git.diff([filePath])
        : await this.git.diff();
      return { success: true, data: diff };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get diff: ${error}`,
      };
    }
  }

  // ==================== UTILITY ====================

  /**
   * Get repository root path
   */
  getRepoPath(): string {
    return this.repoPath;
  }

  /**
   * Execute custom git command
   * @param command - Git command arguments
   */
  async raw(command: string[]): Promise<GitOperationResult<string>> {
    try {
      const result = await this.git.raw(command);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: `Git command failed: ${error}`,
      };
    }
  }
}

// ==================== FACTORY ====================

/**
 * Create GitService instance for a repository path
 */
export function createGitService(repoPath: string): GitService {
  return new GitService(repoPath);
}