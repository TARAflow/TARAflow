// File: CreateAttackTreeDialog.tsx
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
} from "@mui/material";
import {
  Security as SecurityIcon,
  Warning as ThreatIcon,
  Assessment as RiskIcon,
  Search as StandaloneIcon,
} from "@mui/icons-material";

import {
  AttackTreeAnchor,
  AttackTreeAnchorType,
  AttackTreeProjectData,
  SecurityGoalType,
  ATTACK_TREE_TEMPLATES,
} from "../models/attacktree-types";

interface AttackTreeCreateDialogProps {
  open: boolean;
  project: AttackTreeProjectData;
  isCriticalWorkflow: boolean;
  onClose: () => void;
  onCreate: (anchor: AttackTreeAnchor, templateId?: string) => void;
}

export const AttackTreeCreateDialog: React.FC<AttackTreeCreateDialogProps> = ({
  open,
  project,
  isCriticalWorkflow,
  onClose,
  onCreate,
}) => {
  const { t } = useTranslation();

  const [anchorType, setAnchorType] = useState<AttackTreeAnchorType>(
    isCriticalWorkflow ? "asset" : "standalone",
  );
  const [selectedAssetId, setSelectedAssetId] = useState<string>("");
  const [selectedSecurityGoal, setSelectedSecurityGoal] = useState<string>("");
  const [selectedThreatId, setSelectedThreatId] = useState<string>("");
  const [selectedRiskId, setSelectedRiskId] = useState<string>("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

  const assets = project.assets || [];
  const threats = project.threats || [];
  const risks = project.risks || [];

  const selectedAsset = assets.find((a) => a.id === selectedAssetId);
  const enabledSecurityGoals =
    selectedAsset?.securityGoals.filter((sg) => sg.enabled) || [];

  const handleCreate = () => {
    let anchor: AttackTreeAnchor;

    switch (anchorType) {
      case "asset": {
        const asset = assets.find((a) => a.id === selectedAssetId);
        anchor = {
          type: "asset",
          assetId: selectedAssetId,
          assetName: asset ? asset.name : undefined,
          securityGoal: selectedSecurityGoal as SecurityGoalType,
        };
        break;
      }
      case "threat": {
        const threat = threats.find((t) => t.id === selectedThreatId);
        anchor = {
          type: "threat",
          threatId: selectedThreatId,
          threatTitle: threat
            ? threat.threatDescription.substring(0, 50)
            : undefined,
          strideCategory: threat ? threat.strideCategory : undefined,
        };
        break;
      }
      case "risk": {
        const risk = risks.find((r) => r.id === selectedRiskId);
        anchor = {
          type: "risk",
          riskId: selectedRiskId,
          riskLevel: risk
            ? String(risk.calculatedRiskBeforeMitigation)
            : undefined,
          moscowPriority: risk ? risk.moscowPriority : undefined,
        };
        break;
      }
      case "standalone":
      default:
        anchor = { type: "standalone" };
    }

    onCreate(anchor, selectedTemplateId || undefined);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {t("attacktree:tabs.attacktree.createDialog.createNewAttackTree")}
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {/* Anchor Type Selection */}
          <Typography variant="subtitle2">
            {t("attacktree:tabs.attacktree.createDialog.anchorType")}
          </Typography>

          <List dense>
            <ListItem disablePadding>
              <ListItemButton
                selected={anchorType === "asset"}
                onClick={() => setAnchorType("asset")}
              >
                <ListItemIcon>
                  <SecurityIcon
                    color={anchorType === "asset" ? "primary" : "inherit"}
                  />
                </ListItemIcon>
                <ListItemText
                  primary={t(
                    "attacktree:tabs.attacktree.createDialog.assetBased",
                  )}
                  secondary={t(
                    "attacktree:tabs.attacktree.createDialog.attackTreeForASpecificAssetCriti",
                  )}
                />
              </ListItemButton>
            </ListItem>

            <ListItem disablePadding>
              <ListItemButton
                selected={anchorType === "threat"}
                onClick={() => setAnchorType("threat")}
              >
                <ListItemIcon>
                  <ThreatIcon
                    color={anchorType === "threat" ? "primary" : "inherit"}
                  />
                </ListItemIcon>
                <ListItemText
                  primary={t(
                    "attacktree:tabs.attacktree.createDialog.threatBased",
                  )}
                  secondary={t(
                    "attacktree:tabs.attacktree.createDialog.detailedAnalysisOfAnExistingThre",
                  )}
                />
              </ListItemButton>
            </ListItem>

            <ListItem disablePadding>
              <ListItemButton
                selected={anchorType === "risk"}
                onClick={() => setAnchorType("risk")}
              >
                <ListItemIcon>
                  <RiskIcon
                    color={anchorType === "risk" ? "primary" : "inherit"}
                  />
                </ListItemIcon>
                <ListItemText
                  primary={t(
                    "attacktree:tabs.attacktree.createDialog.riskBased",
                  )}
                  secondary={t(
                    "attacktree:tabs.attacktree.createDialog.deepDiveForHighRiskOrUncertainAs",
                  )}
                />
              </ListItemButton>
            </ListItem>

            <ListItem disablePadding>
              <ListItemButton
                selected={anchorType === "standalone"}
                onClick={() => setAnchorType("standalone")}
              >
                <ListItemIcon>
                  <StandaloneIcon
                    color={anchorType === "standalone" ? "primary" : "inherit"}
                  />
                </ListItemIcon>
                <ListItemText
                  primary={t(
                    "attacktree:tabs.attacktree.createDialog.standalone",
                  )}
                  secondary={t(
                    "attacktree:tabs.attacktree.createDialog.exploratoryAnalysisWithoutAnchor",
                  )}
                />
              </ListItemButton>
            </ListItem>
          </List>

          {/* Asset Selection */}
          {anchorType === "asset" && (
            <>
              <FormControl fullWidth size="small">
                <InputLabel>
                  {t("attacktree:tabs.attacktree.createDialog.asset")}
                </InputLabel>
                <Select
                  value={selectedAssetId}
                  label={t("attacktree:tabs.attacktree.createDialog.asset")}
                  onChange={(e) => setSelectedAssetId(e.target.value)}
                >
                  {assets.map((asset) => (
                    <MenuItem key={asset.id} value={asset.id}>
                      {asset.id}: {asset.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {selectedAssetId && (
                <FormControl fullWidth size="small">
                  <InputLabel>
                    {t("attacktree:tabs.attacktree.createDialog.securityGoal")}
                  </InputLabel>
                  <Select
                    value={selectedSecurityGoal}
                    label={t(
                      "attacktree:tabs.attacktree.createDialog.securityGoal",
                    )}
                    onChange={(e) =>
                      setSelectedSecurityGoal(
                        e.target.value as SecurityGoalType,
                      )
                    }
                  >
                    {(
                      [
                        "C",
                        "I",
                        "A",
                        "N",
                        "AuthZ",
                        "AuthN",
                        "Acc",
                      ] as SecurityGoalType[]
                    ).map((goal) => {
                      const isEnabled = enabledSecurityGoals.some(
                        (sg) => sg.type === goal,
                      );
                      return (
                        <MenuItem
                          key={goal}
                          value={goal}
                          sx={{
                            fontWeight: isEnabled ? "bold" : "normal",
                            backgroundColor: isEnabled
                              ? "action.hover"
                              : "inherit",
                          }}
                        >
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 1,
                            }}
                          >
                            <span>{goal}</span>
                            {isEnabled && (
                              <Chip
                                label={t(
                                  "attacktree:tabs.attacktree.createDialog.assetGoal",
                                )}
                                size="small"
                                color="primary"
                                variant="outlined"
                              />
                            )}
                          </Box>
                        </MenuItem>
                      );
                    })}
                  </Select>
                </FormControl>
              )}
            </>
          )}

          {/* Threat Selection */}
          {anchorType === "threat" && (
            <FormControl fullWidth size="small">
              <InputLabel>
                {t("attacktree:tabs.attacktree.createDialog.threat")}
              </InputLabel>
              <Select
                value={selectedThreatId}
                label={t("attacktree:tabs.attacktree.createDialog.threat")}
                onChange={(e) => setSelectedThreatId(e.target.value)}
              >
                {threats.map((threat) => (
                  <MenuItem key={threat.id} value={threat.id}>
                    {threat.id}: {threat.threatDescription.substring(0, 50)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {/* Risk Selection */}
          {anchorType === "risk" && (
            <FormControl fullWidth size="small">
              <InputLabel>
                {t("attacktree:tabs.attacktree.createDialog.risk")}
              </InputLabel>
              <Select
                value={selectedRiskId}
                label={t("attacktree:tabs.attacktree.createDialog.risk")}
                onChange={(e) => setSelectedRiskId(e.target.value)}
              >
                {risks.map((risk) => (
                  <MenuItem key={risk.id} value={risk.id}>
                    {risk.id} [{risk.moscowPriority}] - Risk:{" "}
                    {risk.calculatedRiskBeforeMitigation}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {/* Template Selection */}
          <Divider />
          <Typography variant="subtitle2">
            {t("attacktree:tabs.attacktree.createDialog.templateOptional")}
          </Typography>

          <FormControl fullWidth size="small">
            <InputLabel>
              {t("attacktree:tabs.attacktree.createDialog.template")}
            </InputLabel>
            <Select
              value={selectedTemplateId}
              label={t("attacktree:tabs.attacktree.createDialog.template")}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
            >
              <MenuItem value="">
                {t("attacktree:tabs.attacktree.createDialog.startEmpty")}
              </MenuItem>
              {ATTACK_TREE_TEMPLATES.filter(
                (t) => t.suitableFor.indexOf(anchorType) >= 0,
              ).map((template) => (
                <MenuItem key={template.id} value={template.id}>
                  {t(`attacktree:tabs.attacktree.templates.${template.id}`)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>
          {t("attacktree:tabs.attacktree.createDialog.cancel")}
        </Button>
        <Button
          variant="contained"
          onClick={handleCreate}
          disabled={anchorType === "asset" && !selectedAssetId}
        >
          {t("attacktree:tabs.attacktree.createDialog.create")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};