/**
 * Migrate schema version 6 → 7.
 * Risk identity: key Risk.id on the threat UUID instead of the threat's
 * display label. Completes the threat identity split of migrate_4_to_5, which
 * explicitly left Risk.id for a later change.
 *
 * Before: Risk.id = "R-<threat display id>" (e.g. "R-DF31-I-1"), minted once at
 * risk creation and never updated. A DFD renumber relabels the threat, so the
 * key drifted away from its threat, and a new threat receiving the freed label
 * produced a SECOND risk with the same id. riskService.updateRisk matches by id
 * and replaces every match — saving one of two colliding risks overwrote the
 * other (including its threatId).
 *
 * After:
 *   - Risk.id = "R-<threat UUID>" (generateRiskId(risk.threatId)) — stable for
 *     the life of the threat, unique because each threat has at most one risk.
 *   - The readable label is derived: formatRiskLabel(risk) →
 *     "R-<threatDisplayId>". Nothing new is persisted for it.
 *
 * Every persisted reference to a Risk.id is repointed in the same pass:
 *   - attackTrees.trees[].anchor.riskId (type "risk"), plus a riskDisplayId
 *     display snapshot so the anchor label stays readable
 *   - riskId anywhere under dfd (control provenance of "apply suggestion")
 *
 * Old ids that were DUPLICATED (the collision this migration heals) are
 * ambiguous as references; they resolve to the FIRST risk carrying that id —
 * the same risk riskService's find() resolved them to at runtime.
 *
 * Idempotent: a risk whose id already equals R-<threatId> contributes no
 * mapping; references not in the map pass through unchanged.
 */

function riskKey(threatId: string): string {
  return `R-${threatId}`;
}

/** Recursively repoint every string-valued `riskId` field found in the map. */
function rewriteRiskIdRefs(node: any, map: Map<string, string>): any {
  if (Array.isArray(node)) return node.map((n) => rewriteRiskIdRefs(n, map));
  if (node && typeof node === "object") {
    const out: Record<string, any> = {};
    for (const [key, value] of Object.entries(node)) {
      out[key] =
        key === "riskId" && typeof value === "string"
          ? (map.get(value) ?? value)
          : rewriteRiskIdRefs(value, map);
    }
    return out;
  }
  return node;
}

export function migrate_6_to_7(data: any): any {
  const risks: any[] = Array.isArray(data?.risks?.risks) ? data.risks.risks : [];

  // ── 1. Mint new keys; old id → new id (first occurrence wins) ────────────
  const idMap = new Map<string, string>();
  const labelByNewId = new Map<string, string>();
  const used = new Set<string>();

  const rekeyed = risks.map((risk) => {
    if (!risk || typeof risk.threatId !== "string" || !risk.threatId) {
      if (typeof risk?.id === "string") used.add(risk.id);
      return risk;
    }
    let newId = riskKey(risk.threatId);
    // Defensive: two risks on one threat should not exist; never merge them.
    if (used.has(newId)) newId = `${newId}-${crypto.randomUUID()}`;
    used.add(newId);

    if (typeof risk.id === "string" && risk.id !== newId && !idMap.has(risk.id)) {
      idMap.set(risk.id, newId);
    }
    // The old id WAS the readable label — best display snapshot for anchors.
    const label = risk.threatDisplayId
      ? `R-${risk.threatDisplayId}`
      : typeof risk.id === "string"
        ? risk.id
        : newId;
    labelByNewId.set(newId, label);

    return risk.id === newId ? risk : { ...risk, id: newId };
  });

  if (idMap.size === 0 && rekeyed.every((r, i) => r === risks[i])) {
    return { ...data, schemaVersion: 7 };
  }

  let next: any = {
    ...data,
    risks: { ...data.risks, risks: rekeyed },
  };

  // ── 2. Attack tree risk anchors ──────────────────────────────────────────
  if (next.attackTrees && Array.isArray(next.attackTrees.trees)) {
    next = {
      ...next,
      attackTrees: {
        ...next.attackTrees,
        trees: next.attackTrees.trees.map((tree: any) => {
          const anchor = tree?.anchor;
          if (!anchor || typeof anchor.riskId !== "string") return tree;
          const newId = idMap.get(anchor.riskId) ?? anchor.riskId;
          const riskDisplayId =
            anchor.riskDisplayId ?? labelByNewId.get(newId) ?? anchor.riskId;
          return {
            ...tree,
            anchor: { ...anchor, riskId: newId, riskDisplayId },
          };
        }),
      },
    };
  }

  // ── 3. DFD control provenance (riskId anywhere under dfd) ────────────────
  if (next.dfd && idMap.size > 0) {
    next = { ...next, dfd: rewriteRiskIdRefs(next.dfd, idMap) };
  }

  return { ...next, schemaVersion: 7 };
}
