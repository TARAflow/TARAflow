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
} from "@mui/icons-material";
import { useAuditSigners, type SignerGit } from "../hooks/useAuditSigners";
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
  /** Bound audit repo root + git service — needed for the Signers tab. */
  repoRoot?: string;
  gitService?: SignerGit;
}

// ==================== COMPONENT ====================

export const AuditConfigDialog: React.FC<AuditConfigDialogProps> = ({
  open,
  config,
  onSave,
  onClose,
  onSaveCredential,
  repoRoot,
  gitService,
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

  // Signers tab: the committed manifest + the "add signer" form.
  const signers = useAuditSigners(repoRoot, gitService, localConfig);
  const [newPrincipal, setNewPrincipal] = useState("");
  const [newPubkey, setNewPubkey] = useState("");

  // ==================== EFFECTS ====================

  useEffect(() => {
    if (open) {
      // Seed the unified `signing` block from the legacy `gpg` config when a
      // project predates it, so older projects surface their settings here.
      setLocalConfig({
        ...config,
        signing: config.signing ?? {
          enabled: !!config.gpg?.enabled,
          format: "gpg",
          keyId: config.gpg?.keyId,
        },
      });
      setError(null);
      setPatToken("");
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

      await onSave(localConfig);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save configuration",
      );
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

  // Native file picker for the SSH signing key — avoids typing the full path
  // by hand. Uses the generic file:pickFile (NOT the project openDialog): no
  // tara.json filter, showHiddenFiles so ~/.ssh is reachable.
  const handleBrowseSigningKey = async () => {
    const api = window.electron?.file;
    if (!api?.pickFile) return;
    const res = await api.pickFile({
      title: "Select SSH signing key",
      defaultPath: "~/.ssh",
      buttonLabel: "Select",
      // .pub first (git-ssh signing points user.signingkey at the public key),
      // but "All files" lets a private/extension-less key be picked too.
      filters: [
        { name: "SSH public keys", extensions: ["pub"] },
        { name: "All files", extensions: ["*"] },
      ],
    });
    if (res.success && res.data) {
      setLocalConfig((prev) => ({
        ...prev,
        signing: { ...prev.signing!, sshSigningKeyPath: res.data },
      }));
    }
  };

  // Same picker for the SSH auth key (push), different target field.
  const handleBrowseAuthKey = async () => {
    const api = window.electron?.file;
    if (!api?.pickFile) return;
    const res = await api.pickFile({
      title: "Select SSH key",
      defaultPath: "~/.ssh",
      buttonLabel: "Select",
      filters: [{ name: "All files", extensions: ["*"] }],
    });
    if (res.success && res.data) {
      setLocalConfig((prev) => ({
        ...prev,
        auth: { ...prev.auth, sshKeyPath: res.data },
      }));
    }
  };

  // Add-signer: pick a *.pub, read its CONTENTS (entryFromPubkey needs the key
  // text, not the path), and drop it into the textarea (which paste also feeds).
  const handleBrowsePubkey = async () => {
    const api = window.electron?.file;
    if (!api?.pickFile || !api?.readText) return;
    const picked = await api.pickFile({
      title: "Select signer public key (.pub)",
      defaultPath: "~/.ssh",
      buttonLabel: "Select",
      filters: [
        { name: "SSH public keys", extensions: ["pub"] },
        { name: "All files", extensions: ["*"] },
      ],
    });
    if (picked.success && picked.data) {
      const read = await api.readText(picked.data);
      if (read.success && read.data) setNewPubkey(read.data.trim());
    }
  };

  const handleAddSigner = async () => {
    const ok = await signers.addSigner(newPrincipal.trim(), newPubkey.trim());
    if (ok) setNewPubkey(""); // keep principal for adding several keys
  };

  // ==================== RENDER ====================

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {t("audit.config.title", { defaultValue: "Git Configuration" })}
      </DialogTitle>

      <DialogContent
        sx={{
          height: 520,
          overflowY: "auto",
        }}
      >
        <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}>
          <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
            <Tab
              label={t("audit.config.tabs.general", {
                defaultValue: "General",
              })}
            />
            <Tab
              label={t("audit.config.tabs.auth", {
                defaultValue: "Authentication",
              })}
            />
            <Tab
              label={t("audit.config.tabs.signing", {
                defaultValue: "Commit Signing",
              })}
            />
            <Tab
              label={t("audit.config.tabs.rounds", {
                defaultValue: "Round Names",
              })}
            />
            <Tab
              label={t("audit.config.tabs.signers", {
                defaultValue: "Signers",
              })}
            />
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
                setLocalConfig((prev) => ({
                  ...prev,
                  remoteUrl: e.target.value,
                }))
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
                setLocalConfig((prev) => ({
                  ...prev,
                  defaultBranch: e.target.value,
                }))
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
                defaultValue:
                  "Template for auto-generated branch names (e.g., 'risk-round-' → 'risk-round-1')",
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
                    auth: {
                      ...prev.auth,
                      method: e.target.value as AuthMethod,
                    },
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
                        label={t("audit.config.stored", {
                          defaultValue: "Stored",
                        })}
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

                <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
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
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={handleBrowseAuthKey}
                    sx={{ whiteSpace: "nowrap", height: 40 }}
                  >
                    {t("audit.config.browse", { defaultValue: "Browse…" })}
                  </Button>
                </Box>
              </Box>
            )}
          </Box>
        )}

        {/* TAB 2: Commit Signing */}
        {activeTab === 2 && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={!!localConfig.signing?.enabled}
                  onChange={(e) =>
                    setLocalConfig((prev) => ({
                      ...prev,
                      signing: {
                        ...(prev.signing ?? { format: "ssh" }),
                        enabled: e.target.checked,
                      },
                    }))
                  }
                />
              }
              label={t("audit.config.enableSigning", {
                defaultValue: "Sign commits",
              })}
            />

            {localConfig.signing?.enabled && (
              <>
                <FormControl size="small">
                  <FormLabel>
                    {t("audit.config.signFormat", {
                      defaultValue: "Signature format",
                    })}
                  </FormLabel>
                  <RadioGroup
                    row
                    value={localConfig.signing?.format ?? "ssh"}
                    onChange={(e) =>
                      setLocalConfig((prev) => ({
                        ...prev,
                        signing: {
                          ...prev.signing!,
                          format: e.target.value as "gpg" | "ssh",
                        },
                      }))
                    }
                  >
                    <FormControlLabel
                      value="ssh"
                      control={<Radio />}
                      label="SSH (recommended)"
                    />
                    <FormControlLabel
                      value="gpg"
                      control={<Radio />}
                      label="GPG"
                    />
                  </RadioGroup>
                </FormControl>

                {localConfig.signing?.format === "ssh" ? (
                  <Box
                    sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}
                  >
                    <TextField
                      label={t("audit.config.sshSigningKey", {
                        defaultValue: "SSH signing key path",
                      })}
                      value={localConfig.signing?.sshSigningKeyPath ?? ""}
                      onChange={(e) =>
                        setLocalConfig((prev) => ({
                          ...prev,
                          signing: {
                            ...prev.signing!,
                            sshSigningKeyPath: e.target.value,
                          },
                        }))
                      }
                      placeholder="~/.ssh/taraflow_signing.pub"
                      size="small"
                      fullWidth
                    />
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={handleBrowseSigningKey}
                      sx={{ whiteSpace: "nowrap", height: 40 }}
                    >
                      {t("audit.config.browse", { defaultValue: "Browse…" })}
                    </Button>
                  </Box>
                ) : (
                  <TextField
                    label={t("audit.config.gpgKeyId", {
                      defaultValue: "GPG Key ID",
                    })}
                    value={localConfig.signing?.keyId ?? ""}
                    onChange={(e) =>
                      setLocalConfig((prev) => ({
                        ...prev,
                        signing: { ...prev.signing!, keyId: e.target.value },
                      }))
                    }
                    placeholder="ABCD1234"
                    size="small"
                    fullWidth
                  />
                )}
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

        {/* TAB 4: Signers */}
        {activeTab === 4 && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Typography variant="subtitle2">
              {t("audit.config.signers.title", {
                defaultValue: "Authorized signers",
              })}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t("audit.config.signers.help", {
                defaultValue:
                  "Keys allowed to sign audit commits (.tara/allowed_signers). Adding or removing one is itself a signed audit: commit.",
              })}
            </Typography>

            {!repoRoot && (
              <Alert severity="info">
                {t("audit.config.signers.noRepo", {
                  defaultValue:
                    "Open a project inside its audit repo to manage signers.",
                })}
              </Alert>
            )}

            {signers.error && (
              <Alert severity="error" onClose={() => signers.setError(null)}>
                {signers.error}
              </Alert>
            )}

            <List dense>
              {signers.entries.map((e) => (
                <ListItem
                  key={`${e.keyType} ${e.keyBlob}`}
                  secondaryAction={
                    <IconButton
                      edge="end"
                      aria-label="remove signer"
                      disabled={signers.loading || !repoRoot}
                      onClick={() => signers.removeSigner(e.keyType, e.keyBlob)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  }
                >
                  <ListItemText
                    primary={e.principal}
                    secondary={`${e.keyType} …${e.keyBlob.slice(-16)}`}
                  />
                </ListItem>
              ))}
              {repoRoot && signers.entries.length === 0 && (
                <ListItem>
                  <ListItemText
                    secondary={t("audit.config.signers.empty", {
                      defaultValue: "No signers yet.",
                    })}
                  />
                </ListItem>
              )}
            </List>

            <Divider />

            <Typography variant="subtitle2">
              {t("audit.config.signers.add", { defaultValue: "Add signer" })}
            </Typography>
            <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
              <TextField
                label={t("audit.config.signers.principal", {
                  defaultValue: "Signer email (commit author)",
                })}
                value={newPrincipal}
                onChange={(e) => setNewPrincipal(e.target.value)}
                placeholder={config.author.email || "name@example.com"}
                helperText={t("audit.config.signers.principalHelp", {
                  defaultValue:
                    "The commit-author email of the signer — must match how they commit.",
                })}
                size="small"
                fullWidth
              />
              {config.author.email && (
                <Button
                  size="small"
                  variant="text"
                  onClick={() => setNewPrincipal(config.author.email)}
                  sx={{ whiteSpace: "nowrap", height: 40 }}
                >
                  {t("audit.config.signers.useMine", {
                    defaultValue: "Use mine",
                  })}
                </Button>
              )}
            </Box>
            <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
              <TextField
                label={t("audit.config.signers.pubkey", {
                  defaultValue: "Public key (.pub contents)",
                })}
                value={newPubkey}
                onChange={(e) => setNewPubkey(e.target.value)}
                placeholder="ssh-ed25519 AAAA…"
                size="small"
                fullWidth
                multiline
                minRows={2}
              />
              <Button
                variant="outlined"
                size="small"
                onClick={handleBrowsePubkey}
                sx={{ whiteSpace: "nowrap", height: 40 }}
              >
                {t("audit.config.browse", { defaultValue: "Browse…" })}
              </Button>
            </Box>
            <Box>
              <Button
                variant="contained"
                size="small"
                startIcon={<AddIcon />}
                disabled={
                  signers.loading ||
                  !repoRoot ||
                  !newPrincipal.trim() ||
                  !newPubkey.trim()
                }
                onClick={handleAddSigner}
              >
                {t("audit.config.signers.addButton", {
                  defaultValue: "Add signer",
                })}
              </Button>
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button
          onClick={onClose}
          disabled={isSaving}
          startIcon={<CancelIcon />}
        >
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
