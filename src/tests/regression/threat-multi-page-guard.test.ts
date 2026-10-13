// src/tests/regression/threat-multi-page-guard.test.ts
//
// Phase 0 of the leveled-DFD design (leveled-dfd-multi-diagram-design.md
// §13), threat side.
//
// A project file may already carry multi-page DFD XML together with a model
// merged from all pages (written by an older version or edited outside
// TARAflow). Threat generation must not replace the register with threats for
// duplicated elements, and sync must not remove threats as orphans. Both
// services refuse — independent of the GUI.

import { describe, it, expect } from "vitest";
import { elementThreatService } from "features/threats/services/per-element/element-threat-service";
import { interactionThreatService } from "features/threats/services/per-interaction/interaction-threat-service";
import { unsupportedDfdLayoutError } from "features/threats/services/dfd-page-layout-guard";
import type { ThreatProjectData } from "features/threats/models/threat-types";

const MODEL = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>`;
const TWO_PAGES = `<mxfile><diagram id="top" name="Top">${MODEL}</diagram><diagram id="sub" name="Detail">${MODEL}</diagram></mxfile>`;
const SINGLE_PAGE = `<mxfile><diagram id="top" name="Top">${MODEL}</diagram></mxfile>`;

describe("unsupportedDfdLayoutError", () => {
  it("is null for a single page, a bare model and a missing XML", () => {
    for (const dfdXml of [SINGLE_PAGE, MODEL, undefined]) {
      expect(unsupportedDfdLayoutError({ dfdXml })).toBeNull();
    }
  });

  it("explains a multi-page layout", () => {
    const error = unsupportedDfdLayoutError({ dfdXml: TWO_PAGES });
    expect(error).toContain("2 pages");
    expect(error).toContain("disabled");
  });
});

describe("DFD multi-page guard — threat generation and sync", () => {
  const threatProject = {
    id: "proj-multi-page",
    name: "multi-page guard",
    threats: null,
    phaseStatus: {},
    dfdXml: TWO_PAGES,
    lastModified: new Date().toISOString(),
  } as unknown as ThreatProjectData;

  const dfdContext = {} as never;
  const configuration = {} as never;
  const syncStatus = {} as never;
  const syncOptions = { updateReferences: true, removeOrphaned: true };

  it("per-element generation refuses", () => {
    const result = elementThreatService.generateThreats(
      threatProject,
      dfdContext,
      configuration,
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain("Unsupported draw.io page layout");
  });

  it("per-interaction generation refuses", () => {
    const result = interactionThreatService.generateThreats(
      threatProject,
      dfdContext,
      configuration,
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain("Unsupported draw.io page layout");
  });

  it("per-element and per-interaction sync refuse without touching tables", () => {
    for (const service of [elementThreatService, interactionThreatService]) {
      const result = service.synchronizeThreats(
        threatProject,
        dfdContext,
        [],
        syncStatus,
        syncOptions,
      );
      expect(result).toMatchObject({
        success: false,
        added: 0,
        removed: 0,
        updated: 0,
      });
      expect(result.threatData).toBeUndefined();
    }
  });
});
