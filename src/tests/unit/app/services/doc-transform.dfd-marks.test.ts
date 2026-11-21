// What the page images show besides the model (0.20 patch 23): the report
// legend follows DocProjectData.dfdMarks — the badge setting and, for the
// safety-zone frame, an EN 50742 project.
import { describe, it, expect } from "vitest";
import { transformProjectToDocData } from "app/services/doc-transform";
import { parseAndRepair } from "app/services/migration-service";
import { loadProjectFixture } from "../../../fixtures/load-fixture";

describe("transformProjectToDocData — dfdMarks", () => {
  const loaded = parseAndRepair(loadProjectFixture("Simple_Test_Project.tara.json"))!;
  const project = { ...loaded, info: { ...loaded.info, tags: { ...loaded.info.tags, regulation: ["IEC 62443", "EN 50742 A"] } } };

  it("EN 50742 A project, badges by default", () => {
    expect(transformProjectToDocData(project, "en").dfdMarks).toEqual({ badges: true, en50742: true });
  });

  it("the setting off; no EN 50742 tag (the alias counts)", () => {
    const off = { ...project, settings: { ...project.settings, dfdBadges: false } };
    expect(transformProjectToDocData(off, "en").dfdMarks).toEqual({ badges: false, en50742: true });
    const other = { ...project, info: { ...project.info, tags: { ...project.info.tags, regulation: ["CRA"] } } };
    expect(transformProjectToDocData(other, "en").dfdMarks?.en50742).toBe(false);
    const alias = { ...project, info: { ...project.info, tags: { ...project.info.tags, regulation: ["EN50742_A"] } } };
    expect(transformProjectToDocData(alias, "en").dfdMarks?.en50742).toBe(true);
  });
});
