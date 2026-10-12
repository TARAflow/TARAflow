// features/dfd/asset-graph/asset-graph-element-link.tsx
//
// Edit mode (phase 3, FR-E7): DFD element → asset relations in the graph.
// DFD elements are referenced, never created here. Allowed types come from
// the element rules (getAllowedRelations) — the same rules the validator
// uses. The relation itself is edited in the side panel's per-asset dialog
// (ElementAssetRelationDialog: types, qualifier, safety, notes), and written
// through the DFD tab's element/connection update (AR-6) — no new write path.

import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, List, ListItemButton, ListItemText, Popover, TextField, Typography } from "@mui/material";
import type { AssetGroup } from "shared";
import { getAllowedRelations } from "../models/asset-constants";
import type { AssetRelation } from "../models/asset-relation-types";
import type { DFDConnection, DFDElement, DFDElementType } from "../models/dfd-types";

/** What the graph needs to link DFD elements (provided by the DFD tab). */
export interface ElementLinking {
  readonly elements: readonly DFDElement[];
  readonly connections: readonly DFDConnection[];
  /** Write the element's (or connection's) complete new relation list. */
  readonly onChange: (elementId: string, relations: AssetRelation[]) => void;
}

export interface LinkableElement {
  readonly id: string;
  readonly displayId: string;
  readonly name: string;
  /** Connections count as DataFlow for the rules. */
  readonly type: DFDElementType;
  readonly relations: readonly AssetRelation[];
}

/** Elements and connections as one list, in the rules' terms. */
export function linkableElements(linking: Pick<ElementLinking, "elements" | "connections">): LinkableElement[] {
  const label = (x: { id: string; displayId?: string; name?: string; label?: string }) => ({
    displayId: x.displayId ?? x.id.slice(0, 8),
    name: x.name ?? x.label ?? "",
  });
  return [
    ...linking.elements.map((e) => ({
      id: e.id,
      ...label(e as never),
      type: e.type,
      relations: e.assetRelations ?? [],
    })),
    ...linking.connections.map((c) => ({
      id: c.id,
      ...label(c as never),
      type: "DataFlow" as DFDElementType,
      relations: c.assetRelations ?? [],
    })),
  ];
}

/** Allowed element → asset relation types for one pair. */
export function allowedElementTypes(elementType: string, assetGroup: string): string[] {
  try {
    return getAllowedRelations(elementType as DFDElementType, assetGroup as AssetGroup);
  } catch {
    return [];
  }
}

/** Elements that may relate to an asset of `assetGroup`, linked ones marked. */
export function elementCandidates(
  elements: readonly LinkableElement[],
  assetId: string,
  assetGroup: string,
): Array<LinkableElement & { readonly linked: boolean }> {
  return elements
    .filter((e) => allowedElementTypes(e.type, assetGroup).length > 0)
    .map((e) => ({ ...e, linked: e.relations.some((r) => r.assetId === assetId) }))
    .sort((a, b) => a.displayId.localeCompare(b.displayId, undefined, { numeric: true }));
}

/**
 * While dragging from an element anchor: every shown asset is a valid target
 * if the element may relate to its group at all.
 */
export function elementTargetClasses(
  elementType: string,
  shown: ReadonlyArray<{ readonly id: string; readonly assetGroup: string }>,
): Map<string, "valid" | "invalid"> {
  const out = new Map<string, "valid" | "invalid">();
  for (const a of shown) {
    out.set(a.id, allowedElementTypes(elementType, a.assetGroup).length > 0 ? "valid" : "invalid");
  }
  return out;
}

/** The element's relations without one (asset, type) pair. */
export function withoutElementRelation(
  relations: readonly AssetRelation[],
  assetId: string,
  relationType: string,
): AssetRelation[] {
  return relations.filter((r) => !(r.assetId === assetId && r.relationType === relationType));
}

export interface ElementPickerProps {
  readonly anchorEl: HTMLElement | null;
  readonly candidates: ReadonlyArray<LinkableElement & { readonly linked: boolean }>;
  readonly elementTypeName: (type: string) => string;
  readonly onPick: (elementId: string) => void;
  readonly onClose: () => void;
}

/** "Link to element": pick a DFD element (or flow) for the card's asset. */
export const ElementPicker: React.FC<ElementPickerProps> = ({
  anchorEl,
  candidates,
  elementTypeName,
  onPick,
  onClose,
}) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = useMemo(
    () =>
      candidates.filter(
        (o) => !q || `${o.displayId} ${o.name} ${elementTypeName(o.type)}`.toLowerCase().includes(q),
      ),
    [candidates, q, elementTypeName],
  );
  return (
    <Popover
      open={!!anchorEl}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      PaperProps={{ sx: { p: 1.5, width: 360 } }}
    >
      <Box data-testid="asset-graph-element-picker">
        {candidates.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {t("tabs.dfd.assetGraph.elementLink.noCandidates", {
              defaultValue: "No DFD element may relate to an asset of this group.",
            })}
          </Typography>
        ) : (
          <>
            <TextField
              size="small"
              fullWidth
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && shown.length === 1) onPick(shown[0].id);
              }}
              label={t("tabs.dfd.assetGraph.elementLink.pick", { defaultValue: "DFD element or flow" })}
              inputProps={{ "data-testid": "asset-graph-element-search" }}
            />
            <List dense disablePadding sx={{ mt: 1, maxHeight: 280, overflow: "auto" }}>
              {shown.map((o) => (
                <ListItemButton
                  key={o.id}
                  onClick={() => onPick(o.id)}
                  data-testid={`asset-graph-element-option-${o.id}`}
                  sx={{ borderRadius: 0.5 }}
                >
                  <ListItemText
                    primary={`${o.displayId} ${o.name}`.trim()}
                    secondary={
                      elementTypeName(o.type) +
                      (o.linked
                        ? ` · ${t("tabs.dfd.assetGraph.elementLink.linked", { defaultValue: "already linked" })}`
                        : "")
                    }
                  />
                </ListItemButton>
              ))}
            </List>
          </>
        )}
      </Box>
    </Popover>
  );
};
