// ==================== AUDIT FEATURE EXPORTS ====================
// Public API for the Audit/Version Control feature

// ==================== COMPONENTS ====================
export { AuditTab } from "./components/audit-tab";
export { AuditToolbar } from "./components/audit-toolbar";
export { AuditSummary } from "./components/audit-summary";
export { PhaseDiffViewer } from "./components/phase-diff-viewer";
export { CommitDialog } from "./components/commit-dialog";
export { AuditConfigDialog } from "./components/audit-config-dialog";

// ==================== MODELS ====================
export type {
  // Main types
  AuditData,
  AuditConfig,
  AuditProjectData,
  AuditUpdateResult,
  AuditTabProps,
  
  // Git types
  GitProvider,
  GitAuthConfig,
  AuthMethod,
  GPGConfig,
  
  // Round names
  RoundName,
  
  // Commit types
  CommitState,
  CommitHistoryEntry,
  CommitOptions,
  CommitMessageData,
  
  // Change types
  PhaseChanges,
  ChangeItem,
  ChangeDetail,
  ChangeType,
  
  // Validation
  GitValidation,
  
  // Branch info
  BranchInfo,
} from "./models/audit-types";

export {
  // Constants
  GIT_PROVIDERS,
  DEFAULT_AUDIT_CONFIG,
  DEFAULT_ROUND_NAMES,

  // Helper functions
  createDefaultAuditData,
  generateCommitMessage,
  validateGitConfig,
  getAllRoundNames,
} from "./models/audit-types";

export type {
  GitStatus,
  GitCommitResult,
  GitBranchSummary,
  GitPushResult,
  GitLogSummary,
  GitRemote,
  GitOperationResult,
} from "./models/git-types";

// ==================== SERVICES ====================
export { GitServiceRenderer as GitService, createGitService } from "./services/git-service-renderer";
export { CredentialServiceRenderer as CredentialService, credentialService } from "./services/credential-service-renderer";
export { DiffService, diffService } from "./services/diff-service";

