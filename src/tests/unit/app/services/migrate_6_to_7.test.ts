// src/tests/unit/app/services/migrate_6_to_7.test.ts
//
// Risk identity (schema 6 → 7): Risk.id "R-<threat display id>" → "R-<threat
// UUID>", references repointed in one pass. The fixture reproduces the two
// failure modes seen in a real project (Nussbaum DataTrack):
//   - a renumber left R-DF31-I-1 pointing at the threat now labelled DF32-I-1
//   - two risks shared the id R-DS4-T-1 (manual + generated threat, same label)

import { describe, it, expect } from "vitest";
import { migrate_6_to_7 } from "app/services/versions/migrate-6-to-7";
import { applyMigrations } from "app/services/migration-service";
import { CURRENT_SCHEMA_VERSION } from "app/services/schema-version";
import {
  createDefaultRiskData,
  createEmptyRisk,
} from "features/risks/models/risk-assessment-types";
import { formatRiskLabel } from "shared/models/risk-label";
import type { ThreatReference } from "shared";

const T_RENUMBERED = "11111111-1111-4111-8111-111111111111";
const T_GENERATED = "22222222-2222-4222-8222-222222222222";
const T_MANUAL = "33333333-3333-4333-8333-333333333333";

function v6Project(): any {
  return {
    schemaVersion: 6,
    risks: {
      configuration: {},
      risks: [
        // stale after renumber: label says DF31, threat is now DF32
        { id: "R-DF31-I-1", threatId: T_RENUMBERED, threatDisplayId: "DF31-I-1" },
        // duplicate key — generated and manual threat both labelled DS4-T-1
        { id: "R-DS4-T-1", threatId: T_GENERATED, threatDisplayId: "DS4-T-1" },
        { id: "R-DS4-T-1", threatId: T_MANUAL, threatDisplayId: "DS4-T-1" },
      ],
    },
    attackTrees: {
      trees: [
        { id: "AT-1", anchor: { type: "risk", riskId: "R-DF31-I-1", riskLevel: "12" } },
        { id: "AT-2", anchor: { type: "threat", threatId: T_GENERATED } },
      ],
    },
    dfd: {
      xml: "<mxGraphModel/>",
      elements: [
        {
          id: "el-1",
          properties: {
            controlProvenance: { setBy: "apply_suggestion", riskId: "R-DF31-I-1" },
          },
        },
      ],
    },
  };
}

describe("migrate_6_to_7 — Risk.id keyed on the threat UUID", () => {
  it("rekeys every risk to R-<threatId> and makes the ids unique", () => {
    const out = migrate_6_to_7(v6Project());
    const ids = out.risks.risks.map((r: any) => r.id);

    expect(ids).toEqual([
      `R-${T_RENUMBERED}`,
      `R-${T_GENERATED}`,
      `R-${T_MANUAL}`,
    ]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(out.schemaVersion).toBe(7);
  });

  it("keeps threatId and the display label untouched", () => {
    const out = migrate_6_to_7(v6Project());
    const r = out.risks.risks[0];

    expect(r.threatId).toBe(T_RENUMBERED);
    expect(r.threatDisplayId).toBe("DF31-I-1"); // refreshed by the risk sync, not here
  });

  it("repoints risk anchors and adds a readable riskDisplayId snapshot", () => {
    const out = migrate_6_to_7(v6Project());
    const [riskTree, threatTree] = out.attackTrees.trees;

    expect(riskTree.anchor.riskId).toBe(`R-${T_RENUMBERED}`);
    expect(riskTree.anchor.riskDisplayId).toBe("R-DF31-I-1");
    expect(threatTree).toEqual(v6Project().attackTrees.trees[1]); // untouched
  });

  it("repoints riskId in dfd control provenance, leaves the xml string alone", () => {
    const out = migrate_6_to_7(v6Project());

    expect(out.dfd.elements[0].properties.controlProvenance.riskId).toBe(
      `R-${T_RENUMBERED}`,
    );
    expect(out.dfd.xml).toBe("<mxGraphModel/>");
  });

  it("is idempotent", () => {
    const once = migrate_6_to_7(v6Project());
    const twice = migrate_6_to_7(once);

    expect(twice).toEqual(once);
  });

  it("runs as part of applyMigrations up to the current schema", () => {
    const { data, migrated } = applyMigrations(v6Project());

    expect(migrated).toBe(true);
    expect(data.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(data.risks.risks[2].id).toBe(`R-${T_MANUAL}`);
  });
});

describe("createEmptyRisk / formatRiskLabel", () => {
  const threat: ThreatReference = {
    id: T_GENERATED,
    displayId: "DS4-T-1",
    strideCategory: "T",
    threatDescription: "Tampering with the cache",
    attackDescription: "",
    sourceStrideMethod: "per-element",
    relevance: "relevant",
    proposedMitigations: [],
    proposedVerifications: [],
    trustBoundaryId: null,
    trustBoundaryName: null,
    linkedAssetIds: [],
  };

  it("keys a new risk on the threat UUID, labels it with the display id", () => {
    const risk = createEmptyRisk(threat, createDefaultRiskData().configuration);

    expect(risk.id).toBe(`R-${T_GENERATED}`);
    expect(formatRiskLabel(risk)).toBe("R-DS4-T-1");
  });

  it("falls back to the raw id when no display label is known", () => {
    expect(formatRiskLabel({ id: "R-legacy" })).toBe("R-legacy");
  });
});
