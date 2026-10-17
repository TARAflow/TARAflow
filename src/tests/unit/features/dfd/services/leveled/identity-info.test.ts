// Leveled-DFD Phase 5g — identity of the selected cell and the actions the
// details panel offers (design §5.2, §12).
import { describe, it, expect } from "vitest";
import { dfdParser } from "features/dfd/services/dfd-parser";
import { contextCellsOf, describeIdentity } from "features/dfd/services/leveled";
import type { DFDPage } from "features/dfd/models/dfd-types";
import {
  CONTROLLER,
  LEVELED_PAGES,
  SENSOR,
  SYSTEM,
  mxfile,
  node,
  page,
} from "../../../../../fixtures/leveled-dfd-xml";

const describe_ = (xml: string, pages: DFDPage[] | undefined, pageId: string, cellId: string) =>
  describeIdentity(dfdParser.parse(xml, pages), pages, { pageId, cellId });

const XML = mxfile(SYSTEM, SENSOR, CONTROLLER);

describe("describeIdentity", () => {
  it("describes a context copy: definition, occurrences, make-definition", () => {
    const info = describe_(XML, LEVELED_PAGES, "sen", "sen_mp2")!;
    expect(info).toMatchObject({
      tfId: "mp2",
      kind: "element",
      role: "ref",
      dangling: false,
      definition: { pageId: "sys", cellId: "mp2", pageName: "System", role: "definition" },
      canMakeDefinition: true,
      canPromote: false,
      contextCopyCandidates: [],
    });
    expect(info.occurrences.map((o) => `${o.pageName}/${o.cellId}/${o.role}`)).toEqual([
      "System/mp2/definition",
      "Sensor Module/sen_mp2/ref",
    ]);
  });

  it("offers the promotion of a copy whose definition is gone", () => {
    const info = describe_(mxfile(SENSOR, CONTROLLER), LEVELED_PAGES, "sen", "sen_mp2")!;
    expect(info.dangling).toBe(true);
    expect(info.definition).toBeUndefined();
    expect(info.canPromote).toBe(true);
    expect(info.canMakeDefinition).toBe(false);
  });

  it("offers a plain cell as context copy of elements of the same type", () => {
    // A process drawn on the controller page that is really P-2.
    const ctl = page(
      "ctl",
      "Controller Module",
      node("ctl_mp1", "multiprocess", "Sensor Module", "MP-1", 10) +
        node("ctl_p5", "process", "Evaluate Alarm", "P-5", 300) +
        node("ctl_x", "process", "Sample Smoke Sensor", "P-xx", 600),
    );
    const info = describe_(mxfile(SYSTEM, SENSOR, ctl), LEVELED_PAGES, "ctl", "ctl_x")!;
    expect(info.role).toBe("definition");
    expect(info.contextCopyCandidates).toEqual([
      { tfId: "sen_p2", label: "P-2 Sample Smoke Sensor" },
      { tfId: "ctl_p5", label: "P-5 Evaluate Alarm" },
    ]);
    expect(info.canMakeDefinition).toBe(false);
  });

  it("offers nothing that needs links in a classic project", () => {
    const xml = mxfile(page("p1", "Page-1", node("a", "process", "A", "P-1", 10) + node("b", "process", "B", "P-2", 300)));
    const info = describe_(xml, undefined, "p1", "a")!;
    expect(info.contextCopyCandidates).toEqual([]);
    expect(info.occurrences).toHaveLength(1);
  });

  it("is undefined for a cell that is no element or flow", () => {
    expect(describe_(XML, LEVELED_PAGES, "sys", "nope")).toBeUndefined();
  });
});

describe("contextCellsOf", () => {
  it("lists the context copies per page", () => {
    const { occurrences } = dfdParser.parse(XML, LEVELED_PAGES);
    expect(contextCellsOf(occurrences, LEVELED_PAGES)).toEqual({
      sen: { sen_mp2: true, sen_df7: true },
      ctl: { ctl_mp1: true, ctl_df7: true },
    });
  });

  it("includes a linked flow with a free end, which is no occurrence", () => {
    // Reported with 5g: the copied flow to the Debugger was not faded.
    const pages: DFDPage[] = LEVELED_PAGES.map((p) =>
      p.pageId === "sen"
        ? { ...p, links: [...(p.links ?? []), { cellId: "sen_loose", tfId: "df8", role: "ref" }] }
        : p,
    );
    const { occurrences } = dfdParser.parse(XML, pages);
    expect(occurrences.some((o) => o.cellId === "sen_loose")).toBe(false);
    expect(contextCellsOf(occurrences, pages).sen).toEqual({
      sen_mp2: true,
      sen_df7: true,
      sen_loose: true,
    });
  });

  it("is empty for a classic project", () => {
    const xml = mxfile(page("p1", "Page-1", node("a", "process", "A", "P-1", 10)));
    expect(contextCellsOf(dfdParser.parse(xml).occurrences, undefined)).toEqual({});
  });
});
