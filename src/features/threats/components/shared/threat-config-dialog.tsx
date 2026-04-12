// ==================== THREAT CONFIG DIALOG ====================
// Configuration dialog for STRIDE method and custom templates

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Switch,
  Tabs,
  Tab,
  TextField,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Alert,
  Chip,
  Select,
  MenuItem,
  InputLabel,
} from "@mui/material";
import { Add as AddIcon, Delete as DeleteIcon } from "@mui/icons-material";

import {
  ThreatConfiguration,
  StrideMethod,
  ThreatTemplate,
  MitigationTemplate,
  VerificationTemplate,
} from "../../models/threat-types";
import type { StrideCategory } from "shared";

// ==================== TYPES ====================

interface ThreatConfigDialogProps {
  open: boolean;
  configuration: ThreatConfiguration;
  hasExistingThreats: boolean;
  onSave: (config: ThreatConfiguration) => void;
  onClose: () => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
  );
}

// ==================== COMPONENT ====================

export const ThreatConfigDialog: React.FC<ThreatConfigDialogProps> = ({
  open,
  configuration,
  hasExistingThreats,
  onSave,
  onClose,
}) => {
  const { t } = useTranslation();

  const [tabValue, setTabValue] = useState(0);
  const [activeMethod, setActiveMethod] = useState<StrideMethod>(
    configuration.activeMethod
  );
  const [zeroTrustMode, setZeroTrustMode] = useState(
    configuration.zeroTrustMode ?? false,
  );
  const [showThreatActor, setShowThreatActor] = useState(
    configuration.showThreatActor ?? false,
  );
  const [customThreats, setCustomThreats] = useState<ThreatTemplate[]>(
    configuration.customThreatTemplates
  );
  const [customMitigations, setCustomMitigations] = useState<MitigationTemplate[]>(
    configuration.customMitigationTemplates
  );
  const [customVerifications, setCustomVerifications] = useState<VerificationTemplate[]>(
    configuration.customVerificationTemplates
  );

  // New template states
  const [newThreatCategory, setNewThreatCategory] = useState<StrideCategory>("S");
  const [newThreatText, setNewThreatText] = useState("");
  const [newMitigationCategory, setNewMitigationCategory] = useState<StrideCategory>("S");
  const [newMitigationText, setNewMitigationText] = useState("");
  const [newVerificationCategory, setNewVerificationCategory] = useState<StrideCategory>("S");
  const [newVerificationText, setNewVerificationText] = useState("");

  const handleAddThreat = () => {
    if (!newThreatText.trim()) return;
    const template: ThreatTemplate = {
      id: `custom-threat-${Date.now()}`,
      strideCategory: newThreatCategory,
      elementTypes: ["Process", "DataFlow", "DataStore", "ExternalEntity"],
      threat: newThreatText,
      threatDE: newThreatText,
      attack: "",
      attackDE: "",
      isCustom: true,
    };
    setCustomThreats([...customThreats, template]);
    setNewThreatText("");
  };

  const handleAddMitigation = () => {
    if (!newMitigationText.trim()) return;
    const template: MitigationTemplate = {
      id: `custom-mitigation-${Date.now()}`,
      strideCategory: newMitigationCategory,
      mitigation: newMitigationText,
      mitigationDE: newMitigationText,
      isCustom: true,
    };
    setCustomMitigations([...customMitigations, template]);
    setNewMitigationText("");
  };

  const handleAddVerification = () => {
    if (!newVerificationText.trim()) return;
    const template: VerificationTemplate = {
      id: `custom-verification-${Date.now()}`,
      strideCategory: newVerificationCategory,
      verification: newVerificationText,
      verificationDE: newVerificationText,
      isCustom: true,
    };
    setCustomVerifications([...customVerifications, template]);
    setNewVerificationText("");
  };

  const handleSave = () => {
    onSave({
      activeMethod,
      zeroTrustMode,
      showThreatActor,
      customThreatTemplates: customThreats,
      customMitigationTemplates: customMitigations,
      customVerificationTemplates: customVerifications,
    });
  };

  const getStrideName = (type: StrideCategory): string =>
    t(`stride.${type}.name`, { defaultValue: type });

  const strideCategories: StrideCategory[] = ["S", "T", "R", "I", "D", "E"];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {t("tabs.threats.config.title", {
          defaultValue: "Threat Analysis Configuration",
        })}
      </DialogTitle>

      <DialogContent dividers>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
          <Tab
            label={t("tabs.threats.config.optionsTab", {
              defaultValue: "Options",
            })}
          />
          <Tab
            label={t("tabs.threats.config.threatsTab", {
              defaultValue: "Threats",
            })}
          />
          <Tab
            label={t("tabs.threats.config.mitigationsTab", {
              defaultValue: "Mitigations",
            })}
          />
          <Tab
            label={t("tabs.threats.config.verificationsTab", {
              defaultValue: "Verifications",
            })}
          />
        </Tabs>

        {/* Options Tab */}
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {/* Zero Trust Mode */}
            <Box>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Box>
                  <Typography fontWeight="medium">
                    {t("tabs.threats.config.zeroTrustMode", {
                      defaultValue: "Zero Trust Mode",
                    })}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t("tabs.threats.config.zeroTrustModeDesc", {
                      defaultValue:
                        "Generate threats from both sender AND receiver perspective for every data flow. " +
                        "Default: sender perspective only (+ receiver for cross-boundary flows).",
                    })}
                  </Typography>
                </Box>
                <Switch
                  checked={zeroTrustMode}
                  onChange={(e) => setZeroTrustMode(e.target.checked)}
                />
              </Box>
            </Box>

            <Divider />

            {/* Show Threat Actor */}
            <Box>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Box>
                  <Typography fontWeight="medium">
                    {t("tabs.threats.config.showThreatActor", {
                      defaultValue: "Show Threat Actor",
                    })}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t("tabs.threats.config.showThreatActorDesc", {
                      defaultValue:
                        "Display the Threat Actor column in threat tables. " +
                        "Default off — actor has limited value for likelihood assessment.",
                    })}
                  </Typography>
                </Box>
                <Switch
                  checked={showThreatActor}
                  onChange={(e) => setShowThreatActor(e.target.checked)}
                />
              </Box>
            </Box>
          </Box>
        </TabPanel>

        {/* Threats Tab */}
        <TabPanel value={tabValue} index={1}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t("tabs.threats.config.customThreatsInfo", {
              defaultValue: "Add custom threat templates to the catalog.",
            })}
          </Typography>

          <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>STRIDE</InputLabel>
              <Select
                value={newThreatCategory}
                label="STRIDE"
                onChange={(e) =>
                  setNewThreatCategory(e.target.value as StrideCategory)
                }
              >
                {strideCategories.map((cat) => (
                  <MenuItem key={cat} value={cat}>
                    {cat} - {getStrideName(cat)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              size="small"
              fullWidth
              label={t("tabs.threats.config.threatDescription", {
                defaultValue: "Threat Description",
              })}
              value={newThreatText}
              onChange={(e) => setNewThreatText(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleAddThreat()}
            />
            <IconButton onClick={handleAddThreat} color="primary">
              <AddIcon />
            </IconButton>
          </Box>

          <List dense>
            {customThreats.map((threat) => (
              <ListItem key={threat.id}>
                <Chip
                  label={threat.strideCategory}
                  size="small"
                  sx={{ mr: 1 }}
                />
                <ListItemText primary={threat.threat} />
                <ListItemSecondaryAction>
                  <IconButton
                    edge="end"
                    onClick={() =>
                      setCustomThreats(
                        customThreats.filter((t) => t.id !== threat.id),
                      )
                    }
                  >
                    <DeleteIcon />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
            {customThreats.length === 0 && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ py: 2, textAlign: "center" }}
              >
                {t("tabs.threats.config.noCustomThreats", {
                  defaultValue: "No custom threats defined",
                })}
              </Typography>
            )}
          </List>
        </TabPanel>

        {/* Mitigations Tab */}
        <TabPanel value={tabValue} index={2}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t("tabs.threats.config.customMitigationsInfo", {
              defaultValue: "Add custom mitigation templates to the catalog.",
            })}
          </Typography>

          <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>STRIDE</InputLabel>
              <Select
                value={newMitigationCategory}
                label="STRIDE"
                onChange={(e) =>
                  setNewMitigationCategory(e.target.value as StrideCategory)
                }
              >
                {strideCategories.map((cat) => (
                  <MenuItem key={cat} value={cat}>
                    {cat} - {getStrideName(cat)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              size="small"
              fullWidth
              label={t("tabs.threats.config.mitigationDescription", {
                defaultValue: "Mitigation",
              })}
              value={newMitigationText}
              onChange={(e) => setNewMitigationText(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleAddMitigation()}
            />
            <IconButton onClick={handleAddMitigation} color="primary">
              <AddIcon />
            </IconButton>
          </Box>

          <List dense>
            {customMitigations.map((mitigation) => (
              <ListItem key={mitigation.id}>
                <Chip
                  label={mitigation.strideCategory}
                  size="small"
                  sx={{ mr: 1 }}
                />
                <ListItemText primary={mitigation.mitigation} />
                <ListItemSecondaryAction>
                  <IconButton
                    edge="end"
                    onClick={() =>
                      setCustomMitigations(
                        customMitigations.filter((m) => m.id !== mitigation.id),
                      )
                    }
                  >
                    <DeleteIcon />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
            {customMitigations.length === 0 && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ py: 2, textAlign: "center" }}
              >
                {t("tabs.threats.config.noCustomMitigations", {
                  defaultValue: "No custom mitigations defined",
                })}
              </Typography>
            )}
          </List>
        </TabPanel>

        {/* Verifications Tab */}
        <TabPanel value={tabValue} index={3}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t("tabs.threats.config.customVerificationsInfo", {
              defaultValue: "Add custom verification templates to the catalog.",
            })}
          </Typography>

          <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>STRIDE</InputLabel>
              <Select
                value={newVerificationCategory}
                label="STRIDE"
                onChange={(e) =>
                  setNewVerificationCategory(e.target.value as StrideCategory)
                }
              >
                {strideCategories.map((cat) => (
                  <MenuItem key={cat} value={cat}>
                    {cat} - {getStrideName(cat)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              size="small"
              fullWidth
              label={t("tabs.threats.config.verificationDescription", {
                defaultValue: "Verification Method",
              })}
              value={newVerificationText}
              onChange={(e) => setNewVerificationText(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleAddVerification()}
            />
            <IconButton onClick={handleAddVerification} color="primary">
              <AddIcon />
            </IconButton>
          </Box>

          <List dense>
            {customVerifications.map((verification) => (
              <ListItem key={verification.id}>
                <Chip
                  label={verification.strideCategory}
                  size="small"
                  sx={{ mr: 1 }}
                />
                <ListItemText primary={verification.verification} />
                <ListItemSecondaryAction>
                  <IconButton
                    edge="end"
                    onClick={() =>
                      setCustomVerifications(
                        customVerifications.filter(
                          (v) => v.id !== verification.id,
                        ),
                      )
                    }
                  >
                    <DeleteIcon />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
            {customVerifications.length === 0 && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ py: 2, textAlign: "center" }}
              >
                {t("tabs.threats.config.noCustomVerifications", {
                  defaultValue: "No custom verifications defined",
                })}
              </Typography>
            )}
          </List>
        </TabPanel>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>
          {t("common.cancel", { defaultValue: "Cancel" })}
        </Button>
        <Button onClick={handleSave} variant="contained">
          {t("common.save", { defaultValue: "Save" })}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ThreatConfigDialog;