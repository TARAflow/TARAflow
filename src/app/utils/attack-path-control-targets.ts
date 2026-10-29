// src/app/utils/attack-path-control-targets.ts
//
// Closed-loop review CL-3 (decision 3): attack-path risks join the closed loop
// through their tree's anchor. Only asset-anchored trees emit attack-path
// threats (ISO 3.1.33, the generator's rule), so: threat id "AT-<treeId>-…" →
// tree → anchor asset → the DFD elements and flows the asset is linked to
// (Asset.linkedDFDElements). Every target is offered to the derivation, which
// keeps the effects whose target type fits:
//   element      as the threat's element (role ignored, as for STRIDE
//                per-element threats)
//   flow         as a flow element (role-less and channel effects) AND as the
//                flow with its endpoints (source / target effects); the
//                derivation de-duplicates per element × property × value.
// The derivation marks everything reached this way heuristic.

import type { AttackTreeData } from "features/attacktree";
import type { DFDData } from "features/dfd";
import type { ControlTarget } from "app/hooks/use-control-instance-derivation";

interface AssetLinks {
  id: string;
  linkedDFDElements?: { elementId: string; elementType?: string }[];
}

export function attackPathControlTargets(
  attackTrees: AttackTreeData | null | undefined,
  assets: readonly AssetLinks[] | undefined,
  dfd: DFDData | null | undefined,
): (threatId: string) => ControlTarget[] {
  const elementType = new Map((dfd?.elements ?? []).map((e) => [e.id, e.type as string]));
  const connections = new Map((dfd?.connections ?? []).map((c) => [c.id, c]));
  const assetById = new Map((assets ?? []).map((a) => [a.id, a]));

  const targetsOfTree = new Map<string, ControlTarget[]>();
  for (const tree of attackTrees?.trees ?? []) {
    if (tree.anchor?.type !== "asset" || !tree.anchor.assetId) continue;
    const links = assetById.get(tree.anchor.assetId)?.linkedDFDElements ?? [];
    const targets: ControlTarget[] = [];
    for (const link of links) {
      const flow = connections.get(link.elementId);
      if (flow) {
        targets.push({ linkedElement: { elementId: flow.id, elementType: "DataFlow" }, dataFlow: null });
        targets.push({
          linkedElement: null,
          dataFlow: {
            connectionId: flow.id,
            sourceId: flow.from,
            sourceType: elementType.get(flow.from) ?? "",
            targetId: flow.to,
            targetType: elementType.get(flow.to) ?? "",
          },
        });
        continue;
      }
      const type = elementType.get(link.elementId);
      if (type) targets.push({ linkedElement: { elementId: link.elementId, elementType: type }, dataFlow: null });
    }
    targetsOfTree.set(`AT-${tree.id}-`, targets);
  }

  return (threatId) => {
    for (const [prefix, targets] of targetsOfTree) {
      if (threatId.startsWith(prefix)) return targets;
    }
    return [];
  };
}
