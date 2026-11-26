// The EL badges and the safety-zone frame are display only (0.20 patch 23,
// review 2026-11-21): a save of the editor's diagram stores it without them,
// so opening a project never changes its file and a component's snapshot
// hash does not depend on them.
import { describe, it, expect } from "vitest";
import { dfdService } from "features/dfd/services/dfd-service";
import { applyDfdBadges } from "features/dfd/services/dfd-badges";
import type { DFDProjectData } from "features/dfd/models/dfd-types";
import { parseAndRepair } from "app/services/migration-service";
import { loadProjectFixture } from "../../../../fixtures/load-fixture";

describe("dfdService.saveDFDFromXml — badges are not stored", () => {
  it("the editor's diagram with badges and a zone frame is saved as the plain diagram", () => {
    const project = parseAndRepair(loadProjectFixture("Simple_Test_Project.tara.json"))!;
    const xml = project.dfd!.xml!;
    const elements = new Map(
      project.dfd!.elements.map((e) => [e.id, e.type === "TrustBoundary" ? { ...e, properties: { ...e.properties, safetyZone: "yes" } } : e]),
    );
    const editor = applyDfdBadges(xml, elements, project.dfd!.pages, { enabled: true, en50742: true });
    expect(editor).toContain('type="elbadge"');
    expect(editor).toContain('type="elzone"');

    const data = { id: project.id, name: "P", phaseStatus: {}, dfd: project.dfd, settings: { autoSave: true } } as unknown as DFDProjectData;
    const saved = dfdService.saveDFDFromXml(data, editor);
    expect(saved.success).toBe(true);
    expect(saved.dfd.xml).toBe(xml);
    // the model is the same as from the plain diagram
    const plain = dfdService.saveDFDFromXml(data, xml);
    expect(saved.dfd.elements.map((e) => e.id)).toEqual(plain.dfd.elements.map((e) => e.id));
  });
});
