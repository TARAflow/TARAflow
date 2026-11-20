// EN 50742 relevance (O17 / O18, user 2026-11-20): the interfaces to the
// safety functions and the flows crossing them — from a safety zone (trust
// boundary type "safety"), else from the path search to the safety-function
// assets; nothing without either.
import { describe, it, expect } from "vitest";
import { en50742Relevance, type En50742RelevanceInput } from "app/utils/en50742-relevance";
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
    (tb.properties as Record<string, unknown>).boundaryType = "safety";
    (project.dfd as unknown as Record<string, unknown>).graph = undefined;
    const r = prepareProjectCompliance(project)!.en50742Relevance();
    expect(r.mode).toBe("zone");
    expect(r.zoneIds).toEqual([tb.id]);
    expect(r.relevant.size).toBeGreaterThan(0);
    for (const reason of r.relevant.values()) expect(["crosses-zone", "zone-interface"]).toContain(reason.kind);
  });
});
