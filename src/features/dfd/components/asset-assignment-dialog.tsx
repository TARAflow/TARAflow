// ==================== ASSET ASSIGNMENT DIALOG ====================
// Context-menu triggered dialog for quick asset assignment to DFD elements.
// Uses the new single-relationType model (discriminated union).
//
// Note: Long-term this workflow will be replaced by the form-based
// asset relation editor in element description forms.

import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Checkbox,
  Box,
  Typography,
  Chip,
  TextField,
  InputAdornment,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import type { AssetRelation, DFDElementType } from "../models/dfd-types";
import type { DFDAsset } from "../models/dfd-asset-types";
import {
  getAllowedRelations,
  ASSET_GROUP_TAB_ORDER,
} from "../models/asset-constants";
import {
  getAssetGroupText,
  getRelationTypeText,
} from "../models/dfd-formatters";
import { AnyAssetRelationType, AssetGroup } from "shared";

// ==================== TYPES ====================

interface AssetAssignmentDialogProps {
  open: boolean;
  onClose: () => void;
  elementId: string | null;
  elementLabel: string | null;
  elementType: DFDElementType | null | undefined;
  availableAssets: DFDAsset[];
  currentAssignments: AssetRelation[];
  onSave: (relations: AssetRelation[]) => void;
}

// ==================== HELPERS ====================

function getDefaultRelationType(
  elementType: DFDElementType,
  assetGroup: AssetGroup,
): AnyAssetRelationType | undefined {
  const allowed = getAllowedRelations(elementType, assetGroup);
  return allowed[0] as AnyAssetRelationType | undefined;
}

function buildRelation(
  assetId: string,
  assetGroup: AssetGroup,
  relationType: AnyAssetRelationType,
): AssetRelation {
  if (relationType === "is_an") {
    return { relationType: "is_an", assetId, assetGroup } as AssetRelation;
  }
  return { relationType, assetId, assetGroup } as AssetRelation;
}

// ==================== COMPONENT ====================

export const AssetAssignmentDialog: React.FC<AssetAssignmentDialogProps> = ({
  open,
  onClose,
  elementId,
  elementLabel,
  elementType,
  availableAssets,
  currentAssignments,
  onSave,
}) => {
  const { t } = useTranslation();
  const [relations, setRelations] = useState<AssetRelation[]>(currentAssignments);
  const [searchQuery, setSearchQuery] = useState("");
  const [assetConfig, setAssetConfig] = useState<
    Record<
      string,
      { assetGroup: AssetGroup; relationType: AnyAssetRelationType }
    >
  >({});

  useEffect(() => {
    if (open) {
      setRelations(currentAssignments);
      setSearchQuery("");
      setAssetConfig({});
    }
  }, [open, currentAssignments]);

  const allowedGroups = elementType
    ? ASSET_GROUP_TAB_ORDER.filter(
        (g) => getAllowedRelations(elementType, g).length > 0,
      )
    : [];

  const canAssignAssets = allowedGroups.length > 0;

  const filteredAssets = availableAssets.filter(
    (asset) =>
      asset.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.description?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const isAssetAssigned = (assetId: string) =>
    relations.some((r) => r.assetId === assetId);

  const getConfigForAsset = (assetId: string, fallbackGroup?: AssetGroup) => {
    if (assetConfig[assetId]) return assetConfig[assetId];
    const group = fallbackGroup ?? allowedGroups[0];
    const relationType = elementType
      ? (getDefaultRelationType(elementType, group) ??
        ("reads" as AnyAssetRelationType))
      : ("reads" as AnyAssetRelationType);
    return { assetGroup: group, relationType };
  };

  const handleToggleAsset = (assetId: string, fallbackGroup?: AssetGroup) => {
    if (isAssetAssigned(assetId)) {
      setRelations((prev) => prev.filter((r) => r.assetId !== assetId));
    } else {
      const config = getConfigForAsset(assetId, fallbackGroup);
      setRelations((prev) => [
        ...prev,
        buildRelation(assetId, config.assetGroup, config.relationType),
      ]);
    }
  };

  const handleGroupChange = (assetId: string, assetGroup: AssetGroup) => {
    const relationType = elementType
      ? (getDefaultRelationType(elementType, assetGroup) ??
        ("reads" as AnyAssetRelationType))
      : ("reads" as AnyAssetRelationType);
    const newConfig = { assetGroup, relationType };
    setAssetConfig((prev) => ({ ...prev, [assetId]: newConfig }));
    if (isAssetAssigned(assetId)) {
      setRelations((prev) =>
        prev.map((r) =>
          r.assetId === assetId
            ? buildRelation(assetId, assetGroup, relationType)
            : r,
        ),
      );
    }
  };

  const handleRelationTypeChange = (
    assetId: string,
    relationType: AnyAssetRelationType,
  ) => {
    const group = assetConfig[assetId]?.assetGroup ?? allowedGroups[0];
    setAssetConfig((prev) => ({
      ...prev,
      [assetId]: { assetGroup: group, relationType },
    }));
    if (isAssetAssigned(assetId)) {
      setRelations((prev) =>
        prev.map((r) =>
          r.assetId === assetId
            ? buildRelation(assetId, group, relationType)
            : r,
        ),
      );
    }
  };

  const handleSave = () => {
    if (elementId) {
      onSave(relations);
      onClose();
    }
  };

  const assignedCount = relations.length;
  const hasChanges =
    JSON.stringify(
      [...relations].sort((a, b) => a.assetId.localeCompare(b.assetId)),
    ) !==
    JSON.stringify(
      [...currentAssignments].sort((a, b) =>
        a.assetId.localeCompare(b.assetId),
      ),
    );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { height: "75vh" } }}
    >
      <DialogTitle>
        <Box>
          <Typography variant="h6" gutterBottom>
            Manage Assets
          </Typography>
          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            <Typography variant="body2" color="text.secondary">
              Element: <strong>{elementLabel || elementId}</strong>
            </Typography>
            <Chip
              label={elementType || "unknown"}
              size="small"
              variant="outlined"
            />
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {!canAssignAssets ? (
          <Box sx={{ textAlign: "center", py: 4 }}>
            <Typography color="text.secondary">
              Elements of type <strong>{elementType}</strong> cannot have assets
              assigned.
            </Typography>
          </Box>
        ) : (
          <>
            <TextField
              fullWidth
              size="small"
              placeholder="Search assets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 2 }}
            />

            <Box sx={{ mb: 2, display: "flex", alignItems: "center", gap: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Assigned:
              </Typography>
              <Chip
                label={assignedCount}
                size="small"
                color={assignedCount > 0 ? "primary" : "default"}
              />
              {hasChanges && (
                <Chip
                  label="Modified"
                  size="small"
                  color="warning"
                  variant="outlined"
                />
              )}
            </Box>

            <Divider sx={{ mb: 2 }} />

            {filteredAssets.length === 0 ? (
              <Box sx={{ textAlign: "center", py: 4 }}>
                <Typography color="text.secondary">
                  {searchQuery
                    ? "No assets match your search"
                    : "No assets available"}
                </Typography>
              </Box>
            ) : (
              <List sx={{ pt: 0 }}>
                {filteredAssets.map((asset) => {
                  const assigned = isAssetAssigned(asset.id);
                  const config = getConfigForAsset(
                    asset.id,
                    asset.assetGroup ?? allowedGroups[0],
                  );
                  const allowedTypes = elementType
                    ? getAllowedRelations(elementType, config.assetGroup)
                    : [];

                  return (
                    <Box key={asset.id} sx={{ mb: 1 }}>
                      <ListItem
                        onClick={() =>
                          handleToggleAsset(asset.id, asset.assetGroup)
                        }
                        sx={{
                          borderRadius: 1,
                          cursor: "pointer",
                          bgcolor: assigned ? "action.selected" : undefined,
                        }}
                      >
                        <ListItemIcon>
                          <Checkbox
                            edge="start"
                            checked={assigned}
                            tabIndex={-1}
                            disableRipple
                          />
                        </ListItemIcon>
                        <ListItemText
                          primary={asset.name}
                          secondary={asset.description || "No description"}
                          primaryTypographyProps={{
                            fontWeight: assigned ? 600 : 400,
                          }}
                        />
                      </ListItem>

                      {/* Group + RelationType selectors shown when assigned */}
                      {assigned && (
                        <Box
                          sx={{ pl: 9, pr: 2, pb: 1, display: "flex", gap: 1 }}
                        >
                          <FormControl size="small" sx={{ minWidth: 130 }}>
                            <InputLabel>Group</InputLabel>
                            <Select
                              value={config.assetGroup}
                              label="Group"
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) =>
                                handleGroupChange(
                                  asset.id,
                                  e.target.value as AssetGroup,
                                )
                              }
                            >
                              {allowedGroups.map((g) => (
                                <MenuItem key={g} value={g}>
                                  {getAssetGroupText(g, t)}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>

                          <FormControl size="small" sx={{ minWidth: 160 }}>
                            <InputLabel>Relation</InputLabel>
                            <Select
                              value={config.relationType}
                              label="Relation"
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) =>
                                handleRelationTypeChange(
                                  asset.id,
                                  e.target.value as AnyAssetRelationType,
                                )
                              }
                            >
                              {allowedTypes.map((relType) => (
                                <MenuItem key={relType} value={relType}>
                                  {getRelationTypeText(
                                    relType as AnyAssetRelationType,
                                    config.assetGroup,
                                    t,
                                  )}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Box>
                      )}
                    </Box>
                  );
                })}
              </List>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={!hasChanges || !canAssignAssets}
        >
          Save ({assignedCount})
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AssetAssignmentDialog;