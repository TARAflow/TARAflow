// tests/unit/features/threats/services/per-interaction/interaction-sync.scope.test.ts
//
// A data flow with no trust boundary on either side (e.g. External Entity →
// External Entity) is outside the analysed system: the per-interaction
// generator never produces threats for it. The sync check used to report it
// as "data flow without threats" — and since syncing could never add any, the
// banner stayed forever (observed: SmokeDetector "Wifi Gateway → Update Server").

import { describe, it, expect } from "vitest";
import { isInteractionFlowInScope } from "features/threats/services/per-interaction/interaction-generator";
import { interactionThreatService } from "features/threats/services/per-interaction/interaction-threat-service";
import type { ThreatProjectData } from "features/threats/models/threat-types";

describe("isInteractionFlowInScope", () => {
  it("in scope when either side has an effective trust boundary", () => {
    expect(isInteractionFlowInScope("TB-1", null, "Process")).toBe(true);
    expect(isInteractionFlowInScope(null, "TB-1", "ExternalEntity")).toBe(true);
  });
  it("out of scope with no trust boundary on either side", () => {
    expect(isInteractionFlowInScope(null, null, "ExternalEntity")).toBe(false);
    expect(isInteractionFlowInScope(undefined, undefined, "Process")).toBe(false);
  });
  it("exception: a flow terminating at a ChipBoundary", () => {
    expect(isInteractionFlowInScope(null, null, "ChipBoundary")).toBe(true);
  });
});

describe("checkSyncStatus ignores out-of-scope flows", () => {
  const el = (id: string, type: string) => ({ id, type, name: id, displayId: id });
  const conn = (id: string, from: string, to: string) => ({ id, from, to, name: id, displayId: id });

  const project = {
    threats: null,
    dfdGraph: {
      elementsById: new Map([
        ["gw", el("gw", "ExternalEntity")],
        ["srv", el("srv", "ExternalEntity")],
        ["p1", el("p1", "Process")],
      ]),
      connectionsById: new Map([
        ["ee-ee", conn("ee-ee", "gw", "srv")],
        ["ee-p", conn("ee-p", "gw", "p1")],
      ]),
      effectiveElementTrustBoundary: new Map<string, string | undefined>([
        ["gw", undefined],
        ["srv", undefined],
        ["p1", "TB-1"],
      ]),
      elementChipBoundaries: new Map(),
      elementPhysicalBoundaries: new Map(),
      dataFlowAnalysis: new Map(),
    },
  } as unknown as ThreatProjectData;

  it("EE → EE is not reported missing; a flow into a trust boundary is", () => {
    const status = interactionThreatService.checkSyncStatus(project, []);
    const missing = status.missingInThreats.dataFlows.map((c) => c.id);
    expect(missing).toEqual(["ee-p"]);
  });
});
