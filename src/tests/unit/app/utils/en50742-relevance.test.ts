// EN 50742 relevance (O17 / O18, user 2026-11-20): the interfaces to the
// safety functions and the flows crossing them — from a safety zone (trust
// a trust boundary marked as the safety zone), else from the path search to the safety-function
// assets; nothing without either.
import { describe, it, expect } from "vitest";
import {
  en50742Relevance,
  en50742Scope,
  threatRelevance,
  threatRelevanceText,
  type En50742RelevanceInput,
} from "app/utils/en50742-relevance";
import { EDITION_EN50742_A, RULES_BY_ID } from "features/compliance";
import { parseAndRepair } from "app/services/migration-service";
import { prepareProjectCompliance } from "app/services/compliance-report";
import { loadProjectFixture } from "../../../fixtures/load-fixture";

// Grey PLC ── DF-1 (IF-A) ──▶ Safety PLC (in zone SZ) ── DF-2 ──▶ Drive (in SZ)
// HMI ── DF-3 ──▶ Grey PLC (outside)          Safety PLC ── DF-4 (IF-B) ──▶ HMI (out)
const FLOWS = [
  { id: "DF-1", from: "grey", to: "splc" },
  { id: "DF-2", from: "splc", to: "drive" },
  { id: "DF-3", from: "hmi", to: "grey" },
  { id: "DF-4", from: "splc", to: "hmi" },
];
const ZONE_OF: Record<string, string[]> = { grey: ["NET"], splc: ["NET", "SZ"], drive: ["NET", "SZ"], hmi: [] };
const INTERFACES: Record<string, string[]> = { "DF-1": ["IF-A"], "DF-4": ["IF-B"] };

const input = (over: Partial<En50742RelevanceInput> = {}): En50742RelevanceInput => ({
  zoneIds: ["SZ"],
  boundariesOf: (id) => {
    const f = FLOWS.find((x) => x.id === id);
    return f ? { from: ZONE_OF[f.from], to: ZONE_OF[f.to] } : undefined;
  },
  safetyFunctions: [{ id: "SF-1", linkedIds: ["drive"] }],
  paths: {
    flows: FLOWS,
    interfacesOf: (id) => INTERFACES[id] ?? [],
    blocked: () => false,
    parentOf: () => undefined,
  },
  ...over,
});

describe("en50742Relevance — safety zone", () => {
  const r = en50742Relevance(input());

  it("flows crossing the zone border in either direction are relevant; inside and outside flows are not", () => {
    expect(r.mode).toBe("zone");
    expect([...r.relevant.keys()].filter((k) => k.startsWith("DF")).sort()).toEqual(["DF-1", "DF-4"]);
    expect(r.relevant.get("DF-1")).toEqual({ kind: "crosses-zone", zoneIds: ["SZ"] });
  });

  it("the interfaces those flows pass are relevant, with the flows as the reason", () => {
    expect(r.relevant.get("IF-A")).toEqual({ kind: "zone-interface", zoneIds: ["SZ"], flowIds: ["DF-1"] });
    expect(r.relevant.get("IF-B")).toEqual({ kind: "zone-interface", zoneIds: ["SZ"], flowIds: ["DF-4"] });
  });

  it("a zone wins over the path search (the path would also reach DF-3 → grey)", () => {
    expect(r.relevant.has("DF-3")).toBe(false);
  });
});

describe("en50742Relevance — without a zone", () => {
  it("path: everything on a path to a safety function, with the safety functions as the reason", () => {
    const r = en50742Relevance(input({ zoneIds: [] }));
    expect(r.mode).toBe("path");
    // backwards against the flow direction: HMI feeds the grey PLC, the safety PLC feeds HMI
    expect([...r.relevant.keys()].sort()).toEqual(["DF-1", "DF-2", "DF-3", "DF-4", "IF-A", "IF-B"]);
    expect(r.relevant.get("DF-2")).toEqual({ kind: "on-path", safetyFunctionIds: ["SF-1"] });
  });

  it("none: neither a zone nor a safety function", () => {
    const r = en50742Relevance(input({ zoneIds: [], safetyFunctions: [] }));
    expect(r).toEqual({ mode: "none", zoneIds: [], relevant: new Map() });
  });
});

describe("en50742Relevance — from a project (compliance context)", () => {
  it("SmokeDetector (safety-function assets, no zone): path mode", () => {
    const project = parseAndRepair(loadProjectFixture("SmokeDetector.tara.json"))!;
    const r = prepareProjectCompliance(project)!.en50742Relevance();
    expect(r.mode).toBe("path");
    expect(r.relevant.size).toBeGreaterThan(0);
    for (const reason of r.relevant.values()) expect(reason.kind).toBe("on-path");
  });

  it("the same project with a safety zone: zone mode, only flows across its border", () => {
    const project = parseAndRepair(loadProjectFixture("SmokeDetector.tara.json"))!;
    const tb = project.dfd!.elements.find((e) => e.type === "TrustBoundary")!;
    (tb.properties as Record<string, unknown>).safetyZone = "yes";
    (project.dfd as unknown as Record<string, unknown>).graph = undefined;
    const r = prepareProjectCompliance(project)!.en50742Relevance();
    expect(r.mode).toBe("zone");
    expect(r.zoneIds).toEqual([tb.id]);
    expect(r.relevant.size).toBeGreaterThan(0);
    for (const reason of r.relevant.values()) expect(["crosses-zone", "zone-interface"]).toContain(reason.kind);
  });
});

describe("threatRelevance — per risk (O18)", () => {
  const r = en50742Relevance(input());
  const onInterface = (id: string) => ({ linkedElement: { elementId: id, elementType: "Interface" } });
  const onFlow = (id: string) => ({ dataFlow: { connectionId: id } });

  it("an interface or flow anchor in the relevance set is relevant, with its reason", () => {
    expect(threatRelevance(onInterface("IF-A"), r)).toEqual({ relevant: true, reason: r.relevant.get("IF-A") });
    expect(threatRelevance(onFlow("DF-4"), r).relevant).toBe(true);
    expect(threatRelevance({ linkedElement: { elementId: "DF-1", elementType: "DataFlow" } }, r).relevant).toBe(true);
  });

  it("not relevant: a process anchor, a flow outside the zone, a flow off the path, nothing modelled", () => {
    expect(threatRelevance({ linkedElement: { elementId: "splc", elementType: "Process" } }, r)).toEqual({ relevant: false, reason: "not-an-interface" });
    expect(threatRelevance(onFlow("DF-2"), r)).toEqual({ relevant: false, reason: "outside-zone" });
    const path = en50742Relevance(input({ zoneIds: [], safetyFunctions: [{ id: "SF-1", linkedIds: ["grey"] }] }));
    expect(threatRelevance(onFlow("DF-2"), path)).toEqual({ relevant: false, reason: "off-path" });
    const none = en50742Relevance(input({ zoneIds: [], safetyFunctions: [] }));
    expect(threatRelevance(onFlow("DF-1"), none)).toEqual({ relevant: false, reason: "no-safety-scope" });
  });

  it("the display text names the zone, the flows and the safety functions by their labels", () => {
    const t = (key: string, o: Record<string, unknown>) => String(o.defaultValue).replace(/\{\{(\w+)\}\}/g, (_m, k: string) => String(o[k]));
    const label = (id: string) => `<${id}>`;
    expect(threatRelevanceText(threatRelevance(onInterface("IF-A"), r), label, t)).toBe(
      "the interface lies on the border of the safety zone <SZ> (<DF-1>)",
    );
    const path = en50742Relevance(input({ zoneIds: [] }));
    expect(threatRelevanceText(threatRelevance(onFlow("DF-2"), path), label, t)).toBe("on a path to the safety function <SF-1>");
    expect(threatRelevanceText({ relevant: false, reason: "outside-zone" }, label, t)).toBe("the interface / flow does not cross the safety zone");
  });
});

describe("en50742Scope — the model rows' scope (O17)", () => {
  it("relevant interfaces and flows, the flows' ends and the boundaries around those ends — nothing else", () => {
    const r = en50742Relevance(input());
    const around = (id: string) => (id === "splc" ? ["CHIP-1"] : []);
    expect([...en50742Scope(r, FLOWS, around)].sort()).toEqual(["CHIP-1", "DF-1", "DF-4", "IF-A", "IF-B", "grey", "hmi", "splc"]);
  });

  it("empty without relevance", () => {
    expect(en50742Scope(en50742Relevance(input({ zoneIds: [], safetyFunctions: [] })), FLOWS, () => []).size).toBe(0);
  });
});

describe("EN 50742 A model rows on the relevance scope (compliance context)", () => {
  it("SmokeDetector with a safety zone: the A rows' scope is the zone's, not the machine", () => {
    const project = parseAndRepair(loadProjectFixture("SmokeDetector.tara.json"))!;
    const tb = project.dfd!.elements.find((e) => e.type === "TrustBoundary")!;
    (tb.properties as Record<string, unknown>).safetyZone = "yes";
    (project.dfd as unknown as Record<string, unknown>).graph = undefined;
    const context = prepareProjectCompliance(project)!;
    const evaluation = context.evaluate(EDITION_EN50742_A);
    const relevant = context.en50742Relevance();
    for (const id of relevant.relevant.keys()) expect(evaluation.scope.has(id), id).toBe(true);
    expect(evaluation.scope.size).toBeLessThan(context.scope.size);
  });

  it("no zone and no safety function: the model rows are unknown (never met, never n/a)", () => {
    const project = parseAndRepair(loadProjectFixture("cnc-ref.tara.json"))!;
    for (const a of project.assets?.assets ?? []) delete (a as { physicalImpact?: unknown }).physicalImpact;
    const context = prepareProjectCompliance(project)!;
    expect(context.en50742Relevance().mode).toBe("none");
    const modelLabels = new Set(
      EDITION_EN50742_A.rows
        .filter((row) => row.requirementIds.some((id) => (RULES_BY_ID.get(id)?.targets.length ?? 0) > 0))
        .map((row) => row.label),
    );
    const rows = context.evaluate(EDITION_EN50742_A).achieved.rows.filter((row) => modelLabels.has(row.label));
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect([row.label, row.status]).toEqual([row.label, "unknown"]);
  });
});
