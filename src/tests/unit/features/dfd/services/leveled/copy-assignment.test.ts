// Leveled-DFD Phase 1.5 — pasted copies (design §5.2 lifecycle): proposal
// "context copy of X" / "new element", applied only on confirmation.
import { describe, it, expect } from "vitest";
import { dfdParser } from "features/dfd/services/dfd-parser";
import {
  applyCopyAssignments,
  linkAsContextCopy,
  proposeCopyAssignments,
  recordInfos,
} from "features/dfd/services/leveled";
import {
  CONTROLLER,
  LEVELED_PAGES,
  SENSOR,
  SYSTEM,
  mxfile,
  node,
} from "../../../../../fixtures/leveled-dfd-xml";

const SAVED = mxfile(SYSTEM, SENSOR, CONTROLLER);
const previous = dfdParser.parse(SAVED, LEVELED_PAGES).occurrences;

// After the save, the analyst pasted P-2 (defined on Sensor Module) onto
// the Controller page, and duplicated P-5 on its own page.
const CONTROLLER_PASTED = CONTROLLER.replace(
  "</root>",
  node("paste_p2", "process", "Sample Smoke Sensor", "P-2", 600) +
    node("paste_p5", "process", "Evaluate Alarm", "P-5", 900) +
    "</root>",
);
const CURRENT = mxfile(SYSTEM, SENSOR, CONTROLLER_PASTED);
const parse = dfdParser.parse(CURRENT, LEVELED_PAGES);

describe("proposeCopyAssignments", () => {
  it("proposes new cells that look like an existing element", () => {
    expect(CONTROLLER_PASTED).not.toBe(CONTROLLER);
    expect(
      proposeCopyAssignments(parse, previous).map((a) => [
        `${a.cell.pageId}/${a.cell.cellId}`,
        a.displayId,
        a.targetTfId,
        a.definitionPageId,
        a.proposal,
      ]),
    ).toEqual([
      ["ctl/paste_p2", "P-2", "sen_p2", "sen", "copy"],
      ["ctl/paste_p5", "P-5", "ctl_p5", "ctl", "new"], // same page as its original
    ]);
  });

  it("proposes nothing for cells that existed before", () => {
    expect(proposeCopyAssignments(parse, parse.occurrences)).toEqual([]);
  });

  it("proposes nothing when the displayId is already ambiguous", () => {
    // Two existing P-2 definitions: no target can be guessed.
    const twoP2 = SENSOR.replace(
      "</root>",
      node("sen_p2b", "process", "Second", "P-2", 900) + "</root>",
    );
    const before = dfdParser.parse(
      mxfile(SYSTEM, twoP2, CONTROLLER),
      LEVELED_PAGES,
    ).occurrences;
    const now = dfdParser.parse(
      mxfile(SYSTEM, twoP2, CONTROLLER_PASTED),
      LEVELED_PAGES,
    );
    expect(proposeCopyAssignments(now, before).map((a) => a.displayId)).toEqual(
      ["P-5"],
    );
  });
});

describe("applyCopyAssignments", () => {
  it("links the confirmed cells as context copies", () => {
    const [p2] = proposeCopyAssignments(parse, previous);
    const result = applyCopyAssignments(LEVELED_PAGES, parse, [p2]);
    if (!result.ok) throw new Error(result.reason);

    const reparsed = dfdParser.parse(CURRENT, result.pages);
    expect(
      reparsed.occurrences.find((o) => o.cellId === "paste_p2"),
    ).toMatchObject({ tfId: "sen_p2", role: "ref" });
    expect(reparsed.elements.map((e) => e.id)).not.toContain("paste_p2");
  });

  it("is all-or-nothing", () => {
    const [p2] = proposeCopyAssignments(parse, previous);
    const result = applyCopyAssignments(LEVELED_PAGES, parse, [
      p2,
      { cell: { pageId: "ctl", cellId: "nope" }, targetTfId: "sen_p2" },
    ]);
    expect(result).toEqual({
      ok: false,
      cell: { pageId: "ctl", cellId: "nope" },
      reason: "CELL_NOT_FOUND",
    });
  });
});

describe("linkAsContextCopy refuses", () => {
  const types = recordInfos(parse);
  const link = (pageId: string, cellId: string, tfId: string) =>
    linkAsContextCopy(
      LEVELED_PAGES,
      parse.occurrences,
      types,
      { pageId, cellId },
      tfId,
    );

  it("a type mismatch", () => {
    expect(link("ctl", "paste_p2", "mp1")).toEqual({
      ok: false,
      reason: "TYPE_MISMATCH",
    });
  });

  it("a cell that is already linked", () => {
    expect(link("sen", "sen_mp2", "mp1")).toEqual({
      ok: false,
      reason: "NOT_A_PLAIN_CELL",
    });
  });

  it("linking a cell to itself", () => {
    expect(link("ctl", "paste_p2", "paste_p2")).toEqual({
      ok: false,
      reason: "SAME_IDENTITY",
    });
  });

  it("a target without definition", () => {
    const dangling = dfdParser.parse(
      mxfile(SENSOR, CONTROLLER_PASTED),
      LEVELED_PAGES,
    );
    expect(
      linkAsContextCopy(
        LEVELED_PAGES,
        dangling.occurrences,
        recordInfos(dangling),
        { pageId: "ctl", cellId: "paste_p5" },
        "mp2",
      ),
    ).toEqual({ ok: false, reason: "NO_DEFINITION" });
  });

  it("a page without dfd.pages entry", () => {
    const pages = LEVELED_PAGES.filter((p) => p.pageId !== "ctl");
    expect(
      linkAsContextCopy(
        pages,
        parse.occurrences,
        types,
        { pageId: "ctl", cellId: "paste_p2" },
        "sen_p2",
      ),
    ).toEqual({ ok: false, reason: "PAGE_NOT_IN_TREE" });
  });
});
