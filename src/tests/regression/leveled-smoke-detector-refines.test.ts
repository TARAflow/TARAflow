// Leveled DFD §14 "Graph and balancing" on the leveled SmokeDetector: a flow
// drawn only on a child page that crosses the decomposed multiprocess'
// border is BAL_MISSING_PARENT_FLOW — until it refines the parent-level
// flow (D2, §6.4).
//
// The §16 model's "DF-19 push alarm relay refines DF-27 push alarm" is, in
// the fixture's numbering, DF-21 "push alarm contact" (P-3 → EE-1, tfId
// DF-11) and DF-30 "push alarm" (MP-2 → EE-1 on Top, tfId DF-3). The fixture
// draws DF-21 on Top as well (balanced); the test moves its definition to the
// controller page and removes the Top cell.
import { describe, it, expect } from "vitest";
import { dfdParser } from "features/dfd/services/dfd-parser";
import { buildAnalysisView } from "features/dfd/services/build-dfd-graph";
import { makeDefinition } from "features/dfd/services/leveled/identity-links";
import type { DFDConnection, DFDElement, DFDPage } from "features/dfd/models/dfd-types";
import fixture from "../fixtures/leveled/smoke-detector-leveled.json";

const PARENT = "DF-3"; // DF-30 push alarm, drawn MP-2 → EE-1 on Top
const CHILD = "DF-11"; // DF-21 push alarm contact, P-3 → EE-1

const pages = fixture.pages as DFDPage[];
const elements = fixture.leveledElements as unknown as DFDElement[];
const connections = fixture.connections as unknown as DFDConnection[];

/** The Top cell of the child flow and the label cells attached to it, removed. */
function withoutTopCell(xml: string, id: string): string {
  const object = new RegExp(`<object[^>]*\\bid="${id}"[^>]*>[\\s\\S]*?</object>`);
  const labels = new RegExp(`<object[^>]*>\\s*<mxCell[^>]*\\bparent="${id}"[\\s\\S]*?</object>`, "g");
  return xml.replace(object, "").replace(labels, "");
}

function findingsOf(xml: string, pagesOf: DFDPage[], conns: DFDConnection[]) {
  const f = buildAnalysisView({ xml, pages: pagesOf, elements, connections: conns, assets: [] }).leveledFindings!;
  return [...f.errors, ...f.warnings, ...f.infos].map((x) => `${x.key.replace("dfdValidation.leveled.", "")}:${x.elementId}`);
}

describe("leveled SmokeDetector: refines balances a flow drawn only on the child page", () => {
  it("is balanced as delivered", () => {
    expect(findingsOf(fixture.leveledXml, pages, connections)).toEqual([]);
  });

  // DF-21 drawn only on the controller page.
  const occurrences = dfdParser.parse(fixture.leveledXml, pages).occurrences;
  const moved = makeDefinition(pages, occurrences, { pageId: "ctl", cellId: `ctl_${CHILD}` });
  if (!moved.ok) throw new Error(`makeDefinition refused: ${moved.reason}`);
  const xml = withoutTopCell(fixture.leveledXml, CHILD);

  it("without refines: BAL_MISSING_PARENT_FLOW for DF-21", () => {
    // Exactly this finding — the edit leaves nothing else behind.
    expect(findingsOf(xml, moved.pages, connections)).toEqual([`BAL_MISSING_PARENT_FLOW:${CHILD}`]);
  });

  it("refining DF-30: the finding is gone, the refinement is compatible", () => {
    const refined = connections.map((c) =>
      c.id === CHILD ? ({ ...c, properties: { ...c.properties, refines: PARENT } } as DFDConnection) : c,
    );
    // No finding at all: neither missing parent flow nor an incompatible refinement.
    expect(findingsOf(xml, moved.pages, refined)).toEqual([]);
  });
});
