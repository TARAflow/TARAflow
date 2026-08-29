// tests/unit/features/attacktree/attacktree-factory.ts
//
// Shared fixtures for the Attack Tree test suite.
//
// Justified (vs. the inline-fixture rule used in risk-rationale.test.ts):
// five test files all need an AttackTreeProjectData, and every validator /
// operations call takes one. Re-declaring it per file would be pure noise.
//
// Everything here is a plain builder — no mocks, no module stubbing.

import type {
  AssetReference,
  AttackTreeProjectData,
  DFDElementReference,
  MitigationReference,
  RiskReference,
  ThreatReference,
} from "features/attacktree/models/attacktree-types";

export function makeAsset(overrides: Partial<AssetReference> = {}): AssetReference {
  return {
    id: "A-001",
    name: "Config Database",
    securityGoals: [
      { type: "C", enabled: true },
      { type: "I", enabled: true },
      { type: "A", enabled: false },
    ],
    overallImpact: 3,
    ...overrides,
  };
}

export function makeThreat(
  overrides: Partial<ThreatReference> = {},
): ThreatReference {
  return {
    id: "T-001",
    displayId: "T-001",
    strideCategory: "I",
    threatDescription: "Information disclosure of config data",
    mitigation: "M-001",
    linkedAssetIds: ["A-001"],
    ...overrides,
  };
}

export function makeRisk(overrides: Partial<RiskReference> = {}): RiskReference {
  return {
    id: "R-001",
    threatId: "T-001",
    calculatedRiskBeforeMitigation: 3.5,
    moscowPriority: "must",
    ...overrides,
  };
}

export function makeDfdElement(
  overrides: Partial<DFDElementReference> = {},
): DFDElementReference {
  return {
    id: "DS-01",
    type: "DataStore",
    name: "Config Store",
    ...overrides,
  };
}

export function makeMitigation(
  overrides: Partial<MitigationReference> = {},
): MitigationReference {
  return {
    id: "M-001",
    ...overrides,
  };
}

/**
 * A project whose reference tables contain exactly the ids used by
 * DSL_VALID below — so a valid tree produces zero TARA warnings.
 */
export function makeProjectData(
  overrides: Partial<AttackTreeProjectData> = {},
): AttackTreeProjectData {
  return {
    id: "P-1",
    name: "Test Project",
    phaseStatus: {} as AttackTreeProjectData["phaseStatus"],
    isHighImpact: false,
    attackTrees: null,
    assets: [makeAsset()],
    threats: [makeThreat()],
    risks: [makeRisk()],
    dfdElements: [makeDfdElement()],
    mitigations: [makeMitigation({ id: "M-001" }), makeMitigation({ id: "M-002" })],
    lastModified: new Date().toISOString(),
    ...overrides,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// DSL fixtures
//
// NOTE: indentation is TABS. The parser derives tree depth from leading
// tab characters, so these strings must never be reformatted to spaces
// (a 2-space fallback exists, but these fixtures deliberately test tabs).
// ──────────────────────────────────────────────────────────────────────────

/** Minimal valid tree: ROOT + OR gate with two evaluated leaves. */
export const DSL_SIMPLE = [
  "Steal Config [A-001];ROOT @disclosure",
  "\tRemote Path;OR",
  "\t\tExploit API;p=0.5,i=3 [M-001]",
  "\t\tSniff Traffic;p=0.2,i=2 [M-002]",
].join("\n");

/** Same shape, extended (f,b,i) evaluation. */
export const DSL_EXTENDED = [
  "Steal Config [A-001];ROOT @disclosure",
  "\tRemote Path;OR",
  "\t\tExploit API;0.8,0.9,4 [M-001]",
  "\t\tSniff Traffic;0.2,0.5,2 [M-002]",
].join("\n");

/** AND gate — risk aggregation differs from OR. */
export const DSL_AND_GATE = [
  "Steal Config [A-001];ROOT @disclosure",
  "\tPhysical Path;AND",
  "\t\tEnter Room;p=0.2,i=3 [M-001]",
  "\t\tOpen Cabinet;p=0.4,i=3 [M-002]",
].join("\n");
