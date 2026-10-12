// features/dfd/asset-graph/asset-graph-inspector.tsx
//
// Read-only detail card of the asset graph (FR-V8, phase 2): the selected
// asset with its relations grouped by type, or the selected link with its
// attributes. Editing stays in the asset panel (the same selection) until the
// edit mode of phase 3.

import React from "react";
import { useTranslation } from "react-i18next";
import { Box, Button, Divider, IconButton, Link, Paper, Stack, Typography } from "@mui/material";
import { Close as CloseIcon } from "@mui/icons-material";
import { a2aRelationName, type A2ARelationType } from "shared";
import type { AssetGraphEdge, AssetGraphSource } from "./asset-graph-types";
import { relationsOfAssetGrouped } from "./asset-graph-query";

export interface AssetGraphInspectorProps {
  readonly source: AssetGraphSource;
  readonly assetId: string | null;
  readonly edge: AssetGraphEdge | null;
  /** Finding reason for an asset link (validateA2ARelations), if any. */
  readonly findingOf?: (relationId: string) => string | undefined;
  readonly typeLabel: (type: string) => string;
  /** Label of a drawn edge (asset link or DFD element → asset). */
  readonly edgeLabel?: (edge: AssetGraphEdge) => string;
  /** Label of a DFD element → asset relation type for an asset group. */
  readonly elementTypeLabel?: (type: string, group?: string) => string;
  readonly groupLabel: (group: string) => string;
  /** Navigate to another asset (select + centre). */
  readonly onGoToAsset: (assetId: string) => void;
  readonly onGoToElement?: (elementId: string) => void;
  readonly onFocus: (assetId: string) => void;
  readonly onShowInTable?: (assetId: string) => void;
  readonly onClose: () => void;
  /** Space on the right covered by the side panel. */
  readonly rightInset?: number;
  /** Edit mode: remove an asset link (FR-E8). */
  readonly onDeleteLink?: (relationId: string) => void;
  /** Edit mode: delete the asset (the caller confirms, FR-E8). */
  readonly onDeleteAsset?: (assetId: string) => void;
}

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <Stack direction="row" spacing={1} sx={{ mb: 0.25 }}>
    <Typography variant="caption" color="text.secondary" sx={{ minWidth: 92 }}>
      {label}
    </Typography>
    <Typography variant="caption" sx={{ wordBreak: "break-word" }}>
      {children}
    </Typography>
  </Stack>
);

export const AssetGraphInspector: React.FC<AssetGraphInspectorProps> = ({
  source,
  assetId,
  edge,
  findingOf,
  typeLabel,
  edgeLabel,
  elementTypeLabel,
  groupLabel,
  onGoToAsset,
  onGoToElement,
  onFocus,
  onShowInTable,
  onClose,
  rightInset = 0,
  onDeleteLink,
  onDeleteAsset,
}) => {
  const { t } = useTranslation();
  const assetById = (id: string) => source.assets.find((a) => a.id === id);
  const name = (id: string) => {
    const a = assetById(id);
    if (a) return `${a.displayId ?? ""} ${a.name ?? ""}`.trim();
    const el = source.elements.find((e) => e.id === id);
    return el ? `${el.displayId ?? el.id} ${el.name ?? ""}`.trim() : id.slice(0, 8);
  };

  let body: React.ReactNode = null;
  if (edge) {
    const elementId = edge.kind === "anchor" ? edge.source.replace(/^el:/, "") : null;
    const rel =
      edge.kind === "a2a" ? source.relations.find((r) => r.id === edge.id) : undefined;
    body = (
      <Box data-testid="asset-graph-inspector-edge">
        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
          {edge.kind === "a2a"
            ? t("tabs.dfd.assetGraph.inspector.link", { defaultValue: "Asset link" })
            : t("tabs.dfd.assetGraph.inspector.elementLink", { defaultValue: "DFD element → asset" })}
        </Typography>
        <Row label={t("tabs.dfd.assetGraph.inspector.from", { defaultValue: "From" })}>
          {name(elementId ?? edge.source)}
        </Row>
        <Row label={t("tabs.dfd.assetGraph.inspector.type", { defaultValue: "Type" })}>
          {edgeLabel ? edgeLabel(edge) : typeLabel(edge.relationType)}{" "}
          <span style={{ opacity: 0.6 }}>({edge.relationType})</span>
        </Row>
        <Row label={t("tabs.dfd.assetGraph.inspector.to", { defaultValue: "To" })}>
          {name(edge.target)}
        </Row>
        {rel?.stepOrder !== undefined && (
          <Row label={t("tabs.dfd.assetGraph.inspector.stepOrder", { defaultValue: "Step" })}>{rel.stepOrder}</Row>
        )}
        {rel?.rationale && (
          <Row label={t("tabs.dfd.assetGraph.inspector.rationale", { defaultValue: "Rationale" })}>{rel.rationale}</Row>
        )}
        {rel?.degradationMode !== undefined && (
          <Row label={t("tabs.dfd.assetGraph.inspector.degradation", { defaultValue: "Degraded mode" })}>
            {rel.degradationMode
              ? rel.degradationDescription || t("common.yes", { defaultValue: "yes" })
              : t("common.no", { defaultValue: "no" })}
          </Row>
        )}
        {edge.kind === "a2a" && findingOf?.(edge.id) && (
          <Typography variant="caption" sx={{ display: "block", color: "warning.dark", mb: 0.5 }} data-testid="asset-graph-inspector-finding">
            {"⚠ "}
            {t(`tabs.dfd.assetGraph.finding.${findingOf(edge.id)}`, {
              defaultValue: "This link is not allowed for these groups (e.g. after a group change).",
            })}
          </Typography>
        )}
        {rel?.notes && (
          <Row label={t("tabs.dfd.assetGraph.inspector.notes", { defaultValue: "Notes" })}>{rel.notes}</Row>
        )}
        {onDeleteLink && edge.kind === "a2a" && (
          <>
            <Divider sx={{ my: 0.75 }} />
            <Button size="small" color="error" onClick={() => onDeleteLink(edge.id)} data-testid="asset-graph-delete-link">
              {t("tabs.dfd.assetGraph.inspector.deleteLink", { defaultValue: "Delete link" })}
            </Button>
          </>
        )}
      </Box>
    );
  } else if (assetId) {
    const asset = assetById(assetId);
    if (!asset) return null;
    const groups = relationsOfAssetGrouped(source, assetId, (type) =>
      a2aRelationName(type as A2ARelationType, "in").replace(/_/g, " "),
    );
    body = (
      <Box data-testid="asset-graph-inspector-asset">
        <Typography variant="subtitle2">{name(assetId)}</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.75 }}>
          {groupLabel(String(asset.assetGroup))}
          {asset.protectionNeed
            ? ` · ${t("tabs.dfd.assetGraph.inspector.protectionNeed", { defaultValue: "Protection need" })}: ${asset.protectionNeed}`
            : ""}
        </Typography>
        {groups.length === 0 && (
          <Typography variant="caption" color="text.secondary">
            {t("tabs.dfd.assetGraph.inspector.noRelations", { defaultValue: "No relations." })}
          </Typography>
        )}
        {groups.map((g) => (
          <Box key={`${g.direction}:${g.relationType}`} sx={{ mb: 0.75 }}>
            <Typography variant="caption" sx={{ fontWeight: 600, display: "block" }}>
              {g.direction === "out"
                ? typeLabel(g.relationType)
                : g.direction === "element" && elementTypeLabel
                  ? elementTypeLabel(g.relationType, String(asset.assetGroup))
                  : g.label}
              {g.direction === "element"
                ? ` · ${t("tabs.dfd.assetGraph.anchors", { defaultValue: "DFD elements" })}`
                : ""}
            </Typography>
            {g.items.map((item) => (
              <Link
                key={`${item.id}:${item.relationId ?? ""}`}
                component="button"
                variant="caption"
                underline="hover"
                sx={{ display: "block", textAlign: "left" }}
                onClick={() =>
                  g.direction === "element" ? onGoToElement?.(item.id) : onGoToAsset(item.id)
                }
              >
                {item.stepOrder !== undefined ? `[${item.stepOrder}] ` : ""}
                {`${item.displayId} ${item.name}`.trim()}
              </Link>
            ))}
          </Box>
        ))}
        <Divider sx={{ my: 0.75 }} />
        <Stack direction="row" spacing={1}>
          <Button size="small" onClick={() => onFocus(assetId)}>
            {t("tabs.dfd.assetGraph.inspector.focus", { defaultValue: "Focus" })}
          </Button>
          {onShowInTable && (
            <Button size="small" onClick={() => onShowInTable(assetId)}>
              {t("tabs.dfd.assetGraph.inspector.showInTable", { defaultValue: "Show in table" })}
            </Button>
          )}
          {onDeleteAsset && (
            <Button size="small" color="error" onClick={() => onDeleteAsset(assetId)} data-testid="asset-graph-delete-asset">
              {t("tabs.dfd.assetGraph.inspector.deleteAsset", { defaultValue: "Delete asset" })}
            </Button>
          )}
        </Stack>
      </Box>
    );
  }
  if (!body) return null;

  return (
    <Paper
      elevation={3}
      data-testid="asset-graph-inspector"
      sx={{ position: "absolute", top: 12, right: rightInset + 12, width: 290, maxHeight: "calc(100% - 24px)", overflow: "auto", p: 1.5, zIndex: 1 }}
    >
      <IconButton size="small" onClick={onClose} sx={{ position: "absolute", top: 4, right: 4 }}>
        <CloseIcon fontSize="small" />
      </IconButton>
      {body}
    </Paper>
  );
};
