// EN 50742 relevance of attack-path risks (review 2026-11-21): an attack
// path has no anchor of its own; its leaves name DFD elements (DSL [IF-1]).
//   - a leaf on a relevant interface / flow → relevant;
//   - every leaf anchored, none relevant → not relevant;
//   - otherwise → relevant, "not determinable" (the safe side).
// The EL prefill is the MIN of the anchored leaves (AND = MIN).
import { describe, it, expect } from "vitest";
import {
  attackPathExposureLevel,
  attackPathRelevance,
  dfdRefResolver,
  threatRelevance,
  threatRelevanceText,
  type En50742Relevance,
} from "app/utils/en50742-relevance";
import { parseAndRepair } from "app/services/migration-service";
import { prepareProjectCompliance } from "app/services/compliance-report";
import { loadProjectFixture } from "../../../fixtures/load-fixture";

const resolve = dfdRefResolver({
  elements: [
    { id: "9", displayId: "IF-1" },
    { id: "17", displayId: "IF-2" },
    { id: "3", displayId: "P-1" },
  ],
  connections: [{ id: "7", displayId: "DF-3" }],
});
const zone: En50742Relevance = {
  mode: "zone",
  zoneIds: ["TB"],
  relevant: new Map([["9", { kind: "zone-interface", zoneIds: ["TB"], flowIds: ["7"] }]]),
};

describe("attackPathRelevance", () => {
  it("a leaf on a relevant interface: relevant, naming the leaf and the anchor", () => {
    const r = attackPathRelevance([{ name: "Plug in", dfdRef: "if-1" }, { name: "Wait" }], zone, resolve);
    expect(r).toEqual({ relevant: true, reason: { kind: "path-leaf", anchorId: "9", leaf: "Plug in" } });
    const t = (_k: string, o: Record<string, unknown>) => String(o.defaultValue).replace(/\{\{(\w+)\}\}/g, (_, n: string) => String(o[n]));
    expect(threatRelevanceText(r, (id) => ({ "9": "IF-1 USB" })[id] ?? id, t)).toBe("the attack path's step Plug in is on IF-1 USB");
  });

  it("every leaf anchored, none relevant: not relevant", () => {
    expect(attackPathRelevance([{ name: "JTAG", dfdRef: "IF-2" }, { name: "Proc", dfdRef: "P-1" }], zone, resolve)).toEqual({
      relevant: false,
      reason: "path-leaves-not-relevant",
    });
  });

  it("a leaf without a ref, or naming nothing known, or no leaves: relevant — not determinable", () => {
    const undetermined = { relevant: true, reason: { kind: "path-undetermined" } };
    expect(attackPathRelevance([{ name: "JTAG", dfdRef: "IF-2" }, { name: "Social" }], zone, resolve)).toEqual(undetermined);
    expect(attackPathRelevance([{ name: "X", dfdRef: "IF-99" }], zone, resolve)).toEqual(undetermined);
    expect(attackPathRelevance([], zone, resolve)).toEqual(undetermined);
  });

  it("no safety scope at all: not relevant, as the STRIDE threats", () => {
    expect(attackPathRelevance([{ name: "A" }], { mode: "none", zoneIds: [], relevant: new Map() }, resolve)).toEqual({
      relevant: false,
      reason: "no-safety-scope",
    });
  });

  it("threatRelevance takes the leaves when the threat has them", () => {
    expect(threatRelevance({ attackPathLeaves: [{ name: "Plug in", dfdRef: "IF-1" }] }, zone, resolve).relevant).toBe(true);
    // without them: the anchor rule (no anchor → not an interface)
    expect(threatRelevance({}, zone, resolve)).toEqual({ relevant: false, reason: "not-an-interface" });
  });
});

describe("attackPathExposureLevel — MIN of the anchored leaves", () => {
  const el = (id: string) => ({ "9": "EL3", "17": "EL1", "7": "EL2" })[id];
  it("AND = MIN; leaves without an EL or a ref do not count", () => {
    expect(attackPathExposureLevel([{ dfdRef: "IF-1" }, { dfdRef: "IF-2" }, {}], resolve, el)).toBe("EL1");
    expect(attackPathExposureLevel([{ dfdRef: "IF-1" }, { dfdRef: "DF-3" }], resolve, el)).toBe("EL2");
    expect(attackPathExposureLevel([{ dfdRef: "P-1" }, {}], resolve, el)).toBeUndefined();
  });
});

describe("from a project — the compliance view reads a path risk's leaves", () => {
  // Simple_Test_Project as an EN 50742 A project; its attack-path risk carries a stored SRSL.
  const projectWith = (leafRef?: string) => {
    const p = parseAndRepair(loadProjectFixture("Simple_Test_Project.tara.json"))!;
    p.info.tags = { ...p.info.tags, regulation: ["EN 50742 A"] };
    // a safety zone, so the project has a safety scope (zone mode)
    const tb = p.dfd!.elements.find((e) => e.type === "TrustBoundary")!;
    (tb.properties as Record<string, unknown>).safetyZone = "yes";
    const risk = p.risks!.risks.find((r) => r.id.startsWith("R-AT-"))!;
    (risk as { calculatedSrsl?: string }).calculatedSrsl = "SRSL1";
    if (leafRef) {
      const mark = (n: { type: string; dfdRef?: string; children: unknown[] }) => {
        if (n.type === "LEAF") n.dfdRef = leafRef;
        for (const c of n.children as (typeof n)[]) mark(c);
      };
      for (const tree of p.attackTrees!.trees) if (tree.ast) mark(tree.ast as never);
    }
    return { p, id: risk.id };
  };

  it("no leaf names a DFD element: relevant (not determinable) — the SRSL stays", () => {
    const { p, id } = projectWith();
    expect(prepareProjectCompliance(p)!.en50742View().risks.find((r) => r.id === id)!.srsl).toBe(1);
  });

  it("every leaf names an element off the relevant anchors: not relevant — no SRSL", () => {
    const { p, id } = projectWith("P-1");
    expect(prepareProjectCompliance(p)!.en50742View().risks.find((r) => r.id === id)!.srsl).toBeUndefined();
  });
});
