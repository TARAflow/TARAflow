// ==================== AUDIT TYPES ====================
// Core data models for the Audit/Version Control feature
// NO dependency on app - follows Dependency Inversion Principle

import type { PhaseStatusMap } from "shared/models/common-types";

// ==================== GIT PROVIDER ====================

export type GitProvider = "github" | "gitlab" | "bitbucket" | "generic";

export type SigningFormat = "gpg" | "ssh";

export interface SigningSettings {
  enabled: boolean;
  format: SigningFormat; // default "ssh" for new configs
  keyId?: string; // GPG key id
  sshSigningKeyPath?: string; // path to the SSH signing key
  hasStoredKey?: boolean;
}

export interface GitProviderDefinition {
  id: GitProvider;
  name: string;
  apiBaseUrl?: string;
  requiresToken: boolean;
  supportsSSH: boolean;
}

export const GIT_PROVIDERS: GitProviderDefinition[] = [
  {
    id: "github",
    name: "GitHub",
    apiBaseUrl: "https://api.github.com",
    requiresToken: true,
    supportsSSH: true,
  },
  {
    id: "gitlab",
    name: "GitLab",
    apiBaseUrl: "https://gitlab.com/api/v4",
    requiresToken: true,
    supportsSSH: true,
  },
  {
    id: "bitbucket",
    name: "Bitbucket",
    apiBaseUrl: "https://api.bitbucket.org/2.0",
    requiresToken: true,
    supportsSSH: true,
  },
  {
    id: "generic",
    name: "Generic Git",
    requiresToken: false,
    supportsSSH: true,
  },
];

// ==================== AUTHENTICATION ====================

export type AuthMethod = "pat" | "ssh";

export interface GitAuthConfig {
  method: AuthMethod;
  /** Personal Access Token (stored in Keytar) */
  patAccount?: string; // Account identifier for Keytar
  /** SSH Key path */
  sshKeyPath?: string;
}

// ==================== GPG SIGNING ====================

export interface GPGConfig {
  enabled: boolean;
  /** GPG Key ID (e.g., "ABCD1234") */
  keyId?: string;
  /** Whether private key is stored in Keytar */
  hasStoredKey?: boolean;
}

// ==================== ROUND NAMES ====================

/**
 * Predefined round/stage names for commit messages
 */
export interface RoundName {
  id: string;
  name: string;
  nameDE: string;
  isCustom: boolean;
}

export const DEFAULT_ROUND_NAMES: RoundName[] = [
  {
    id: "initial",
    name: "Initial Assessment",
    nameDE: "Initiale Bewertung",
    isCustom: false,
  },
  {
    id: "detail",
    name: "Detail Review",
    nameDE: "Detailbewertung",
    isCustom: false,
  },
  {
    id: "refinement",
    name: "Refinement",
    nameDE: "Verfeinerung",
    isCustom: false,
  },
  {
    id: "final",
    name: "Final Decision",
    nameDE: "Finale Entscheidung",
    isCustom: false,
  },
];

// ==================== AUDIT CONFIGURATION ====================

export interface AuditConfig {
  /** Git Provider */
  provider: GitProvider;

  /** Remote Repository URL */
  remoteUrl?: string;

  /** Default Branch (e.g., 'main', 'master') */
  defaultBranch: string;

  /** Feature Branch Template (e.g., 'risk-round-', 'tara/batch-') */
  featureBranchTemplate: string;

  /** Author Info */
  author: {
    name: string;
    email: string;
  };

  /** Authentication */
  auth: GitAuthConfig;

  /** GPG Signing */
  gpg: GPGConfig;

  /** Custom Round Names */
  customRoundNames: RoundName[];

  /** Last Round Number (for auto-increment) */
  lastRoundNumber: number;

  /** Unified signing config (gpg|ssh). Falls back to legacy `gpg` when absent. */
  signing?: SigningSettings;
}

export const DEFAULT_AUDIT_CONFIG: AuditConfig = {
  provider: "github",
  defaultBranch: "main",
  featureBranchTemplate: "risk-round-",
  author: {
    name: "",
    email: "",
  },
  auth: {
    method: "pat",
  },
  gpg: {
    enabled: false,
  },
  customRoundNames: [],
  lastRoundNumber: 0,
  signing: { enabled: false, format: "ssh" },
};

// ==================== COMMIT STATE ====================

export interface CommitState {
  /** Git commit hash */
  commitHash: string;

  /** Commit timestamp */
  commitDate: string;

  /** Branch name */
  branchName: string;

  /** Commit message */
  message: string;

  /** Round name used */
  roundName?: string;

  /** Affected phases */
  affectedPhases: string[];

  /** Batch size (number of changed items) */
  batchSize: number;
}

// ==================== COMMIT HISTORY ====================

export interface CommitHistoryEntry {
  hash: string;
  date: string;
  author: string;
  message: string;
  branch: string;
  affectedPhases: string[];
  batchSize: number;
}

// ==================== PHASE CHANGES ====================

export type ChangeType = "added" | "modified" | "deleted";

export interface ChangeItem {
  type: ChangeType;
  id: string;
  name: string;
  description: string;
  details?: ChangeDetail[];
}

export interface ChangeDetail {
  field: string;
  fieldLabel: string;
  oldValue: any;
  newValue: any;
  valueType: "string" | "number" | "boolean" | "array" | "object";
}

export interface PhaseChanges {
  phase: string;
  phaseLabel: string;
  changeCount: number;
  changes: ChangeItem[];
}

// ==================== COMMIT MESSAGE DATA ====================

export interface CommitMessageData {
  round: string; // Round name (e.g. "Detail Review")
  /** Project display name — distinguishes commits when a repo holds several. */
  projectName?: string;
  /** Stable project id — the machine-readable half of the distinguisher. */
  projectId?: string;
  batchSize: number; // Total number of changed items
  affectedPhases: string[]; // Phase names
  changes: PhaseChanges[]; // Detailed changes
  author: string; // Git author name
  reviewer?: string; // Optional reviewer name
}

// ==================== AUDIT DATA ====================

export interface AuditData {
  /** Configuration */
  config: AuditConfig;

  /** Last successful commit state */
  lastCommitState?: CommitState;

  /** Commit history (optional, for future enhancement) */
  commitHistory?: CommitHistoryEntry[];

  /** Last modified timestamp */
  lastModified: string;
}

// ==================== AUDIT PROJECT INTERFACE ====================
export type ProjectStatus = "draft" | "in-progress" | "review" | "complete";
export type StrideMethod = "per-element" | "per-interaction";

export interface AuditProjectData {
  id: string;
  name: string;
  /** Absolute path of the .tara.json on THIS machine — needed for audit-repo
   *  discovery (setRepoPath / .gitattributes). Runtime-only, never persisted. */
  filePath?: string;
  audit: AuditData | null;
  phaseStatus: PhaseStatusMap;

  // For change detection (full project snapshot)
  info: any;
  hazards: any;
  dfd: any;
  assets: any;
  threats: any;
  risks: any;
  attackTrees: any;

  lastModified: string;

  // Additional fields to satisfy Project interface
  currentPhase?: number;
  strideMethod?: StrideMethod | null;
  methodSelected?: boolean;
  settings?: any;
  status?: ProjectStatus;
  documentation?: any;
  integration?: any;
}

// ==================== AUDIT UPDATE RESULT ====================

export interface AuditUpdateResult {
  audit: AuditData;
  phaseStatus: PhaseStatusMap;
  lastModified: string;
}

// ==================== AUDIT TAB PROPS ====================

export interface AuditTabProps {
  project: AuditProjectData;
  onUpdate: (updates: AuditUpdateResult) => void;
  onDirtyChange?: (isDirty: boolean) => void;
  onPhaseComplete?: () => void;
}

// ==================== GIT VALIDATION ====================

export interface GitValidation {
  isConfigured: boolean;
  errors: string[];
  warnings: string[];
  canCommit: boolean;
  canPush: boolean;
}

// ==================== BRANCH INFO ====================

export interface BranchInfo {
  name: string;
  current: boolean;
  commit: string;
  label: string; // Display label
}

// ==================== COMMIT OPTIONS ====================

export interface CommitOptions {
  /** Branch name (auto-generated or custom) */
  branchName: string;

  /** Create new branch? */
  createBranch: boolean;

  /** Commit message */
  message: string;

  /** Round name */
  roundName: string;

  /** Sign commit with GPG? */
  signCommit: boolean;

  /** Push after commit? */
  pushAfterCommit: boolean;

  /** Reviewer name (optional) */
  reviewer?: string;
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Build the audit commit message: `[TARA] <round>` subject, a human-readable
 * change breakdown (body), and a contiguous git-trailer block at the end.
 */
export function generateCommitMessage(data: CommitMessageData): string {
  const subject = `[TARA] ${data.round}`;

  // ---- Body: human-readable change breakdown ----
  const fmt = (v: any): string =>
    v === null || v === undefined || v === "" ? "—" : String(v);

  const body: string[] = ["- Changes:"];
  data.changes.forEach((phase) => {
    body.push(`  - ${phase.phaseLabel}: ${phase.changeCount} items`);
    phase.changes.forEach((change) => {
      const prefix =
        change.type === "added" ? "+" : change.type === "deleted" ? "-" : "~";
      body.push(`    ${prefix} ${change.id}: ${change.name}`);
      // Detail deltas (e.g. impact ratings, security goals, and asset<->DFD
      // relations via "Linked DFD Elements") make the message concrete. Skip
      // no-op details so the body stays signal, not noise.
      (change.details ?? []).forEach((d) => {
        if (d.oldValue === d.newValue) return;
        body.push(
          `        ${d.fieldLabel}: ${fmt(d.oldValue)} → ${fmt(d.newValue)}`,
        );
      });
    });
  });

  // ---- Trailers: hyphenated keys, contiguous, LAST paragraph ----
  const trailers: string[] = [];
  if (data.projectName) {
    trailers.push(
      `Project: ${data.projectName}${data.projectId ? ` [${data.projectId}]` : ""}`,
    );
  }
  trailers.push(`Affected-Phases: ${data.affectedPhases.join(", ")}`);
  trailers.push(`Batch-Size: ${data.batchSize}`);
  trailers.push(`Author: ${data.author}`);
  if (data.reviewer) {
    trailers.push(`Reviewed-by: ${data.reviewer}`);
  }
  trailers.push(`Date: ${new Date().toISOString()}`);

  return [subject, "", ...body, "", ...trailers].join("\n");
}

/**
 * Generate next branch name
 */
export function generateNextBranchName(
  template: string,
  lastRoundNumber: number
): string {
  const nextNumber = lastRoundNumber + 1;
  return `${template}${nextNumber}`;
}

/**
 * Create default AuditData for new projects
 */
export function createDefaultAuditData(): AuditData {
  return {
    config: { ...DEFAULT_AUDIT_CONFIG },
    lastModified: new Date().toISOString(),
  };
}

/**
 * Validate Git configuration
 */
export function validateGitConfig(config: AuditConfig): GitValidation {
  // Commit is LOCAL and offline — the audit trail rides on signed history, and
  // push is a separate step (see the design doc §8). So a remote credential
  // must never block a commit. We separate the two concerns explicitly:
  //   commitErrors -> block `canCommit` (and are surfaced in the tab)
  //   push issues  -> block `canPush` only, and are shown as warnings
  const commitErrors: string[] = [];
  const warnings: string[] = [];

  // ---- Commit-blocking: what a local (optionally signed) commit needs ----

  // Author identity is mandatory for any commit.
  if (!config.author.name || !config.author.email) {
    commitErrors.push("Git author name and email are required");
  }

  // A signing key must exist for the ACTIVE signing method — and only that one.
  // The unified `signing` model is the source of truth; fall back to the legacy
  // `gpg` block for older configs. Previously this checked `config.gpg` even
  // when SSH signing was selected, which demanded a GPG key id that SSH signing
  // never uses — an unsatisfiable, silent commit block.
  const signing = config.signing ?? {
    enabled: config.gpg.enabled,
    format: "gpg" as SigningFormat,
    keyId: config.gpg.keyId,
  };
  if (signing.enabled) {
    if (signing.format === "gpg" && !(signing.keyId ?? config.gpg.keyId)) {
      commitErrors.push("GPG key ID is required for GPG signing");
    } else if (signing.format === "ssh" && !signing.sshSigningKeyPath) {
      // An SSH signing key can also come from git config / the agent, and
      // git-signing refuses to sign without a key at commit time while
      // verification catches an unauthorized signer — so warn, don't block.
      warnings.push(
        "SSH signing is enabled but no signing key path is set — relying on git config",
      );
    }
  }

  // ---- Push-blocking only (never blocks a local commit) ----

  if (!config.remoteUrl) {
    warnings.push(
      "No remote repository URL configured - push will not be available",
    );
  }

  const patMissing =
    !!config.remoteUrl &&
    config.auth.method === "pat" &&
    !config.auth.patAccount;
  if (patMissing) {
    warnings.push("Personal Access Token required to push to the remote");
  }

  return {
    isConfigured: config.author.name !== "" && config.author.email !== "",
    errors: commitErrors,
    warnings,
    canCommit: commitErrors.length === 0,
    canPush: commitErrors.length === 0 && !!config.remoteUrl && !patMissing,
  };
}

/**
 * Get all round names (default + custom)
 */
export function getAllRoundNames(config: AuditConfig): RoundName[] {
  return [...DEFAULT_ROUND_NAMES, ...config.customRoundNames];
}