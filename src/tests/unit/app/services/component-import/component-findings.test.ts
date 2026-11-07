// src/tests/unit/app/services/component-import/component-findings.test.ts
//
// Multi-project TARA (design §4.1, §6.3, §8.1): findings about imported
// components — unpinned import, instance without its multiprocess, a flow
// on an imported multiprocess that is none of the component's interfaces —
// and the multiprocesses whose pages are locked for the renumber.

import { describe, expect, it } from "vitest";
import type { Project } from "app/models/project-types";
import { parseAndRepair } from "app/services/migration-service";
import { loadProjectFixture } from "../../../../fixtures/load-fixture";
import { buildComponentSnapshot, projectMethodologyFingerprint, snapshotContentHash } from "app/services/component-import/snapshot-builder";
import { applyComponentImport } from "app/services/component-import/import-flow";
import { componentFindings, importedMultiprocessIds } from "app/services/component-import/component-findings";
import { componentInstanceTfId, type ComponentInsertContext } from "features/dfd";
import { flow, mxfile, node, page } from "../../../../fixtures/leveled-dfd-xml";

function imported(source: Record<string, unknown> = { commitSha: "abc", schemaVersion: 14 }) {
  const p = parseAndRepair(loadProjectFixture("SmokeDetector.tara.json")) as Project;
  const snapshot = buildComponentSnapshot(p);
  const context: ComponentInsertContext = {
    xml: mxfile(page("top", "Fire Panel", node("m_plc", "externalentity", "Fire Panel Controller", "EE-1", 10) + node("m_p1", "process", "Alarm Logic", "P-1", 300) + flow("m_df1", "report alarm", "DF-1", "m_plc", "m_p1"))),
    pages: [],
    pageId: "top",
    elements: [
      { id: "m_plc", displayId: "EE-1", name: "Fire Panel Controller", type: "ExternalEntity", position: { x: 0, y: 0 }, size: { width: 1, height: 1 }, properties: {} },
      { id: "m_p1", displayId: "P-1", name: "Alarm Logic", type: "Process", position: { x: 0, y: 0 }, size: { width: 1, height: 1 }, properties: {} },
    ] as never,
    connections: [{ id: "m_df1", displayId: "DF-1", name: "report alarm", from: "m_plc", to: "m_p1", properties: {} }] as never,
  };
  const applied = applyComponentImport({
    context,
    machine: {},
    result: { snapshot, contentHash: snapshotContentHash(snapshot), methodology: projectMethodologyFingerprint(p), source: source as never },
    choice: { prefix: "SD1", name: "Smoke Detector", eeMapping: { "EE-1": "m_plc" } },
    ids: { importId: "imp", instanceId: "inst-1" },
    importedAt: "t",
  });
  const project = {
    components: applied.components,
    dfd: { elements: applied.outcome.elements, connections: applied.outcome.connections },
  } as unknown as Project;
  return { project, applied, snapshot };
}

describe("componentFindings", () => {
  it("no components, no findings", () => {
    expect(componentFindings({ dfd: null })).toEqual({ errors: [], warnings: [], infos: [] });
  });

  it("a freshly imported, pinned component: no findings — its boundary flows are its interfaces", () => {
    expect(componentFindings(imported().project)).toEqual({ errors: [], warnings: [], infos: [] });
  });

  it("an unpinned import: a warning on its multiprocess", () => {
    const { project, applied } = imported({ schemaVersion: 14, unpinned: "dirty" });
    const f = componentFindings(project);
    expect(f.warnings).toHaveLength(1);
    expect(f.warnings[0]).toMatchObject({
      key: "components.findings.CMP_SOURCE_UNPINNED",
      elementId: applied.instance.multiprocessTfId,
      params: { reason: "dirty" },
    });
  });

  it("an instance whose multiprocess is gone: an error", () => {
    const { project, applied } = imported();
    const without = { ...project, dfd: { ...project.dfd!, elements: project.dfd!.elements.filter((e) => e.id !== applied.instance.multiprocessTfId) } } as Project;
    expect(componentFindings(without).errors.map((e) => e.key)).toEqual(["components.findings.CMP_INSTANCE_ORPHANED"]);
  });

  it("a flow drawn to the imported multiprocess that the component does not know: an error on the flow", () => {
    const { project, applied } = imported();
    const extra = { id: "m_extra", displayId: "DF-9", name: "new interface", from: "m_p1", to: applied.instance.multiprocessTfId, properties: {} };
    const withExtra = { ...project, dfd: { ...project.dfd!, connections: [...project.dfd!.connections, extra] } } as Project;
    const f = componentFindings(withExtra);
    expect(f.errors).toHaveLength(1);
    expect(f.errors[0]).toMatchObject({ key: "components.findings.CMP_FLOW_NOT_IN_COMPONENT", elementId: "m_extra", displayId: "DF-9" });
  });
});

describe("componentFindings — changed component pages", () => {
  function withXml() {
    const { project, applied } = imported();
    return { project: { ...project, dfd: { ...project.dfd!, xml: applied.outcome.xml, pages: applied.outcome.pages } } as Project, applied };
  }

  it("the imported state: no change", () => {
    expect(componentFindings(withXml().project).warnings).toEqual([]);
  });

  it("a component element missing: a warning on the multiprocess", () => {
    const { project, applied } = withXml();
    const victim = project.dfd!.elements.find((e) => e.displayId?.startsWith("SD1:P-"))!;
    const changed = { ...project, dfd: { ...project.dfd!, elements: project.dfd!.elements.filter((e) => e.id !== victim.id) } } as Project;
    const [w] = componentFindings(changed).warnings;
    expect(w).toMatchObject({ key: "components.findings.CMP_COMPONENT_PAGE_CHANGED", elementId: applied.instance.multiprocessTfId, params: { missing: 1, added: 0 } });
  });

  it("an element drawn on the component page: counted as added", () => {
    const { project, applied } = withXml();
    const childPage = applied.outcome.pages.find((p) => p.decomposes === applied.instance.multiprocessTfId)!.pageId;
    const cell = '<object label="Intruder" type="process" id="intruder"><mxCell vertex="1" parent="1"><mxGeometry x="1" y="1" width="10" height="10" as="geometry"/></mxCell></object>';
    const xml = project.dfd!.xml!.replace(new RegExp(`(<diagram id="${childPage}"[^>]*>[\\s\\S]*?<mxCell id="1" parent="0"\\s*/>)`), `$1${cell}`);
    expect(xml).toContain("Intruder");
    const changed = { ...project, dfd: { ...project.dfd!, xml } } as Project;
    const [w] = componentFindings(changed).warnings;
    expect(w).toMatchObject({ key: "components.findings.CMP_COMPONENT_PAGE_CHANGED", params: { missing: 0, added: 1 } });
  });
});

describe("importedMultiprocessIds", () => {
  it("the instance's multiprocess and the component's own multiprocesses as machine tfIds", () => {
    const { project, applied, snapshot } = imported();
    const componentMps = (snapshot.dfd?.elements ?? []).filter((e) => e.type === "Multiprocess").map((e) => componentInstanceTfId("inst-1", e.id));
    expect(importedMultiprocessIds(project)).toEqual([applied.instance.multiprocessTfId, ...componentMps]);
  });

  it("none without components", () => {
    expect(importedMultiprocessIds({})).toEqual([]);
  });
});
