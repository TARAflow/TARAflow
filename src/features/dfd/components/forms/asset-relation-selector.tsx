// ==================== ASSET RELATION SELECTOR ====================
// Manages asset-element relationships using the new typed relation model.
// Each relation has a single relationType + assetGroup + optional qualifier.
// Used in element description forms (Process, DataStore, DataFlow, etc.)

import React, { useState, useCallback } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Typography,
  Stack,
  IconButton,
  Chip,
  Alert,
} from "@mui/material";
import { Add as AddIcon, Delete as DeleteIcon } from "@mui/icons-material";
import type { AssetRelation, DFDElementType } from "../../models/dfd-types";
import type {
  AssetGroup,
  AnyAssetRelationType,
  SystemUsesQualifier,
  InfraAccessesQualifier,
} from "../../models/asset-relation-types";
import {
  getAllowedRelations,
  hasAnyAllowedRelations,
  ASSET_GROUP_TAB_ORDER,
  ASSET_GROUP_CONFIG,
} from "../../models/asset-constants";
import {
  getRelationTypeText,
  getAssetGroupText,
} from "../../models/dfd-formatters";

// ==================== TYPES ====================

export interface AvailableAsset {
  id: string;
  name: string;
  displayId: string;
  assetGroup?: AssetGroup;
  protectionNeed?: "low" | "medium" | "high" | "critical";
}

interface AssetRelationSelectorProps {
  /** Current asset relations */
  assetRelations: AssetRelation[];
  /** Element type — determines which asset groups and relation types are allowed */
  elementType: DFDElementType;
  /** Available assets for selection */
  availableAssets: AvailableAsset[];
  /** Callback when relations change */
  onChange: (relations: AssetRelation[]) => void;
}

// ==================== HELPERS ====================

const PROTECTION_NEED_COLOR: Record<string, "error" | "warning" | "info" | "success" | "default"> = {
  critical: "error",
  high: "warning",
  medium: "info",
  low: "success",
};

function buildRelation(
  assetId: string,
  assetGroup: AssetGroup,
  relationType: AnyAssetRelationType,
  qualifier: string | undefined,
  notes: string,
): AssetRelation {
  // Build the correct discriminated union shape
  if (relationType === "is_an") {
    return { relationType: "is_an", assetId, assetGroup } as AssetRelation;
  }
  if (relationType === "uses" && qualifier) {
    return {
      relationType: "uses",
      assetId,
      assetGroup: "system",
      qualifier: qualifier as SystemUsesQualifier,
      notes: notes || undefined,
    } as AssetRelation;
  }
  if (relationType === "accesses" && qualifier) {
    return {
      relationType: "accesses",
      assetId,
      assetGroup: "infrastructure",
      qualifier: qualifier as InfraAccessesQualifier,
      notes: notes || undefined,
    } as AssetRelation;
  }
  return {
    relationType,
    assetId,
    assetGroup,
    notes: notes || undefined,
  } as AssetRelation;
}

// ==================== COMPONENT ====================

export const AssetRelationSelector: React.FC<AssetRelationSelectorProps> = ({
  assetRelations,
  elementType,
  availableAssets,
  onChange,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newAssetId, setNewAssetId] = useState("");
  const [newAssetGroup, setNewAssetGroup] = useState<AssetGroup | "">("");
  const [newRelationType, setNewRelationType] = useState<
    AnyAssetRelationType | ""
  >("");
  const [newQualifier, setNewQualifier] = useState("");
  const [newNotes, setNewNotes] = useState("");

  // Asset groups that have at least one allowed relation for this element type
  const allowedGroups = ASSET_GROUP_TAB_ORDER.filter((group) =>
    hasAnyAllowedRelations(elementType, group),
  );

  if (allowedGroups.length === 0) {
    return (
      <Alert severity="info" sx={{ my: 2 }}>
        <Typography variant="body2">
          This element type does not support asset relations.
        </Typography>
      </Alert>
    );
  }

  const relatedAssetIds = new Set(assetRelations.map((r) => r.assetId));
  const unrelatedAssets = availableAssets.filter(
    (a) => !relatedAssetIds.has(a.id),
  );

  // Allowed relation types for the currently selected group
  const allowedTypesForGroup = newAssetGroup
    ? getAllowedRelations(elementType, newAssetGroup as AssetGroup)
    : [];

  // Whether qualifier is needed
  const needsQualifier =
    newRelationType === "uses" || newRelationType === "accesses";

  const qualifierOptions: string[] =
    newRelationType === "uses"
      ? [
          "network",
          "local",
          "authentication",
          "authorization",
          "api",
          "storage",
          "computation",
          "messaging",
          "configuration",
          "monitoring",
          "networking",
        ]
      : newRelationType === "accesses"
        ? ["local", "internal", "remote"]
        : [];

  // ---- Handlers ----

  const handleAdd = useCallback(() => {
    if (!newAssetId || !newAssetGroup || !newRelationType) return;
    if (needsQualifier && !newQualifier) return;

    const relation = buildRelation(
      newAssetId,
      newAssetGroup as AssetGroup,
      newRelationType as AnyAssetRelationType,
      newQualifier || undefined,
      newNotes,
    );

    onChange([...assetRelations, relation]);
    setIsAdding(false);
    setNewAssetId("");
    setNewAssetGroup("");
    setNewRelationType("");
    setNewQualifier("");
    setNewNotes("");
  }, [
    newAssetId,
    newAssetGroup,
    newRelationType,
    newQualifier,
    newNotes,
    assetRelations,
    onChange,
    needsQualifier,
  ]);

  const handleRemove = useCallback(
    (assetId: string) =>
      onChange(assetRelations.filter((r) => r.assetId !== assetId)),
    [assetRelations, onChange],
  );

  const handleNotesChange = useCallback(
    (assetId: string, notes: string) =>
      onChange(
        assetRelations.map((r) =>
          r.assetId === assetId ? { ...r, notes: notes || undefined } : r,
        ),
      ),
    [assetRelations, onChange],
  );

  const getAsset = (assetId: string) =>
    availableAssets.find((a) => a.id === assetId);

  // ---- Render ----

  return (
    <Box>
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        Asset Relations
      </Typography>
      <Typography
        variant="caption"
        color="text.secondary"
        display="block"
        sx={{ mb: 2 }}
      >
        Link this element to assets it affects
      </Typography>

      {/* Existing relations */}
      <Stack spacing={2}>
        {assetRelations.map((relation) => {
          const asset = getAsset(relation.assetId);
          const groupConfig = ASSET_GROUP_CONFIG[relation.assetGroup];
          const qualifier =
            "qualifier" in relation ? (relation as any).qualifier : undefined;

          return (
            <Card key={relation.assetId} variant="outlined">
              <CardContent sx={{ pb: "12px !important" }}>
                <Stack spacing={1.5}>
                  {/* Header row */}
                  <Box display="flex" alignItems="center" gap={1}>
                    <Chip
                      label={getAssetGroupText(relation.assetGroup, "en")}
                      size="small"
                      sx={{
                        bgcolor: groupConfig?.colorLight,
                        color: groupConfig?.color,
                        fontWeight: 600,
                      }}
                    />
                    <Typography variant="subtitle2" sx={{ flex: 1 }}>
                      {asset?.displayId || relation.assetId}:{" "}
                      {asset?.name || "Unknown Asset"}
                    </Typography>
                    {asset?.protectionNeed && (
                      <Chip
                        label={asset.protectionNeed.toUpperCase()}
                        color={
                          PROTECTION_NEED_COLOR[asset.protectionNeed] ??
                          "default"
                        }
                        size="small"
                      />
                    )}
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleRemove(relation.assetId)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>

                  {/* Relation type + qualifier */}
                  <Box display="flex" alignItems="center" gap={1}>
                    <Chip
                      label={getRelationTypeText(
                        relation.relationType,
                        relation.assetGroup,
                        "en",
                      )}
                      size="small"
                      variant="outlined"
                    />
                    {qualifier && (
                      <Chip
                        label={`[${qualifier}]`}
                        size="small"
                        variant="outlined"
                      />
                    )}
                  </Box>

                  {/* Notes */}
                  <TextField
                    fullWidth
                    size="small"
                    label="Notes"
                    value={relation.notes ?? ""}
                    onChange={(e) =>
                      handleNotesChange(relation.assetId, e.target.value)
                    }
                    placeholder="Optional description of this relationship"
                    multiline
                    rows={2}
                  />
                </Stack>
              </CardContent>
            </Card>
          );
        })}
      </Stack>

      {/* Add new relation */}
      {!isAdding && unrelatedAssets.length > 0 && (
        <Button
          startIcon={<AddIcon />}
          onClick={() => setIsAdding(true)}
          sx={{ mt: 2 }}
        >
          Add Asset Relation
        </Button>
      )}

      {isAdding && (
        <Card variant="outlined" sx={{ mt: 2, bgcolor: "action.hover" }}>
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="subtitle2">
                Add New Asset Relation
              </Typography>

              {/* Asset selection */}
              <FormControl fullWidth size="small">
                <InputLabel>Select Asset</InputLabel>
                <Select
                  value={newAssetId}
                  onChange={(e) => setNewAssetId(e.target.value)}
                  label="Select Asset"
                >
                  {unrelatedAssets.map((asset) => (
                    <MenuItem key={asset.id} value={asset.id}>
                      <Box
                        display="flex"
                        alignItems="center"
                        gap={1}
                        width="100%"
                      >
                        <Typography sx={{ flex: 1 }}>
                          {asset.displayId}: {asset.name}
                        </Typography>
                        {asset.protectionNeed && (
                          <Chip
                            label={asset.protectionNeed}
                            color={
                              PROTECTION_NEED_COLOR[asset.protectionNeed] ??
                              "default"
                            }
                            size="small"
                          />
                        )}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Asset group */}
              <FormControl fullWidth size="small">
                <InputLabel>Asset Group</InputLabel>
                <Select
                  value={newAssetGroup}
                  onChange={(e) => {
                    setNewAssetGroup(e.target.value as AssetGroup);
                    setNewRelationType("");
                    setNewQualifier("");
                  }}
                  label="Asset Group"
                >
                  {allowedGroups.map((group) => (
                    <MenuItem key={group} value={group}>
                      {getAssetGroupText(group, "en")}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Relation type */}
              {newAssetGroup && (
                <FormControl fullWidth size="small">
                  <InputLabel>Relation Type</InputLabel>
                  <Select
                    value={newRelationType}
                    onChange={(e) => {
                      setNewRelationType(
                        e.target.value as AnyAssetRelationType,
                      );
                      setNewQualifier("");
                    }}
                    label="Relation Type"
                  >
                    {allowedTypesForGroup.map((type) => (
                      <MenuItem key={type} value={type}>
                        {getRelationTypeText(
                          type as AnyAssetRelationType,
                          newAssetGroup as AssetGroup,
                          "en",
                        )}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}

              {/* Qualifier (uses / accesses) */}
              {needsQualifier && (
                <FormControl fullWidth size="small">
                  <InputLabel>Qualifier</InputLabel>
                  <Select
                    value={newQualifier}
                    onChange={(e) => setNewQualifier(e.target.value)}
                    label="Qualifier"
                  >
                    {qualifierOptions.map((q) => (
                      <MenuItem key={q} value={q}>
                        [{q}]
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}

              {/* Notes */}
              <TextField
                fullWidth
                size="small"
                label="Notes (optional)"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="Describe this relationship"
                multiline
                rows={2}
              />

              {/* Actions */}
              <Stack direction="row" spacing={1}>
                <Button
                  variant="contained"
                  onClick={handleAdd}
                  disabled={
                    !newAssetId ||
                    !newAssetGroup ||
                    !newRelationType ||
                    (needsQualifier && !newQualifier)
                  }
                >
                  Add
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setIsAdding(false);
                    setNewAssetId("");
                    setNewAssetGroup("");
                    setNewRelationType("");
                    setNewQualifier("");
                    setNewNotes("");
                  }}
                >
                  Cancel
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      )}

      {!isAdding &&
        unrelatedAssets.length === 0 &&
        assetRelations.length > 0 && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mt: 2, display: "block" }}
          >
            All available assets are already linked.
          </Typography>
        )}

      {availableAssets.length === 0 && (
        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="body2">
            No assets available. Create assets in the Assets tab first.
          </Typography>
        </Alert>
      )}
    </Box>
  );
};