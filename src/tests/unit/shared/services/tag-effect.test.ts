// Tags that change the workflow are marked in the tag editor (user
// 2026-11-01): method tags select the regulation preset, matrix tags enable
// an IEC 62443-4-2 requirement matrix; the others only document.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { MATRIX_TAGS, regulationPresetFromTags, tagEffectOf } from "shared";
import { TAG_EN_IEC_62443_CRA, TAG_IEC_62443 } from "features/compliance";
import { getRegulationTagNames } from "shared/utils/tag-categories";

const tags = (regulation: string[]) => ({ domain: [], platform: [], custom: [], regulation });

describe("tagEffectOf", () => {
  it("method tags select a preset, matrix tags a matrix, the rest documents", () => {
    expect(["ISO 21434", "EN 50742 A", "EN 50742 B", "ETSI TVRA"].map(tagEffectOf)).toEqual(["method", "method", "method", "method"]);
    expect(["IEC 62443", "EN IEC 62443 (CRA)"].map(tagEffectOf)).toEqual(["matrix", "matrix"]);
    expect(["CRA", "NIS2", "GDPR", "Industrial", "OT"].map(tagEffectOf)).toEqual([null, null, null, null, null]);
  });

  it("every regulation tag marked as method really changes the preset, and only those", () => {
    for (const tag of getRegulationTagNames()) {
      const changesPreset = regulationPresetFromTags(tags([tag])) !== "standard";
      expect(tagEffectOf(tag) === "method", tag).toBe(changesPreset);
    }
  });

  it("the matrix tags are the ones the compliance feature selects an edition by", () => {
    expect([...MATRIX_TAGS].sort()).toEqual([TAG_IEC_62443, TAG_EN_IEC_62443_CRA].sort());
  });
});

describe("catalog: S-002 for both IEC 62443 tags", () => {
  it("the spoofing template tied to IEC 62443 also applies with the CRA edition's tag", () => {
    const file = JSON.parse(
      readFileSync("src/features/threats/services/catalog/threats/per-element/embedded/threats-spoofing.json", "utf-8"),
    );
    const items = (Array.isArray(file) ? file : Object.values(file).find(Array.isArray)) as { id: string; context?: { regulation?: string[] } }[];
    const s002 = items.find((t) => t.id === "S-002")!;
    expect(s002.context?.regulation).toEqual(["IEC 62443", "EN IEC 62443 (CRA)"]);
  });
});
