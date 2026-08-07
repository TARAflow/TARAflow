// ==================== COMMIT DIALOG ====================
// Dialog for creating Git commits
// Features:
// - Branch selection (existing or auto-increment)
// - Custom branch name input
// - Round name selection
// - Commit message editor
// - Push option

import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Select,
  MenuItem,
  Box,
  Typography,
  Divider,
  Checkbox,
  Alert,
  CircularProgress,
} from "@mui/material";
import {
  Commit as CommitIcon,
  Cancel as CancelIcon,
} from "@mui/icons-material";
import type {
  AuditConfig,
  CommitOptions,
  BranchInfo,
  RoundName,
} from "../models/audit-types";
import {
  generateNextBranchName,
  getAllRoundNames,
  generateCommitMessage,
} from "../models/audit-types";
import type { CommitMessageData } from "../models/audit-types";
import type { AuditProtection } from "../hooks/useAuditProtection";
import { AuditProtectionPanel } from "./audit-protection-panel";

// ==================== PROPS ====================

interface CommitDialogProps {
  open: boolean;
  config: AuditConfig;
  branches: BranchInfo[];
  currentBranch: string;
  commitMessageData: CommitMessageData;
  onCommit: (options: CommitOptions) => Promise<void>;
  onClose: () => void;
  /** Local protection status — shows a warning banner when a check fails. */
  protection?: AuditProtection;
}

// ==================== COMPONENT ====================

export const CommitDialog: React.FC<CommitDialogProps> = ({
  open,
  config,
  branches,
  currentBranch,
  commitMessageData,
  onCommit,
  onClose,
  protection,
}) => {
  const { t } = useTranslation();

  const signingEnabled =
    config.signing?.enabled ?? config.gpg?.enabled ?? false;
  const signingFormat = config.signing?.format ?? "gpg";

  // ==================== STATE ====================

  const [branchMode, setBranchMode] = useState<
    "current" | "existing" | "auto" | "custom"
  >("current");
  const [selectedBranch, setSelectedBranch] = useState<string>(currentBranch);
  const [customBranchName, setCustomBranchName] = useState<string>("");
  const [roundName, setRoundName] = useState<string>(commitMessageData.round);
  const [commitMessage, setCommitMessage] = useState<string>("");
  const [reviewer, setReviewer] = useState<string>("");
  const [pushAfterCommit, setPushAfterCommit] = useState<boolean>(true);
  const [isCommitting, setIsCommitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [signCommit, setSignCommit] = useState<boolean>(signingEnabled);

  // ==================== COMPUTED ====================

  const allRoundNames = getAllRoundNames(config);
  const nextBranchName = generateNextBranchName(
    config.featureBranchTemplate,
    config.lastRoundNumber,
  );

  // ==================== EFFECTS ====================

  // Generate commit message when round name changes
  useEffect(() => {
    const updatedData = {
      ...commitMessageData,
      round: roundName,
      reviewer: reviewer || undefined,
    };
    const message = generateCommitMessage(updatedData);
    setCommitMessage(message);
  }, [roundName, reviewer, commitMessageData]);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setBranchMode("current");
      setSelectedBranch(currentBranch);
      setCustomBranchName("");
      setRoundName(commitMessageData.round);
      setReviewer("");
      setPushAfterCommit(!!config.remoteUrl);
      setSignCommit(signingEnabled);
      setError(null);
    }
  }, [open, currentBranch, commitMessageData.round, config]);

  // ==================== HANDLERS ====================

  const handleCommit = async () => {
    setError(null);
    setIsCommitting(true);

    try {
      // Determine branch name
      let branchName = currentBranch;
      let createBranch = false;

      if (branchMode === "existing") {
        branchName = selectedBranch;
      } else if (branchMode === "auto") {
        branchName = nextBranchName;
        createBranch = true;
      } else if (branchMode === "custom") {
        if (!customBranchName.trim()) {
          setError("Custom branch name is required");
          setIsCommitting(false);
          return;
        }
        branchName = customBranchName.trim();
        createBranch = true;
      }

      // Validate branch name
      if (createBranch && !isValidBranchName(branchName)) {
        setError(
          "Invalid branch name. Use only alphanumeric characters, hyphens, and slashes.",
        );
        setIsCommitting(false);
        return;
      }

      const options: CommitOptions = {
        branchName,
        createBranch,
        message: commitMessage,
        roundName,
        signCommit,
        pushAfterCommit: pushAfterCommit && !!config.remoteUrl,
        reviewer: reviewer || undefined,
      };

      await onCommit(options);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Commit failed");
    } finally {
      setIsCommitting(false);
    }
  };

  // ==================== RENDER ====================

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {t("audit.commit.title", { defaultValue: "Create Commit" })}
      </DialogTitle>

      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3, pt: 1 }}>
          {/* Audit-trail protection warning (only when a local check fails) */}
          {protection && (
            <AuditProtectionPanel protection={protection} variant="banner" />
          )}

          {/* Error Alert */}
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {/* Branch Selection */}
          <FormControl component="fieldset">
            <FormLabel component="legend">
              {t("audit.commit.branchSelection", {
                defaultValue: "Branch Selection",
              })}
            </FormLabel>
            <RadioGroup
              value={branchMode}
              onChange={(e) => setBranchMode(e.target.value as any)}
            >
              {/* Current Branch */}
              <FormControlLabel
                value="current"
                control={<Radio />}
                label={
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Typography variant="body2">
                      {t("audit.commit.currentBranch", {
                        defaultValue: "Current Branch:",
                      })}
                    </Typography>
                    <Typography
                      variant="body2"
                      fontFamily="monospace"
                      fontWeight="medium"
                    >
                      {currentBranch}
                    </Typography>
                  </Box>
                }
              />

              {/* Existing Branch */}
              {branches.length > 1 && (
                <FormControlLabel
                  value="existing"
                  control={<Radio />}
                  label={
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Typography variant="body2">
                        {t("audit.commit.existingBranch", {
                          defaultValue: "Existing Branch:",
                        })}
                      </Typography>
                      <Select
                        value={selectedBranch}
                        onChange={(e) => setSelectedBranch(e.target.value)}
                        size="small"
                        disabled={branchMode !== "existing"}
                        sx={{ minWidth: 200 }}
                      >
                        {branches.map((branch) => (
                          <MenuItem key={branch.name} value={branch.name}>
                            {branch.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </Box>
                  }
                />
              )}

              {/* Auto-Increment Branch */}
              <FormControlLabel
                value="auto"
                control={<Radio />}
                label={
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Typography variant="body2">
                      {t("audit.commit.autoIncrement", {
                        defaultValue: "Auto-Increment:",
                      })}
                    </Typography>
                    <Typography
                      variant="body2"
                      fontFamily="monospace"
                      fontWeight="medium"
                      color="primary"
                    >
                      {nextBranchName}
                    </Typography>
                  </Box>
                }
              />

              {/* Custom Branch */}
              <FormControlLabel
                value="custom"
                control={<Radio />}
                label={
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Typography variant="body2">
                      {t("audit.commit.customBranch", {
                        defaultValue: "Custom Branch:",
                      })}
                    </Typography>
                    <TextField
                      value={customBranchName}
                      onChange={(e) => setCustomBranchName(e.target.value)}
                      placeholder="feature/my-branch"
                      size="small"
                      disabled={branchMode !== "custom"}
                      sx={{ minWidth: 200 }}
                    />
                  </Box>
                }
              />
            </RadioGroup>
          </FormControl>

          <Divider />

          {/* Round Name Selection */}
          <FormControl fullWidth>
            <FormLabel>
              {t("audit.commit.roundName", { defaultValue: "Round Name" })}
            </FormLabel>
            <Select
              value={roundName}
              onChange={(e) => setRoundName(e.target.value)}
              size="small"
            >
              {allRoundNames.map((round) => (
                <MenuItem key={round.id} value={round.name}>
                  {round.name}
                  {round.isCustom && (
                    <Typography
                      component="span"
                      variant="caption"
                      color="text.secondary"
                      sx={{ ml: 1 }}
                    >
                      (custom)
                    </Typography>
                  )}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Reviewer (Optional) */}
          <TextField
            label={t("audit.commit.reviewer", {
              defaultValue: "Reviewer (optional)",
            })}
            value={reviewer}
            onChange={(e) => setReviewer(e.target.value)}
            size="small"
            fullWidth
            placeholder="Enter reviewer name"
          />

          <Divider />

          {/* Commit Message */}
          <FormControl fullWidth>
            <FormLabel>
              {t("audit.commit.message", { defaultValue: "Commit Message" })}
            </FormLabel>
            <TextField
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              multiline
              rows={12}
              fullWidth
              sx={{
                fontFamily: "monospace",
                fontSize: "0.875rem",
                "& textarea": {
                  fontFamily: "monospace",
                },
              }}
            />
          </FormControl>

          <Divider />

          {/* Options */}
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {/* Push Option */}
            {config.remoteUrl && (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={pushAfterCommit}
                    onChange={(e) => setPushAfterCommit(e.target.checked)}
                  />
                }
                label={t("audit.commit.pushAfterCommit", {
                  defaultValue: "Push to remote after commit",
                })}
              />
            )}

            {/* GPG Signing */}
            {signingEnabled && (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={signCommit}
                    onChange={(e) => setSignCommit(e.target.checked)}
                  />
                }
                label={t("audit.commit.signCommit", {
                  defaultValue: `Sign commit (${signingFormat.toUpperCase()})`,
                })}
              />
            )}
          </Box>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button
          onClick={onClose}
          disabled={isCommitting}
          startIcon={<CancelIcon />}
        >
          {t("common.cancel", { defaultValue: "Cancel" })}
        </Button>
        <Button
          onClick={handleCommit}
          disabled={isCommitting || !commitMessage.trim()}
          variant="contained"
          color="primary"
          startIcon={
            isCommitting ? <CircularProgress size={20} /> : <CommitIcon />
          }
        >
          {isCommitting
            ? t("audit.commit.committing", { defaultValue: "Committing..." })
            : pushAfterCommit
              ? t("audit.commit.commitAndPush", {
                  defaultValue: "Commit & Push",
                })
              : t("audit.commit.commit", { defaultValue: "Commit" })}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ==================== HELPERS ====================

/**
 * Validate Git branch name
 * Rules: alphanumeric, hyphens, underscores, forward slashes
 * No spaces, special characters, or consecutive dots
 */
function isValidBranchName(name: string): boolean {
  // Basic validation
  if (!name || name.trim() === "") return false;
  
  // Git branch name rules
  const invalidChars = /[~^:?*\[\]\\@{}\s]/;
  const consecutiveDots = /\.\./;
  const endsWithDot = /\.$/;
  const startsWithDot = /^\./;
  
  if (invalidChars.test(name)) return false;
  if (consecutiveDots.test(name)) return false;
  if (endsWithDot.test(name)) return false;
  if (startsWithDot.test(name)) return false;
  
  return true;
}

export default CommitDialog;
