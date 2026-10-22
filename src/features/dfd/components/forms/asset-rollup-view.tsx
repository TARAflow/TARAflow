// ==================== ASSET ROLL-UP VIEW ====================
// Leveled DFD Phase 6d (leveled-dfd-multi-diagram-design.md §9, D3): the
// "Asset" tab of a decomposed multiprocess. Its relations are a read-only
// roll-up of its parts ("via P-3.1, DS-3.1"); relations from before the
// decomposition are listed as "not yet assigned to a part" — they disappear
// with the next save once a part holds the same pair, or the analyst
// removes them.
//
// ElementFormShell shows this view instead of the relation selector when
// the panel provides a roll-up for the element (AssetRollupContext).

import React from "react";
import { useTranslation } from "react-i18next";
import { Alert, Box, Chip, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import { DeleteOutline as DeleteIcon } from "@mui/icons-material";
import type { AssetGroup } from "shared";
import type { AssetRelation } from "../../models/asset-relation-types";
import type { MultiprocessAssets } from "../../services/leveled/asset-rollup";
import { getAssetGroupColor, getRelationTypeText } from "../../models/dfd-formatters";
import type { AvailableAsset } from "./asset-relation-selector";

export interface AssetRollupContextValue {
  /** The decomposed multiprocess the roll-up belongs to. */
  elementId: string;
  assets: MultiprocessAssets;
  /** Label of a part (element or flow) by tfId, e.g. "P-3.1". */
  partLabel: (tfId: string) => string;
}

export const AssetRollupContext = React.createContext<AssetRollupContextValue | null>(null);

export interface AssetRollupViewProps {
  value: AssetRollupContextValue;
  availableAssets: AvailableAsset[];
  /** Own relations of the multiprocess (the pending ones are among them). */
  ownRelations: AssetRelation[];
  onChange: (relations: AssetRelation[]) => void;
}

const sameRelation = (a: AssetRelation, b: AssetRelation) =>
  a.assetId === b.assetId && a.relationType === b.relationType;

export const AssetRollupView: React.FC<AssetRollupViewProps> = ({
  value,
  availableAssets,
  ownRelations,
  onChange,
}) => {
  const { t } = useTranslation();
  const assetById = new Map(availableAssets.map((a) => [a.id, a]));
  const assetLabel = (id: string) => {
    const asset = assetById.get(id);
    return asset ? `${asset.displayId} ${asset.name}` : id;
  };
  const relationText = (r: { relationType: string }, group: AssetGroup) =>
    getRelationTypeText(r.relationType as never, group, t);
  const { rollup, pending } = value.assets;

  return (
    <Stack spacing={2} data-testid="asset-rollup-view">
      <Alert severity="info" sx={{ py: 0 }}>
        {t("tabs.dfd.element_description.assetRollup.info", {
          defaultValue:
            "This multiprocess is decomposed: it holds the assets of its parts. Edit the relations on the parts.",
        })}
      </Alert>

      <Box>
        <Typography variant="subtitle2" gutterBottom>
          {t("tabs.dfd.element_description.assetRollup.rollupTitle", {
            defaultValue: "Held by its parts",
          })}
        </Typography>
        {rollup.length === 0 ? (
          <Typography variant="body2" color="text.secondary" data-testid="asset-rollup-empty">
            {t("tabs.dfd.element_description.assetRollup.rollupEmpty", {
              defaultValue: "No part holds an asset yet.",
            })}
          </Typography>
        ) : (
          <Stack spacing={0.5}>
            {rollup.map((entry) => {
              const group = entry.relation.assetGroup;
              return (
                <Stack
                  key={`${entry.assetId}-${entry.relationType}`}
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  data-testid={`asset-rollup-${entry.assetId}-${entry.relationType}`}
                >
                  <Chip
                    size="small"
                    label={assetLabel(entry.assetId)}
                    sx={{ borderLeft: `4px solid ${getAssetGroupColor(group).color}` }}
                  />
                  <Typography variant="body2">{relationText(entry, group)}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t("tabs.dfd.element_description.assetRollup.via", {
                      defaultValue: "via {{parts}}",
                      parts: entry.via.map(value.partLabel).join(", "),
                    })}
                  </Typography>
                </Stack>
              );
            })}
          </Stack>
        )}
      </Box>

      {pending.length > 0 && (
        <Box data-testid="asset-rollup-pending">
          <Typography variant="subtitle2" gutterBottom>
            {t("tabs.dfd.element_description.assetRollup.pendingTitle", {
              defaultValue: "Not yet assigned to a part",
            })}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
            {t("tabs.dfd.element_description.assetRollup.pendingHint", {
              defaultValue:
                "Held before the decomposition. Assign the asset to the part that holds it — the entry then disappears with the next save.",
            })}
          </Typography>
          <Stack spacing={0.5}>
            {pending.map((relation) => (
              <Stack
                key={`${relation.assetId}-${relation.relationType}`}
                direction="row"
                spacing={1}
                alignItems="center"
              >
                <Chip
                  size="small"
                  color="warning"
                  variant="outlined"
                  label={assetLabel(relation.assetId)}
                />
                <Typography variant="body2" sx={{ flexGrow: 1 }}>
                  {relationText(relation, relation.assetGroup)}
                </Typography>
                <Tooltip
                  title={t("tabs.dfd.element_description.assetRollup.removePending", {
                    defaultValue: "Remove — no part holds this asset",
                  })}
                >
                  <IconButton
                    size="small"
                    aria-label="remove-pending"
                    onClick={() => onChange(ownRelations.filter((r) => !sameRelation(r, relation)))}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            ))}
          </Stack>
        </Box>
      )}
    </Stack>
  );
};

export default AssetRollupView;
