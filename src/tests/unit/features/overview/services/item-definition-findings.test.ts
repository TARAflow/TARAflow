// tests/unit/features/overview/services/item-definition-findings.test.ts
//
// ISO/SAE 21434 conformance plan Phase 1 stage A, A-4 (decisions 8, 24): the
// preset decides which Definition sections are mandatory; some findings hold
// in every preset.

import { describe, it, expect } from "vitest";
import { itemDefinitionFindings } from "features/overview/services/item-definition-findings";
import type { ItemDefinition } from "shared";

const def = (extra: Partial<ItemDefinition> = {}): ItemDefinition => ({ sections: {}, functions: [], assumptions: [], ...extra });
const codes = (f: ReturnType<typeof itemDefinitionFindings>) => f.map((x) => `${x.code}${x.section ? `:${x.section}` : ""}`);
const base = { description: "Detects smoke", today: "2026-10-28" };

describe("item definition findings (A-4)", () => {
  it("iso-21434: boundary, architecture and environment are mandatory, with their requirement", () => {
    const f = itemDefinitionFindings({ ...base, itemDefinition: def(), presetId: "iso-21434" });
    expect(f.map((x) => [x.code, x.section, x.requirement])).toEqual([
      ["ITEM_SECTION_MISSING", "boundary", "RQ-09-01 a"],
      ["ITEM_SECTION_MISSING", "architecture", "RQ-09-01 c"],
      ["ITEM_SECTION_MISSING", "environment", "RQ-09-02"],
    ]);
  });

  it("a section counts as described with text, a source or model links", () => {
    const f = itemDefinitionFindings({
      ...base,
      presetId: "iso-21434",
      itemDefinition: def({
        sections: {
          boundary: { text: "Head and loop" },
          architecture: { source: { document: "arc42", section: "§5" } },
          environment: { modelRefs: ["tb1"] },
        },
      }),
    });
    expect(codes(f)).toEqual([]);
  });

  it("other presets: no mandatory section; the purpose is needed everywhere", () => {
    expect(itemDefinitionFindings({ ...base, itemDefinition: undefined, presetId: "standard" })).toEqual([]);
    expect(itemDefinitionFindings({ ...base, itemDefinition: undefined, presetId: "en-50742-a" })).toEqual([]);
    const f = itemDefinitionFindings({ ...base, description: " ", itemDefinition: undefined, presetId: "standard" });
    expect(f).toEqual([{ code: "ITEM_PURPOSE_MISSING", severity: "warning", section: "functions" }]);
    expect(
      itemDefinitionFindings({ ...base, description: "", itemDefinition: def(), presetId: "iso-21434" })[0],
    ).toMatchObject({ code: "ITEM_PURPOSE_MISSING", requirement: "RQ-09-01 b" });
  });

  it("an invalid assumption still in use warns; an open one past its review date informs", () => {
    const f = itemDefinitionFindings({
      ...base,
      presetId: "standard",
      itemDefinition: def({
        assumptions: [
          { id: "a1", displayId: "ASM-01", text: "x", status: "invalid" },
          { id: "a2", displayId: "ASM-02", text: "y", status: "invalid" },
          { id: "a3", displayId: "ASM-03", text: "z", status: "open", reviewBy: "2026-10-01" },
          { id: "a4", displayId: "ASM-04", text: "z", status: "open", reviewBy: "2026-12-01" },
        ],
      }),
      assumptionUsage: { a1: ["TB-1 Device"] },
    });
    expect(f).toEqual([
      { code: "ITEM_ASSUMPTION_INVALID_IN_USE", severity: "warning", assumption: "ASM-01", boundaries: ["TB-1 Device"] },
      { code: "ITEM_ASSUMPTION_REVIEW_DUE", severity: "info", assumption: "ASM-03" },
    ]);
  });

  it("links to removed model items inform, per section; function assets too", () => {
    const f = itemDefinitionFindings({
      ...base,
      presetId: "standard",
      itemDefinition: def({
        sections: { boundary: { modelRefs: ["ok", "gone1", "gone2"] } },
        functions: [{ id: "f1", name: "Detect", lifecyclePhases: [], functionAssetId: "gone3" }],
      }),
      modelItemIds: new Set(["ok"]),
    });
    expect(f.map((x) => [x.code, x.section, x.count])).toEqual([
      ["ITEM_LINK_REMOVED", "boundary", 2],
      ["ITEM_LINK_REMOVED", "functions", 1],
    ]);
  });
});
