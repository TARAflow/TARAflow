// ==================== ASSET-TO-ASSET SELECTOR ====================
// Layer 2: Asset-to-Asset relations on a DFDAsset.
//
// Displays existing A2A relations as a list, each with:
//   relationType chip | targetGroup/targetAssetId | degradationMode badge | delete
//
// "+ Add relation" opens AssetToAssetDialog:
//   1. Select target asset via tab-based group picker
//   2. Select relationType from allowed A2ARelationType list
//   3. Optional: stepOrder, rationale, degradationMode + degradationDescription
//
// Props:
//   asset           — the source asset (owner of these relations)
//   allAssets       — all DFDAssets available as targets (excluding self)
//   onChange        — called when relations array changes

import React, { useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";

import type { AssetGroup } from "../../models/dfd-types";
import type { DFDAsset } from "../../models/dfd-asset-types";
import type { A2ARelationType, AssetToAssetRelation } from "../../models/asset-relation-types";
import { getAllowedA2ARelations } from "../../models/asset-constants";
import { getAssetGroupColor } from "../../models/dfd-formatters";

// ==================== CONSTANTS ====================

const ASSET_GROUPS: AssetGroup[] = [
  "data", "function", "system", "infrastructure",
  "process", "physical", "service", "human",
];

const GROUP_LABEL: Record<AssetGroup, string> = {
  data: "Data",
  function: "Function",
  system: "System",
  infrastructure: "Infrastructure",
  process: "Process",
  physical: "Physical",
  service: "Service",
  human: "People",
  environment: "Environment",
};

// Relation matrix imported from asset-constants — single source of truth

// ==================== TYPES ====================

interface AssetToAssetSelectorProps {
  asset: DFDAsset;
  allAssets: DFDAsset[];
  onChange: (relations: AssetToAssetRelation[]) => void;
}

// ==================== HELPERS ====================

function getRelations(asset: DFDAsset): AssetToAssetRelation[] {
  return (asset as any).assetRelations ?? [];
}

// ==================== DIALOG ====================

interface A2ADialogProps {
  open: boolean;
  onClose: () => void;
  sourceAsset: DFDAsset;
  allAssets: DFDAsset[];
  existingRelations: AssetToAssetRelation[];
  onSave: (relation: AssetToAssetRelation) => void;
}

const AssetToAssetDialog: React.FC<A2ADialogProps> = ({
  open,
  onClose,
  sourceAsset,
  allAssets,
  existingRelations,
  onSave,
}) => {
  const { t } = useTranslation();

  const [selectedGroup, setSelectedGroup] = useState<AssetGroup>("data");
  const [targetAssetId, setTargetAssetId] = useState("");
  const [relationType, setRelationType] = useState<A2ARelationType | "">("");
  const [stepOrder, setStepOrder] = useState("");
  const [rationale, setRationale] = useState("");
  const [degradationMode, setDegradationMode] = useState(false);
  const [degradationDescription, setDegradationDescription] = useState("");

  // Reset on open
  React.useEffect(() => {
    if (!open) return;
    setTargetAssetId("");
    setRelationType("");
    setStepOrder("");
    setRationale("");
    setDegradationMode(false);
    setDegradationDescription("");
    // Auto-select first group with available targets
    const alreadyTargeted = new Set(existingRelations.map((r) => r.targetAssetId));
    const first = ASSET_GROUPS.find((g) =>
      allAssets.some((a) => a.id !== sourceAsset.id && a.assetGroup === g && !alreadyTargeted.has(a.id))
    );
    if (first) setSelectedGroup(first);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const alreadyTargeted = useMemo(
    () => new Set(existingRelations.map((r) => r.targetAssetId)),
    [existingRelations],
  );

  const availableTargets = useMemo(
    () => allAssets.filter(
      (a) => a.id !== sourceAsset.id && a.assetGroup === selectedGroup && !alreadyTargeted.has(a.id)
    ),
    [allAssets, sourceAsset.id, selectedGroup, alreadyTargeted],
  );

  const groupsWithTargets = useMemo(
    () => ASSET_GROUPS.filter((g) =>
      allAssets.some((a) => a.id !== sourceAsset.id && a.assetGroup === g && !alreadyTargeted.has(a.id))
    ),
    [allAssets, sourceAsset.id, alreadyTargeted],
  );

  const targetAsset = allAssets.find((a) => a.id === targetAssetId);

  const allowedTypes = useMemo(
    () => targetAsset ? getAllowedA2ARelations(sourceAsset.assetGroup, targetAsset.assetGroup) : [],
    [sourceAsset.assetGroup, targetAsset],
  );

  // Reset relationType when target changes and current type is no longer valid
  React.useEffect(() => {
    if (relationType && !allowedTypes.includes(relationType as A2ARelationType)) {
      setRelationType("");
    }
  }, [allowedTypes, relationType]);

  const isDependsOn = relationType === "depends_on";
  const needsDegradationDesc = isDependsOn && degradationMode && !degradationDescription.trim();
  const canSave = !!targetAssetId && !!relationType && !needsDegradationDesc;

  const handleSave = () => {
    if (!targetAssetId || !relationType || !targetAsset) return;
    const relation: AssetToAssetRelation = {
      sourceGroup: sourceAsset.assetGroup,
      targetGroup: targetAsset.assetGroup,
      targetAssetId,
      relationType: relationType as A2ARelationType,
      ...(stepOrder.trim() ? { stepOrder: parseInt(stepOrder, 10) } : {}),
      ...(rationale.trim() ? { rationale: rationale.trim() } : {}),
      ...(isDependsOn ? { degradationMode } : {}),
      ...(isDependsOn && degradationMode && degradationDescription.trim()
        ? { degradationDescription: degradationDescription.trim() }
        : {}),
    };
    onSave(relation);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {t("assets.relations.a2a.addRelation", {
          defaultValue: "Add Asset Relation",
        })}
      </DialogTitle>

      <DialogContent dividers sx={{ p: 2 }}>
        <Stack spacing={2}>
          {/* Source asset header */}
          <Paper variant="outlined" sx={{ p: 1.25, bgcolor: "action.hover" }}>
            <Typography variant="caption" color="text.secondary">From</Typography>
            <Typography variant="body2" fontWeight={600}>
              {sourceAsset.displayId} · {sourceAsset.name || "Unnamed"}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {GROUP_LABEL[sourceAsset.assetGroup]}
            </Typography>
          </Paper>

          {/* Target asset selection — tab-based */}
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block" }}>
              {t("assets.relations.a2a.selectTarget", { defaultValue: "Target Asset" })}
            </Typography>

            {groupsWithTargets.length === 0 ? (
              <Alert severity="info" sx={{ py: 0.5 }}>
                <Typography variant="caption">
                  {t("assets.relations.a2a.noTargets", {
                    defaultValue: "All assets are already related to this asset.",
                  })}
                </Typography>
              </Alert>
            ) : (
              <Stack spacing={1}>
                <Tabs
                  value={groupsWithTargets.includes(selectedGroup) ? selectedGroup : groupsWithTargets[0]}
                  onChange={(_, g) => { setSelectedGroup(g); setTargetAssetId(""); setRelationType(""); }}
                  variant="scrollable"
                  scrollButtons="auto"
                  sx={{ borderBottom: 1, borderColor: "divider", minHeight: 36 }}
                >
                  {groupsWithTargets.map((g) => {
                    const count = allAssets.filter(
                      (a) => a.id !== sourceAsset.id && a.assetGroup === g && !alreadyTargeted.has(a.id)
                    ).length;
                    const colors = getAssetGroupColor(g);
                    return (
                      <Tab key={g} value={g}
                        sx={{ minHeight: 36, py: 0.5, fontSize: 12 }}
                        label={
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            <span>{GROUP_LABEL[g]}</span>
                            <Chip label={count} size="small"
                              sx={{
                                height: 16, fontSize: 10, "& .MuiChip-label": { px: 0.5 },
                                bgcolor: selectedGroup === g ? colors.colorLight : undefined,
                                color: selectedGroup === g ? colors.color : undefined,
                              }} />
                          </Stack>
                        }
                      />
                    );
                  })}
                </Tabs>

                <Box sx={{ maxHeight: 180, overflow: "auto" }}>
                  {availableTargets.length === 0 ? (
                    <Typography variant="caption" color="text.disabled" sx={{ p: 1, display: "block" }}>
                      No available assets in this group
                    </Typography>
                  ) : (
                    <List dense disablePadding>
                      {availableTargets.map((a) => {
                        const isSelected = targetAssetId === a.id;
                        const colors = getAssetGroupColor(a.assetGroup);
                        return (
                          <ListItem key={a.id} disablePadding>
                            <ListItemButton selected={isSelected}
                              onClick={() => setTargetAssetId(a.id)}
                              sx={{ py: 0.5, borderRadius: 0.5,
                                "&.Mui-selected": { bgcolor: colors.colorLight } }}
                            >
                              <ListItemText
                                primary={
                                  <Stack direction="row" spacing={1} alignItems="center">
                                    <Typography variant="caption"
                                      sx={{ fontFamily: "monospace", color: colors.color, minWidth: 52 }}>
                                      {a.displayId}
                                    </Typography>
                                    <Typography variant="body2">
                                      {a.name || <em style={{ opacity: 0.5 }}>unnamed</em>}
                                    </Typography>
                                  </Stack>
                                }
                              />
                            </ListItemButton>
                          </ListItem>
                        );
                      })}
                    </List>
                  )}
                </Box>
              </Stack>
            )}
          </Box>

          {/* Relation type */}
          {targetAssetId && (
            allowedTypes.length === 0 ? (
              <Alert severity="info" sx={{ py: 0.5 }}>
                <Typography variant="caption">
                  {t("assets.relations.a2a.noRelationTypes", {
                    defaultValue: "No defined relation types for this source → target combination.",
                  })}
                </Typography>
              </Alert>
            ) : (
              <FormControl fullWidth size="small" required>
                <InputLabel>
                  {t("assets.relations.a2a.relationType", { defaultValue: "Relation Type" })}
                </InputLabel>
                <Select
                  value={relationType}
                  onChange={(e) => setRelationType(e.target.value as A2ARelationType)}
                  label={t("assets.relations.a2a.relationType", { defaultValue: "Relation Type" })}
                >
                  {allowedTypes.map((rt) => (
                    <MenuItem key={rt} value={rt}>
                      <Box component="span" sx={{ fontFamily: "monospace", mr: 1 }}>{rt}</Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )
          )}

          {/* degradationMode — only for depends_on */}
          {isDependsOn && (
            <Stack spacing={1}>
              <FormControl size="small" fullWidth>
                <InputLabel>
                  {t("tabs.dfd.element_description.assetRelations.degradationMode.label",
                    { defaultValue: "Dependency Mode" })}
                </InputLabel>
                <Select
                  value={degradationMode ? "degraded" : "total"}
                  onChange={(e) => setDegradationMode(e.target.value === "degraded")}
                  label={t("tabs.dfd.element_description.assetRelations.degradationMode.label",
                    { defaultValue: "Dependency Mode" })}
                >
                  <MenuItem value="total">
                    <Box>
                      <Box sx={{ fontWeight: 500 }}>Total failure</Box>
                      <Box sx={{ fontSize: 11, color: "text.secondary" }}>Full criticality propagation</Box>
                    </Box>
                  </MenuItem>
                  <MenuItem value="degraded">
                    <Box>
                      <Box sx={{ fontWeight: 500 }}>Degraded mode</Box>
                      <Box sx={{ fontSize: 11, color: "text.secondary" }}>Continues with reduced function</Box>
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
              {degradationMode && (
                <TextField size="small" fullWidth required
                  label={t("tabs.dfd.element_description.assetRelations.degradationMode.description",
                    { defaultValue: "Fallback description (required)" })}
                  placeholder="e.g. Local cache available for 24h, then failure"
                  value={degradationDescription}
                  onChange={(e) => setDegradationDescription(e.target.value)}
                  error={!degradationDescription.trim()}
                  helperText={!degradationDescription.trim()
                    ? t("tabs.dfd.element_description.assetRelations.degradationMode.required",
                        { defaultValue: "Required for audit trail (IEC 62443-4-1)" })
                    : undefined}
                  multiline rows={2}
                />
              )}
            </Stack>
          )}

          {/* stepOrder — for invokes and configures (sequential step index) */}
          {(relationType === "invokes" || relationType === "configures") && (
            <TextField size="small"
              label={t("assets.relations.a2a.stepOrder", { defaultValue: "Step Order (optional)" })}
              placeholder="1"
              value={stepOrder}
              onChange={(e) => setStepOrder(e.target.value.replace(/\D/g, ""))}
              helperText="Sequential index for attack-path / sequencing analysis"
              inputProps={{ inputMode: "numeric" }}
            />
          )}

          {/* Rationale */}
          {relationType && (
            <TextField size="small" fullWidth multiline rows={2}
              label={t("assets.relations.a2a.rationale", { defaultValue: "Rationale (optional)" })}
              placeholder="Why does this relation exist?"
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
            />
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 2, py: 1.5 }}>
        <Button onClick={onClose} size="small">
          {t("common.cancel", { defaultValue: "Cancel" })}
        </Button>
        <Button variant="contained" size="small" onClick={handleSave} disabled={!canSave}>
          {t("common.add", { defaultValue: "Add" })}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ==================== MAIN COMPONENT ====================

export const AssetToAssetSelector: React.FC<AssetToAssetSelectorProps> = ({
  asset,
  allAssets,
  onChange,
}) => {
  const { t } = useTranslation();
  const [dialogOpen, setDialogOpen] = useState(false);

  const relations = getRelations(asset);

  const handleAdd = useCallback((relation: AssetToAssetRelation) => {
    onChange([...relations, relation]);
  }, [relations, onChange]);

  const handleRemove = useCallback((idx: number) => {
    onChange(relations.filter((_, i) => i !== idx));
  }, [relations, onChange]);

  return (
    <Stack spacing={2}>
      {/* Existing relations */}
      {relations.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 2, textAlign: "center" }}>
          <Typography variant="body2" color="text.disabled" sx={{ fontStyle: "italic" }}>
            {t("assets.relations.a2a.noRelations", {
              defaultValue: "No asset-to-asset relations defined.",
            })}
          </Typography>
        </Paper>
      ) : (
        <Stack spacing={0.75}>
          {relations.map((rel, idx) => {
            const targetAsset = allAssets.find((a) => a.id === rel.targetAssetId);
            const colors = getAssetGroupColor(rel.targetGroup);
            return (
              <Paper key={idx} variant="outlined" sx={{ px: 1.5, py: 1 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip label={rel.relationType} size="small"
                    sx={{
                      fontFamily: "monospace", fontSize: 11,
                      bgcolor: colors.colorLight, color: colors.color,
                      border: `1px solid ${colors.color}`,
                    }} />
                  <Typography variant="body2" sx={{ flexGrow: 1 }}>
                    <Box component="span" sx={{ fontFamily: "monospace", color: "text.secondary", mr: 0.5 }}>
                      {targetAsset?.displayId ?? rel.targetAssetId}
                    </Box>
                    {targetAsset?.name || rel.targetAssetId}
                  </Typography>
                  {rel.degradationMode && (
                    <Chip label="degraded" size="small" color="warning" variant="outlined"
                      sx={{ fontSize: 10, height: 18 }} />
                  )}
                  {rel.stepOrder !== undefined && (
                    <Chip label={`#${rel.stepOrder}`} size="small" variant="outlined"
                      sx={{ fontSize: 10, height: 18 }} />
                  )}
                  <Tooltip title={t("common.delete", { defaultValue: "Delete" })}>
                    <IconButton size="small" onClick={() => handleRemove(idx)}
                      sx={{ color: "error.main", opacity: 0.6, "&:hover": { opacity: 1 } }}>
                      <DeleteOutlineIcon sx={{ fontSize: 15 }} />
                    </IconButton>
                  </Tooltip>
                </Stack>
                {rel.rationale && (
                  <Typography variant="caption" color="text.secondary" sx={{ pl: 0.5, display: "block", mt: 0.25 }}>
                    {rel.rationale}
                  </Typography>
                )}
                {rel.degradationMode && rel.degradationDescription && (
                  <Typography variant="caption" color="warning.main" sx={{ pl: 0.5, display: "block", mt: 0.25 }}>
                    Fallback: {rel.degradationDescription}
                  </Typography>
                )}
              </Paper>
            );
          })}
        </Stack>
      )}

      {/* Add button */}
      <Button size="small" startIcon={<AddIcon />} variant="outlined"
        onClick={() => setDialogOpen(true)}
        sx={{ alignSelf: "flex-start" }}
      >
        {t("assets.relations.a2a.add", { defaultValue: "Add Relation" })}
      </Button>

      <AssetToAssetDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        sourceAsset={asset}
        allAssets={allAssets}
        existingRelations={relations}
        onSave={handleAdd}
      />
    </Stack>
  );
};

export default AssetToAssetSelector;