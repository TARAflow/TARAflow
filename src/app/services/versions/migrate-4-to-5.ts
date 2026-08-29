/**
 * Migrate schema version 4 → 5.
 * Threat identity split: decouple a threat's stable identity from its
 * regenerable display label.
 *
 * Before: a threat's only id was the display label ("P1-S-1"), derived from
 * the element's mutable displayId. A renumber changed the id, and every full
 * regeneration rebuilt threats from scratch — silently losing analyst edits
 * and orphaning everything keyed on the id (Risk.threatId,
 * AttackTreeAnchor.threatId, ...). Patch 1 stopped the analyst-data loss via a
 * natural-key merge; this migration removes the root cause.
 *
 * After:
 *   - Threat.id      = opaque UUID, minted here, NEVER changes again.
 *   - Threat.displayId = the old label ("P1-S-1"), regenerated on renumber.
 *
 * Because the change alters cross-feature foreign keys, the repoint happens in
 * ONE pass so the file is never left internally inconsistent:
 *   - Risk.threatId              (old label → new UUID)
 *   - AttackTreeAnchor.threatId  (old label → new UUID)
 *
 * The old label each ref held is preserved as a DISPLAY snapshot on the same
 * object (Risk.threatDisplayId / AttackTreeAnchor.threatDisplayId) so the Risk
 * grouping/columns/Jira and the tree DSL/labels keep rendering the readable
 * "P1-S-1" form while resolving identity through the UUID.
 *
 * Deliberately NOT touched here (own later hardening):
 *   - Risk.id ("R-P1-S-1")  — still unique and stable once created; becomes a
 *     UUID in its own change. Its DISPLAY string is computed from the live
 *     threat's displayId at render time.
 *   - AttackTreeAnchor.riskId — points at Risk.id, which this pass leaves as-is.
 *   - AttackTreeNode.threatRef inside DSL free-text — cannot be repointed
 *     mechanically; handled (or documented as a known limitation) separately.
 *
 * Idempotent: a threat whose id already looks like a UUID is left untouched,
 * and refs already pointing at a UUID are left untouched.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: unknown): boolean {
  return typeof value === "string" && UUID_RE.test(value);
}

function newUuid(): string {
  // crypto.randomUUID is available in the Electron main/renderer and in Node
  // ≥ 16.7; used elsewhere in the app (e.g. hazard-tab.tsx).
  return crypto.randomUUID();
}

export function migrate_4_to_5(data: any): any {
  // Map from OLD threat label (the pre-migration id) → NEW UUID, so the
  // cross-feature refs below can be repointed. A threat's display label is
  // unique across all threat tables (the generator dedups on it), so a single
  // flat map is sufficient.
  const labelToUuid = new Map<string, string>();

  const migrateThreat = (threat: any): any => {
    if (!threat || typeof threat !== "object") return threat;

    // Already migrated (has a UUID id). Ensure displayId exists as a fallback.
    if (isUuid(threat.id)) {
      if (threat.displayId == null) {
        return { ...threat, displayId: String(threat.id) };
      }
      return threat;
    }

    const oldLabel = String(threat.id ?? "");
    const uuid = newUuid();
    if (oldLabel) labelToUuid.set(oldLabel, uuid);

    return {
      ...threat,
      id: uuid,
      // Preserve an already-present displayId if somehow set; otherwise the
      // old label becomes the display label.
      displayId: threat.displayId ?? oldLabel,
    };
  };

  const migrateTable = (table: any): any => {
    if (!table || !Array.isArray(table.threats)) return table;
    return { ...table, threats: table.threats.map(migrateThreat) };
  };

  // ── 1. Split threat identity (build the label → UUID map) ────────────────
  let next = data;
  if (data.threats) {
    const threats = data.threats;
    next = {
      ...data,
      threats: {
        ...threats,
        perElementTables: Array.isArray(threats.perElementTables)
          ? threats.perElementTables.map(migrateTable)
          : threats.perElementTables,
        perInteractionTables: Array.isArray(threats.perInteractionTables)
          ? threats.perInteractionTables.map(migrateTable)
          : threats.perInteractionTables,
      },
    };
  }

  // ── 2. Repoint Risk.threatId (old label → new UUID) + snapshot label ──────
  // The pre-migration risk.threatId IS the old display label, so it seeds
  // risk.threatDisplayId directly.
  if (next.risks && Array.isArray(next.risks.risks)) {
    next = {
      ...next,
      risks: {
        ...next.risks,
        risks: next.risks.risks.map((risk: any) => {
          if (!risk) return risk;
          const oldLabel = String(risk.threatId ?? "");
          const displaySnapshot = risk.threatDisplayId ?? oldLabel;
          if (isUuid(risk.threatId)) {
            // Already a UUID FK — just ensure the display snapshot exists.
            return risk.threatDisplayId != null
              ? risk
              : { ...risk, threatDisplayId: displaySnapshot };
          }
          const repointed = labelToUuid.get(oldLabel);
          return repointed
            ? { ...risk, threatId: repointed, threatDisplayId: displaySnapshot }
            : { ...risk, threatDisplayId: displaySnapshot };
        }),
      },
    };
  }

  // ── 3. Repoint AttackTreeAnchor.threatId (old label → new UUID) + label ───
  if (next.attackTrees && Array.isArray(next.attackTrees.trees)) {
    next = {
      ...next,
      attackTrees: {
        ...next.attackTrees,
        trees: next.attackTrees.trees.map((tree: any) => {
          const anchor = tree?.anchor;
          if (!anchor || anchor.threatId == null) return tree;
          const oldLabel = String(anchor.threatId);
          const displaySnapshot = anchor.threatDisplayId ?? oldLabel;
          if (isUuid(anchor.threatId)) {
            return anchor.threatDisplayId != null
              ? tree
              : {
                  ...tree,
                  anchor: { ...anchor, threatDisplayId: displaySnapshot },
                };
          }
          const repointed = labelToUuid.get(oldLabel);
          return repointed
            ? {
                ...tree,
                anchor: {
                  ...anchor,
                  threatId: repointed,
                  threatDisplayId: displaySnapshot,
                },
              }
            : {
                ...tree,
                anchor: { ...anchor, threatDisplayId: displaySnapshot },
              };
        }),
      },
    };
  }

  return { ...next, schemaVersion: 5 };
}
