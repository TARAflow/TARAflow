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
import { transformProjectToDocData } from "../../../src/app/services/doc-transform";
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

  it("computes the same label caches as the app (the app's transform — before 2026-11-09 they were empty)", () => {
    const project = loadFixtureProject();
    const doc = toDocProjectData(project, "de");
    const app = transformProjectToDocData(project, "de");

    expect(doc.computed.language).toBe("de");
    expect(doc.computed.moscowLabels.get("should")).toBe("Sollte");
    expect(doc.computed.strideNames.get("T")).toBe("Manipulation");
    expect(doc.computed.impactLabels.size).toBe(project.assets?.assets?.length ?? 0);
    expect(doc.computed.activeStrideMethods.length).toBeGreaterThan(0);
    const { verification: _v, ...cli } = doc.computed;
    const { verification: _w, ...own } = app.computed;
    expect(cli).toEqual(own);
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

  it("outside ISO/SAE 21434 the item definition is the system definition (neutral wording), as in the app", () => {
    const project = loadFixtureProject();
    const tags = { domain: [], platform: [], custom: [], ...(project.info?.tags ?? {}) };
    const neutral = toDocProjectData({ ...project, info: { ...project.info, tags: { ...tags, regulation: ["EN IEC 62443 (CRA)"] } } } as Project, "en");
    expect(neutral.computed.neutralItemDefinition).toBe(true);
    const iso = toDocProjectData({ ...project, info: { ...project.info, tags: { ...tags, regulation: ["ISO 21434"] } } } as Project, "en");
    expect(iso.computed.neutralItemDefinition).toBe(false);
  });
});
