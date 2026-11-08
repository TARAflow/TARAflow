// src/tests/unit/app/services/component-import/instance-quantity.test.ts
//
// Multi-project TARA, I5 (user 2026-11-08): identical units of a component
// in the same installation context are one instance with a quantity — one
// child page, one set of threats and risks; the quantity is shown at the
// instance and detected by the audit diff.

import { describe, expect, it } from "vitest";
import type { Project } from "app/models/project-types";
import { parseAndRepair } from "app/services/migration-service";
import { loadProjectFixture } from "../../../../fixtures/load-fixture";
import { buildComponentSnapshot, projectMethodologyFingerprint, snapshotContentHash } from "app/services/component-import/snapshot-builder";
import { applyComponentImport, candidateFrom } from "app/services/component-import/import-flow";
import { instanceLabel, quantityOf, withInstanceQuantity } from "app/services/component-import/instance-quantity";
import { componentThreatGroups } from "app/utils/component-threats";
import { DiffService } from "features/audit/services/diff-service";
import { flow, mxfile, node, page } from "../../../../fixtures/leveled-dfd-xml";

const component = parseAndRepair(loadProjectFixture("SmokeDetector.tara.json")) as Project;
const snapshot = buildComponentSnapshot(component);
const result = { snapshot, contentHash: snapshotContentHash(snapshot), methodology: projectMethodologyFingerprint(component), source: { commitSha: "a", schemaVersion: 14 } };
const context = () =>
  ({
    xml: mxfile(page("top", "Panel", node("m_plc", "externalentity", "Controller", "EE-1", 10) + node("m_p1", "process", "Logic", "P-1", 300) + flow("m_df1", "x", "DF-1", "m_plc", "m_p1"))),
    pages: [],
    pageId: "top",
    assets: [],
    elements: [
      { id: "m_plc", displayId: "EE-1", name: "Controller", type: "ExternalEntity", position: { x: 0, y: 0 }, size: { width: 1, height: 1 }, properties: {} },
      { id: "m_p1", displayId: "P-1", name: "Logic", type: "Process", position: { x: 0, y: 0 }, size: { width: 1, height: 1 }, properties: {} },
    ],
    connections: [{ id: "m_df1", displayId: "DF-1", name: "x", from: "m_plc", to: "m_p1", properties: {} }],
  }) as never;
const importOnce = (quantity?: number) =>
  applyComponentImport({
    context: context(),
    machine: {},
    result,
    choice: { prefix: "SD1", name: "Smoke Detector", eeMapping: { "EE-1": "m_plc" }, ...(quantity ? { quantity } : {}) },
    ids: { importId: "imp", instanceId: "inst-1" },
    importedAt: "t",
  });

describe("instance quantity (I5)", () => {
  it("quantityOf / instanceLabel: absent or 1 is one unit, ×n only above 1", () => {
    expect(quantityOf({})).toBe(1);
    expect(quantityOf({ quantity: 1 })).toBe(1);
    expect(quantityOf({ quantity: 4 })).toBe(4);
    expect(instanceLabel({ prefix: "SD1" }, "Smoke Detector")).toBe("SD1 · Smoke Detector");
    expect(instanceLabel({ prefix: "SD1", quantity: 4 }, "Smoke Detector")).toBe("SD1 · Smoke Detector ×4");
  });

  it("the import stores a quantity above 1 only", () => {
    expect("quantity" in importOnce().instance).toBe(false);
    expect("quantity" in importOnce(1).instance).toBe(false);
    expect(importOnce(4).instance.quantity).toBe(4);
  });

  it("set and reset; at least 1", () => {
    const c = importOnce().components;
    const four = withInstanceQuantity(c, "inst-1", 4);
    expect(four.instances[0].quantity).toBe(4);
    expect("quantity" in withInstanceQuantity(four, "inst-1", 1).instances[0]).toBe(false);
    expect(() => withInstanceQuantity(c, "inst-1", 0)).toThrow();
  });

  it("one set of threats whatever the quantity; the group label carries ×n", () => {
    const one = componentThreatGroups({ components: importOnce().components });
    const four = componentThreatGroups({ components: withInstanceQuantity(importOnce().components, "inst-1", 4) });
    expect(four[0].threats.length).toBe(one[0].threats.length);
    expect(four[0].label).toBe("SD1 · Smoke Detector ×4");
  });

  it("the candidate of a second import lists the existing instances with their quantity", () => {
    const c = withInstanceQuantity(importOnce().components, "inst-1", 3);
    const cand = candidateFrom(result, { components: c });
    expect(cand.existing?.instances).toEqual([{ id: "inst-1", label: "SD1 · Smoke Detector ×3", quantity: 3 }]);
  });

  it("the audit diff sees a changed quantity (commit gate)", () => {
    const base = { components: importOnce().components } as Project;
    const changed = { components: withInstanceQuantity(base.components!, "inst-1", 2) } as Project;
    const strip = (p: Project) => ({ ...p, dfd: null, assets: null, threats: null, risks: null, attackTrees: null }) as never;
    const section = new DiffService().detectChanges(strip(changed), strip(base)).find((x) => x.phase === "components");
    expect(section?.changes[0].details?.map((d) => d.field)).toContain("quantity");
  });
});
