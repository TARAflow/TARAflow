// src/tests/unit/app/services/component-import/snapshot-builder.test.ts
//
// Multi-project TARA, phase 0 (design §4.2, §7.2, §8.2): the snapshot a
// machine embeds from a component TARA — what crosses, what stays behind,
// a stable content hash — and the component's methodology fingerprint.

import { describe, expect, it } from "vitest";
import type { Project } from "app/models/project-types";
import { parseAndRepair } from "app/services/migration-service";
import { loadProjectFixture } from "../../../../fixtures/load-fixture";
import {
  buildComponentSnapshot,
  projectMethodologyFingerprint,
  snapshotContentHash,
} from "app/services/component-import/snapshot-builder";
import { canonicalStringify } from "shared/utils/tcs-canonical";
import { ALL_PREDEFINED_FACTORS } from "features/risks/models/risk-factor-types";

// Migrated once per file and cloned per test: the old fixtures (schema 2)
// get fresh threat UUIDs on every migration (migrate 5→6) — see the
// determinism note in design §16 / phase 1.
const cache = new Map<string, Project>();
const load = (file: string): Project => {
  if (!cache.has(file)) cache.set(file, parseAndRepair(loadProjectFixture(file)) as Project);
  return structuredClone(cache.get(file)!);
};
/** cnc-ref: weighted mean, rated factors, attack trees, hazards. */
const cnc = () => load("cnc-ref.tara.json");
/** Headlamp: ISO/SAE 21434, attack trees. */
const headlamp = () => load("headlamp-iso21434.tara.json");

const INTRINSIC = new Set(ALL_PREDEFINED_FACTORS.filter((f) => f.factorClass === "intrinsic").map((f) => f.id));

/** Every key used anywhere in a value. */
function keysOf(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((v) => keysOf(v, out));
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      out.add(k);
      keysOf(v, out);
    }
  }
  return out;
}

describe("buildComponentSnapshot — what crosses", () => {
  it("identity, DFD, threats with relevance, attack trees, risks, assets", () => {
    const p = cnc();
    const s = buildComponentSnapshot(p);
    expect(s.snapshotFormat).toBe(1);
    expect(s.component).toMatchObject({ projectId: p.id, name: p.info.name });
    expect(s.dfd?.elements.length).toBe(p.dfd?.elements.length);
    expect(s.dfd?.xml).toBe(p.dfd?.xml);
    const threatCount = (t: { perElementTables: { threats: unknown[] }[]; perInteractionTables: { threats: unknown[] }[] }) =>
      [...t.perElementTables, ...t.perInteractionTables].reduce((n, tb) => n + tb.threats.length, 0);
    expect(threatCount(s.threats!)).toBe(threatCount(p.threats!));
    expect(keysOf(s.threats)).toContain("relevance");
    expect(s.attackTrees).toBeTruthy();
    expect(s.risks).toHaveLength(p.risks!.risks.length);
    expect(s.assets).toHaveLength(p.assets!.assets.length);
  });

  it("risks carry treatment, measures and only rated intrinsic factors", () => {
    const p = cnc();
    const s = buildComponentSnapshot(p);
    const withFactors = s.risks.filter((r) => r.intrinsicFactors.length > 0);
    expect(withFactors.length).toBeGreaterThan(0);
    for (const r of s.risks) {
      for (const f of r.intrinsicFactors) {
        expect(INTRINSIC.has(f.factorId), f.factorId).toBe(true);
        expect(f.value).toBeGreaterThan(0);
      }
      const original = p.risks!.risks.find((x) => x.id === r.id)!;
      expect(r.threatId).toBe(original.threatId);
      expect(r.treatment).toBe(original.treatment);
    }
  });

  it("ISO/SAE 21434: the attack-potential factors except the window of opportunity", () => {
    const s = buildComponentSnapshot(headlamp());
    const ids = new Set(s.risks.flatMap((r) => r.intrinsicFactors.map((f) => f.factorId)));
    expect(ids.has("iso_window_of_opportunity")).toBe(false);
    expect(ids.has("attack_tree_likelihood")).toBe(false);
    for (const id of ids) expect(INTRINSIC.has(id), id).toBe(true);
  });
});

describe("buildComponentSnapshot — what stays behind", () => {
  it("no impact, no risk levels, no context factors, no tickets, no timestamps", () => {
    const keys = keysOf(buildComponentSnapshot(cnc()));
    for (const k of [
      "impactRatings",
      "overallImpact",
      "aggregatedImpact",
      "physicalImpact",
      "factorRatings",
      "mitigatedFactorRatings",
      "calculatedImpact",
      "calculatedRiskBeforeMitigation",
      "calculatedRiskAfterMitigation",
      "isoRisk",
      "moscowPriority",
      "rejectedByTicket",
      "evidenceRef",
      "lastModified",
      "created",
      "statusChangedAt",
      "thumbnail",
      "graph",
      "protectionNeed",
    ]) {
      expect(keys.has(k), k).toBe(false);
    }
  });

  it("the DFD without derived data (graph, stats, validation, thumbnail)", () => {
    const dfd = buildComponentSnapshot(cnc()).dfd as unknown as Record<string, unknown>;
    expect(Object.keys(dfd).sort()).toEqual(expect.arrayContaining(["assets", "connections", "elements", "xml"]));
    for (const k of ["graph", "stats", "validation", "thumbnail", "lastModified"]) expect(k in dfd, k).toBe(false);
  });

  it("no hazards, Item Definition sections, audit, integration, documentation", () => {
    const s = buildComponentSnapshot(cnc()) as unknown as Record<string, unknown>;
    for (const k of ["hazards", "itemDefinition", "audit", "integration", "documentation", "settings", "phaseStatus"]) {
      expect(k in s, k).toBe(false);
    }
  });

  it("security goals cross without their per-goal impact and consequence; the mirror without protection need", () => {
    const p = cnc();
    const asset = p.assets!.assets[0] as unknown as Record<string, unknown>;
    asset.securityGoals = [
      { type: "confidentiality", level: "high", formalDescription: "keep secret", impactRatings: [{ criterionId: "safety", value: 4 }], consequence: "Jane gets hurt" },
    ];
    p.dfd = { ...p.dfd!, assets: (p.dfd!.assets ?? []).map((a, i) => (i === 0 ? { ...a, protectionNeed: "critical" as const } : a)) };
    const s = buildComponentSnapshot(p);
    const goal = (s.assets[0] as unknown as { securityGoals: Record<string, unknown>[] }).securityGoals[0];
    expect(goal).toEqual({ type: "confidentiality", level: "high", formalDescription: "keep secret" });
    expect(JSON.stringify(s)).not.toContain("Jane gets hurt");
    expect((s.dfd?.assets ?? []).some((a) => "protectionNeed" in a)).toBe(false);
  });

  it("a damage-scenario edit (per-goal impact, consequence) does not change the hash", () => {
    const withGoal = (impact: number, text: string) => {
      const p = cnc();
      (p.assets!.assets[0] as unknown as Record<string, unknown>).securityGoals = [
        { type: "integrity", level: "medium", formalDescription: "f", impactRatings: [{ criterionId: "safety", value: impact }], consequence: text },
      ];
      return snapshotContentHash(buildComponentSnapshot(p));
    };
    expect(withGoal(1, "a")).toBe(withGoal(4, "b"));
  });

  it("assumptions without their owner; goals and claims kept", () => {
    const p = cnc();
    p.itemDefinition = {
      sections: {},
      functions: [],
      assumptions: [{ id: "a1", displayId: "ASM-01", text: "Cabinet is locked", owner: "Jane Doe", status: "open" }],
    };
    p.cybersecurityConcept = { goals: [{ id: "g1" } as never], claims: [{ id: "c1" } as never], verifications: [{ id: "v1", reviewer: "Jane Doe" } as never] };
    const s = buildComponentSnapshot(p);
    expect(s.assumptions).toEqual([{ id: "a1", displayId: "ASM-01", text: "Cabinet is locked", status: "open" }]);
    expect(s.concept).toEqual({ goals: [{ id: "g1" }], claims: [{ id: "c1" }] });
    expect(JSON.stringify(s)).not.toContain("Jane Doe");
  });
});

describe("snapshotContentHash", () => {
  it("identical project → identical hash; canonical round-trip", () => {
    const a = buildComponentSnapshot(cnc());
    const b = buildComponentSnapshot(cnc());
    expect(snapshotContentHash(a)).toMatch(/^[0-9a-f]{12}$/);
    expect(snapshotContentHash(a)).toBe(snapshotContentHash(b));
    const text = canonicalStringify(a);
    expect(canonicalStringify(JSON.parse(text))).toBe(text);
  });

  it("a save (timestamps, thumbnail) or an impact change does not change the hash", () => {
    const p = cnc();
    const before = snapshotContentHash(buildComponentSnapshot(p));
    p.dfd = { ...p.dfd!, thumbnail: "data:image/png;base64,xyz", lastModified: "2099-01-01" };
    p.info = { ...p.info, lastModified: "2099-01-01" };
    p.assets = {
      ...p.assets!,
      assets: p.assets!.assets.map((a) => ({ ...a, aggregatedImpact: "CRITICAL" as never, lastModified: "2099-01-01" })),
    };
    expect(snapshotContentHash(buildComponentSnapshot(p))).toBe(before);
  });

  it("an analysis change (threat relevance, intrinsic factor) changes the hash", () => {
    const p = cnc();
    const before = snapshotContentHash(buildComponentSnapshot(p));
    const q = cnc();
    const table = q.threats!.perElementTables.find((t) => t.threats.length > 0)!;
    table.threats[0] = { ...table.threats[0], relevance: table.threats[0].relevance === "relevant" ? "not_relevant" : "relevant" } as never;
    expect(snapshotContentHash(buildComponentSnapshot(q))).not.toBe(before);
    const r = cnc();
    const risk = r.risks!.risks.find((x) => x.factorRatings.some((f) => f.factorId === "skill_level"))!;
    risk.factorRatings = risk.factorRatings.map((f) => (f.factorId === "skill_level" ? { ...f, value: f.value === 4 ? 3 : 4 } : f));
    expect(snapshotContentHash(buildComponentSnapshot(r))).not.toBe(before);
  });

  it("a context factor change does not change the hash (it never crosses)", () => {
    const p = cnc();
    const before = snapshotContentHash(buildComponentSnapshot(p));
    const risk = p.risks!.risks.find((x) => x.factorRatings.some((f) => f.factorId === "motive"))!;
    risk.factorRatings = risk.factorRatings.map((f) => (f.factorId === "motive" ? { ...f, value: f.value === 4 ? 3 : 4 } : f));
    expect(snapshotContentHash(buildComponentSnapshot(p))).toBe(before);
  });
});

describe("projectMethodologyFingerprint", () => {
  it("weighted mean: the enabled intrinsic factors", () => {
    const fp = projectMethodologyFingerprint(cnc())!;
    expect(fp.likelihoodMethod).toBe("weighted-mean");
    expect(fp.factors.map((f) => f.factorId)).toEqual(["ease_of_exploit", "skill_level"]);
  });

  it("ISO/SAE 21434: four attack-potential factors (window of opportunity is context)", () => {
    const fp = projectMethodologyFingerprint(headlamp())!;
    expect(fp.likelihoodMethod).toBe("iso-21434");
    expect(fp.factors.map((f) => f.factorId)).toEqual(["iso_elapsed_time", "iso_equipment", "iso_expertise", "iso_knowledge"]);
  });

  it("an impact-scale, risk-matrix or threshold change leaves it unchanged; a likelihood-scale change does not", () => {
    const p = cnc();
    const base = projectMethodologyFingerprint(p)!.hash;
    p.assets = { ...p.assets!, configuration: { ...p.assets!.configuration, impactScale: "5-level" } as never };
    p.risks = {
      ...p.risks!,
      configuration: { ...p.risks!.configuration, severityThresholds: { 1: 2, 2: 5 }, riskMatrix: undefined } as never,
    };
    expect(projectMethodologyFingerprint(p)!.hash).toBe(base);
    p.risks = { ...p.risks!, configuration: { ...p.risks!.configuration, scale: "5-level" } };
    expect(projectMethodologyFingerprint(p)!.hash).not.toBe(base);
  });

  it("no risk configuration → no fingerprint", () => {
    expect(projectMethodologyFingerprint({ risks: null })).toBeNull();
  });
});
