// features/dfd/asset-graph/asset-graph-connect.tsx
//
// Edit mode (phase 3): the type chooser shown after a connection was dragged
// from one asset onto another (FR-E4, FR-E5, FR-E12).
//
//   - valid target: the allowed types source → target, KERN first and marked;
//   - reverse-only target: the allowed types in the other direction, with the
//     direction named ("Did you mean E-Stop requires … ?");
//   - a type that already exists between the two is offered but disabled;
//   - a mirror pair hint: warning when the counterpart edge exists, else the
//     preferred direction is named — never blocking (FR-E12).
//
// The rules come from shared (classifyA2ATargetGroup, getA2AMirror) — never
// maintained here (AR-4).

import React from "react";
import { useTranslation } from "react-i18next";
import { Box, Chip, Divider, ListItemText, Menu, MenuItem, Typography } from "@mui/material";
import {
  classifyA2ATargetGroup,
  getA2AMirror,
  type A2ARelation,
  type A2ARelationType,
  type AssetGroup,
} from "shared";

export interface ConnectRequest {
  readonly sourceId: string;
  readonly targetId: string;
  /** Screen position for the menu. */
  readonly anchor: { readonly left: number; readonly top: number };
}

export interface ConnectChoice {
  readonly sourceAssetId: string;
  readonly targetAssetId: string;
  readonly relationType: A2ARelationType;
}

interface AssetRef {
  readonly id: string;
  readonly displayId?: string;
  readonly name?: string;
  readonly assetGroup: AssetGroup | string;
}

export interface ConnectOption extends ConnectChoice {
  readonly kern: boolean;
  /** The same edge exists already. */
  readonly exists: boolean;
  /** Mirror pair hint (FR-E12). */
  readonly mirror?: { readonly counterpartExists: boolean; readonly preferred?: A2ARelationType };
}

export interface ConnectPlan {
  readonly direction: "forward" | "reverse" | "none";
  readonly options: readonly ConnectOption[];
}

/**
 * What can be connected between two assets: forward types, or — if only the
 * other direction is allowed — the reverse types with source and target
 * swapped. Pure; used by the chooser and the tests.
 */
export function planConnection(
  source: AssetRef,
  target: AssetRef,
  relations: readonly A2ARelation[],
): ConnectPlan {
  if (source.id === target.id) return { direction: "none", options: [] };
  const c = classifyA2ATargetGroup(source.assetGroup as AssetGroup, target.assetGroup as AssetGroup);
  const direction = c.targetClass === "valid" ? "forward" : c.targetClass === "reverse_only" ? "reverse" : "none";
  if (direction === "none") return { direction, options: [] };
  const [from, to] = direction === "forward" ? [source, target] : [target, source];
  const list = direction === "forward" ? c.forward : c.reverse;
  const has = (s: string, t: string, type: string) =>
    relations.some((r) => r.sourceAssetId === s && r.targetAssetId === t && r.relationType === type);
  return {
    direction,
    options: list.map((o) => {
      const m = getA2AMirror({
        sourceGroup: from.assetGroup as AssetGroup,
        targetGroup: to.assetGroup as AssetGroup,
        relationType: o.relationType,
      });
      return {
        sourceAssetId: from.id,
        targetAssetId: to.id,
        relationType: o.relationType,
        kern: o.kern,
        exists: has(from.id, to.id, o.relationType),
        ...(m
          ? {
              mirror: {
                counterpartExists: has(to.id, from.id, m.counterpart.relationType),
                ...(m.isPreferred ? {} : { preferred: m.counterpart.relationType }),
              },
            }
          : {}),
      };
    }),
  };
}

export interface ConnectChooserProps {
  readonly request: ConnectRequest | null;
  readonly assets: readonly AssetRef[];
  readonly relations: readonly A2ARelation[];
  readonly typeLabel: (type: string) => string;
  readonly onChoose: (choice: ConnectChoice) => void;
  readonly onClose: () => void;
}

export const ConnectChooser: React.FC<ConnectChooserProps> = ({
  request,
  assets,
  relations,
  typeLabel,
  onChoose,
  onClose,
}) => {
  const { t } = useTranslation();
  if (!request) return null;
  const source = assets.find((a) => a.id === request.sourceId);
  const target = assets.find((a) => a.id === request.targetId);
  if (!source || !target) return null;
  const plan = planConnection(source, target, relations);
  const label = (a: AssetRef) => `${a.displayId ?? ""} ${a.name ?? ""}`.trim();
  const [from, to] = plan.direction === "reverse" ? [target, source] : [source, target];

  return (
    <Menu
      open
      onClose={onClose}
      anchorReference="anchorPosition"
      anchorPosition={request.anchor}
      data-testid="asset-graph-connect-chooser"
    >
      <Box sx={{ px: 2, py: 1, maxWidth: 340 }}>
        {plan.direction === "reverse" && (
          <Typography variant="caption" sx={{ display: "block", color: "warning.dark", mb: 0.5 }} data-testid="asset-graph-connect-reverse">
            {t("tabs.dfd.assetGraph.connect.reverse", {
              defaultValue: "Only the other direction is allowed. Did you mean {{from}} → {{to}}?",
              from: label(from),
              to: label(to),
            })}
          </Typography>
        )}
        <Typography variant="caption" color="text.secondary">
          {`${label(from)} → ${label(to)}`}
        </Typography>
      </Box>
      <Divider />
      {plan.options.map((o) => (
        <MenuItem
          key={o.relationType}
          dense
          disabled={o.exists}
          onClick={() =>
            onChoose({
              sourceAssetId: o.sourceAssetId,
              targetAssetId: o.targetAssetId,
              relationType: o.relationType,
            })
          }
          data-testid={`asset-graph-connect-option-${o.relationType}`}
        >
          <ListItemText
            primary={
              <span>
                {typeLabel(o.relationType)}{" "}
                {o.kern && (
                  <Chip size="small" label="KERN" color="primary" variant="outlined" sx={{ height: 16, fontSize: 10, ml: 0.5 }} />
                )}
              </span>
            }
            secondary={
              o.exists
                ? t("tabs.dfd.assetGraph.connect.exists", { defaultValue: "exists already" })
                : o.mirror?.counterpartExists
                  ? t("tabs.dfd.assetGraph.connect.mirrorExists", {
                      defaultValue: "The opposite edge states the same fact — keep only one.",
                    })
                  : o.mirror?.preferred
                    ? t("tabs.dfd.assetGraph.connect.mirrorPreferred", {
                        defaultValue: "Same fact as \"{{type}}\" in the other direction (preferred).",
                        type: typeLabel(o.mirror.preferred),
                      })
                    : undefined
            }
          />
        </MenuItem>
      ))}
    </Menu>
  );
};
