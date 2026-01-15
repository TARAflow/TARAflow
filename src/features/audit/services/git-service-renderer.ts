// ==================== GIT SERVICE RENDERER ====================
// Renderer-side wrapper for Git operations
// Communicates with Electron main process via IPC
// This replaces the direct simple-git usage in the renderer

import type {
  GitStatus,
  GitCommitResult,
  GitBranchSummary,
  GitPushResult,
  GitLogSummary,
  GitRemote,
  GitOperationResult,
} from "../models/git-types";
import type { AuditConfig } from "../models/audit-types";

// ==================== GIT SERVICE RENDERER ====================

export class GitServiceRenderer {
  // ==================== REPOSITORY INIT ====================

  /**
   * Initialize Git repository if not already initialized
   */
  async initRepository(): Promise<GitOperationResult<void>> {
    try {
      if (!window.git) {
        return {
          success: false,
          error: "Git API not available. Running outside Electron?",
        };
      }
      const result = await window.git.initRepository();
      return result;
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
      if (!window.git) return false;
      return await window.git.isRepository();
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
      if (!window.git) {
        return {
          success: false,
          error: "Git API not available",
        };
      }
      return await window.git.getStatus();
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
      if (!window.git) return false;
      return await window.git.isClean();
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
      if (!window.git) {
        return {
          success: false,
          error: "Git API not available",
        };
      }
      return await window.git.stageAll();
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
    config: AuditConfig
  ): Promise<GitOperationResult<GitCommitResult>> {
    try {
      if (!window.git) {
        return {
          success: false,
          error: "Git API not available",
        };
      }
      return await window.git.commit(message, config);
    } catch (error) {
      return {
        success: false,
        error: `Failed to commit: ${error}`,
      };
    }
  }

  // ==================== BRANCHES ====================

  /**
   * Get all branches
   */
  async getBranches(): Promise<GitOperationResult<GitBranchSummary>> {
    try {
      if (!window.git) {
        return {
          success: false,
          error: "Git API not available",
        };
      }
      return await window.git.getBranches();
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
      if (!window.git) return null;
      return await window.git.getCurrentBranch();
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
    checkout: boolean = true
  ): Promise<GitOperationResult<void>> {
    try {
      if (!window.git) {
        return {
          success: false,
          error: "Git API not available",
        };
      }
      return await window.git.createBranch(branchName, checkout);
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
  async checkoutBranch(
    branchName: string
  ): Promise<GitOperationResult<void>> {
    try {
      if (!window.git) {
        return {
          success: false,
          error: "Git API not available",
        };
      }
      return await window.git.checkoutBranch(branchName);
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
      if (!window.git) return false;
      return await window.git.branchExists(branchName);
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
    url: string
  ): Promise<GitOperationResult<void>> {
    try {
      if (!window.git) {
        return {
          success: false,
          error: "Git API not available",
        };
      }
      return await window.git.addRemote(name, url);
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
      if (!window.git) {
        return {
          success: false,
          error: "Git API not available",
        };
      }
      return await window.git.getRemotes();
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
      if (!window.git) return false;
      return await window.git.remoteExists(name);
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
    config?: AuditConfig
  ): Promise<GitOperationResult<GitPushResult>> {
    try {
      if (!window.git) {
        return {
          success: false,
          error: "Git API not available",
        };
      }

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

      return await window.git.push(remote, branch, config);
    } catch (error) {
      return {
        success: false,
        error: `Failed to push: ${error}`,
      };
    }
  }

  // ==================== LOG ====================

  /**
   * Get commit history
   * @param maxCount - Maximum number of commits (default: 10)
   */
  async getLog(maxCount: number = 10): Promise<GitOperationResult<GitLogSummary>> {
    try {
      if (!window.git) {
        return {
          success: false,
          error: "Git API not available",
        };
      }
      return await window.git.getLog(maxCount);
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
      if (!window.git) {
        return {
          success: false,
          error: "Git API not available",
        };
      }
      return await window.git.getLatestCommit();
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
      if (!window.git) {
        return {
          success: false,
          error: "Git API not available",
        };
      }
      return await window.git.getDiff(filePath);
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
    // In renderer, we don't have direct access to the path
    // This is managed by the main process
    return ".";
  }

  /**
   * Execute custom git command
   * @param command - Git command arguments
   */
  async raw(command: string[]): Promise<GitOperationResult<string>> {
    try {
      if (!window.git) {
        return {
          success: false,
          error: "Git API not available",
        };
      }
      return await window.git.raw(command);
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
 * Create GitService instance for renderer process
 * No repoPath needed - managed by main process
 */
export function createGitService(): GitServiceRenderer {
  return new GitServiceRenderer();
}