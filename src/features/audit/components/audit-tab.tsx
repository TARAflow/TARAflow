// ==================== AUDIT TAB ====================
// Main Audit/Version Control Tab
// Features:
// - Change detection and diff viewing
// - Git commit creation
// - Branch management
// - Configuration management

import React, { useState, useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Box, Alert } from "@mui/material";
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
import { diffService } from "../services/diff-service";
import { createGitService } from "../services/git-service-renderer";
import { credentialService } from "../services/credential-service-renderer";
import type { Project } from "app/models/project-types";

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

  // ==================== COMPUTED ====================

  const validation = useMemo(
    () => validateGitConfig(auditData.config),
    [auditData.config]
  );

  const hasChanges = changes.length > 0;
  const totalChangeCount = changes.reduce(
    (sum, p) => sum + p.changeCount,
    0
  );

  // ==================== GIT SERVICE ====================

const gitService = useMemo(() => {
  // Git operations are handled by Electron main process via IPC
  return createGitService();
}, []);

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

  // Initialize Git and detect changes on mount
  useEffect(() => {
    initializeGit();
    detectChanges();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          branchesResult.data.branches
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

  const detectChanges = useCallback(() => {
    try {
      // Get snapshot from last commit state
      const previousProject = auditData.lastCommitState
        ? reconstructProjectFromCommitState()
        : null;

      // Detect changes
      const detectedChanges = diffService.detectChanges(
        project as Project,
        previousProject
      );

      setChanges(detectedChanges);

      // Generate commit message data
      if (detectedChanges.length > 0) {
        const messageData = diffService.generateCommitMessageData(
          detectedChanges,
          "Detail Review", // Default round name
          auditData.config.author.name || "Unknown"
        );
        setCommitMessageData(messageData);
      } else {
        setCommitMessageData(null);
      }
    } catch (err) {
      console.error("Failed to detect changes:", err);
      setError("Failed to detect changes");
    }
  }, [project, auditData.lastCommitState, auditData.config.author.name]);

  const reconstructProjectFromCommitState = (): Project | null => {
    // In a real implementation, this would reconstruct the project from the commit state
    // For now, we return null to compare against nothing (all changes are new)
    // TODO: Implement proper project snapshot reconstruction
    return null;
  };

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
    [auditData]
  );

  const handleSaveCredential = useCallback(
    async (account: string, token: string) => {
      await credentialService.saveGitToken(account, token);
    },
    []
  );

  const handleSaveGPGKey = useCallback(
    async (keyId: string, privateKey: string) => {
      await credentialService.saveGPGKey(keyId, privateKey);
    },
    []
  );

  const handleOpenCommit = useCallback(() => {
    if (!validation.canCommit || !hasChanges) {
      setError("Cannot commit: Configuration incomplete or no changes detected");
      return;
    }
    setShowCommitDialog(true);
  }, [validation.canCommit, hasChanges]);

  const handleCommit = useCallback(
    async (options: CommitOptions) => {
      try {
        setError(null);

        // Stage all changes
        const stageResult = await gitService.stageAll();
        if (!stageResult.success) {
          throw new Error(stageResult.error || "Failed to stage changes");
        }

        // Create or checkout branch if needed
        if (options.createBranch) {
          const createResult = await gitService.createBranch(
            options.branchName,
            true
          );
          if (!createResult.success) {
            throw new Error(
              createResult.error || "Failed to create branch"
            );
          }
        } else if (options.branchName !== currentBranch) {
          const checkoutResult = await gitService.checkoutBranch(
            options.branchName
          );
          if (!checkoutResult.success) {
            throw new Error(
              checkoutResult.error || "Failed to checkout branch"
            );
          }
        }

        // Commit
        const commitResult = await gitService.commit(
          options.message,
          auditData.config
        );
        if (!commitResult.success || !commitResult.data) {
          throw new Error(commitResult.error || "Failed to commit");
        }

        // Push if requested
        if (options.pushAfterCommit && auditData.config.remoteUrl) {
          const pushResult = await gitService.push(
            "origin",
            options.branchName,
            auditData.config
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
    ]
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
            lastCommitDate={auditData.lastCommitState?.commitDate}
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
        />
      )}
    </Box>
  );
};

export default AuditTab;
