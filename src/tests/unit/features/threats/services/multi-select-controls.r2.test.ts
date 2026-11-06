// R-2 for MS-1 (release plan 0.18, model coverage plan §3): turning
// malwareProtection and physicalPathProtection into selections changes no
// threat. The same model, once with the single values of a schema-12 file
// and once with the selections the schema-13 migration writes, gives the same
// threats and the same implemented-control hints.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseAndRepair } from "app/services/migration-service";
import { resolveDfdGraph } from "app/utils/resolve-dfd-graph";
import { toReferenceGraph } from "app/utils/to-reference-graph";
import { DFDGraphAnalysisContext } from "features/dfd";
import { elementThreatGenerator } from "features/threats/services/per-element/element-generator";
import { interactionThreatGenerator } from "features/threats/services/per-interaction/interaction-generator";
import { createDefaultThreatData, type ThreatProjectData, type ThreatTable } from "features/threats/models/threat-types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const migrated: Any = parseAndRepair(JSON.parse(readFileSync("src/tests/fixtures/SmokeDetector.tara.json", "utf-8")))!;

/** The same DFD with the selections folded back into single values (the schema-12 form). */
function asSingleValues(dfd: Any): Any {
  const single = (item: Any, key: string) => {
    const value = item.properties?.[key];
    return Array.isArray(value) && value.length === 1 ? { ...item, properties: { ...item.properties, [key]: value[0] } } : item;
  };
  return {
    ...dfd,
    elements: dfd.elements.map((e: Any) => single(e, "malwareProtection")),
    connections: dfd.connections.map((c: Any) => single(c, "physicalPathProtection")),
  };
}

function threatsOf(dfd: Any): string[] {
  const graph = resolveDfdGraph(dfd)!;
  const data = { ...migrated, threats: null, dfdGraph: toReferenceGraph(graph) } as unknown as ThreatProjectData;
  const base = createDefaultThreatData().configuration;
  const tables: ThreatTable[] = [
    ...elementThreatGenerator.generateThreatsForProject(data, { ...base, activeMethod: "per-element" }, { keepManual: false }),
    ...interactionThreatGenerator.generateThreatsForProject(data, new DFDGraphAnalysisContext(graph), { ...base, activeMethod: "per-interaction" }, { keepManual: false }),
  ];
  return tables
    .flatMap((t) => t.threats)
    // Stable parts only: ids and time stamps are new on every run.
    .map((th: Any) => {
      const { id: _id, created: _c, lastModified: _m, ...rest } = th;
      return JSON.stringify(rest);
    })
    .sort();
}

describe("MS-1 keeps threat generation unchanged (R-2)", () => {
  it("the fixture carries both controls, as selections after loading", () => {
    expect(migrated.dfd.elements.some((e: Any) => Array.isArray(e.properties?.malwareProtection))).toBe(true);
    expect(migrated.dfd.connections.some((c: Any) => Array.isArray(c.properties?.physicalPathProtection))).toBe(true);
  });

  it("single values and selections give the same threats and hints", () => {
    const selections = threatsOf(migrated.dfd);
    expect(selections.length).toBeGreaterThan(0);
    expect(selections).toEqual(threatsOf(asSingleValues(migrated.dfd)));
  });
});

describe("readers of the selections (MS-1)", () => {
  // Imported here to keep the R-2 part above self-contained.
  it("a buried path in a selection still takes tampering out of scope", async () => {
    const { shouldEliminateThreat } = await import("features/threats/services/threat-elimination-filter");
    expect(shouldEliminateThreat("DataFlow", { physicalPathProtection: ["cable_duct", "buried"] }, "T")).toBe(true);
    expect(shouldEliminateThreat("DataFlow", { physicalPathProtection: "buried" }, "T")).toBe(true);
    expect(shouldEliminateThreat("DataFlow", { physicalPathProtection: ["cable_duct"] }, "T")).toBe(false);
  });

  it("every measure of a selection counts for the implemented-control hints; none counts for nothing", async () => {
    const { getImplementedMitigationHints } = await import("features/threats/services/implemented-controls-mapper");
    const ids = (props: Record<string, unknown>) => getImplementedMitigationHints("Process", props, "E").map((h) => h.id);
    expect(ids({ malwareProtection: ["sandbox", "code_signing"] })).toEqual(["M-E-001", "M-E-002"]);
    expect(ids({ malwareProtection: ["sandbox"] })).toEqual(["M-E-001"]);
    expect(ids({ malwareProtection: ["none"] })).toEqual([]);
  });
});
