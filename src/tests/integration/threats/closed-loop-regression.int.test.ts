// Closed-loop review CL-4 — regression on the SmokeDetector fixture.
//
// Every STRIDE threat of the fixture (516) gets a reduce risk selecting its
// proposed catalog mitigations, alternately planned (open) and done
// (implemented). Through the real services the closed loop must keep its
// invariants; the counts are pinned so that a catalog or semantics change
// shows up here.

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import "i18n/services/i18n";
import { parseAndRepairWithMetadata } from "app/services/migration-service";
import { deriveControlInstances } from "app/hooks/use-control-instance-derivation";
import { computeSecurityDrifts } from "app/hooks/use-security-drift";
import { getAllMitigations } from "features/threats/services/threat-catalog-service";
import { controlPropertyOptions } from "features/dfd/models/control-property-options";
import { isInterfaceControlKeyApplicable } from "shared/models/interface-capability-registry";
import { meetsExpected, readControlValue } from "shared/utils/control-value-semantics";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const raw = JSON.parse(readFileSync(path.join(__dirname, "../../fixtures/SmokeDetector.tara.json"), "utf-8"));
const result: Any = parseAndRepairWithMetadata(raw);
const project: Any = result.project ?? result;
const threats = [...project.threats.perElementTables, ...project.threats.perInteractionTables].flatMap((t: Any) => t.threats);
const risks: Any = {
  risks: threats.map((t: Any, i: number) => ({
    id: `r-${t.id}`,
    threatId: t.id,
    treatment: "reduce",
    selectedMitigations: (t.proposedMitigations ?? [])
      .filter((m: Any) => m.id)
      .map((m: Any) => ({ id: m.id, status: i % 2 === 0 ? "open" : "implemented" })),
  })),
};
const instances = deriveControlInstances(project.threats, risks, project.dfd, getAllMitigations());
const drifts = computeSecurityDrifts(instances, project.dfd);
const all = [...project.dfd.elements, ...(project.dfd.connections ?? [])];
const byId = new Map(all.map((e: Any) => [e.id, e]));

describe("closed loop on the SmokeDetector fixture", () => {
  it("one instance per element × property × value; every SHOULD a DFD option of its element type", () => {
    expect(new Set(instances.map((i) => i.instanceKey)).size).toBe(instances.length);
    for (const i of instances) {
      const el: Any = byId.get(i.elementId);
      const type = el?.type ?? "DataFlow";
      expect([i.elementId, controlPropertyOptions(type, i.property)?.includes(i.expectedValue)]).toEqual([i.elementId, true]);
    }
  });

  it("no Interface control on an interface type it does not fit", () => {
    for (const i of instances.filter((x) => x.property.startsWith("implementedControls."))) {
      const el: Any = byId.get(i.elementId);
      expect(isInterfaceControlKeyApplicable(el?.properties?.type, i.property.split(".")[1])).toBe(true);
    }
  });

  it("status and drift agree with the shared semantics", () => {
    for (const i of instances) {
      const el: Any = byId.get(i.elementId);
      const met = meetsExpected(i.property, readControlValue(el?.properties, i.property), i.expectedValue);
      expect(i.status === "implemented").toBe(met);
    }
    const aligned = drifts.filter((d) => d.status === "aligned").length;
    expect(aligned).toBe(instances.filter((i) => i.status === "implemented").length);
  });

  it("pinned counts", () => {
    const count = (f: (i: Any) => boolean) => instances.filter(f).length;
    expect({
      instances: instances.length,
      implemented: count((i) => i.status === "implemented"),
      plannedOnly: count((i) => i.planned),
      heuristic: count((i) => i.inferenceConfidence === "heuristic"),
      drift: Object.fromEntries(
        ["aligned", "missing", "conflict", "drift"].map((s) => [s, drifts.filter((d) => d.status === s).length]),
      ),
    }).toMatchInlineSnapshot(`
      {
        "drift": {
          "aligned": 49,
          "conflict": 61,
          "drift": 0,
          "missing": 156,
        },
        "heuristic": 127,
        "implemented": 49,
        "instances": 266,
        "plannedOnly": 76,
      }
    `);
  });
});
