// The regulation tag "EN IEC 62443 (CRA)" (iec-62443-4-2-cra-coverage.md D-3,
// IEC-2b): in the catalogue, selects the CRA requirement matrix, a context
// hint like "IEC 62443", and a hint to add the generic CRA tag.
import { describe, it, expect } from "vitest";
import { getTagDefinition, getTagCategory, isPredefinedTag } from "shared/utils/tag-categories";
import { getTagWarnings } from "shared";
import { selectEdition, TAG_EN_IEC_62443_CRA } from "features/compliance";

const tags = (regulation: string[], domain: string[] = [], platform: string[] = []) => ({ regulation, domain, platform, custom: [] });

describe('tag "EN IEC 62443 (CRA)"', () => {
  it("is a predefined regulation tag with tooltip and document description", () => {
    expect(isPredefinedTag(TAG_EN_IEC_62443_CRA)).toBe(true);
    expect(getTagCategory(TAG_EN_IEC_62443_CRA, {})?.key).toBe("regulation");
    expect(getTagDefinition(TAG_EN_IEC_62443_CRA)).toMatchObject({
      tooltipKey: "tags.tooltips.enIec62443Cra",
      docDescriptionKey: "tags.docDescriptions.enIec62443Cra",
    });
  });

  it("selects the CRA edition", () => {
    expect(selectEdition(tags([TAG_EN_IEC_62443_CRA]))?.id).toBe("en-iec-62443-4-2-praa-2026");
  });

  it("hints at an industrial context and at the CRA tag; none with both", () => {
    const warnings = getTagWarnings(tags([TAG_EN_IEC_62443_CRA]));
    expect(warnings.some((w) => w.regulation === TAG_EN_IEC_62443_CRA && w.suggestedTag === "OT")).toBe(true);
    expect(warnings.some((w) => w.regulation === TAG_EN_IEC_62443_CRA && w.kind === "missing-context" && !w.suggestedTag)).toBe(true);
    expect(getTagWarnings(tags([TAG_EN_IEC_62443_CRA, "CRA"], ["Industrial"], ["OT"]))).toEqual([]);
  });
});
