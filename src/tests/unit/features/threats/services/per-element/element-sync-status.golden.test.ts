import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
// NOTE: align these relative paths with the sibling tests in this folder.
import { elementThreatSync } from "../../../../../../features/threats/services/per-element/element-sync";
import { elementThreatGenerator } from "../../../../../../features/threats/services/per-element/element-generator";
import type {
  ThreatProjectData,
  ThreatTable,
} from "../../../../../../features/threats/models/threat-types";
import fixture from "../../../../../fixtures/edge2-sync.fixture.json";

/**
 * Golden integration test built from the real customer project
 * (EdGe2_tara.json), trimmed to exactly what checkSyncStatus reads. It locks in
 * the structural invariants of a freshly-saved, in-sync project AND the
 * regression fix: an internal ExternalEntity whose STRIDE categories are all
 * eliminated (Operator, EE-2, id 189) must NOT be reported "missing in threats"
 * — while a newly added type that WOULD get a threat (Sensor, SE-1, id 206) is
 * correctly flagged.
 *
 * getEffectiveStrideCategories is stubbed here so the assertions are fully
 * deterministic and do not depend on the (repo-only) generation strategy. A
 * separate "real strategy" block below exercises the un-stubbed path purely for
 * the totality guarantee (never throws).
 */

type RefElement = {
  id: string;
  type: string;
  name: string;
  displayId: string;
  properties: Record<string, unknown>;
};
type RefConnection = {
  id: string;
  type: string;
  displayId: string;
  label: string | null;
  name: string | null;
  excludeFromThreatGen: boolean;
};

const ELEMENTS = fixture.elements as RefElement[];
const CONNECTIONS = fixture.connections as RefConnection[];
const TABLES = fixture.perElementTables as unknown as ThreatTable[];
const EXPECTED = fixture.expected as {
  totalThreats: number;
  orphanedThreats: number;
  changedReferences: number;
  trustBoundaryChanges: number;
  missingDataFlows: number;
  threatenedElementIds: string[];
  unthreatenedNonTB: string[];
  realStrategyMissing: string[];
};
// Faithful assetDataRef (linkedElementIds + securityGoals) extracted from the
// real project — drives the CIANAAA module of the actual generation strategy.
const ASSET_DATA_REF = (fixture as any).assetDataRef as {
  assets: {
    id: string;
    linkedElementIds: string[];
    securityGoals: { type: string; level: string }[];
  }[];
};

function buildProject(
  assetDataRef: unknown = { assets: [] },
): ThreatProjectData {
  const elementsById = new Map<string, RefElement>();
  for (const e of ELEMENTS) elementsById.set(e.id, e);
  const connectionsById = new Map<string, RefConnection>();
  for (const c of CONNECTIONS) connectionsById.set(c.id, c);

  return {
    dfdGraph: { elementsById, connectionsById },
    threats: {
      configuration: { activeMethod: "per-element" },
      perElementTables: TABLES,
      perInteractionTables: [],
      lastModified: new Date().toISOString(),
    },
    assetDataRef,
  } as unknown as ThreatProjectData;
}

/** Stub effective categories by element id; default = none (not flagged). */
function stubEffective(byId: Record<string, string[]>) {
  vi.spyOn(
    elementThreatGenerator,
    "getEffectiveStrideCategories",
  ).mockImplementation(
    (element: any) => (byId[element.id] ?? []) as any,
  );
}

describe("checkSyncStatus — golden (EdGe2 project)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("structural invariants of the saved, in-sync project", () => {
    beforeEach(() => stubEffective({})); // nothing flagged as missing

    it("has the expected threat volume in the fixture", () => {
      const total = TABLES.reduce((n, t) => n + t.threats.length, 0);
      expect(total).toBe(EXPECTED.totalThreats); // 71
    });

    it("reports no orphans, no id/name drift and no TB renames", () => {
      const status = elementThreatSync.checkSyncStatus(buildProject(), TABLES);

      expect(status.orphanedThreats.threatIds).toHaveLength(
        EXPECTED.orphanedThreats,
      ); // 0 — every linkedElement resolves
      expect(status.changedReferences.elements).toHaveLength(
        EXPECTED.changedReferences,
      ); // 0 — stored ids match the expected format
      expect(status.summary.changedReferenceCount).toBe(
        EXPECTED.changedReferences + EXPECTED.trustBoundaryChanges,
      ); // 0
    });

    it("covers every data flow (no missing dataflows)", () => {
      const status = elementThreatSync.checkSyncStatus(buildProject(), TABLES);
      expect(status.missingInThreats.dataFlows).toHaveLength(
        EXPECTED.missingDataFlows,
      ); // 0 — all 12 connections are threatened
    });

    it("is fully in sync when no element is missing", () => {
      const status = elementThreatSync.checkSyncStatus(buildProject(), TABLES);
      expect(status.missingInThreats.elements).toHaveLength(0);
      expect(status.inSync).toBe(true);
    });
  });

  describe("missing-element gate (the regression)", () => {
    it("does NOT flag the Operator EE (189) when its categories are all eliminated", () => {
      // Real pipeline removes both S and R for the internal/medium Operator →
      // effective = [] → must not be reported missing (pre-fix bug: flagged
      // forever via the raw STRIDE table).
      stubEffective({ "189": [] });
      const status = elementThreatSync.checkSyncStatus(buildProject(), TABLES);
      const ids = status.missingInThreats.elements.map((e) => e.id);
      expect(ids).not.toContain("189");
    });

    it("DOES flag the Operator EE (189) if it would still receive a threat", () => {
      // Proves the gate is wired to the effective categories, not hard-coded.
      stubEffective({ "189": ["S", "R"] });
      const status = elementThreatSync.checkSyncStatus(buildProject(), TABLES);
      const ids = status.missingInThreats.elements.map((e) => e.id);
      expect(ids).toContain("189");
    });

    it("flags a newly added Sensor (206) that has no threats yet", () => {
      // User added Sensor → ["T","D"]; SE-1 has no generated threats yet, so it
      // must surface as missing (and NOT the eliminated Operator EE).
      stubEffective({ "206": ["T", "D"] });
      const status = elementThreatSync.checkSyncStatus(buildProject(), TABLES);
      const ids = status.missingInThreats.elements.map((e) => e.id);
      expect(ids).toContain("206");
      expect(ids).not.toContain("189");
      expect(status.inSync).toBe(false);
    });

    it("only ever flags the two unthreatened non-TB elements (189, 206)", () => {
      // Force every element to have effective categories. Only elements WITHOUT
      // existing threats may be flagged → exactly the two known gaps.
      stubEffective(
        Object.fromEntries(ELEMENTS.map((e) => [e.id, ["T"]])),
      );
      const status = elementThreatSync.checkSyncStatus(buildProject(), TABLES);
      const ids = status.missingInThreats.elements.map((e) => e.id).sort();
      expect(ids).toEqual([...EXPECTED.unthreatenedNonTB].sort()); // ["189","206"]
    });
  });

  describe("end-to-end with the real generation strategy", () => {
    // No stub: runs the actual UnifiedStrategy (Module 1 element properties +
    // Module 2 CIANAAA) against the real element set AND the real asset security
    // goals. The missing-element verdict for the two unthreatened elements is
    // driven purely by CIANAAA (both are type 'default' for Module 1), so it is
    // fully determined by the fixture and independent of the repo-only
    // stride-modifier functions.
    it("never throws and reports the structural facts", () => {
      const project = buildProject(ASSET_DATA_REF);
      let status!: ReturnType<typeof elementThreatSync.checkSyncStatus>;
      expect(() => {
        status = elementThreatSync.checkSyncStatus(project, TABLES);
      }).not.toThrow();

      expect(status).toBeDefined();
      expect(status.orphanedThreats.threatIds).toHaveLength(0);
      expect(status.missingInThreats.dataFlows).toHaveLength(0);
      expect(status.changedReferences.elements).toHaveLength(0);
    });

    it("eliminates the Operator EE (189) via CIANAAA and flags only the Sensor (206)", () => {
      // DA-004 carries goals {I, AuthZ} → derived {T, E}.
      //   EE-2 (189) base [S,R] ∩ {T,E} = []      → no threat → NOT missing.
      //   SE-1 (206) base [T,D] ∩ {T,E} = [T]      → would get a threat → missing.
      const status = elementThreatSync.checkSyncStatus(
        buildProject(ASSET_DATA_REF),
        TABLES,
      );
      const ids = status.missingInThreats.elements.map((e) => e.id).sort();

      expect(ids).not.toContain("189"); // the regression: eliminated, not "missing forever"
      expect(ids).toEqual([...EXPECTED.realStrategyMissing].sort()); // exactly ["206"]
    });

    it("flags the Operator EE (189) when asset goals are absent (no CIANAAA reduction)", () => {
      // Without securityGoals in the sync project, CIANAAA cannot reduce the EE's
      // base [S,R] → it resurfaces as missing. This pins the real-world
      // dependency: the sync project MUST carry assetDataRef.securityGoals for
      // the elimination to hold.
      const status = elementThreatSync.checkSyncStatus(buildProject(), TABLES);
      const ids = status.missingInThreats.elements.map((e) => e.id);
      expect(ids).toContain("189");
    });
  });
});