// tests/unit/app/utils/attack-path-control-targets.test.ts
//
// Closed-loop review CL-3 (decision 3, finding 5): attack-path risks — every
// ISO project — reach the closed loop through their tree's anchor asset and
// the DFD elements / flows it is linked to; always heuristic.

import { describe, it, expect } from "vitest";
import "i18n/services/i18n";
import { attackPathControlTargets } from "app/utils/attack-path-control-targets";
import { deriveControlInstances } from "app/hooks/use-control-instance-derivation";
import { getAllMitigations } from "features/threats/services/threat-catalog-service";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const dfd: Any = {
  elements: [
    { id: "ecu", type: "Multiprocess", properties: {} },
    { id: "act", type: "Process", properties: { inputValidation: "basic" } },
  ],
  connections: [{ id: "df", from: "ecu", to: "act", properties: { encryptionInTransit: "none" } }],
};
const trees: Any = {
  trees: [
    { id: "at-1", anchor: { type: "asset", assetId: "a1" } },
    { id: "at-2", anchor: { type: "standalone" } },
  ],
};
const assets: Any[] = [
  { id: "a1", linkedDFDElements: [{ elementId: "df", elementType: "DataFlow" }, { elementId: "act", elementType: "Process" }] },
];

// a catalog mitigation with a DataFlow channel effect and one with a Process effect
const flowMitigation = getAllMitigations().find((m) =>
  m.affectsProperties.some((e) => e.targetType === "DataFlow" && e.property === "encryptionInTransit"),
)!;
const processMitigation = getAllMitigations().find((m) =>
  m.affectsProperties.length > 0 && m.affectsProperties.every((e) => e.targetType === "Process" && !e.role),
)!;

describe("attack-path risks through the anchor", () => {
  const resolve = attackPathControlTargets(trees, assets, dfd);

  it("the tree's anchor asset → its flow (as element and as flow) and its process", () => {
    expect(resolve("AT-at-1-abc123-T")).toEqual([
      { linkedElement: { elementId: "df", elementType: "DataFlow" }, dataFlow: null },
      { linkedElement: null, dataFlow: { connectionId: "df", sourceId: "ecu", sourceType: "Multiprocess", targetId: "act", targetType: "Process" } },
      { linkedElement: { elementId: "act", elementType: "Process" }, dataFlow: null },
    ]);
    expect(resolve("AT-at-2-abc123-T")).toEqual([]);
    expect(resolve("P1-T-1")).toEqual([]);
  });

  it("the derivation yields heuristic SHOULDs on the flow and the process — without any STRIDE threats", () => {
    const risks: Any = {
      risks: [
        {
          id: "r1",
          threatId: "AT-at-1-abc123-T",
          treatment: "reduce",
          selectedMitigations: [
            { id: flowMitigation.id, status: "open" },
            { id: processMitigation.id, status: "implemented" },
          ],
        },
      ],
    };
    const instances = deriveControlInstances(null, risks, dfd, getAllMitigations(), resolve);
    const flow = instances.filter((i) => i.elementId === "df");
    const proc = instances.filter((i) => i.elementId === "act");
    expect(flow.length).toBeGreaterThan(0);
    expect(proc.length).toBeGreaterThan(0);
    expect(instances.every((i) => i.inferenceConfidence === "heuristic")).toBe(true);
    expect(new Set(instances.map((i) => i.instanceKey)).size).toBe(instances.length);
    expect(flow.every((i) => i.planned)).toBe(true);
    expect(proc.every((i) => !i.planned)).toBe(true);
  });

  it("without the resolver attack-path risks stay out (as before)", () => {
    const risks: Any = { risks: [{ id: "r1", threatId: "AT-at-1-abc123-T", treatment: "reduce", selectedMitigations: [{ id: flowMitigation.id, status: "open" }] }] };
    expect(deriveControlInstances(null, risks, dfd, getAllMitigations())).toEqual([]);
  });
});
