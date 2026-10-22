// Leveled-DFD Phase 1.4 — dangling references and the identity-link writers
// (design §5.2, §5.2.1, D12). Writers only change dfd.pages; the XML stays
// untouched.
import { describe, it, expect } from "vitest";
import { dfdParser } from "features/dfd/services/dfd-parser";
import {
  computeHomePages,
  findDanglingReferences,
  makeDefinition,
  promoteToDefinition,
  pruneStaleLinks,
  restoreLinks,
} from "features/dfd/services/leveled";
import type { DFDPage } from "features/dfd/models/dfd-types";
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

const parse = (xml: string, pages: readonly DFDPage[] = LEVELED_PAGES) =>
  dfdParser.parse(xml, pages);

const linksOf = (pages: readonly DFDPage[] | undefined, pageId: string) =>
  [...(pages?.find((p) => p.pageId === pageId)?.links ?? [])].sort((a, b) =>
    a.cellId.localeCompare(b.cellId),
  );

// The leveled model with the System page deleted: every copy of mp1, mp2
// and df7 on the child pages is left without its definition.
const WITHOUT_SYSTEM = mxfile(SENSOR, CONTROLLER);

describe("findDanglingReferences", () => {
  it("finds nothing while every copy has its definition", () => {
    const { occurrences } = parse(mxfile(SYSTEM, SENSOR, CONTROLLER));
    expect(findDanglingReferences(occurrences)).toEqual([]);
  });

  it("lists elements and flows that have copies but no definition", () => {
    const { occurrences } = parse(WITHOUT_SYSTEM);
    const dangling = findDanglingReferences(occurrences);
    expect(
      dangling.map((d) => [
        d.kind,
        d.tfId,
        d.copies.map((c) => `${c.pageId}/${c.cellId}`),
      ]),
    ).toEqual([
      ["element", "mp2", ["sen/sen_mp2"]],
      ["connection", "df7", ["sen/sen_df7", "ctl/ctl_df7"]],
      ["element", "mp1", ["ctl/ctl_mp1"]],
    ]);
  });

  it("keeps the dangling element in the model (record from the first copy)", () => {
    const { elements } = parse(WITHOUT_SYSTEM);
    expect(elements.map((e) => e.id)).toEqual(
      expect.arrayContaining(["mp1", "mp2"]),
    );
  });
});

describe("pruneStaleLinks", () => {
  it("returns the same array when every linked cell exists", () => {
    const xml = mxfile(SYSTEM, SENSOR, CONTROLLER);
    const result = pruneStaleLinks(LEVELED_PAGES, xml);
    expect(result.pages).toBe(LEVELED_PAGES);
    expect(result.removed).toEqual([]);
  });

  it("is a no-op without dfd.pages", () => {
    expect(pruneStaleLinks(undefined, mxfile(SYSTEM))).toEqual({
      pages: undefined,
      removed: [],
    });
  });

  it("drops the link of a deleted cell and keeps the others", () => {
    const sensorWithoutCopy = page(
      "sen",
      "Sensor Module",
      node("sen_p2", "process", "Sample Smoke Sensor", "P-2", 10) +
        flow("sen_df7", "stream sensor data", "DF-7", "sen_p2", "sen_p2"),
    );
    const result = pruneStaleLinks(
      LEVELED_PAGES,
      mxfile(SYSTEM, sensorWithoutCopy, CONTROLLER),
    );
    expect(result.removed).toEqual([
      {
        pageId: "sen",
        cellId: "sen_mp2",
        tfId: "mp2",
        link: { cellId: "sen_mp2", tfId: "mp2", role: "ref" },
      },
    ]);
    expect(linksOf(result.pages, "sen").map((l) => l.cellId)).toEqual([
      "sen_df7",
    ]);
    expect(linksOf(result.pages, "ctl")).toEqual(linksOf(LEVELED_PAGES, "ctl"));
  });

  it("removes the links key when the last link of a page goes", () => {
    const emptySensor = page("sen", "Sensor Module", "");
    const result = pruneStaleLinks(
      LEVELED_PAGES,
      mxfile(SYSTEM, emptySensor, CONTROLLER),
    );
    expect(result.pages?.find((p) => p.pageId === "sen")).not.toHaveProperty(
      "links",
    );
  });

  it("keeps the link of a cell that exists but is not parsed right now", () => {
    // Label cleared in draw.io: the cell is still there, only unparsed.
    const unlabelled = SENSOR.replace(
      'label="Controller Module" type="multiprocess" id="sen_mp2"',
      'label="" type="multiprocess" id="sen_mp2"',
    );
    expect(unlabelled).not.toBe(SENSOR);
    const result = pruneStaleLinks(
      LEVELED_PAGES,
      mxfile(SYSTEM, unlabelled, CONTROLLER),
    );
    expect(result.removed).toEqual([]);
  });

  it("leaves a page that is missing from the XML untouched (PAGE_MISSING)", () => {
    const result = pruneStaleLinks(LEVELED_PAGES, mxfile(SYSTEM, CONTROLLER));
    expect(result.removed).toEqual([]);
    expect(linksOf(result.pages, "sen")).toEqual(linksOf(LEVELED_PAGES, "sen"));
  });
});

describe("restoreLinks (undo of a deleted linked cell)", () => {
  const FULL = mxfile(SYSTEM, SENSOR, CONTROLLER);
  const withoutLink = LEVELED_PAGES.map((p) =>
    p.pageId === "sen" ? { ...p, links: p.links?.filter((l) => l.cellId !== "sen_mp2") } : p,
  );
  const copy = { pageId: "sen", link: { cellId: "sen_mp2", tfId: "mp2", role: "ref" as const }, cellType: "multiprocess" };

  it("gives the link back when the same cell is on its page again", () => {
    const result = restoreLinks(withoutLink, FULL, [copy]);
    expect(result.restored).toEqual([copy]);
    expect(linksOf(result.pages, "sen")).toEqual(linksOf(LEVELED_PAGES, "sen"));
  });

  it("not while the cell is still gone", () => {
    const sensorWithoutCopy = page("sen", "Sensor Module", node("sen_p2", "process", "Sample Smoke Sensor", "P-2", 10));
    const result = restoreLinks(withoutLink, mxfile(SYSTEM, sensorWithoutCopy, CONTROLLER), [copy]);
    expect(result).toEqual({ pages: withoutLink, restored: [] });
  });

  it("not to a cell of another type with the same id", () => {
    const result = restoreLinks(withoutLink, FULL, [{ ...copy, cellType: "process" }]);
    expect(result.restored).toEqual([]);
  });

  it("not to a cell that has a link again (e.g. assigned by hand)", () => {
    const result = restoreLinks(LEVELED_PAGES, FULL, [{ ...copy, link: { ...copy.link, tfId: "mp1" } }]);
    expect(result).toEqual({ pages: LEVELED_PAGES, restored: [] });
  });

  it("a definition link not while its element has another definition", () => {
    const moved = withoutLink.map((p) =>
      p.pageId === "ctl" ? { ...p, links: [...(p.links ?? []), { cellId: "ctl_p5", tfId: "mp2", role: "definition" as const }] } : p,
    );
    const definition = { ...copy, link: { ...copy.link, role: "definition" as const } };
    expect(restoreLinks(moved, FULL, [definition]).restored).toEqual([]);
    expect(restoreLinks(withoutLink, FULL, [definition]).restored).toEqual([definition]);
  });
});

describe("promoteToDefinition", () => {
  it("makes the chosen copy the definition of a dangling element", () => {
    const { occurrences } = parse(WITHOUT_SYSTEM);
    const result = promoteToDefinition(LEVELED_PAGES, occurrences, {
      pageId: "sen",
      cellId: "sen_mp2",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(linksOf(result.pages, "sen")).toContainEqual({
      cellId: "sen_mp2",
      tfId: "mp2",
      role: "definition",
    });
    const reparsed = parse(WITHOUT_SYSTEM, result.pages);
    expect(
      findDanglingReferences(reparsed.occurrences).map((d) => d.tfId),
    ).not.toContain("mp2");
    expect(computeHomePages(reparsed.occurrences).elements.get("mp2")).toBe(
      "sen",
    );
  });

  it("does not touch the input pages", () => {
    const pages = structuredClone(LEVELED_PAGES);
    promoteToDefinition(pages, parse(WITHOUT_SYSTEM).occurrences, {
      pageId: "sen",
      cellId: "sen_mp2",
    });
    expect(pages).toEqual(LEVELED_PAGES);
  });

  it("refuses when the element still has a definition", () => {
    const { occurrences } = parse(mxfile(SYSTEM, SENSOR, CONTROLLER));
    expect(
      promoteToDefinition(LEVELED_PAGES, occurrences, {
        pageId: "sen",
        cellId: "sen_mp2",
      }),
    ).toEqual({ ok: false, reason: "NOT_DANGLING" });
  });

  it("refuses a definition cell and an unknown cell", () => {
    const { occurrences } = parse(WITHOUT_SYSTEM);
    expect(
      promoteToDefinition(LEVELED_PAGES, occurrences, {
        pageId: "sen",
        cellId: "sen_p2",
      }),
    ).toEqual({ ok: false, reason: "NOT_A_CONTEXT_COPY" });
    expect(
      promoteToDefinition(LEVELED_PAGES, occurrences, {
        pageId: "sen",
        cellId: "nope",
      }),
    ).toEqual({ ok: false, reason: "CELL_NOT_FOUND" });
  });
});

describe("makeDefinition", () => {
  const xml = mxfile(SYSTEM, SENSOR, CONTROLLER);

  it("moves the definition to the copy; the former definition becomes a copy", () => {
    const result = makeDefinition(LEVELED_PAGES, parse(xml).occurrences, {
      pageId: "sen",
      cellId: "sen_mp2",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // The former plain definition cell "mp2" now carries a ref link to its
    // own cell id — valid, see identity-reader.
    expect(linksOf(result.pages, "sys")).toEqual([
      { cellId: "mp2", tfId: "mp2", role: "ref" },
    ]);
    const reparsed = parse(xml, result.pages);
    const mp2 = reparsed.elements.find((e) => e.id === "mp2")!;
    expect(mp2.position).toEqual({ x: 500, y: 10 }); // record from Sensor Module
    expect(computeHomePages(reparsed.occurrences).elements.get("mp2")).toBe(
      "sen",
    );
    expect(findDanglingReferences(reparsed.occurrences)).toEqual([]);
    // Flow endpoints still resolve to the same logical element.
    expect(reparsed.connections.map((c) => [c.id, c.from, c.to])).toEqual([
      ["df7", "mp1", "mp2"],
    ]);
  });

  it("moving back restores the lazy state: no link on the System page", () => {
    const there = makeDefinition(LEVELED_PAGES, parse(xml).occurrences, {
      pageId: "sen",
      cellId: "sen_mp2",
    });
    if (!there.ok) throw new Error(there.reason);
    const back = makeDefinition(
      there.pages,
      parse(xml, there.pages).occurrences,
      { pageId: "sys", cellId: "mp2" },
    );
    if (!back.ok) throw new Error(back.reason);

    expect(back.pages.find((p) => p.pageId === "sys")).not.toHaveProperty(
      "links",
    );
    expect(linksOf(back.pages, "sen")).toEqual(linksOf(LEVELED_PAGES, "sen"));
  });

  it("refuses a dangling element (use promote)", () => {
    expect(
      makeDefinition(LEVELED_PAGES, parse(WITHOUT_SYSTEM).occurrences, {
        pageId: "sen",
        cellId: "sen_mp2",
      }),
    ).toEqual({ ok: false, reason: "NO_DEFINITION" });
  });

  it("refuses while the tfId has several definitions (duplicated page)", () => {
    const systemCopy = SYSTEM.replace(
      'id="sys" name="System"',
      'id="sys2" name="Copy"',
    );
    const dup = mxfile(SYSTEM, systemCopy, SENSOR);
    expect(
      makeDefinition(LEVELED_PAGES, parse(dup).occurrences, {
        pageId: "sen",
        cellId: "sen_mp2",
      }),
    ).toEqual({ ok: false, reason: "DUPLICATE_DEFINITIONS" });
  });

  it("refuses when the page of the former definition is not in dfd.pages", () => {
    const pages = LEVELED_PAGES.filter((p) => p.pageId !== "sys");
    expect(
      makeDefinition(pages, parse(xml, pages).occurrences, {
        pageId: "sen",
        cellId: "sen_mp2",
      }),
    ).toEqual({ ok: false, reason: "PAGE_NOT_IN_TREE" });
  });
});
