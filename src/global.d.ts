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
        writeProject: (
          filePath: string,
          projectData: string,
        ) => Promise<{ success: boolean; data?: string; error?: string }>;
        readProject: (
          filePath: string,
        ) => Promise<{ success: boolean; data?: string; error?: string }>;
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
    };

    // Git APIs (für Audit Feature)
    git?: {
      isRepository: () => Promise<boolean>;
      initRepository: () => Promise<GitOperationResult<void>>;
      getStatus: () => Promise<GitOperationResult<GitStatus>>;
      isClean: () => Promise<boolean>;
      stageAll: () => Promise<GitOperationResult<void>>;
      commit: (
        message: string,
        config: AuditConfig,
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
}

export {};