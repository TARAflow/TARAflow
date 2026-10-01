// src/app/utils/build-threat-goal-links.ts
//
// App-layer projection for the threat ↔ goal cross-checks of the asset tab
// (security-goal rework, Phase 6): every threat of an enabled generator with
// its STRIDE category and linked assets. The asset feature evaluates the
// projection against its OWN working copy of the goals, so the findings
// follow edits in the asset dialog before they are saved.
//
// Which threats count:
//   - per-element and per-interaction threats of the stored tables, unless
//     the regulation preset disables that generator (the risk tab drops
//     them too);
//   - attack-path threats of asset-anchored trees whose path is relevant —
//     WITHOUT the mitigation gate of the risk tab: a relevant path violates
//     its goal whether or not a mitigation is chosen yet;
//   - not threats the analyst dismissed (relevance "not_relevant") — a goal
//     that only dismissed threats violate has no threat that realises it.
//
// The link to assets is the same rule the risk register uses
// (resolveThreatAssetIds).

import type { StrideMethod, ThreatGoalLink } from "shared";
import type { ThreatData } from "features/threats";
import type { AttackTreeData } from "features/attacktree";
import { buildAttackPathThreatReferences } from "./build-attack-path-threat-references";
import { buildElementToAssetIds, resolveThreatAssetIds } from "./threat-asset-links";

export interface ThreatGoalLinkInput {
  threats: ThreatData | null | undefined;
  assets: readonly { id: string; linkedDFDElements?: { elementId: string }[] }[] | undefined;
  dfdElements:
    | readonly { id: string; assetRelations?: { assetId: string; relationType: string }[] }[]
    | undefined;
  attackTrees: AttackTreeData | null | undefined;
  disabledStrideMethods: readonly StrideMethod[];
}

export function buildThreatGoalLinks(input: ThreatGoalLinkInput): ThreatGoalLink[] {
  const elementToAssetIds = buildElementToAssetIds(input.assets, input.dfdElements);
  const out: ThreatGoalLink[] = [];
  const seen = new Set<string>();
  const push = (link: ThreatGoalLink) => {
    if (seen.has(link.id)) return;
    seen.add(link.id);
    out.push(link);
  };

  const tables: [StrideMethod, ThreatData["perElementTables"] | undefined][] = [
    ["per-element", input.threats?.perElementTables],
    ["per-interaction", input.threats?.perInteractionTables],
  ];
  for (const [method, list] of tables) {
    if (input.disabledStrideMethods.includes(method)) continue;
    for (const table of list ?? []) {
      for (const threat of table.threats ?? []) {
        if (threat.relevance === "not_relevant") continue;
        push({
          id: threat.id,
          displayId: threat.displayId,
          strideCategory: threat.strideCategory,
          linkedAssetIds: resolveThreatAssetIds(threat, elementToAssetIds),
        });
      }
    }
  }

  if (!input.disabledStrideMethods.includes("attack-path")) {
    for (const ref of buildAttackPathThreatReferences(input.attackTrees, false)) {
      push({
        id: ref.id,
        displayId: ref.displayId,
        strideCategory: ref.strideCategory,
        linkedAssetIds: ref.linkedAssetIds ?? [],
      });
    }
  }
  return out;
}
