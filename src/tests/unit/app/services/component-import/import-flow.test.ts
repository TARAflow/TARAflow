// src/tests/unit/app/services/component-import/import-flow.test.ts
//
// Multi-project TARA, phase 1 (design §5, §6.4, §17 I2): the pure steps of
// the import — candidate shown in the dialog, mappable machine elements,
// default prefix, applying the choice (DFD + project.components), a second
// import of the same component reusing the imported state.

import { describe, expect, it } from "vitest";
import type { Project } from "app/models/project-types";
import { parseAndRepair } from "app/services/migration-service";
import { loadProjectFixture } from "../../../../fixtures/load-fixture";
import { buildComponentSnapshot, projectMethodologyFingerprint, snapshotContentHash } from "app/services/component-import/snapshot-builder";
import {
  applyComponentImport,
  candidateFrom,
  defaultPrefix,
  machineElementOptions,
  unresolvableFlows,
} from "app/services/component-import/import-flow";
import { flow, mxfile, node, page } from "../../../../fixtures/leveled-dfd-xml";
import { instanceAssetId, type ComponentInsertContext } from "features/dfd";

const smokeProject = () => parseAndRepair(loadProjectFixture("SmokeDetector.tara.json")) as Project;
const result = () => {
  const p = smokeProject();
  const snapshot = buildComponentSnapshot(p);
  return {
    snapshot,
    contentHash: snapshotContentHash(snapshot),
    methodology: projectMethodologyFingerprint(p),
    source: { commitSha: "abc123def456", schemaVersion: 14, path: "components/smoke.tara.json" },
  };
};

const context = (): ComponentInsertContext => ({
  xml: mxfile(
    page(
      "top",
      "Fire Panel",
      node("m_plc", "externalentity", "Fire Panel Controller", "EE-1", 10) +
        node("m_p1", "process", "Alarm Logic", "P-1", 300) +
        node("m_tb", "trustboundary", "Cabinet", "TB-1", 600) +
        flow("m_df1", "report alarm", "DF-1", "m_plc", "m_p1"),
    ),
  ),
  pages: [],
  pageId: "top",
    assets: [],
  elements: [
    { id: "m_plc", displayId: "EE-1", name: "Fire Panel Controller", type: "ExternalEntity", position: { x: 0, y: 0 }, size: { width: 1, height: 1 }, properties: {} },
    { id: "m_p1", displayId: "P-1", name: "Alarm Logic", type: "Process", position: { x: 0, y: 0 }, size: { width: 1, height: 1 }, properties: {} },
    { id: "m_tb", displayId: "TB-1", name: "Cabinet", type: "TrustBoundary", position: { x: 0, y: 0 }, size: { width: 1, height: 1 }, properties: {} },
  ] as never,
  connections: [{ id: "m_df1", displayId: "DF-1", name: "report alarm", from: "m_plc", to: "m_p1", properties: {} }] as never,
});

describe("defaultPrefix", () => {
  it("initials of the name and the next free number", () => {
    expect(defaultPrefix("Smoke Detector", [])).toBe("SD1");
    expect(defaultPrefix("Smoke Detector", ["SD1", "sd2"])).toBe("SD3");
    expect(defaultPrefix("Camera", [])).toBe("CAM1");
    expect(defaultPrefix("Fire Alarm Control Panel", [])).toBe("FAC1");
    expect(defaultPrefix("", [])).toBe("C1");
  });
});

describe("candidateFrom", () => {
  it("name, source, the component's EEs, flows that will not resolve (I2), default prefix", () => {
    const c = candidateFrom(result(), {});
    expect(c.name).toBe(smokeProject().info.name);
    expect(c.source.commitSha).toBe("abc123def456");
    expect(c.externalEntities.map((e) => e.id).sort()).toEqual(["11", "3", "EE-1", "EE-2", "EE-3"]);
    expect(c.unresolvableFlows.length).toBe(2);
    expect(c.existing).toBeUndefined();
    expect(c.defaultPrefix).toMatch(/^[A-Z]+1$/);
  });

  it("already imported: same state or another state", () => {
    const r = result();
    const first = applyComponentImport({ context: context(), machine: {}, result: r, choice: { prefix: "SD1", name: "SD", eeMapping: {} }, ids: { importId: "imp", instanceId: "i1" }, importedAt: "2026-11-07" });
    const machine = { components: first.components };
    // with the existing instances, for the "imported already" question (I5)
    const instances = [{ id: "i1", label: "SD1 · Smoke Detector", quantity: 1 }];
    expect(candidateFrom(r, machine).existing).toEqual({ sameState: true, label: "abc123de", instances });
    expect(candidateFrom({ ...r, contentHash: "other" }, machine).existing).toEqual({ sameState: false, label: "abc123de", instances });
    expect(candidateFrom(r, machine).usedPrefixes).toEqual(["SD1"]);
    expect(candidateFrom(r, machine).defaultPrefix).not.toBe("SD1");
  });
});

describe("unresolvableFlows", () => {
  it("lists flows from an EE to a boundary element", () => {
    expect(unresolvableFlows(result().snapshot).sort()).toEqual(["DF-18 push debug commands [req_resp]", "DF-8 pull debug commands [req_resp]"]);
  });
});

describe("machineElementOptions", () => {
  it("elements on the page shown, without boundaries", () => {
    expect(machineElementOptions(context()).map((o) => o.id)).toEqual(["m_plc", "m_p1"]);
  });
});

describe("applyComponentImport", () => {
  it("inserts the instance and records the import and the instance", () => {
    const ctx = context();
    const a = applyComponentImport({
      context: ctx,
      machine: {},
      result: result(),
      choice: { prefix: "SD1", name: "Smoke Detector", eeMapping: { "EE-1": "m_plc" } },
      ids: { importId: "imp", instanceId: "inst-1" },
      importedAt: "2026-11-07T10:00:00Z",
    });
    expect(a.components.imports).toHaveLength(1);
    expect(a.components.imports[0]).toMatchObject({ id: "imp", componentId: smokeProject().id, importedAt: "2026-11-07T10:00:00Z" });
    expect(a.components.instances).toEqual([a.instance]);
    expect(a.instance).toMatchObject({ id: "inst-1", importId: "imp", prefix: "SD1", assumptions: [] });
    expect(a.instance.eeMapping).toContainEqual({ componentEeId: "EE-1", machineTfId: "m_plc" });
    expect(a.instance.eeMapping).toHaveLength(5);
    // the machine's own records stay, the instance's are added
    expect(a.outcome.elements.slice(0, 3).map((e) => e.id)).toEqual(["m_plc", "m_p1", "m_tb"]);
    expect(a.outcome.elements.some((e) => e.id === a.instance.multiprocessTfId)).toBe(true);
    expect(a.outcome.pages.some((p) => p.decomposes === a.instance.multiprocessTfId)).toBe(true);
  });

  it("a second import of the same component reuses the import and its state", () => {
    const r = result();
    const first = applyComponentImport({ context: context(), machine: {}, result: r, choice: { prefix: "SD1", name: "SD", eeMapping: {} }, ids: { importId: "imp", instanceId: "i1" }, importedAt: "t" });
    const ctx2: ComponentInsertContext = { ...context(), xml: first.outcome.xml, pages: first.outcome.pages, elements: first.outcome.elements, connections: first.outcome.connections };
    const second = applyComponentImport({ context: ctx2, machine: { components: first.components }, result: { ...r, contentHash: "newer" }, choice: { prefix: "SD2", name: "SD 2", eeMapping: {} }, ids: { importId: "imp2", instanceId: "i2" }, importedAt: "t2" });
    expect(second.components.imports).toHaveLength(1);
    expect(second.components.imports[0].id).toBe("imp");
    expect(second.components.imports[0].contentHash).toBe(r.contentHash);
    expect(second.components.instances.map((i) => i.prefix)).toEqual(["SD1", "SD2"]);
    expect(second.instance.importId).toBe("imp");
  });

  it("the component's assets become instance assets (E5): ids per instance, prefix, origin, no impact, linked to the instance", () => {
    const r = result();
    const a = applyComponentImport({ context: context(), machine: {}, result: r, choice: { prefix: "SD1", name: "SD", eeMapping: { "EE-1": "m_plc" } }, ids: { importId: "imp", instanceId: "inst-1" }, importedAt: "t" });
    expect(a.assets).toHaveLength(r.snapshot.assets.length);
    const first = r.snapshot.assets.find((x) => (x.linkedDFDElements ?? []).length > 0)!;
    const mine = a.assets.find((x) => x.id === instanceAssetId("inst-1", first.id))!;
    expect(mine.importedFrom).toBe("SD1 · " + r.snapshot.component.name);
    // no impact from the component; one unrated row per criterion of the
    // machine's configuration so the machine can rate it (manual test 2026-11-08)
    expect(mine.impactRatings.length).toBeGreaterThan(0);
    expect(mine.impactRatings.every((x) => x.value === null)).toBe(true);
    const criteria = [{ id: "c1", name: "One" }, { id: "c2", name: "Two" }];
    const withConfig = applyComponentImport({
      context: context(),
      machine: { assets: { configuration: { impactCriteria: criteria }, assets: [] } as never },
      result: r,
      choice: { prefix: "SD1", name: "SD", eeMapping: { "EE-1": "m_plc" } },
      ids: { importId: "imp", instanceId: "inst-1" },
      importedAt: "t",
    });
    expect(withConfig.assets[0].impactRatings).toEqual([{ criterionId: "c1", value: null }, { criterionId: "c2", value: null }]);
    if (first.displayId) expect(mine.displayId).toBe(`SD1:${first.displayId}`);
    const machineIds = new Set([...a.outcome.elements, ...a.outcome.connections].map((e) => e.id));
    for (const l of mine.linkedDFDElements) expect(machineIds.has(l.elementId), l.elementId).toBe(true);
    // the DFD mirror carries the mirrored ones too, with the same ids
    for (const m of r.snapshot.dfd!.assets ?? []) {
      expect(a.outcome.assets.some((x) => x.id === instanceAssetId("inst-1", m.id)), m.id).toBe(true);
    }
  });
});
