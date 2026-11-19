// src/tests/unit/app/services/component-import/copy-ratings.test.ts
//
// Multi-project TARA, I5 (patch 33): copy the ratings of one instance to
// another of the same import — once, no live coupling. Decisions (likelihood
// factors incl. overrides of prefilled factors with their rationale,
// relevance overrides, windows of opportunity) on by default, asset impact
// optional; "fill" keeps what the target rated, "overwrite" replaces it.

import { describe, expect, it, vi } from "vitest";
import type { Project } from "app/models/project-types";
import { parseAndRepair } from "app/services/migration-service";
import { loadProjectFixture } from "../../../../fixtures/load-fixture";
import { buildComponentSnapshot, projectMethodologyFingerprint, snapshotContentHash } from "app/services/component-import/snapshot-builder";
import { applyComponentImport } from "app/services/component-import/import-flow";
import { copyInstanceRatings, copySourcesOf } from "app/services/component-import/copy-ratings";
import { componentThreatReferences } from "app/utils/component-threats";
import { componentInstanceTfId, instanceAssetId } from "features/dfd";
import { syncRisksFromThreats } from "features/risks/services/risk-sync-service";
import { DEFAULT_CONFIGURATION } from "features/risks/models/risk-config-types";
import { createDefaultAssetData } from "features/assets";
import { flow, mxfile, node, page } from "../../../../fixtures/leveled-dfd-xml";

const component = (() => {
  const p = parseAndRepair(loadProjectFixture("SmokeDetector.tara.json")) as Project;
  for (const tb of p.threats!.perElementTables) for (const t of tb.threats.slice(0, 2)) t.relevance = "relevant";
  return p;
})();
const snapshot = buildComponentSnapshot(component);
const result = { snapshot, contentHash: snapshotContentHash(snapshot), methodology: projectMethodologyFingerprint(component), source: { commitSha: "a", schemaVersion: 14 } };

function machine(): Project {
  let ctx = {
    xml: mxfile(page("top", "Panel", node("m_plc", "externalentity", "PLC", "EE-1", 10) + node("m_p1", "process", "Logic", "P-1", 300) + flow("m_df1", "x", "DF-1", "m_plc", "m_p1"))),
    pages: [],
    pageId: "top",
    assets: [],
    elements: [
      { id: "m_plc", displayId: "EE-1", name: "PLC", type: "ExternalEntity", position: { x: 0, y: 0 }, size: { width: 1, height: 1 }, properties: {} },
      { id: "m_p1", displayId: "P-1", name: "Logic", type: "Process", position: { x: 0, y: 0 }, size: { width: 1, height: 1 }, properties: {} },
    ],
    connections: [{ id: "m_df1", displayId: "DF-1", name: "x", from: "m_plc", to: "m_p1", properties: {} }],
  } as never as Parameters<typeof applyComponentImport>[0]["context"];
  let components: Project["components"] | undefined;
  let assets = createDefaultAssetData();
  for (const [id, prefix] of [["s", "SD1"], ["t", "SD2"]] as const) {
    const a = applyComponentImport({ context: ctx, machine: { components, assets }, result, choice: { prefix, name: "SD", eeMapping: { "EE-1": "m_plc" } }, ids: { importId: "imp", instanceId: id }, importedAt: "t" });
    components = a.components;
    assets = { ...assets, assets: [...assets.assets, ...a.assets] };
    ctx = { ...ctx, xml: a.outcome.xml, pages: a.outcome.pages, elements: a.outcome.elements, connections: a.outcome.connections };
  }
  const base = { components, assets, dfd: { elements: ctx.elements, connections: ctx.connections } } as unknown as Project;
  const refs = componentThreatReferences({ ...base, risks: null } as never, "per-element");
  const risks = syncRisksFromThreats({ configuration: DEFAULT_CONFIGURATION, risks: [], lastModified: "" } as never, refs).riskData;
  return { ...base, risks } as Project;
}

const key = (() => {
  const m = machine();
  const k = snapshot.threats!.perElementTables.flatMap((t) => t.threats).find((t) =>
    m.risks!.risks.some((r) => r.threatId === componentInstanceTfId("s", `threat|${t.id}`)),
  )!.id;
  return k;
})();
const riskOf = (p: Project, inst: string) => p.risks!.risks.find((r) => r.threatId === componentInstanceTfId(inst, `threat|${key}`))!;
const setRating = (p: Project, inst: string, factorId: string, value: number, extra: object = {}): Project => ({
  ...p,
  risks: {
    ...p.risks!,
    risks: p.risks!.risks.map((r) => (r === riskOf(p, inst) ? { ...r, factorRatings: r.factorRatings.map((f) => (f.factorId === factorId ? { ...f, value, ...extra } : f)) } : r)),
  },
});
const valueOf = (p: Project, inst: string, factorId: string) => riskOf(p, inst).factorRatings.find((f) => f.factorId === factorId)!;
const apply = (p: Project, r: ReturnType<typeof copyInstanceRatings>): Project =>
  ({ ...p, components: r.components, ...(r.risks ? { risks: { ...p.risks!, risks: r.risks } } : {}), ...(r.assets ? { assets: r.assets } : {}) }) as Project;
const ALL = { decisions: true, assetImpact: false, mode: "overwrite" as const };

describe("copy ratings between instances (I5)", () => {
  it("sources: instances of the same import, not the target itself", () => {
    const m = machine();
    expect(copySourcesOf(m.components!, "t").map((i) => i.id)).toEqual(["s"]);
    const other = { ...m.components!, instances: m.components!.instances.map((i) => (i.id === "s" ? { ...i, importId: "imp2" } : i)) };
    expect(copySourcesOf(other, "t")).toEqual([]);
    expect(() => copyInstanceRatings({ ...m, components: other }, "s", "t", ALL)).toThrow(/same import/);
  });

  it("decisions: likelihood factors incl. a prefilled factor's override with its rationale, recalculated", () => {
    let m = machine();
    m = setRating(m, "s", "motive", 3);
    m = setRating(m, "s", "skill_level", 2, { source: "manual", overrideRationale: "Tools are public" });
    const recalc = vi.fn((r) => ({ ...r, calculatedLikelihood: 42 }));
    const r = copyInstanceRatings(m, "s", "t", ALL, recalc);
    const after = apply(m, r);
    expect(valueOf(after, "t", "motive").value).toBe(3);
    expect(valueOf(after, "t", "skill_level")).toMatchObject({ value: 2, overrideRationale: "Tools are public" });
    expect(riskOf(after, "t").calculatedLikelihood).toBe(42);
    expect(recalc).toHaveBeenCalled();
    expect(r.counts.factors).toBeGreaterThanOrEqual(2);
    // the source is untouched; no coupling
    expect(riskOf(after, "s")).toEqual(riskOf(m, "s"));
  });

  it("only decisions: derived values stay to the target's own context (review 2026-11-08)", () => {
    let m = machine();
    // e.g. the EN 50742 exposure level — derived from the anchor's boundary crossing per instance
    m = setRating(m, "s", "motive", 4, { source: "derived", derivedValue: 4 });
    m = setRating(m, "s", "opportunity", 2, { source: "attack-tree" });
    m = setRating(m, "s", "ease_of_exploit", 3, { source: "manual" });
    const r = copyInstanceRatings(m, "s", "t", ALL);
    const after = apply(m, r);
    expect(valueOf(after, "t", "motive").value).toBe(valueOf(m, "t", "motive").value);
    expect(valueOf(after, "t", "opportunity").value).toBe(valueOf(m, "t", "opportunity").value);
    expect(valueOf(after, "t", "ease_of_exploit").value).toBe(3);
    // the toast counts only what was really copied
    expect(r.counts.factors).toBe(1);
  });

  it("fill keeps what the target rated; overwrite replaces it", () => {
    let m = machine();
    m = setRating(m, "s", "motive", 3);
    m = setRating(m, "t", "motive", 1);
    expect(valueOf(apply(m, copyInstanceRatings(m, "s", "t", { ...ALL, mode: "fill" })), "t", "motive").value).toBe(1);
    expect(valueOf(apply(m, copyInstanceRatings(m, "s", "t", ALL)), "t", "motive").value).toBe(3);
  });

  it("relevance overrides and windows of opportunity; fill keeps the target's own", () => {
    const m = machine();
    const ov = (relevance: string, rationale: string) => ({ threatKey: "k1", relevance, rationale, componentRelevance: "relevant", date: "d" });
    const withDecisions = {
      ...m,
      components: {
        ...m.components!,
        instances: m.components!.instances.map((i) =>
          i.id === "s"
            ? { ...i, relevanceOverrides: [ov("not_relevant", "cabinet")], pathOverlays: [{ treeKey: "t1", pathKey: "p1", windowOfOpportunity: "easy", date: "d" }] }
            : { ...i, relevanceOverrides: [ov("uncertain", "own")] },
        ),
      },
    } as unknown as Project;
    const filled = copyInstanceRatings(withDecisions, "s", "t", { ...ALL, mode: "fill" }).components.instances.find((i) => i.id === "t")!;
    expect(filled.relevanceOverrides).toEqual([ov("uncertain", "own")]);
    expect(filled.pathOverlays).toEqual([{ treeKey: "t1", pathKey: "p1", windowOfOpportunity: "easy", date: "d" }]);
    const over = copyInstanceRatings(withDecisions, "s", "t", ALL);
    expect(over.components.instances.find((i) => i.id === "t")!.relevanceOverrides).toEqual([ov("not_relevant", "cabinet")]);
    expect(over.counts).toMatchObject({ relevanceOverrides: 1, pathOverlays: 1 });
  });

  it("asset impact only when asked for; then the instance assets' ratings", () => {
    const m = machine();
    const a = snapshot.assets[0];
    const src = instanceAssetId("s", a.id);
    const withImpact = {
      ...m,
      assets: { ...m.assets!, assets: m.assets!.assets.map((x) => (x.id === src ? { ...x, impactRatings: x.impactRatings.map((r, i) => (i === 0 ? { ...r, value: 3 } : r)) } : x)) },
    } as Project;
    const criterion = withImpact.assets!.assets.find((x) => x.id === src)!.impactRatings[0].criterionId;
    expect(copyInstanceRatings(withImpact, "s", "t", ALL).assets).toBeNull();
    const r = copyInstanceRatings(withImpact, "s", "t", { decisions: false, assetImpact: true, mode: "fill" });
    const target = r.assets!.assets.find((x) => x.id === instanceAssetId("t", a.id))!;
    expect(target.impactRatings.find((x) => x.criterionId === criterion)!.value).toBe(3);
    expect(r.counts.assetRatings).toBeGreaterThan(0);
    // decisions off: no overrides / windows / likelihood factors copied
    expect(r.counts).toMatchObject({ relevanceOverrides: 0, pathOverlays: 0 });
  });
});
