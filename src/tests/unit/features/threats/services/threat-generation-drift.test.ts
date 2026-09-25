// tests/unit/features/threats/services/threat-generation-drift.test.ts
//
// Stored threats do not follow a change of the generation rules (or of the
// security goals) on their own. A full regeneration would then silently drop
// every generated threat the current rules no longer produce — with the
// analyst's work and, on the next risk sync, the risk. detectGenerationDrift
// makes that visible BEFORE anything is dropped; resolution is always explicit
// (keep as manual / remove).

import { describe, it, expect } from "vitest";
import {
  detectGenerationDrift,
  hasDrift,
  keepThreatsAsManual,
  removeThreats,
  NO_DRIFT,
} from "features/threats/services/threat-generation-drift";
import { elementThreatGenerator } from "features/threats/services/per-element/element-generator";
import type {
  ThreatConfiguration,
  ThreatProjectData,
  ThreatTable,
} from "features/threats/models/threat-types";
import type { DFDAnalysisContext, DFDElementReference } from "shared";

// ──────────────────────────────────────────────────────────────────────────
// Fixtures — one DataStore (base T, R, I, D) linked to one asset.
// Without element properties the security goals filter the base:
//   goals {I}    → T
//   goals {I, C} → T, I
// ──────────────────────────────────────────────────────────────────────────

const store: DFDElementReference = {
  id: "ds-1",
  type: "DataStore",
  name: "Config Store",
  displayId: "DS-1",
} as DFDElementReference;

const config = {
  activeMethod: "per-element",
  forceClassicMode: false,
} as unknown as ThreatConfiguration;

const ctx = {} as DFDAnalysisContext;

function project(
  goalTypes: string[],
  tables: ThreatTable[] | null = null,
): ThreatProjectData {
  return {
    threats: tables
      ? { perElementTables: tables, perInteractionTables: [] }
      : null,
    dfdGraph: {
      elementsById: new Map([[store.id, store]]),
      connectionsById: new Map(),
      effectiveElementTrustBoundary: new Map<string, string | null>([
        [store.id, null],
      ]),
      elementPhysicalBoundaries: new Map<string, string[]>(),
      elementChipBoundaries: new Map<string, string[]>(),
    },
    assetDataRef: {
      assets: [
        {
          id: "a-1",
          name: "Config",
          linkedElementIds: [store.id],
          securityGoals: goalTypes.map((type) => ({ type, level: "high" })),
        },
      ],
    },
  } as unknown as ThreatProjectData;
}

/** What the generator stores today for the given goals. */
function generated(goalTypes: string[]): ThreatTable[] {
  return elementThreatGenerator.generateThreatsForProject(
    project(goalTypes),
    config,
  );
}

const categories = (tables: ThreatTable[]) =>
  tables.flatMap((t) => t.threats.map((th) => th.strideCategory)).sort();

const drift = (goalTypes: string[], stored: ThreatTable[]) =>
  detectGenerationDrift(project(goalTypes, stored), ctx, config, "per-element");

// ──────────────────────────────────────────────────────────────────────────

describe("detectGenerationDrift", () => {
  it("fixture sanity: goals filter the DataStore base as expected", () => {
    expect(categories(generated(["I"]))).toEqual(["T"]);
    expect(categories(generated(["I", "C"]))).toEqual(["I", "T"]);
  });

  it("no drift when the stored set matches the current rules", () => {
    const d = drift(["I", "C"], generated(["I", "C"]));
    expect(d).toEqual(NO_DRIFT);
    expect(hasDrift(d)).toBe(false);
  });

  it("goal removed → the now-unproduced threat is obsolete, with its identity", () => {
    const stored = generated(["I", "C"]);
    const d = drift(["I"], stored);
    expect(d.addedCount).toBe(0);
    expect(d.obsolete).toHaveLength(1);
    const iThreat = stored[0].threats.find((t) => t.strideCategory === "I")!;
    expect(d.obsolete[0]).toMatchObject({
      threatId: iThreat.id,
      displayId: iThreat.displayId,
      strideCategory: "I",
      elementName: "Config Store",
    });
  });

  it("goal added → counted as to-be-added, nothing obsolete", () => {
    const d = drift(["I", "C"], generated(["I"]));
    expect(d.obsolete).toEqual([]);
    expect(d.addedCount).toBe(1);
  });

  it("manual threats are never obsolete", () => {
    const fresh = generated(["I", "C"]);
    const stored = keepThreatsAsManual(
      fresh,
      new Set(fresh.flatMap((t) => t.threats.map((th) => th.id))),
    );
    // all stored threats manual → nothing generated to compare against
    expect(drift(["I"], stored)).toEqual(NO_DRIFT);
  });

  it("nothing generated yet → no drift (only meaningful against an existing set)", () => {
    expect(
      detectGenerationDrift(project(["I"]), ctx, config, "per-element"),
    ).toEqual(NO_DRIFT);
  });
});

describe("resolution actions", () => {
  const stored = generated(["I", "C"]);
  const iId = stored[0].threats.find((t) => t.strideCategory === "I")!.id;

  it("keepThreatsAsManual: same id, source manual, others untouched", () => {
    const kept = keepThreatsAsManual(stored, new Set([iId]));
    const all = kept.flatMap((t) => t.threats);
    expect(all.find((t) => t.id === iId)!.source).toBe("manual");
    expect(all.filter((t) => t.id !== iId).every((t) => t.source !== "manual")).toBe(true);
    // resolved: the kept threat no longer counts as obsolete
    expect(drift(["I"], kept)).toEqual(NO_DRIFT);
  });

  it("kept threat survives a regeneration under the new rules", () => {
    const kept = keepThreatsAsManual(stored, new Set([iId]));
    const regenerated = elementThreatGenerator.generateThreatsForProject(
      project(["I"], kept),
      config,
      { keepManual: true },
    );
    expect(regenerated.flatMap((t) => t.threats).some((t) => t.id === iId)).toBe(true);
  });

  it("removeThreats: removes only the given ids, drops emptied tables", () => {
    const removed = removeThreats(stored, new Set([iId]));
    expect(removed.flatMap((t) => t.threats).map((t) => t.id)).not.toContain(iId);
    expect(drift(["I"], removed)).toEqual(NO_DRIFT);

    const allIds = new Set(stored.flatMap((t) => t.threats.map((th) => th.id)));
    expect(removeThreats(stored, allIds)).toEqual([]);
  });

  it("empty id set is a no-op (same reference)", () => {
    expect(keepThreatsAsManual(stored, new Set())).toBe(stored);
    expect(removeThreats(stored, new Set())).toBe(stored);
  });
});
