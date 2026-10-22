// Leveled-DFD Phase 4a (leveled-dfd-multi-diagram-design.md §7, D10): the
// findings of the page tree, the effective model and the occurrences reach
// the DFD validation — errors, warnings and the new infos.
import { describe, it, expect } from "vitest";
import { buildAnalysisView } from "features/dfd/services/build-dfd-graph";
import { dfdService } from "features/dfd/services/dfd-service";
import type {
  DFDPage,
  DFDProjectData,
  ValidationFinding,
} from "features/dfd/models/dfd-types";
import type { LeveledFindings } from "features/dfd/services/leveled";
import fixture from "../../../../../fixtures/leveled/smoke-detector-leveled.json";

// ---- tiny draw.io builder -------------------------------------------------

const shape = (
  type: string,
  id: string,
  y: number,
  label = id,
  idLabel?: string,
) =>
  `<object label="${label}" type="${type}" id="${id}">` +
  `<mxCell style="ellipse;" vertex="1" parent="1">` +
  `<mxGeometry x="100" y="${y}" width="80" height="80" as="geometry"/></mxCell></object>` +
  (idLabel
    ? `<object label="${idLabel}" type="idlabel" id="${id}-lbl">` +
      `<mxCell style="text;" vertex="1" parent="${id}">` +
      `<mxGeometry width="30" height="20" as="geometry"/></mxCell></object>`
    : "");
const flow = (id: string, from: string, to: string, label = id) =>
  `<object label="${label}" type="DataFlow" id="${id}">` +
  `<mxCell style="endArrow=classic;" edge="1" parent="1" source="${from}" target="${to}">` +
  `<mxGeometry relative="1" as="geometry"/></mxCell></object>`;
// The XML page name wins over dfd.pages (page tree reconciliation).
const PAGE_NAMES: Record<string, string> = { top: "Top", pm: "m" };
const page = (id: string, cells: string) =>
  `<diagram id="${id}" name="${PAGE_NAMES[id] ?? id}"><mxGraphModel><root>` +
  `<mxCell id="0"/><mxCell id="1" parent="0"/>${cells}` +
  `</root></mxGraphModel></diagram>`;
const mxfile = (...pages: string[]) => `<mxfile>${pages.join("")}</mxfile>`;

const findingsOf = (xml: string, pages: DFDPage[]): LeveledFindings =>
  buildAnalysisView({ xml, pages, elements: [], connections: [], assets: [] })
    .leveledFindings!;

const codes = (list: ValidationFinding[]) =>
  list.map((f) => f.key.replace("dfdValidation.leveled.", ""));

const TOP: DFDPage = { pageId: "top", name: "Top", order: 0 };
const CHILD: DFDPage = { pageId: "pm", name: "m", order: 0, decomposes: "m" };

// Top: EE e -> MP m.  pm (details m): process p (own part).
const topPage = (extra = "") =>
  page(
    "top",
    shape("ExternalEntity", "e", 10) +
      shape("Multiprocess", "m", 200) +
      flow("f1", "e", "m") +
      extra,
  );

describe("leveled findings — clean model", () => {
  it("the leveled SmokeDetector has no leveled findings at all", () => {
    const findings = findingsOf(fixture.leveledXml, fixture.pages as DFDPage[]);
    expect(findings).toEqual({ errors: [], warnings: [], infos: [] });
  });

  it("a single page has none (not leveled)", () => {
    const view = buildAnalysisView({
      xml: fixture.singlePageXml,
      elements: [],
      connections: [],
      assets: [],
    });
    expect(view.leveledFindings).toBeUndefined();
  });
});

describe("leveled findings — rules (§7)", () => {
  it("page tree: a page details an unknown element (warning)", () => {
    const xml = mxfile(topPage(), page("pm", shape("Process", "p", 10)));
    const findings = findingsOf(xml, [TOP, { ...CHILD, decomposes: "nope" }]);
    expect(codes(findings.warnings)).toContain("PAGE_DECOMPOSES_UNKNOWN");
  });

  it("unresolved endpoint: a flow to m is not drawn on m's page (info)", () => {
    const xml = mxfile(topPage(), page("pm", shape("Process", "p", 10)));
    const findings = findingsOf(xml, [TOP, CHILD]);
    expect(codes(findings.infos)).toEqual(["BAL_UNRESOLVED_ENDPOINT"]);
    expect(findings.infos[0]).toMatchObject({
      elementId: "f1",
      params: { flow: "f1", element: "m" },
    });
    expect(findings.errors).toEqual([]);
  });

  it("dangling copy (error)", () => {
    const xml = mxfile(
      topPage(),
      page("pm", shape("Process", "p", 10) + shape("ExternalEntity", "g", 90)),
    );
    const findings = findingsOf(xml, [
      TOP,
      { ...CHILD, links: [{ cellId: "g", tfId: "ghost", role: "ref" }] },
    ]);
    expect(codes(findings.errors)).toContain("BAL_DANGLING_REF");
  });

  it("definition below a page the element occurs on (info, D5)", () => {
    // e is defined on pm, Top shows a copy of it
    const xml = mxfile(
      page(
        "top",
        shape("ExternalEntity", "top_e", 10) + shape("Multiprocess", "m", 200),
      ),
      page("pm", shape("Process", "p", 10) + shape("ExternalEntity", "e", 90)),
    );
    const findings = findingsOf(xml, [
      { ...TOP, links: [{ cellId: "top_e", tfId: "e", role: "ref" }] },
      CHILD,
    ]);
    expect(codes(findings.infos)).toContain("BAL_HOME_NOT_HIGHEST");
    const note = findings.infos.find((f) =>
      f.key.endsWith("BAL_HOME_NOT_HIGHEST"),
    )!;
    expect(note.params).toMatchObject({ page: "m", highest: "Top" });
  });

  it("occurrences with different labels (warning)", () => {
    const xml = mxfile(
      topPage(),
      page(
        "pm",
        shape("Process", "p", 10) +
          shape("ExternalEntity", "pm_e", 90, "renamed") +
          flow("pm_f1", "pm_e", "p", "f1"),
      ),
    );
    const findings = findingsOf(xml, [
      TOP,
      {
        ...CHILD,
        links: [
          { cellId: "pm_e", tfId: "e", role: "ref" },
          { cellId: "pm_f1", tfId: "f1", role: "ref" },
        ],
      },
    ]);
    expect(codes(findings.warnings)).toEqual(["BAL_LABEL_DIVERGENCE"]);
    expect(findings.warnings[0].params).toMatchObject({
      element: "e",
      labels: '"e", "renamed"',
    });
  });

  it("a child flow crossing m's border without a parent occurrence (warning)", () => {
    const child = (flows: string) =>
      page(
        "pm",
        shape("Process", "p", 10) +
          shape("ExternalEntity", "pm_e", 90, "e") +
          flows,
      );
    const links = [{ cellId: "pm_e", tfId: "e", role: "ref" as const }];
    // f2 p -> e is new on pm, Top does not show it
    const missing = findingsOf(
      mxfile(topPage(), child(flow("f2", "p", "pm_e"))),
      [TOP, { ...CHILD, links }],
    );
    expect(codes(missing.warnings)).toContain("BAL_MISSING_PARENT_FLOW");
    expect(
      missing.warnings.find((f) => f.key.endsWith("BAL_MISSING_PARENT_FLOW"))!
        .params,
    ).toMatchObject({ flow: "f2", element: "m", page: "Top" });

    // a flow between two parts of m stays inside: no finding
    const inside = findingsOf(
      mxfile(
        topPage(),
        page(
          "pm",
          shape("Process", "p", 10) +
            shape("Process", "q", 90) +
            flow("f3", "p", "q"),
        ),
      ),
      [TOP, CHILD],
    );
    expect(codes(inside.warnings)).not.toContain("BAL_MISSING_PARENT_FLOW");
  });

  it("flow between two external entities (info)", () => {
    const xml = mxfile(
      topPage(shape("ExternalEntity", "e2", 400) + flow("f9", "e", "e2")),
      page("pm", shape("Process", "p", 10)),
    );
    expect(codes(findingsOf(xml, [TOP, CHILD]).infos)).toContain(
      "DFD_EE_TO_EE_FLOW",
    );
  });

  it("a reassigned paste still showing another element's id (info, 3.3)", () => {
    const xml = (dupLabel: string) =>
      mxfile(
        page(
          "top",
          shape("Multiprocess", "m", 10, "m", "MP-1") +
            shape("Process", "a1", 100, "a1", "P-1"),
        ),
        page(
          "pm",
          shape("Process", "b1", 10, "b1", "P-1.1") +
            shape("Process", "a1", 100, "a1", dupLabel),
        ),
      );
    const pages: DFDPage[] = [
      TOP,
      {
        ...CHILD,
        links: [{ cellId: "a1", tfId: "pm:a1", role: "definition" }],
      },
    ];
    const before = findingsOf(xml("P-1"), pages);
    expect(codes(before.infos)).toEqual(["ID_PASTE_REASSIGNED"]);
    expect(before.infos[0]).toMatchObject({
      elementId: "pm:a1",
      displayId: "P-1",
      params: { page: "m" },
    });
    // after the next renumber it has its own id: the note is gone
    expect(findingsOf(xml("P-1.2"), pages).infos).toEqual([]);
  });
});

describe("leveled findings in the DFD validation (dfd-service)", () => {
  it("a save reports them; infos never make the DFD invalid", () => {
    const xml = mxfile(topPage(), page("pm", shape("Process", "p", 10)));
    const project = {
      id: "leveled-findings",
      name: "leveled",
      dfd: {
        xml,
        elements: [],
        connections: [],
        assets: [],
        pages: [TOP, CHILD],
      },
      phaseStatus: {},
      settings: { autoSave: true, autoSaveInterval: 2 },
      lastModified: "",
    } as unknown as DFDProjectData;
    const result = dfdService.saveDFDFromXml(project, xml);
    expect(result.success).toBe(true);
    expect(codes(result.validation.infos ?? [])).toContain(
      "BAL_UNRESOLVED_ENDPOINT",
    );
    expect(result.dfd.validation?.infos?.map((f) => f.key)).toContain(
      "dfdValidation.leveled.BAL_UNRESOLVED_ENDPOINT",
    );
    expect(result.validation.errors.map((f) => f.key)).not.toContain(
      "dfdValidation.leveled.BAL_UNRESOLVED_ENDPOINT",
    );
  });
});
