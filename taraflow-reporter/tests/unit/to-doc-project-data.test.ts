// @vitest-environment node
//
// taraflow-reporter/tests/unit/to-doc-project-data.test.ts
//
// Unit tests for the Project → DocProjectData mapper. Uses the real
// Simple_Test_Project.tara.json fixture rather than a hand-built object,
// because Project's nested types (ProjectInfoData, DFDData, etc.) are
// defined across several features we don't want to duplicate here.

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { toDocProjectData } from "../../cli/to-doc-project-data";
import type { Project } from "../../../src/app/models/project-types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.join(
  __dirname,
  "../../../src/tests/fixtures/Simple_Test_Project.tara.json",
);

function loadFixtureProject(): Project {
  const raw = readFileSync(fixturePath, "utf-8");
  return JSON.parse(raw) as Project;
}

describe("toDocProjectData", () => {
  it("maps basic project fields 1:1", () => {
    const project = loadFixtureProject();
    const doc = toDocProjectData(project, "en");

    expect(doc.id).toBe(project.id);
    expect(doc.name).toBe(project.info.name);
    expect(doc.lastModified).toBe(project.info.lastModified);
    expect(doc.phaseStatus).toEqual(project.phaseStatus);
  });

  it("maps attackTrees (plural, on Project) to attackTree (singular, on DocProjectData)", () => {
    const project = loadFixtureProject();
    const doc = toDocProjectData(project, "en");

    expect(doc.attackTree).toEqual(project.attackTrees);
  });

  it("creates empty computed value maps, never undefined (base-generator.ts reads them unconditionally)", () => {
    const project = loadFixtureProject();
    const doc = toDocProjectData(project, "de");

    expect(doc.computed).toBeDefined();
    expect(doc.computed.language).toBe("de");
    expect(doc.computed.activeStrideMethods).toEqual([]);
    expect(doc.computed.impactLabels).toBeInstanceOf(Map);
    expect(doc.computed.impactLabels.size).toBe(0);
    expect(doc.computed.riskBeforeLabels).toBeInstanceOf(Map);
    expect(doc.computed.riskAfterLabels).toBeInstanceOf(Map);
    expect(doc.computed.strideNames).toBeInstanceOf(Map);
    expect(doc.computed.moscowLabels).toBeInstanceOf(Map);
    expect(doc.computed.statusLabels).toBeInstanceOf(Map);
  });

  it("passes dfd/assets/threats/risks/documentation through unchanged", () => {
    const project = loadFixtureProject();
    const doc = toDocProjectData(project, "en");

    expect(doc.dfd).toEqual(project.dfd);
    expect(doc.assets).toEqual(project.assets);
    expect(doc.threats).toEqual(project.threats);
    expect(doc.risks).toEqual(project.risks);
    expect(doc.documentation).toEqual(project.documentation);
  });

  it("passes the item definition through (WP-09-01, ISO 21434 plan A-5); absent stays absent", () => {
    const project = loadFixtureProject();
    expect("itemDefinition" in toDocProjectData(project, "en")).toBe(false);
    const itemDefinition = { sections: { boundary: { text: "Controller" } }, functions: [], assumptions: [] };
    expect(toDocProjectData({ ...project, itemDefinition }, "en").itemDefinition).toEqual(itemDefinition);
  });

  it("passes goals / claims through and adds the verification status under ISO 21434 only (plan Phase 4)", () => {
    const project = loadFixtureProject();
    const doc = toDocProjectData(project, "en");
    expect("cybersecurityConcept" in doc).toBe(false);
    expect(doc.computed.verification).toBeUndefined();

    const cybersecurityConcept = { goals: [], claims: [], verifications: [] };
    const iso = {
      ...project,
      info: { ...project.info, tags: { ...project.info.tags, regulation: ["ISO/SAE 21434"] } },
      cybersecurityConcept,
    } as Project;
    const isoDoc = toDocProjectData(iso, "en");
    expect(isoDoc.cybersecurityConcept).toEqual(cybersecurityConcept);
    expect(isoDoc.computed.verification?.kind).toBe("none");
  });
});
