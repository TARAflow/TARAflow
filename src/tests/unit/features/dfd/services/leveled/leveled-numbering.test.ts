// Leveled-DFD Phase 3 (leveled-dfd-multi-diagram-design.md §8, D19):
// hierarchical auto-numbering — the root page numbers 1..n per prefix, the
// child page of MP-m numbers its own definitions m.1..m.n; context copies
// show the number of their definition.
import { describe, it, expect } from "vitest";
import { DFDAutoNumbering } from "features/dfd/services/dfd-auto-numbering";
import { dfdParser } from "features/dfd/services/dfd-parser";
import { reassignDuplicateDefinitions } from "features/dfd/services/leveled";
import {
  identityOf,
  collectCellIdentities,
} from "features/dfd/services/parsers/identity-reader";
import type { DFDPage } from "features/dfd/models/dfd-types";
import fixture from "../../../../../fixtures/leveled/smoke-detector-leveled.json";

const pages = fixture.pages as DFDPage[];
const NUMBERED = /^(MP|P|DF|DS|EE|IF|SE|AC)-(\d+(?:\.\d+)*|xx)$/;

/** Every id label back to its placeholder ("P-7" → "P-xx"). */
function blankLabels(xml: string): string {
  return xml.replace(
    /(<object label=")([^"]*)(" type="idlabel")/gi,
    (_m, a: string, label: string, b: string) =>
      a +
      label.replace(/\b(MP|P|DF|DS|EE|IF|SE|AC)-\d+(?:\.\d+)*/g, "$1-xx") +
      b,
  );
}

/** displayIds of every occurrence, grouped by logical element. */
function labelsByLogicalElement(xml: string, pageList: DFDPage[]) {
  const parse = dfdParser.parse(xml, pageList);
  const byKey = new Map<string, Set<string>>();
  const home = new Map<string, string>();
  for (const page of parse.pageCells) {
    const identities = collectCellIdentities(
      pageList.find((p) => p.pageId === page.pageId)?.links,
    );
    const cells = [
      ...page.elements.map((e) => ["element", e] as const),
      ...page.connections.map((c) => ["connection", c] as const),
    ];
    for (const [kind, cell] of cells) {
      // only numbered ids (boundaries carry abbreviations like "SHE")
      if (!NUMBERED.test(cell.displayId ?? "")) continue;
      const { tfId, role } = identityOf(identities, cell.id);
      const key = `${kind}:${tfId}`;
      byKey.set(key, new Set([...(byKey.get(key) ?? []), cell.displayId]));
      if (role === "definition") home.set(key, page.pageId);
    }
  }
  return { byKey, home };
}

const only = (labels: Set<string> | undefined) => {
  expect(labels?.size).toBe(1);
  return [...labels!][0];
};
const split = (label: string) => {
  const [, prefix, number] = label.match(/^([A-Z]+)-(.+)$/)!;
  return { prefix, number };
};

describe("hierarchical numbering — leveled SmokeDetector", () => {
  const blank = blankLabels(fixture.leveledXml);
  const numbered = new DFDAutoNumbering().autoNumber(blank, pages);
  const { byKey, home } = labelsByLogicalElement(numbered, pages);

  // Namespace of each page: "" on Top, the MP's number on its child page.
  const mpNumber = (tfId: string) =>
    split(only(byKey.get(`element:${tfId}`))).number;
  const namespace = new Map<string, string>([
    ["sys", ""],
    ["sen", mpNumber("mp_sen")],
    ["ctl", mpNumber("mp_ctl")],
  ]);

  it("numbers the adopted multi-page file", () => {
    expect(blank).toMatch(/P-xx/);
    expect(numbered).not.toMatch(/\b(MP|P|DF|DS|EE|IF)-xx\b/);
  });

  it("the multiprocesses on Top are MP-1 and MP-2", () => {
    expect(new Set([mpNumber("mp_sen"), mpNumber("mp_ctl")])).toEqual(
      new Set(["1", "2"]),
    );
  });

  it("every copy shows the number of its definition", () => {
    for (const [key, labels] of byKey) {
      expect({ key, size: labels.size }).toEqual({ key, size: 1 });
    }
  });

  it("definitions on a child page are numbered m.k under their MP-m", () => {
    for (const [key, labels] of byKey) {
      const { number } = split(only(labels));
      const ns = namespace.get(home.get(key)!)!;
      const expected = ns === "" ? /^\d+$/ : new RegExp(`^${ns}\\.\\d+$`);
      expect({ key, number }).toEqual({
        key,
        number: expect.stringMatching(expected),
      });
    }
  });

  it("k runs 1..n without gaps per page and prefix", () => {
    const groups = new Map<string, number[]>();
    for (const [key, labels] of byKey) {
      const { prefix, number } = split(only(labels));
      const group = `${home.get(key)}:${prefix}`;
      const k = Number(number.split(".").pop());
      groups.set(group, [...(groups.get(group) ?? []), k]);
    }
    for (const [group, ks] of groups) {
      const sorted = [...ks].sort((a, b) => a - b);
      expect({ group, sorted }).toEqual({
        group,
        sorted: sorted.map((_, i) => i + 1),
      });
    }
  });

  it("flows of the top page keep their top number on the child pages", () => {
    const topFlowsOnChildPages = [...byKey].filter(
      ([key]) => key.startsWith("connection:") && home.get(key) === "sys",
    );
    expect(topFlowsOnChildPages.length).toBeGreaterThan(0);
    // DF-1 (stream smoke measurement) is drawn on Top and copied to both
    // child pages; all three occurrences show the same plain top number.
    expect(only(byKey.get("connection:DF-1"))).toMatch(/^DF-\d+$/);
    expect(
      numbered.match(/<diagram id="sen"[\s\S]*?<\/diagram>/)![0],
    ).toContain(only(byKey.get("connection:DF-1")));
  });

  it("is idempotent", () => {
    expect(new DFDAutoNumbering().autoNumber(numbered, pages)).toBe(numbered);
  });

  it("leaves a file with an unadopted page untouched", () => {
    const withoutController = pages.filter((p) => p.pageId !== "ctl");
    expect(new DFDAutoNumbering().autoNumber(blank, withoutController)).toBe(
      blank,
    );
  });
});

// ---------------------------------------------------------------------------

const shape = (type: string, placeholder: string, id: string, y: number) =>
  `<object label="${id}" type="${type}" id="${id}">` +
  `<mxCell style="ellipse;" vertex="1" parent="1">` +
  `<mxGeometry x="100" y="${y}" width="80" height="80" as="geometry"/></mxCell></object>` +
  `<object label="${placeholder}" type="idlabel" id="${id}-lbl">` +
  `<mxCell style="text;" vertex="1" parent="${id}">` +
  `<mxGeometry x="0" y="0" width="30" height="20" as="geometry"/></mxCell></object>`;
const process = (id: string, y: number) => shape("Process", "P-xx", id, y);
const multiprocess = (id: string, y: number) =>
  shape("Multiprocess", "MP-xx", id, y);

const page = (id: string, cells: string) =>
  `<diagram id="${id}" name="${id}"><mxGraphModel><root>` +
  `<mxCell id="0"/><mxCell id="1" parent="0"/>${cells}` +
  `</root></mxGraphModel></diagram>`;

function labelOf(xml: string, pageId: string, cellId: string): string {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const diagram = Array.from(doc.getElementsByTagName("diagram")).find(
    (d) => d.getAttribute("id") === pageId,
  )!;
  const label = Array.from(diagram.getElementsByTagName("object")).find(
    (o) => o.getAttribute("id") === `${cellId}-lbl`,
  )!;
  return label.getAttribute("label")!;
}

describe("hierarchical numbering — nesting, copies, dangling, duplicates", () => {
  // top:    MP m (y 50), P a1 (y 100), copy of "ghost" (no definition)
  // m:      nested MP n (y 10), P b1 (y 50), and "a1" again as a plain
  //         cell — a duplicated definition of a1 (draw.io "Duplicate page")
  // n:      P c1
  // loose:  P d1 on a page the tree cannot place (decomposes nothing)
  const xml =
    `<mxfile>` +
    page(
      "top",
      multiprocess("m", 50) + process("a1", 100) + process("g", 300),
    ) +
    page("pm", multiprocess("n", 10) + process("b1", 50) + process("a1", 400)) +
    page("pn", process("c1", 50)) +
    page("loose", process("d1", 50)) +
    `</mxfile>`;
  const pageList: DFDPage[] = [
    {
      pageId: "top",
      name: "Top",
      order: 0,
      links: [{ cellId: "g", tfId: "ghost", role: "ref" }],
    },
    { pageId: "pm", name: "m", order: 0, decomposes: "m" },
    { pageId: "pn", name: "n", order: 0, decomposes: "n" },
    { pageId: "loose", name: "loose", order: 1 },
  ];
  const numbered = new DFDAutoNumbering().autoNumber(xml, pageList);

  it("numbers the root page flat", () => {
    expect(labelOf(numbered, "top", "m")).toBe("MP-1");
    expect(labelOf(numbered, "top", "a1")).toBe("P-1");
  });

  it("numbers a child page under its multiprocess, nested pages deeper", () => {
    expect(labelOf(numbered, "pm", "n")).toBe("MP-1.1");
    expect(labelOf(numbered, "pm", "b1")).toBe("P-1.1");
    expect(labelOf(numbered, "pn", "c1")).toBe("P-1.1.1");
  });

  it("a duplicated definition shows the same number until it is reassigned", () => {
    expect(labelOf(numbered, "pm", "a1")).toBe("P-1");
  });

  it("after the save reassigned it (3.3), the duplicate gets its own number", () => {
    const { pages: reassigned } = reassignDuplicateDefinitions({
      xml,
      pages: pageList,
    });
    const renumbered = new DFDAutoNumbering().autoNumber(xml, reassigned);
    expect(labelOf(renumbered, "top", "a1")).toBe("P-1");
    expect(labelOf(renumbered, "pm", "b1")).toBe("P-1.1");
    expect(labelOf(renumbered, "pm", "a1")).toBe("P-1.2");
  });

  it("an unplaced page and a dangling element use the root namespace", () => {
    expect(labelOf(numbered, "loose", "d1")).toBe("P-2");
    expect(labelOf(numbered, "top", "g")).toBe("P-3");
  });
});
