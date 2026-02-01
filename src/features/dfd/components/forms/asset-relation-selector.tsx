// ==================== ASSET RELATION SELECTOR ====================
// Reusable component for managing asset-element relationships
// Used in all element forms that support asset relations

import React, { useState, useCallback } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  FormControl,
  FormControlLabel,
  Checkbox,
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
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Warning as WarningIcon,
} from "@mui/icons-material";
import type {
  AssetRelation,
  AssetRelationType,
  DFDElementType,
} from "../../models/dfd-types";
import { ALLOWED_ASSET_RELATIONS } from "../../models/dfd-constants";
import { getAssetRelationTypeText } from "../../models/dfd-formatters";

// ==================== TYPES ====================

/**
 * Available asset info for selection
 */
export interface AvailableAsset {
  id: string;
  name: string;
  displayId: string;
  protectionNeed?: "low" | "medium" | "high" | "critical";
}

interface AssetRelationSelectorProps {
  /** Current asset relations */
  assetRelations: AssetRelation[];
  
  /** Element type (determines allowed relation types) */
  elementType: DFDElementType;
  
  /** Available assets for selection */
  availableAssets: AvailableAsset[];
  
  /** Callback when relations change */
  onChange: (relations: AssetRelation[]) => void;
  
  /** Optional: IDs of assets that have markers on this element */
  markedAssetIds?: string[];
}

// ==================== COMPONENT ====================

export const AssetRelationSelector: React.FC<AssetRelationSelectorProps> = ({
  assetRelations,
  elementType,
  availableAssets,
  onChange,
  markedAssetIds = [],
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newAssetId, setNewAssetId] = useState("");
  const [newRelationTypes, setNewRelationTypes] = useState<AssetRelationType[]>([]);
  const [newNotes, setNewNotes] = useState("");
  const [localRelationNotes, setLocalRelationNotes] = React.useState<
    Record<string, string>
  >({});

  // Get allowed relation types for this element
  const allowedTypes = ALLOWED_ASSET_RELATIONS[elementType] || [];

  // Check if element type supports asset relations
  if (allowedTypes.length === 0) {
    return (
      <Alert severity="info" sx={{ my: 2 }}>
        <Typography variant="body2">
          This element type does not support asset relations.
        </Typography>
      </Alert>
    );
  }

  // Get assets that already have relations
  const relatedAssetIds = new Set(assetRelations.map((r) => r.assetId));

  // Get unrelated assets available for adding
  const unrelatedAssets = availableAssets.filter(
    (a) => !relatedAssetIds.has(a.id)
  );

  // Handle adding new relation
  const handleAdd = useCallback(() => {
    if (!newAssetId || newRelationTypes.length === 0) return;

    const newRelation: AssetRelation = {
      assetId: newAssetId,
      relationTypes: newRelationTypes,
      notes: newNotes.trim() || undefined,
    };

    onChange([...assetRelations, newRelation]);

    // Reset form
    setNewAssetId("");
    setNewRelationTypes([]);
    setNewNotes("");
    setIsAdding(false);
  }, [newAssetId, newRelationTypes, newNotes, assetRelations, onChange]);

  // Handle removing relation
  const handleRemove = useCallback(
    (assetId: string) => {
      onChange(assetRelations.filter((r) => r.assetId !== assetId));
    },
    [assetRelations, onChange]
  );

  // Handle updating relation
  const handleUpdate = useCallback(
    (assetId: string, updates: Partial<AssetRelation>) => {
      onChange(
        assetRelations.map((r) =>
          r.assetId === assetId ? { ...r, ...updates } : r
        )
      );
    },
    [assetRelations, onChange]
  );

  // Toggle relation type for existing relation
  const handleToggleRelationType = useCallback(
    (assetId: string, relationType: AssetRelationType) => {
      const relation = assetRelations.find((r) => r.assetId === assetId);
      if (!relation) return;

      const currentTypes = relation.relationTypes || [];
      const newTypes = currentTypes.includes(relationType)
        ? currentTypes.filter((t) => t !== relationType)
        : [...currentTypes, relationType];

      handleUpdate(assetId, { relationTypes: newTypes });
    },
    [assetRelations, handleUpdate]
  );

  // Get asset details
  const getAsset = (assetId: string) =>
    availableAssets.find((a) => a.id === assetId);

  // Get impact color
  const getImpactColor = (protectionNeed?: string) => {
    switch (protectionNeed) {
      case "critical":
        return "error";
      case "high":
        return "warning";
      case "medium":
        return "info";
      case "low":
        return "success";
      default:
        return "default";
    }
  };

  return (
    <Box>
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        Asset Relations
      </Typography>
      
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
        Link this element to assets it affects
      </Typography>

      {/* Existing Relations */}
      <Stack spacing={2}>
        {assetRelations.map((relation) => {
          const asset = getAsset(relation.assetId);
          const hasMarker = markedAssetIds.includes(relation.assetId);

          return (
            <Card key={relation.assetId} variant="outlined">
              <CardContent>
                <Stack spacing={2}>
                  {/* Asset Info */}
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant="subtitle2" sx={{ flex: 1 }}>
                      {asset?.displayId || relation.assetId}:{" "}
                      {asset?.name || "Unknown Asset"}
                    </Typography>

                    {asset?.protectionNeed && (
                      <Chip
                        label={asset.protectionNeed.toUpperCase()}
                        color={getImpactColor(asset.protectionNeed) as any}
                        size="small"
                      />
                    )}

                    {!hasMarker && (
                      <Chip
                        icon={<WarningIcon />}
                        label="No marker"
                        color="warning"
                        size="small"
                      />
                    )}

                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleRemove(relation.assetId)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>

                  {/* Relation Types */}
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Relation Types:
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                      {allowedTypes.map((type) => (
                        <FormControlLabel
                          key={type}
                          control={
                            <Checkbox
                              checked={
                                relation.relationTypes?.includes(type) || false
                              }
                              onChange={() =>
                                handleToggleRelationType(relation.assetId, type)
                              }
                              size="small"
                            />
                          }
                          label={getAssetRelationTypeText(type)}
                        />
                      ))}
                    </Stack>
                  </Box>

                  {/* Notes */}
                  <TextField
                    fullWidth
                    size="small"
                    label="Notes"
                    value={
                      localRelationNotes[relation.assetId] ??
                      relation.notes ??
                      ""
                    }
                    onChange={(e) => {
                      setLocalRelationNotes((prev) => ({
                        ...prev,
                        [relation.assetId]: e.target.value,
                      }));
                    }}
                    onBlur={() => {
                      const localValue = localRelationNotes[relation.assetId];
                      if (
                        localValue !== undefined &&
                        localValue !== relation.notes
                      ) {
                        handleUpdate(relation.assetId, { notes: localValue });
                      }
                    }}
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

      {/* Add New Relation */}
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
              <Typography variant="subtitle2">Add New Asset Relation</Typography>

              {/* Asset Selection */}
              <FormControl fullWidth size="small">
                <InputLabel>Select Asset</InputLabel>
                <Select
                  value={newAssetId}
                  onChange={(e) => setNewAssetId(e.target.value)}
                  label="Select Asset"
                >
                  {unrelatedAssets.map((asset) => (
                    <MenuItem key={asset.id} value={asset.id}>
                      <Box display="flex" alignItems="center" gap={1} width="100%">
                        <Typography sx={{ flex: 1 }}>
                          {asset.displayId}: {asset.name}
                        </Typography>
                        {asset.protectionNeed && (
                          <Chip
                            label={asset.protectionNeed}
                            color={getImpactColor(asset.protectionNeed) as any}
                            size="small"
                          />
                        )}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Relation Types */}
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Relation Types (select at least one):
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                  {allowedTypes.map((type) => (
                    <FormControlLabel
                      key={type}
                      control={
                        <Checkbox
                          checked={newRelationTypes.includes(type)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewRelationTypes([...newRelationTypes, type]);
                            } else {
                              setNewRelationTypes(
                                newRelationTypes.filter((t) => t !== type)
                              );
                            }
                          }}
                          size="small"
                        />
                      }
                      label={getAssetRelationTypeText(type)}
                    />
                  ))}
                </Stack>
              </Box>

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
                  disabled={!newAssetId || newRelationTypes.length === 0}
                >
                  Add
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setIsAdding(false);
                    setNewAssetId("");
                    setNewRelationTypes([]);
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

      {/* No more assets available */}
      {!isAdding && unrelatedAssets.length === 0 && assetRelations.length > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: "block" }}>
          All available assets are already linked
        </Typography>
      )}

      {/* No assets in project */}
      {availableAssets.length === 0 && (
        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="body2">
            No assets available. Create assets in the DFD diagram first.
          </Typography>
        </Alert>
      )}

      {/* Marker Warnings */}
      {assetRelations.some((r) => !markedAssetIds.includes(r.assetId)) && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          <Typography variant="body2">
            ⚠️ Some asset relations don't have markers in the diagram. 
            Place asset markers on this element in the DFD view.
          </Typography>
        </Alert>
      )}
    </Box>
  );
};