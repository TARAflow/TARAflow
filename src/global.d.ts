// ==================== TYPES ====================

export interface OAuthCallbackData {
  code?: string;
  state?: string;
  error?: string;
  errorDescription?: string;
}

// Import types for Git and Credentials
import type {
  GitStatus,
  GitCommitResult,
  GitBranchSummary,
  GitPushResult,
  GitLogSummary,
  GitRemote,
  GitOperationResult,
} from "./features/audit/models/git-types";
import type { AuditConfig } from "./features/audit/models/audit-types";

// ==================== WINDOW INTERFACE ====================

declare global {
  interface Window {
    electron?: {
      shell: {
        openExternal: (url: string) => Promise<void>;
      };
      oauth?: {
        onCallback: (callback: (data: OAuthCallbackData) => void) => void;
        removeCallback: () => void;
      };
      file?: {
        saveDialog: (
          defaultName: string,
        ) => Promise<{ success: boolean; data?: string; error?: string }>;
        openDialog: () => Promise<{
          success: boolean;
          data?: string;
          error?: string;
        }>;
        pickFile: (options?: {
          title?: string;
          defaultPath?: string;
          buttonLabel?: string;
          filters?: { name: string; extensions: string[] }[];
        }) => Promise<{ success: boolean; data?: string; error?: string }>;
        writeProject: (
          filePath: string,
          projectData: string,
        ) => Promise<{ success: boolean; data?: string; error?: string }>;
        readProject: (
          filePath: string,
        ) => Promise<{ success: boolean; data?: string; error?: string }>;
        readText: (filePath: string) => Promise<{
          success: boolean;
          data?: string | null;
          error?: string;
        }>;
        writeText: (
          filePath: string,
          content: string,
        ) => Promise<{ success: boolean; data?: string; error?: string }>;
        makeExecutable: (
          filePath: string,
        ) => Promise<{ success: boolean; error?: string }>;
      };
      metadata?: {
        getRecentProjects: () => Promise<{
          success: boolean;
          data?: any[];
          error?: string;
        }>;
        saveRecentProjects: (
          metadata: any[],
        ) => Promise<{ success: boolean; error?: string }>;
        removeProject: (
          projectId: string,
        ) => Promise<{ success: boolean; error?: string }>;
      };
    };

    // ✅ NEU: ElectronAPI für DrawIO Plugin Injection
    electronAPI?: {
      injectDrawioPlugin: () => Promise<{
        success: boolean;
        error?: string;
        message?: string;
        availableFrames?: string[];
        globals?: string[];
        drawKeys?: string[];
        stack?: string;
      }>;
      getDrawioScroll: () => Promise<{ scrollLeft: number; scrollTop: number }>;
      setDrawioViewport: (viewport: {
        translate: { x: number; y: number };
        scale: number;
        scrollLeft?: number;
        scrollTop?: number;
      }) => Promise<{ success: boolean; error?: string }>;
      selectDrawioCell: (
        cellId: string,
      ) => Promise<{ success: boolean; error?: string }>;
      injectDrawioLibraries: (
        dfd1Xml: string,
        dfd2Xml: string,
      ) => Promise<{ success: boolean; error?: string }>;
      jiraRequest: (config: { url: string; options: any }) => Promise<any>;
      jira: {
        saveToken: (
          account: string,
          token: string,
        ) => Promise<{ success: boolean; error?: string }>;
        getToken: (account: string) => Promise<{
          success: boolean;
          token: string | null;
          error?: string;
        }>;
        deleteToken: (
          account: string,
        ) => Promise<{ success: boolean; error?: string }>;
      };
    };

    // Git APIs (für Audit Feature)
    git?: {
      isRepository: () => Promise<boolean>;
      initRepository: () => Promise<GitOperationResult<void>>;
      getStatus: () => Promise<GitOperationResult<GitStatus>>;
      isClean: () => Promise<boolean>;
      stage: (relPaths: string[]) => Promise<GitOperationResult<void>>;
      commit: (
        message: string,
        config: AuditConfig,
        signCommit: boolean,
        relPaths: string[],
      ) => Promise<GitOperationResult<GitCommitResult>>;
      getBranches: () => Promise<GitOperationResult<GitBranchSummary>>;
      getCurrentBranch: () => Promise<string | null>;
      createBranch: (
        name: string,
        checkout: boolean,
      ) => Promise<GitOperationResult<void>>;
      checkoutBranch: (name: string) => Promise<GitOperationResult<void>>;
      branchExists: (name: string) => Promise<boolean>;
      addRemote: (
        name: string,
        url: string,
      ) => Promise<GitOperationResult<void>>;
      getRemotes: () => Promise<GitOperationResult<GitRemote[]>>;
      remoteExists: (name: string) => Promise<boolean>;
      push: (
        remote: string,
        branch: string,
        config?: AuditConfig,
      ) => Promise<GitOperationResult<GitPushResult>>;
      getLog: (maxCount: number) => Promise<GitOperationResult<GitLogSummary>>;
      getLatestCommit: () => Promise<GitOperationResult<any>>;
      getDiff: (filePath?: string) => Promise<GitOperationResult<string>>;
      raw: (command: string[]) => Promise<GitOperationResult<string>>;
      rawInDir: (
        dir: string,
        args: string[],
      ) => Promise<
        GitOperationResult<{ stdout: string; stderr: string; code: number }>
      >;
      setRepoPath: (root: string) => Promise<GitOperationResult<void>>;
    };

    // Credentials APIs (für Audit Feature)
    credentials?: {
      saveGitToken: (account: string, token: string) => Promise<void>;
      getGitToken: (account: string) => Promise<string | null>;
      deleteGitToken: (account: string) => Promise<boolean>;
      saveGPGKey: (keyId: string, privateKey: string) => Promise<void>;
      getGPGKey: (keyId: string) => Promise<string | null>;
      deleteGPGKey: (keyId: string) => Promise<boolean>;
      hasGPGKey: (keyId: string) => Promise<boolean>;
      saveSSHKeyPath: (identifier: string, keyPath: string) => Promise<void>;
      getSSHKeyPath: (identifier: string) => Promise<string | null>;
    };

    audit: {
      verify: (params: {
        repoPath?: string;
        policy: {
          bootstrapAnchor: string;
          ref?: string;
          strict?: boolean;
          mandateFourEyes?: boolean;
          protectedBranches?: string[];
        };
      }) => Promise<
        | {
            success: true;
            data: import("features/audit/services/verify/findings").FindingsResult;
          }
        | { success: false; error: string }
      >;
    };

    updates?: {
      check: (
        opts: import("shared/models/update-types").UpdateCheckOptions,
      ) => Promise<import("shared/models/update-types").UpdateCheckResult>;
    };

    pdf?: {
      generateBuffer: (
        html: string,
        options: object,
      ) => Promise<{ success: boolean; data?: Buffer; error?: string }>;
      generateFile: (
        html: string,
        options: object,
        path: string,
      ) => Promise<{ success: boolean; data?: string; error?: string }>;
    };
  }

  interface ImportMeta {
    /**
     * Vite glob import. Compile-time macro — must be called as
     * `import.meta.glob("literal-pattern", { eager: true })` directly;
     * assigning it to a variable first disables the transform.
     */
    glob: (
      pattern: string,
      options?: { eager?: boolean },
    ) => Record<string, unknown>;
  }
}

export {};