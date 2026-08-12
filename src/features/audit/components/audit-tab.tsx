// ==================== AUDIT TAB ====================
// Main Audit/Version Control Tab
// Features:
// - Change detection and diff viewing
// - Git commit creation
// - Branch management
// - Configuration management

import React, { useState, useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Box, Alert, Button } from "@mui/material";
import type {
  AuditTabProps,
  AuditConfig,
  AuditData,
  PhaseChanges,
  CommitMessageData,
  CommitOptions,
  BranchInfo,
  GitValidation,
} from "../models/audit-types";
import {
  createDefaultAuditData,
  validateGitConfig,
  generateCommitMessage,
} from "../models/audit-types";
import { AuditToolbar } from "./audit-toolbar";
import { AuditSummary } from "./audit-summary";
import { PhaseDiffViewer } from "./phase-diff-viewer";
import { CommitDialog } from "./commit-dialog";
import { AuditConfigDialog } from "./audit-config-dialog";
import { useAuditRepo } from "../hooks/useAuditRepo";
import { useAuditProtection } from "../hooks/useAuditProtection";
import {
  loadPreviousProjectFromGit,
  repoRelativePath,
} from "../services/audit-prev-state";
import { createIpcFileIO } from "../services/audit-git-adapters";
import {
  allowedSignersPathOf,
  parseAllowedSigners,
} from "../services/audit-signer-manifest";
import { checkSigningIdentity } from "../services/audit-signing-identity";
import { diffService } from "../services/diff-service";
import { createGitService } from "../services/git-service-renderer";
import { credentialService } from "../services/credential-service-renderer";
import type { Project } from "app/models/project-types";
import { AuditVerifyPanel } from "./audit-verify-panel";


// ==================== COMPONENT ====================

export const AuditTab: React.FC<AuditTabProps> = ({
  project,
  onUpdate,
  onDirtyChange,
  onPhaseComplete,
}) => {
  const { t } = useTranslation();

  // ==================== STATE ====================

  // Audit data (local working copy)
  const [auditData, setAuditData] = useState<AuditData>(() => {
    return project.audit ?? createDefaultAuditData();
  });

  // UI state
  const [isDirty, setIsDirty] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  // Dialog state
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [showCommitDialog, setShowCommitDialog] = useState(false);

  // Git state
  const [currentBranch, setCurrentBranch] = useState<string>("main");
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [isGitInitialized, setIsGitInitialized] = useState(false);

  // Changes
  const [changes, setChanges] = useState<PhaseChanges[]>([]);
  const [commitMessageData, setCommitMessageData] =
    useState<CommitMessageData | null>(null);

  // Errors
  const [error, setError] = useState<string | null>(null);

  // "Last committed" label. Since the churn fix strips audit.lastCommitState
  // from the on-disk file, this is derived from git on open (path-scoped to the
  // project file) and refreshed in-memory right after a commit.
  const [lastCommitDate, setLastCommitDate] = useState<string | undefined>(
    undefined,
  );

  // ==================== COMPUTED ====================

  const validation = useMemo(
    () => validateGitConfig(auditData.config),
    [auditData.config],
  );

  const hasChanges = changes.length > 0;
  const totalChangeCount = changes.reduce((sum, p) => sum + p.changeCount, 0);

  // ==================== GIT SERVICE ====================

  const gitService = useMemo(() => {
    // Git operations are handled by Electron main process via IPC
    return createGitService();
  }, []);

  // Discover the audit repo from the project file, bind it (setRepoPath), and
  // check .gitattributes. Until this resolves, the main GitService still points
  // at its default path — so git init/commit below are gated on it (see effect).
  const repo = useAuditRepo({
    id: project.id,
    filePath: project.filePath,
  });

  // Bound repo root, once discovery has resolved (shared by dialogs + checks).
  const repoRootValue =
    repo.outcome?.kind === "repo-ok" ||
    repo.outcome?.kind === "repo-needs-attributes"
      ? repo.outcome.repoRoot
      : undefined;

  // Local, token-free protection status of the audit line (signed / linear /
  // anchor tag) + the host-guidance checklist. Shared by the config dialog
  // (full panel) and the commit dialog (warning banner).
  const protection = useAuditProtection(
    repoRootValue,
    gitService,
    currentBranch,
  );

  // ==================== EFFECTS ====================

  // Sync from project when it changes
  useEffect(() => {
    if (!project.audit) return;

    if (project.audit.lastModified !== auditData.lastModified) {
      setAuditData(project.audit);
    }
  }, [project.audit?.lastModified]);

  // Update dirty state
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty]);

  // Detect changes on mount (no git needed — diffs in-memory project state).
  useEffect(() => {
    detectChanges();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initialize git state only AFTER the audit repo is discovered and bound
  // (useAuditRepo calls setRepoPath). Before that, the main GitService still
  // points at its default path, so committing/init would target the wrong dir.
  useEffect(() => {
    if (
      repo.outcome?.kind === "repo-ok" ||
      repo.outcome?.kind === "repo-needs-attributes"
    ) {
      initializeGit();
      // Now that the repo is bound, recompute the diff against the real HEAD.
      detectChanges();
      // ...and read the last commit date for this file straight from git.
      refreshLastCommitDate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo.outcome?.kind]);

  // Auto-save when dirty (debounced)
  useEffect(() => {
    if (!isDirty) return;

    const timeoutId = setTimeout(() => {
      saveAuditData();
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [isDirty]);

  // ==================== GIT INITIALIZATION ====================

  const initializeGit = async () => {
    try {
      // Check if Git repo exists
      const isRepo = await gitService.isRepository();

      if (!isRepo) {
        // Initialize Git repository
        const initResult = await gitService.initRepository();
        if (!initResult.success) {
          setError(initResult.error || "Failed to initialize Git repository");
          return;
        }
      }

      setIsGitInitialized(true);

      // Get current branch
      const branch = await gitService.getCurrentBranch();
      if (branch) {
        setCurrentBranch(branch);
      }

      // Get all branches
      const branchesResult = await gitService.getBranches();
      if (branchesResult.success && branchesResult.data) {
        const branchInfos: BranchInfo[] = Object.entries(
          branchesResult.data.branches,
        ).map(([name, detail]) => ({
          name,
          current: detail.current,
          commit: detail.commit,
          label: detail.label,
        }));
        setBranches(branchInfos);
      }

      // Setup remote if configured
      if (auditData.config.remoteUrl) {
        const remoteExists = await gitService.remoteExists("origin");
        if (!remoteExists) {
          await gitService.addRemote("origin", auditData.config.remoteUrl);
        }
      }
    } catch (err) {
      console.error("Failed to initialize Git:", err);
      setError("Failed to initialize Git. Make sure Git is installed.");
    }
  };

  // ==================== CHANGE DETECTION ====================

  const detectChanges = useCallback(async () => {
    try {
      // Previous state = the committed .tara.json at HEAD (null on the first
      // commit, when not in a repo, or before the repo is bound).
      let previousProject: Project | null = null;
      const repoRoot =
        repo.outcome?.kind === "repo-ok" ||
        repo.outcome?.kind === "repo-needs-attributes"
          ? repo.outcome.repoRoot
          : null;
      const filePath = project.filePath;
      if (repoRoot && filePath) {
        previousProject = await loadPreviousProjectFromGit(
          (args) => gitService.raw(args),
          repoRoot,
          filePath,
        );
      }

      // Detect changes against the real previous state
      const detectedChanges = diffService.detectChanges(
        project as Project,
        previousProject,
      );

      setChanges(detectedChanges);

      // Generate commit message data
      if (detectedChanges.length > 0) {
        const messageData = diffService.generateCommitMessageData(
          detectedChanges,
          "Detail Review",
          auditData.config.author.name || "Unknown",
          {
            projectName: project.name ?? project.info?.name,
            projectId: project.id,
          },
        );
        setCommitMessageData(messageData);
      } else {
        setCommitMessageData(null);
      }
    } catch (err) {
      console.error("Failed to detect changes:", err);
      setError("Failed to detect changes");
    }
  }, [project, repo.outcome, gitService, auditData.config.author.name]);

  // Derive the "last committed" date from git (the on-disk file no longer
  // carries audit.lastCommitState). Path-scoped to THIS project's file so it is
  // correct when a repo holds several projects. Runs only once the repo is bound.
  const refreshLastCommitDate = useCallback(async () => {
    const repoRoot =
      repo.outcome?.kind === "repo-ok" ||
      repo.outcome?.kind === "repo-needs-attributes"
        ? repo.outcome.repoRoot
        : null;
    const filePath = project.filePath;
    if (!repoRoot || !filePath) {
      setLastCommitDate(undefined);
      return;
    }
    const relPath = repoRelativePath(repoRoot, filePath);
    const res = await gitService.raw([
      "log",
      "-1",
      "--format=%cI",
      "--",
      relPath,
    ]);
    setLastCommitDate(
      res.success && res.data?.trim() ? res.data.trim() : undefined,
    );
  }, [repo.outcome, project.filePath, gitService]);

  // ==================== HANDLERS ====================

  const handleRefresh = useCallback(() => {
    detectChanges();
  }, [detectChanges]);

  const handleOpenConfig = useCallback(() => {
    setShowConfigDialog(true);
  }, []);

  const handleSaveConfig = useCallback(
    async (config: AuditConfig) => {
      try {
        const updatedAuditData: AuditData = {
          ...auditData,
          config,
          lastModified: new Date().toISOString(),
        };

        setAuditData(updatedAuditData);
        setIsDirty(true);

        // Re-initialize Git with new config
        await initializeGit();
      } catch (err) {
        throw new Error("Failed to save configuration");
      }
    },
    [auditData],
  );

  const handleSaveCredential = useCallback(
    async (account: string, token: string) => {
      await credentialService.saveGitToken(account, token);
    },
    [],
  );

  const handleSaveGPGKey = useCallback(
    async (keyId: string, privateKey: string) => {
      await credentialService.saveGPGKey(keyId, privateKey);
    },
    [],
  );

  const handleOpenCommit = useCallback(() => {
    if (!validation.canCommit || !hasChanges) {
      setError(
        "Cannot commit: Configuration incomplete or no changes detected",
      );
      return;
    }
    setShowCommitDialog(true);
  }, [validation.canCommit, hasChanges]);

  const handleCommit = useCallback(
    async (options: CommitOptions) => {
      try {
        setError(null);

        // Resolve the project file relative to the bound audit repo. The
        // audit commit is scoped to THIS path — never the whole index.
        const repoRoot =
          repo.outcome?.kind === "repo-ok" ||
          repo.outcome?.kind === "repo-needs-attributes"
            ? repo.outcome.repoRoot
            : null;
        const filePath = project.filePath;
        if (!repoRoot || !filePath) {
          throw new Error(
            "Audit repo not bound yet — cannot determine the project file to commit",
          );
        }
        const relPath = repoRelativePath(repoRoot, filePath);

        // Signing-identity guard: if this commit will be signed, the author
        // email must be authorized in the manifest — otherwise git produces a
        // signature that fails verification later ("No principal matched").
        // Block before committing rather than shipping a worthless signature.
        if (options.signCommit) {
          const io = createIpcFileIO();
          const manifestText = await io.read(allowedSignersPathOf(repoRoot));
          const ident = checkSigningIdentity({
            authorEmail: auditData.config.author.email,
            manifestEntries: manifestText
              ? parseAllowedSigners(manifestText)
              : [],
          });
          if (!ident.ok) {
            throw new Error(
              ident.reason === "empty-manifest"
                ? "Signing is enabled but the signer manifest is empty. Add yourself as a signer first (Config → Signers)."
                : `Signing is enabled but your author email (${auditData.config.author.email}) is not authorized in the signer manifest. Add your key under this email (Config → Signers).`,
            );
          }
        }

        // Stage only the project file (path-scoped)
        const stageResult = await gitService.stage([relPath]);
        if (!stageResult.success) {
          throw new Error(stageResult.error || "Failed to stage changes");
        }

        // Create or checkout branch if needed
        if (options.createBranch) {
          const createResult = await gitService.createBranch(
            options.branchName,
            true,
          );
          if (!createResult.success) {
            throw new Error(createResult.error || "Failed to create branch");
          }
        } else if (options.branchName !== currentBranch) {
          const checkoutResult = await gitService.checkoutBranch(
            options.branchName,
          );
          if (!checkoutResult.success) {
            throw new Error(
              checkoutResult.error || "Failed to checkout branch",
            );
          }
        }

        // Commit — path-scoped
        const commitResult = await gitService.commit(
          options.message,
          auditData.config,
          options.signCommit,
          [relPath],
        );

        if (!commitResult.success || !commitResult.data) {
          throw new Error(commitResult.error || "Failed to commit");
        }

        // Push if requested
        if (options.pushAfterCommit && auditData.config.remoteUrl) {
          const pushResult = await gitService.push(
            "origin",
            options.branchName,
            auditData.config,
          );
          if (!pushResult.success) {
            // Don't fail on push error, just warn
            console.warn("Push failed:", pushResult.error);
            setError(`Commit succeeded, but push failed: ${pushResult.error}`);
          }
        }

        // Update audit data with commit state
        const updatedAuditData: AuditData = {
          ...auditData,
          lastCommitState: {
            commitHash: commitResult.data.commit,
            commitDate: new Date().toISOString(),
            branchName: options.branchName,
            message: options.message,
            roundName: options.roundName,
            affectedPhases: changes.map((c) => c.phaseLabel),
            batchSize: totalChangeCount,
          },
          config: {
            ...auditData.config,
            lastRoundNumber: options.createBranch
              ? auditData.config.lastRoundNumber + 1
              : auditData.config.lastRoundNumber,
          },
          lastModified: new Date().toISOString(),
        };

        setAuditData(updatedAuditData);
        // Reflect the just-made commit immediately, without a git round-trip.
        setLastCommitDate(updatedAuditData.lastCommitState?.commitDate);

        // Save to project
        onUpdate({
          audit: updatedAuditData,
          phaseStatus: project.phaseStatus,
          lastModified: new Date().toISOString(),
        });

        // Refresh
        setCurrentBranch(options.branchName);
        await initializeGit();
        detectChanges();

        setShowCommitDialog(false);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Commit failed";
        setError(message);
        throw err; // Re-throw to be caught by CommitDialog
      }
    },
    [
      gitService,
      auditData,
      currentBranch,
      changes,
      totalChangeCount,
      project.phaseStatus,
      onUpdate,
      detectChanges,
    ],
  );

  const saveAuditData = useCallback(() => {
    onUpdate({
      audit: auditData,
      phaseStatus: project.phaseStatus,
      lastModified: new Date().toISOString(),
    });
    setIsDirty(false);
  }, [auditData, project.phaseStatus, onUpdate]);

  // ==================== RENDER ====================

  return (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Toolbar */}
      <AuditToolbar
        hasChanges={hasChanges}
        changeCount={totalChangeCount}
        isConfigured={validation.isConfigured}
        canCommit={validation.canCommit && hasChanges && isGitInitialized}
        onOpenConfig={handleOpenConfig}
        onToggleDetail={() => setShowDetail(!showDetail)}
        onCommit={handleOpenCommit}
        onRefresh={handleRefresh}
        showDetail={showDetail}
        currentBranch={currentBranch}
      />

      {/* Error Alert */}
      {error && (
        <Box sx={{ px: 2, pt: 2 }}>
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        </Box>
      )}

      {/* Audit repo status (discovery) */}
      {repo.outcome?.kind === "not-a-repo" && (
        <Box sx={{ px: 2, pt: 2 }}>
          <Alert
            severity="warning"
            action={
              <Button
                color="inherit"
                size="small"
                onClick={() => repo.initRepo()}
                disabled={repo.loading}
              >
                {t("audit.repo.init", {
                  defaultValue: "Initialize audit repo here",
                })}
              </Button>
            }
          >
            {t("audit.repo.notARepo", {
              defaultValue:
                "This project file is not inside a Git repository. Initialize one to enable the audit trail.",
            })}
          </Alert>
        </Box>
      )}

      {repo.outcome?.kind === "repo-needs-attributes" && (
        <Box sx={{ px: 2, pt: 2 }}>
          <Alert
            severity="warning"
            action={
              <Button
                color="inherit"
                size="small"
                onClick={() => repo.applyAttributes()}
                disabled={repo.loading}
              >
                {t("audit.repo.setAttributes", {
                  defaultValue: "Set .gitattributes",
                })}
              </Button>
            }
          >
            {t("audit.repo.needsAttributes", {
              defaultValue:
                "The audit repo does not enforce canonical .tara.json handling (LF/text). Set .gitattributes to avoid diff noise.",
            })}
          </Alert>
        </Box>
      )}

      {repo.error && (
        <Box sx={{ px: 2, pt: 2 }}>
          <Alert severity="error">{repo.error}</Alert>
        </Box>
      )}

      {/* Configuration Warning */}
      {!validation.isConfigured && (
        <Box sx={{ px: 2, pt: 2 }}>
          <Alert severity="warning">
            {t("audit.warnings.notConfigured", {
              defaultValue:
                "Git configuration incomplete. Please configure Git settings before committing.",
            })}
          </Alert>
        </Box>
      )}

      {/* Validation Warnings */}
      {validation.warnings.length > 0 && (
        <Box sx={{ px: 2, pt: 2 }}>
          {validation.warnings.map((warning, i) => (
            <Alert key={i} severity="warning" sx={{ mb: 1 }}>
              {warning}
            </Alert>
          ))}
        </Box>
      )}

      {/* Main Content */}
      <Box
        sx={{
          flexGrow: 1,
          overflow: "auto",
          p: 2,
        }}
      >
        {showDetail ? (
          <PhaseDiffViewer changes={changes} />
        ) : (
          <AuditSummary
            changes={changes}
            commitMessageData={commitMessageData}
            lastCommitDate={lastCommitDate}
          />
        )}

        {/* Audit trail verification */}
        {auditData.config.signing?.enabled && (
          <AuditVerifyPanel
            repoRoot={repoRootValue}
            anchor={protection.anchor}
            branch={currentBranch}
          />
        )}
      </Box>

      {/* Config Dialog */}
      <AuditConfigDialog
        open={showConfigDialog}
        config={auditData.config}
        onSave={handleSaveConfig}
        onClose={() => setShowConfigDialog(false)}
        onSaveCredential={handleSaveCredential}
        onSaveGPGKey={handleSaveGPGKey}
        gitService={gitService}
        repoRoot={repoRootValue}
        protection={protection}
      />

      {/* Commit Dialog */}
      {commitMessageData && (
        <CommitDialog
          open={showCommitDialog}
          config={auditData.config}
          branches={branches}
          currentBranch={currentBranch}
          commitMessageData={commitMessageData}
          onCommit={handleCommit}
          onClose={() => setShowCommitDialog(false)}
          protection={protection}
        />
      )}
    </Box>
  );
};

export default AuditTab;