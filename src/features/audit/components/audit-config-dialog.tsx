// ==================== AUDIT CONFIG DIALOG ====================
// Git configuration dialog
// Features:
// - Git provider selection
// - Remote URL configuration
// - Author information
// - Authentication (PAT/SSH)
// - GPG signing configuration
// - Custom round names

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
  Select,
  MenuItem,
  Box,
  Typography,
  Divider,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Chip,
  Alert,
  RadioGroup,
  FormControlLabel,
  Radio,
  Switch,
} from "@mui/material";
import {
  Save as SaveIcon,
  Cancel as CancelIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Key as KeyIcon,
  Upload as UploadIcon,
} from "@mui/icons-material";
import type {
  AuditConfig,
  GitProvider,
  AuthMethod,
  RoundName,
} from "../models/audit-types";
import {
  GIT_PROVIDERS,
  DEFAULT_AUDIT_CONFIG,
  DEFAULT_ROUND_NAMES,
} from "../models/audit-types";

// ==================== PROPS ====================

interface AuditConfigDialogProps {
  open: boolean;
  config: AuditConfig;
  onSave: (config: AuditConfig) => Promise<void>;
  onClose: () => void;
  onSaveCredential?: (account: string, token: string) => Promise<void>;
  onSaveGPGKey?: (keyId: string, privateKey: string) => Promise<void>;
}

// ==================== COMPONENT ====================

export const AuditConfigDialog: React.FC<AuditConfigDialogProps> = ({
  open,
  config,
  onSave,
  onClose,
  onSaveCredential,
  onSaveGPGKey,
}) => {
  const { t } = useTranslation();

  // ==================== STATE ====================

  const [activeTab, setActiveTab] = useState(0);
  const [localConfig, setLocalConfig] = useState<AuditConfig>(config);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Custom round name dialog
  const [newRoundName, setNewRoundName] = useState("");
  const [newRoundNameDE, setNewRoundNameDE] = useState("");

  // PAT input
  const [patToken, setPatToken] = useState("");

  // GPG key input
  const [gpgPrivateKey, setGpgPrivateKey] = useState("");

  // ==================== EFFECTS ====================

  useEffect(() => {
    if (open) {
      setLocalConfig(config);
      setError(null);
      setPatToken("");
      setGpgPrivateKey("");
    }
  }, [open, config]);

  // ==================== HANDLERS ====================

  const handleSave = async () => {
    setError(null);
    setIsSaving(true);

    try {
      // Validate configuration
      if (!localConfig.author.name || !localConfig.author.email) {
        throw new Error("Author name and email are required");
      }

      // Save PAT if provided
      if (patToken && onSaveCredential) {
        const account = localConfig.remoteUrl || "default";
        await onSaveCredential(account, patToken);
        localConfig.auth.patAccount = account;
      }

      // Save GPG key if provided
      if (gpgPrivateKey && localConfig.gpg.keyId && onSaveGPGKey) {
        await onSaveGPGKey(localConfig.gpg.keyId, gpgPrivateKey);
        localConfig.gpg.hasStoredKey = true;
      }

      await onSave(localConfig);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save configuration");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddRoundName = () => {
    if (!newRoundName.trim()) return;

    const customRound: RoundName = {
      id: `custom-${Date.now()}`,
      name: newRoundName.trim(),
      nameDE: newRoundNameDE.trim() || newRoundName.trim(),
      isCustom: true,
    };

    setLocalConfig((prev) => ({
      ...prev,
      customRoundNames: [...prev.customRoundNames, customRound],
    }));

    setNewRoundName("");
    setNewRoundNameDE("");
  };

  const handleDeleteRoundName = (id: string) => {
    setLocalConfig((prev) => ({
      ...prev,
      customRoundNames: prev.customRoundNames.filter((r) => r.id !== id),
    }));
  };

  // ==================== RENDER ====================

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {t("audit.config.title", { defaultValue: "Git Configuration" })}
      </DialogTitle>

      <DialogContent>
        <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}>
          <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
            <Tab label={t("audit.config.tabs.general", { defaultValue: "General" })} />
            <Tab label={t("audit.config.tabs.auth", { defaultValue: "Authentication" })} />
            <Tab label={t("audit.config.tabs.gpg", { defaultValue: "GPG Signing" })} />
            <Tab label={t("audit.config.tabs.rounds", { defaultValue: "Round Names" })} />
          </Tabs>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* TAB 0: General */}
        {activeTab === 0 && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {/* Provider */}
            <FormControl fullWidth>
              <FormLabel>
                {t("audit.config.provider", { defaultValue: "Git Provider" })}
              </FormLabel>
              <Select
                value={localConfig.provider}
                onChange={(e) =>
                  setLocalConfig((prev) => ({
                    ...prev,
                    provider: e.target.value as GitProvider,
                  }))
                }
                size="small"
              >
                {GIT_PROVIDERS.map((provider) => (
                  <MenuItem key={provider.id} value={provider.id}>
                    {provider.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Remote URL */}
            <TextField
              label={t("audit.config.remoteUrl", {
                defaultValue: "Remote Repository URL",
              })}
              value={localConfig.remoteUrl || ""}
              onChange={(e) =>
                setLocalConfig((prev) => ({ ...prev, remoteUrl: e.target.value }))
              }
              placeholder="https://github.com/user/repo.git"
              size="small"
              fullWidth
            />

            {/* Default Branch */}
            <TextField
              label={t("audit.config.defaultBranch", {
                defaultValue: "Default Branch",
              })}
              value={localConfig.defaultBranch}
              onChange={(e) =>
                setLocalConfig((prev) => ({ ...prev, defaultBranch: e.target.value }))
              }
              size="small"
              fullWidth
            />

            {/* Feature Branch Template */}
            <TextField
              label={t("audit.config.branchTemplate", {
                defaultValue: "Feature Branch Template",
              })}
              value={localConfig.featureBranchTemplate}
              onChange={(e) =>
                setLocalConfig((prev) => ({
                  ...prev,
                  featureBranchTemplate: e.target.value,
                }))
              }
              placeholder="risk-round-"
              helperText={t("audit.config.branchTemplateHelp", {
                defaultValue: "Template for auto-generated branch names (e.g., 'risk-round-' → 'risk-round-1')",
              })}
              size="small"
              fullWidth
            />

            <Divider />

            {/* Author Name */}
            <TextField
              label={t("audit.config.authorName", {
                defaultValue: "Author Name",
              })}
              value={localConfig.author.name}
              onChange={(e) =>
                setLocalConfig((prev) => ({
                  ...prev,
                  author: { ...prev.author, name: e.target.value },
                }))
              }
              size="small"
              fullWidth
              required
            />

            {/* Author Email */}
            <TextField
              label={t("audit.config.authorEmail", {
                defaultValue: "Author Email",
              })}
              value={localConfig.author.email}
              onChange={(e) =>
                setLocalConfig((prev) => ({
                  ...prev,
                  author: { ...prev.author, email: e.target.value },
                }))
              }
              type="email"
              size="small"
              fullWidth
              required
            />
          </Box>
        )}

        {/* TAB 1: Authentication */}
        {activeTab === 1 && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <FormControl component="fieldset">
              <FormLabel component="legend">
                {t("audit.config.authMethod", {
                  defaultValue: "Authentication Method",
                })}
              </FormLabel>
              <RadioGroup
                value={localConfig.auth.method}
                onChange={(e) =>
                  setLocalConfig((prev) => ({
                    ...prev,
                    auth: { ...prev.auth, method: e.target.value as AuthMethod },
                  }))
                }
              >
                <FormControlLabel
                  value="pat"
                  control={<Radio />}
                  label={t("audit.config.authPAT", {
                    defaultValue: "Personal Access Token",
                  })}
                />
                <FormControlLabel
                  value="ssh"
                  control={<Radio />}
                  label={t("audit.config.authSSH", {
                    defaultValue: "SSH Key",
                  })}
                />
              </RadioGroup>
            </FormControl>

            {/* PAT Configuration */}
            {localConfig.auth.method === "pat" && (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <Alert severity="info">
                  {t("audit.config.patInfo", {
                    defaultValue:
                      "Personal Access Token will be securely stored in your system keychain.",
                  })}
                </Alert>

                <TextField
                  label={t("audit.config.patToken", {
                    defaultValue: "Personal Access Token",
                  })}
                  value={patToken}
                  onChange={(e) => setPatToken(e.target.value)}
                  type="password"
                  placeholder="ghp_xxxxxxxxxxxx"
                  helperText={t("audit.config.patHelp", {
                    defaultValue:
                      "Enter your PAT with 'repo' permissions. Leave empty to keep existing token.",
                  })}
                  size="small"
                  fullWidth
                  InputProps={{
                    endAdornment: localConfig.auth.patAccount && (
                      <Chip
                        label={t("audit.config.stored", { defaultValue: "Stored" })}
                        size="small"
                        color="success"
                      />
                    ),
                  }}
                />
              </Box>
            )}

            {/* SSH Configuration */}
            {localConfig.auth.method === "ssh" && (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <Alert severity="info">
                  {t("audit.config.sshInfo", {
                    defaultValue:
                      "SSH authentication uses your system's SSH keys (~/.ssh/id_rsa or ~/.ssh/id_ed25519).",
                  })}
                </Alert>

                <TextField
                  label={t("audit.config.sshKeyPath", {
                    defaultValue: "SSH Key Path (optional)",
                  })}
                  value={localConfig.auth.sshKeyPath || ""}
                  onChange={(e) =>
                    setLocalConfig((prev) => ({
                      ...prev,
                      auth: { ...prev.auth, sshKeyPath: e.target.value },
                    }))
                  }
                  placeholder="~/.ssh/id_ed25519"
                  helperText={t("audit.config.sshKeyPathHelp", {
                    defaultValue: "Leave empty to use default SSH key",
                  })}
                  size="small"
                  fullWidth
                />
              </Box>
            )}
          </Box>
        )}

        {/* TAB 2: GPG Signing */}
        {activeTab === 2 && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={localConfig.gpg.enabled}
                  onChange={(e) =>
                    setLocalConfig((prev) => ({
                      ...prev,
                      gpg: { ...prev.gpg, enabled: e.target.checked },
                    }))
                  }
                />
              }
              label={t("audit.config.enableGPG", {
                defaultValue: "Enable GPG Commit Signing",
              })}
            />

            {localConfig.gpg.enabled && (
              <>
                <Alert severity="info">
                  {t("audit.config.gpgInfo", {
                    defaultValue:
                      "GPG signing ensures your commits are cryptographically verified. Your private key will be securely stored.",
                  })}
                </Alert>

                <TextField
                  label={t("audit.config.gpgKeyId", {
                    defaultValue: "GPG Key ID",
                  })}
                  value={localConfig.gpg.keyId || ""}
                  onChange={(e) =>
                    setLocalConfig((prev) => ({
                      ...prev,
                      gpg: { ...prev.gpg, keyId: e.target.value },
                    }))
                  }
                  placeholder="ABCD1234"
                  helperText={t("audit.config.gpgKeyIdHelp", {
                    defaultValue: "Enter the last 8 characters of your GPG key ID",
                  })}
                  size="small"
                  fullWidth
                  InputProps={{
                    endAdornment: localConfig.gpg.hasStoredKey && (
                      <Chip
                        label={t("audit.config.keyStored", {
                          defaultValue: "Key Stored",
                        })}
                        size="small"
                        color="success"
                      />
                    ),
                  }}
                />

                <TextField
                  label={t("audit.config.gpgPrivateKey", {
                    defaultValue: "GPG Private Key (optional)",
                  })}
                  value={gpgPrivateKey}
                  onChange={(e) => setGpgPrivateKey(e.target.value)}
                  multiline
                  rows={4}
                  placeholder="-----BEGIN PGP PRIVATE KEY BLOCK-----..."
                  helperText={t("audit.config.gpgPrivateKeyHelp", {
                    defaultValue:
                      "Paste your armored private key. Leave empty to keep existing key or generate new one.",
                  })}
                  fullWidth
                />

                <Button
                  variant="outlined"
                  startIcon={<KeyIcon />}
                  size="small"
                  disabled
                >
                  {t("audit.config.generateGPGKey", {
                    defaultValue: "Generate GPG Key (Coming Soon)",
                  })}
                </Button>
              </>
            )}
          </Box>
        )}

        {/* TAB 3: Round Names */}
        {activeTab === 3 && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Typography variant="subtitle2">
              {t("audit.config.defaultRounds", {
                defaultValue: "Default Round Names",
              })}
            </Typography>
            <List dense>
              {DEFAULT_ROUND_NAMES.map((round) => (
                <ListItem key={round.id}>
                  <ListItemText primary={round.name} secondary={round.nameDE} />
                </ListItem>
              ))}
            </List>

            <Divider />

            <Typography variant="subtitle2">
              {t("audit.config.customRounds", {
                defaultValue: "Custom Round Names",
              })}
            </Typography>

            <Box sx={{ display: "flex", gap: 1 }}>
              <TextField
                value={newRoundName}
                onChange={(e) => setNewRoundName(e.target.value)}
                placeholder="Round name (EN)"
                size="small"
                fullWidth
              />
              <TextField
                value={newRoundNameDE}
                onChange={(e) => setNewRoundNameDE(e.target.value)}
                placeholder="Rundenname (DE)"
                size="small"
                fullWidth
              />
              <IconButton onClick={handleAddRoundName} color="primary">
                <AddIcon />
              </IconButton>
            </Box>

            <List dense>
              {localConfig.customRoundNames.map((round) => (
                <ListItem
                  key={round.id}
                  secondaryAction={
                    <IconButton
                      edge="end"
                      onClick={() => handleDeleteRoundName(round.id)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  }
                >
                  <ListItemText primary={round.name} secondary={round.nameDE} />
                </ListItem>
              ))}
            </List>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={isSaving} startIcon={<CancelIcon />}>
          {t("common.cancel", { defaultValue: "Cancel" })}
        </Button>
        <Button
          onClick={handleSave}
          disabled={isSaving}
          variant="contained"
          color="primary"
          startIcon={<SaveIcon />}
        >
          {t("common.save", { defaultValue: "Save" })}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AuditConfigDialog;
