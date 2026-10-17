// Leveled-DFD Phase 2c-2 (leveled-dfd-multi-diagram-design.md §11.2.1, §13):
// an ADOPTED multi-page DFD (every page in dfd.pages) is loaded, saved and
// validated like a single page — through the effective model. Graph and
// validation see the same leaves and stitched flows, so the leveled
// SmokeDetector reports exactly the single-page findings. A multi-page DFD
// that is not adopted stays refused (dfd-multi-page-guard.test.ts).
import { describe, it, expect } from "vitest";
import { dfdService } from "features/dfd/services/dfd-service";
import type { DFDProjectData } from "features/dfd/models/dfd-types";
import fixture from "../fixtures/leveled/smoke-detector-leveled.json";

const project = (
  xml: string,
  elements: unknown,
  pages?: unknown,
): DFDProjectData =>
  ({
    id: `proj-${Math.random().toString(36).slice(2)}`,
    name: "SmokeDetector",
    dfd: {
      xml,
      elements,
      connections: fixture.connections,
      assets: [],
      ...(pages ? { pages } : {}),
    },
    phaseStatus: {},
    settings: { autoSave: true, autoSaveInterval: 2 },
    lastModified: "",
  }) as unknown as DFDProjectData;

const single = project(fixture.singlePageXml, fixture.singleElements);
const leveled = project(
  fixture.leveledXml,
  fixture.leveledElements,
  fixture.pages,
);
const keys = (findings: { key: string; params?: unknown }[] = []) =>
  findings.map((f) => `${f.key} ${JSON.stringify(f.params ?? {})}`).sort();

describe("adopted leveled SmokeDetector in the DFD service", () => {
  const savedSingle = dfdService.saveDFDFromXml(single, fixture.singlePageXml);
  const saved = dfdService.saveDFDFromXml(leveled, fixture.leveledXml);

  it("saves — the guard no longer refuses an adopted multi-page DFD", () => {
    expect(saved.success).toBe(true);
    expect(saved.unsupportedPageLayout).toBeUndefined();
  });

  it("keeps the logical records and the page tree", () => {
    expect(saved.dfd.elements).toHaveLength(38); // 36 + MP-1, MP-2
    expect(saved.dfd.connections).toHaveLength(41);
    expect(saved.dfd.pages?.map((p) => p.pageId)).toEqual([
      "sys",
      "sen",
      "ctl",
    ]);
  });

  it("analyses the leaves only", () => {
    expect(saved.dfd.graph?.elementsById.size).toBe(36);
    expect(saved.dfd.graph?.elementsById.has("mp_sen")).toBe(false);
  });

  it("reports exactly the single-page validation findings", () => {
    expect(keys(saved.validation.errors)).toEqual(
      keys(savedSingle.validation.errors),
    );
    expect(keys(saved.validation.warnings)).toEqual(
      keys(savedSingle.validation.warnings),
    );
  });

  it("validates the current state the same way", () => {
    const now = dfdService.validateCurrentState({ ...leveled, dfd: saved.dfd });
    const ref = dfdService.validateCurrentState({
      ...single,
      dfd: savedSingle.dfd,
    });
    expect(keys(now.errors)).toEqual(keys(ref.errors));
    expect(keys(now.warnings)).toEqual(keys(ref.warnings));
  });

  it("loads for editing with a model (not only the XML)", () => {
    const result = dfdService.loadDFDForEditing(leveled);
    expect(result.success).toBe(true);
    expect(result.unsupportedPageLayout).toBeUndefined();
  });
});

describe("the same file without dfd.pages is not adopted", () => {
  it("stays refused", () => {
    const notAdopted = project(fixture.leveledXml, fixture.leveledElements);
    const result = dfdService.saveDFDFromXml(notAdopted, fixture.leveledXml);
    expect(result.success).toBe(false);
    expect(result.unsupportedPageLayout?.unadoptedPageNames).toEqual([
      "Top",
      "Sensor Head",
      "Smoke Detector Controller",
    ]);
  });
});
