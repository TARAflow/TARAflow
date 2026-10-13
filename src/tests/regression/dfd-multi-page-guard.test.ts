// src/tests/regression/dfd-multi-page-guard.test.ts
//
// Phase 0 of the leveled-DFD design (leveled-dfd-multi-diagram-design.md §13).
//
// Bug: the DFD parsers read every <object> of the whole mxfile and ignore the
// <diagram> page it belongs to. A second draw.io page was silently merged into
// one model (context copies became duplicate elements, page geometries
// overlapped), and a compressed page was silently read as empty — which then
// replaced the stored elements and dropped their properties and asset
// relations.
//
// Guard: no entry point derives the model from such a layout. Save is refused
// (project.dfd untouched), load hands the XML to draw.io but does not re-derive
// the model, validation reports it, and auto-numbering leaves the XML alone.
// The threat side is covered in threat-multi-page-guard.test.ts.

import { describe, it, expect } from "vitest";
import { dfdService } from "features/dfd/services/dfd-service";
import { DFDAutoNumbering } from "features/dfd/services/dfd-auto-numbering";
import { ValidationMessages } from "features/dfd/services/validators/validator-utils";
import { validatePageLayout } from "features/dfd/services/validators/page-layout-validator";
import { inspectDrawioPages } from "shared";
import type {
  DFDProjectData,
  DFDData,
  DFDElement,
} from "features/dfd/models/dfd-types";

const processObject = (id: string, label: string, idLabel: string, x: number) => `
  <object label="${label}" type="process" id="${id}">
    <mxCell style="rounded=1;" vertex="1" parent="1">
      <mxGeometry x="${x}" y="100" width="120" height="60" as="geometry"/>
    </mxCell>
  </object>
  <object label="${idLabel}" type="idlabel" id="${id}_id">
    <mxCell connectable="0" parent="${id}" vertex="1">
      <mxGeometry width="35" height="18" relative="1" as="geometry"/>
    </mxCell>
  </object>`;

const model = (body: string) =>
  `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>${body}</root></mxGraphModel>`;

const SINGLE_PAGE = `<mxfile><diagram id="top" name="Top">${model(
  processObject("p1", "Gateway", "P-1", 100),
)}</diagram></mxfile>`;

// Second page shows a context copy of P-1 (same displayId, other cell id) —
// exactly the reference-model situation that the merge got wrong.
const TWO_PAGES = `<mxfile>
  <diagram id="top" name="Top">${model(processObject("p1", "Gateway", "P-1", 100))}</diagram>
  <diagram id="sub" name="Gateway detail">${model(processObject("sub_p1", "Gateway", "P-1", 400))}</diagram>
</mxfile>`;

const COMPRESSED = `<mxfile><diagram id="top" name="Top">7ZXBbuIwEIafJkcqJyEUjiWlrbSqhMRhe7TxQKx1bOQ4BPbpd0wcKAqttFL3dnOwZv7xzPy/</diagram></mxfile>`;

const storedElement = {
  id: "p1",
  type: "process",
  name: "Gateway",
  displayId: "P-1",
  position: { x: 100, y: 100 },
  size: { width: 120, height: 60 },
  properties: { technology: "linux" },
  assetRelations: [
    { assetId: "SW-001", assetGroup: "software", relationType: "runs" },
  ],
} as unknown as DFDElement;

function makeProject(xml: string = SINGLE_PAGE): DFDProjectData {
  const dfd = {
    xml,
    elements: [storedElement],
    connections: [],
    assets: [],
  } as unknown as DFDData;
  return {
    id: "proj-multi-page",
    name: "multi-page guard",
    dfd,
    phaseStatus: {} as never,
    settings: { autoSave: true, autoSaveInterval: 2 },
    lastModified: new Date().toISOString(),
  };
}

describe("DFD multi-page guard — save", () => {
  it("still saves a single uncompressed page wrapped in <mxfile>", () => {
    const result = dfdService.saveDFDFromXml(makeProject(), SINGLE_PAGE);
    expect(result.success).toBe(true);
    expect(result.unsupportedPageLayout).toBeUndefined();
    expect(result.dfd.elements.map((e) => e.displayId)).toEqual(["P-1"]);
  });

  it("refuses to save a two-page diagram and reports it", () => {
    const result = dfdService.saveDFDFromXml(makeProject(), TWO_PAGES);
    expect(result.success).toBe(false);
    expect(result.unsupportedPageLayout?.pageCount).toBe(2);
    expect(result.error).toContain("2 pages");
    expect(result.validation.errors.map((f) => f.key)).toEqual([
      ValidationMessages.MULTI_PAGE_NOT_SUPPORTED,
    ]);
  });

  it("refuses to save a compressed page instead of wiping the elements", () => {
    const project = makeProject();
    const result = dfdService.saveDFDFromXml(project, COMPRESSED);
    expect(result.success).toBe(false);
    expect(result.validation.errors.map((f) => f.key)).toEqual([
      ValidationMessages.COMPRESSED_PAGE_NOT_SUPPORTED,
    ]);
    // The stored model — properties and asset relations — is untouched.
    expect(project.dfd!.elements).toEqual([storedElement]);
  });

  it("would have merged the pages without the guard (documents the bug)", () => {
    // The raw parser still merges; the guard sits in front of it.
    const parsed = (dfdService as unknown as {
      parser: { parse(xml: string): { elements: DFDElement[] } };
    }).parser.parse(TWO_PAGES);
    expect(parsed.elements.filter((e) => e.displayId === "P-1")).toHaveLength(2);
  });
});

describe("DFD multi-page guard — load", () => {
  it("does not re-derive project.dfd from a multi-page XML", () => {
    const project = makeProject(TWO_PAGES);
    const before = project.dfd;

    const result = dfdService.loadDFDForEditing(project);

    expect(result.success).toBe(true); // draw.io still opens to show the pages
    expect(result.hasData).toBe(true);
    expect(result.unsupportedPageLayout?.pageNames).toEqual([
      "Top",
      "Gateway detail",
    ]);
    expect(project.dfd).toBe(before);
    expect(project.dfd!.elements).toEqual([storedElement]);
  });

  it("loads a single page as before", () => {
    const project = makeProject(SINGLE_PAGE);
    const result = dfdService.loadDFDForEditing(project);
    expect(result.success).toBe(true);
    expect(result.unsupportedPageLayout).toBeUndefined();
    expect(project.dfd!.elements[0].assetRelations).toEqual(
      storedElement.assetRelations,
    );
  });
});

describe("DFD multi-page guard — validation findings", () => {
  it("maps an unsupported layout to error findings with page names", () => {
    const findings = validatePageLayout(inspectDrawioPages(TWO_PAGES));
    expect(findings).toEqual([
      {
        key: ValidationMessages.MULTI_PAGE_NOT_SUPPORTED,
        params: { count: 2, pages: "Top, Gateway detail" },
      },
    ]);
  });

  it("is empty for a supported layout", () => {
    expect(validatePageLayout(inspectDrawioPages(SINGLE_PAGE))).toEqual([]);
  });
});

describe("DFD multi-page guard — auto-numbering", () => {
  it("leaves a multi-page XML untouched", () => {
    const numbering = new DFDAutoNumbering();
    expect(numbering.autoNumber(TWO_PAGES)).toBe(TWO_PAGES);
  });
});
