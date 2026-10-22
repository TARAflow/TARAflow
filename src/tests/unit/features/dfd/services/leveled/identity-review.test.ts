// Leveled-DFD Phase 5b — identity review: adoption of unadopted pages and
// assignment of pasted copies (design §11.2.1, §5.2 lifecycle, D8, D13).
// Both only write dfd.pages; the XML is never touched.
import { describe, it, expect } from "vitest";
import { dfdParser } from "features/dfd/services/dfd-parser";
import dfdService from "features/dfd/services/dfd-service";
import { ValidationMessages } from "features/dfd/services/validators/validator-utils";
import {
  confirmAdoption,
  confirmCopyAssignments,
  isAdoptionPending,
  misplacedPages,
  needsPageRepair,
  needsPageReview,
  reviewAdoption,
  reviewCopyAssignments,
} from "features/dfd/services/leveled";
import type { DFDPage, DFDProjectData } from "features/dfd/models/dfd-types";
import {
  CONTROLLER,
  LEVELED_PAGES,
  SENSOR,
  SYSTEM,
  flow,
  mxfile,
  node,
  page,
} from "../../../../../fixtures/leveled-dfd-xml";

// The leveled excerpt drawn as plain pages: copies are cells of their own.
const XML = mxfile(SYSTEM, SENSOR, CONTROLLER);

const project = (xml: string, pages?: DFDPage[]): DFDProjectData =>
  ({
    id: "p-review",
    name: "review",
    phaseStatus: {},
    dfd: { xml, pages, elements: [], connections: [], assets: [] },
  }) as unknown as DFDProjectData;

describe("isAdoptionPending", () => {
  it("is pending for several pages not all in dfd.pages", () => {
    expect(isAdoptionPending(XML, undefined)).toBe(true);
    expect(isAdoptionPending(XML, LEVELED_PAGES.slice(0, 2))).toBe(true);
  });

  it("is not pending for one page or an adopted file", () => {
    expect(isAdoptionPending(mxfile(SYSTEM), undefined)).toBe(false);
    expect(isAdoptionPending(XML, LEVELED_PAGES)).toBe(false);
    expect(isAdoptionPending("", undefined)).toBe(false);
  });
});

describe("adoption — proposal, confirmation, save", () => {
  it("proposes the page tree and the groups of an unadopted file", () => {
    const review = reviewAdoption(XML, undefined)!;
    expect(review.kind).toBe("adoption");
    expect(review.xml).toBe(XML);
    expect(review.proposal.pages.map((p) => [p.pageId, p.status, p.decomposes])).toEqual([
      ["sys", "root", undefined],
      ["sen", "proposed", "mp1"],
      ["ctl", "proposed", "mp2"],
    ]);
    expect(review.proposal.groups.map((g) => g.displayId)).toEqual(["MP-1", "MP-2", "DF-7"]);
  });

  it("has nothing to review for an adopted file", () => {
    expect(reviewAdoption(XML, LEVELED_PAGES)).toBeUndefined();
  });

  it("is refused before and analysable after the confirmation", () => {
    const before = dfdService.saveDFDFromXml(project(XML), XML);
    expect(before.success).toBe(false);
    expect(before.validation.errors.map((f) => f.key)).toEqual([
      ValidationMessages.ADOPTION_PENDING,
    ]);

    const review = reviewAdoption(XML, undefined)!;
    const adopted = confirmAdoption(review, undefined, {});
    if (!adopted.ok) throw new Error(adopted.reason);
    expect(adopted.pages.find((p) => p.pageId === "sen")?.links).toEqual(
      expect.arrayContaining([
        { cellId: "sen_mp2", tfId: "mp2", role: "ref" },
        { cellId: "sen_df7", tfId: "df7", role: "ref" },
      ]),
    );

    const after = dfdService.saveDFDFromXml(project(XML, adopted.pages), XML);
    expect(after.success).toBe(true);
    // One record per logical element: the copies are merged.
    expect(after.dfd.elements.map((e) => e.id).sort()).toEqual(["ctl_p5", "mp1", "mp2", "sen_p2"]);
    expect(after.dfd.xml).toBe(XML);
  });

  it("follows the analyst's decisions", () => {
    const review = reviewAdoption(XML, undefined)!;
    const mp2 = review.proposal.groups.find((g) => g.displayId === "MP-2")!;
    const adopted = confirmAdoption(review, undefined, { reject: [mp2.key] });
    if (!adopted.ok) throw new Error(adopted.reason);
    const sen = adopted.pages.find((p) => p.pageId === "sen")!;
    expect(sen.links?.some((l) => l.cellId === "sen_mp2")).toBe(false);
    expect(adopted.pages.find((p) => p.pageId === "ctl")?.decomposes).toBe("mp2");
    // "No decomposition" is not a choice for a child page (second root).
    expect(confirmAdoption(review, undefined, { decomposes: { ctl: null } })).toEqual({
      ok: false,
      reason: "PAGE_NOT_PLACED",
      pageId: "ctl",
    });
  });
});

describe("copy assignment — pasted cells after a save", () => {
  // A pasted copy of MP-1 on the controller page, and a duplicate of P-2 on
  // its own (sensor) page.
  const pastedCtl = page(
    "ctl",
    "Controller Module",
    node("ctl_mp1", "multiprocess", "Sensor Module", "MP-1", 10) +
      node("ctl_p5", "process", "Evaluate Alarm", "P-5", 300) +
      node("ctl_paste", "process", "Sample Smoke Sensor", "P-2", 600),
  );
  const pastedSen = page(
    "sen",
    "Sensor Module",
    node("sen_p2", "process", "Sample Smoke Sensor", "P-2", 10) +
      node("sen_mp2", "multiprocess", "Controller Module", "MP-2", 500) +
      node("sen_dup", "process", "Sample Smoke Sensor", "P-2", 800),
  );
  const baseline = { xml: XML, pages: LEVELED_PAGES };

  it("proposes a copy on another page, new on the definition's page", () => {
    const current = { xml: mxfile(SYSTEM, pastedSen, pastedCtl), pages: LEVELED_PAGES };
    const review = reviewCopyAssignments(current, baseline)!;
    expect(
      review.assignments.map((a) => [a.cell.pageId, a.cell.cellId, a.targetTfId, a.proposal]),
    ).toEqual([
      ["sen", "sen_dup", "sen_p2", "new"],
      ["ctl", "ctl_paste", "sen_p2", "copy"],
    ]);
  });

  it("raises no hint for a paste on the definition's own page only", () => {
    const current = { xml: mxfile(SYSTEM, pastedSen, CONTROLLER), pages: LEVELED_PAGES };
    expect(reviewCopyAssignments(current, baseline)).toBeUndefined();
  });

  it("raises no hint without dfd.pages (classic project)", () => {
    const xml = mxfile(page("p", "Page-1", node("a", "process", "A", "P-1", 10) + node("b", "process", "A", "P-1", 200)));
    expect(reviewCopyAssignments({ xml }, { xml })).toBeUndefined();
  });

  it("links only the cells chosen as copies", () => {
    const current = { xml: mxfile(SYSTEM, pastedSen, pastedCtl), pages: LEVELED_PAGES };
    const review = reviewCopyAssignments(current, baseline)!;
    const result = confirmCopyAssignments(review, LEVELED_PAGES, [
      { pageId: "ctl", cellId: "ctl_paste" },
    ]);
    if (!result.ok) throw new Error(result.reason);
    const ctl = result.pages.find((p) => p.pageId === "ctl")!;
    expect(ctl.links).toContainEqual({ cellId: "ctl_paste", tfId: "sen_p2", role: "ref" });
    expect(result.pages.find((p) => p.pageId === "sen")?.links?.some((l) => l.cellId === "sen_dup")).toBe(false);

    // The copy is now an occurrence of P-2, not an element of its own.
    const parsed = dfdParser.parse(current.xml, result.pages);
    expect(parsed.elements.some((e) => e.id === "ctl_paste")).toBe(false);
  });
});

describe("page repair — the state a 'none' decomposition used to write", () => {
  // Reported with 5b: a new page adopted without a multiprocess became a
  // second root page (PAGE_MULTIPLE_ROOTS: "System, Page-4").
  const P4 = page("p4", "Page-4", node("p4_p9", "process", "Logger", "P-9", 10));
  const XML4 = mxfile(SYSTEM, SENSOR, CONTROLLER, P4);
  const BROKEN: DFDPage[] = [...LEVELED_PAGES, { pageId: "p4", name: "Page-4", order: 3 }];

  it("an adoption never writes a second root", () => {
    const review = reviewAdoption(XML4, LEVELED_PAGES)!;
    expect(review.proposal.pages.find((p) => p.pageId === "p4")?.status).toBe("unplaced");
    expect(confirmAdoption(review, LEVELED_PAGES, {})).toEqual({
      ok: false,
      reason: "PAGE_NOT_PLACED",
      pageId: "p4",
    });
  });

  it("detects extra root pages and missing pages", () => {
    expect(misplacedPages(XML4, BROKEN)).toEqual({ extraRoots: ["p4"], missing: [] });
    expect(misplacedPages(XML, LEVELED_PAGES)).toEqual({ extraRoots: [], missing: [] });
    expect(misplacedPages(mxfile(SYSTEM, SENSOR), LEVELED_PAGES)).toEqual({
      extraRoots: [],
      missing: ["ctl"],
    });
    expect(needsPageReview(XML4, BROKEN)).toBe(true);
    expect(needsPageReview(XML, LEVELED_PAGES)).toBe(false);
  });

  it("places an extra root again and keeps the first root", () => {
    const review = reviewAdoption(XML4, BROKEN)!;
    expect(review.proposal.pages.map((p) => [p.pageId, p.status])).toEqual([
      ["sys", "root"],
      ["sen", "existing"],
      ["ctl", "existing"],
      ["p4", "unplaced"],
    ]);
    // P-5 lives on the controller page; MP-1 / MP-2 are taken — the analyst
    // details a further multiprocess. Here: none left, so p4 is refused…
    expect(confirmAdoption(review, BROKEN, {}).ok).toBe(false);
  });

  it("repairs the tree once the page details a multiprocess", () => {
    const sysWithMp3 = page(
      "sys",
      "System",
      node("mp1", "multiprocess", "Sensor Module", "MP-1", 10) +
        node("mp2", "multiprocess", "Controller Module", "MP-2", 300) +
        node("mp3", "multiprocess", "Logger Module", "MP-3", 600) +
        flow("df7", "stream sensor data", "DF-7", "mp1", "mp2"),
    );
    const xml = mxfile(sysWithMp3, SENSOR, CONTROLLER, P4);
    const review = reviewAdoption(xml, BROKEN)!;
    const repaired = confirmAdoption(review, BROKEN, { decomposes: { p4: "mp3" } });
    if (!repaired.ok) throw new Error(repaired.reason);
    expect(repaired.pages.map((p) => [p.pageId, p.decomposes])).toEqual([
      ["sys", undefined],
      ["sen", "mp1"],
      ["ctl", "mp2"],
      ["p4", "mp3"],
    ]);
    // Links of the other pages survive the repair.
    const senLinks = repaired.pages.find((p) => p.pageId === "sen")?.links ?? [];
    expect(senLinks).toHaveLength(LEVELED_PAGES[1].links!.length);
    expect(senLinks).toEqual(expect.arrayContaining(LEVELED_PAGES[1].links!));
    expect(needsPageReview(xml, repaired.pages)).toBe(false);
  });

  it("drops the entry of a page that is gone", () => {
    const xml = mxfile(SYSTEM, SENSOR);
    const review = reviewAdoption(xml, LEVELED_PAGES)!;
    const repaired = confirmAdoption(review, LEVELED_PAGES, {});
    if (!repaired.ok) throw new Error(repaired.reason);
    expect(repaired.pages.map((p) => p.pageId)).toEqual(["sys", "sen"]);
  });
});

describe("needsPageRepair — the 'Review pages…' hint", () => {
  it("is shown for an extra root page", () => {
    const xml = mxfile(SYSTEM, SENSOR, CONTROLLER, page("p4", "Page-4", ""));
    const pages: DFDPage[] = [...LEVELED_PAGES, { pageId: "p4", name: "Page-4", order: 3 }];
    expect(needsPageRepair(xml, pages)).toBe(true);
  });

  it("is not shown for a deleted child page — that one is cleaned up automatically", () => {
    // Reported with 5e: after "Delete page" the hint flashed for a few
    // seconds until the entry left dfd.pages.
    expect(needsPageRepair(mxfile(SYSTEM, SENSOR), LEVELED_PAGES)).toBe(false);
  });

  it("is shown for a missing root page", () => {
    expect(needsPageRepair(mxfile(SENSOR, CONTROLLER), LEVELED_PAGES)).toBe(true);
  });

  it("is not shown for a healthy tree or a classic project", () => {
    expect(needsPageRepair(XML, LEVELED_PAGES)).toBe(false);
    expect(needsPageRepair(mxfile(SYSTEM), undefined)).toBe(false);
  });
});
