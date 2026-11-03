// Standard registry and requirement namespaces (model-coverage-implementation-plan.md
// §2.1, §2.3, CM-1): the regulation tags select every matching standard (K-1),
// requirement ids are unique per family and qualified across families (K-4).
import { describe, it, expect } from "vitest";
import { MATRIX_TAGS, tagEffectOf } from "shared";
import {
  activeStandards,
  EDITION_2019,
  EDITION_PRAA_2026,
  parseRequirementId,
  qualifyRequirementId,
  REQUIREMENT_IDS,
  REQUIREMENT_NAMESPACES,
  selectEdition,
  STANDARDS,
  TAG_EN_50742_A,
  TAG_EN_IEC_62443_CRA,
  TAG_IEC_62443,
} from "features/compliance";

const tags = (...regulation: string[]) => ({ regulation });
const ids = (regulation: string[]) => activeStandards(tags(...regulation)).map((s) => s.id);

describe("activeStandards", () => {
  it("no tag, or only the generic CRA tag, selects no standard (D-1)", () => {
    expect(activeStandards(undefined)).toEqual([]);
    expect(activeStandards(null)).toEqual([]);
    expect(ids([])).toEqual([]);
    expect(ids(["CRA"])).toEqual([]);
  });

  it("each 62443 tag selects its edition", () => {
    expect(ids([TAG_IEC_62443])).toEqual(["iec-62443-4-2-2019"]);
    expect(ids([TAG_EN_IEC_62443_CRA, "CRA"])).toEqual(["en-iec-62443-4-2-praa-2026"]);
  });

  it("both 62443 tags select both editions, CRA edition first (K-1)", () => {
    expect(ids([TAG_IEC_62443, TAG_EN_IEC_62443_CRA])).toEqual(["en-iec-62443-4-2-praa-2026", "iec-62443-4-2-2019"]);
  });

  it("EN 50742 A is selected by its tag and every alias of the tag normaliser (CM-11)", () => {
    for (const tag of [TAG_EN_50742_A, "EN50742_A", "EN 50742 Approach A", "en-50742-a", "EN 50742"]) {
      expect(ids([tag]), tag).toEqual(["en-50742-a"]);
    }
  });

  it("Approach B and unrelated tags do not select EN 50742 A", () => {
    expect(ids(["EN 50742 B"])).toEqual([]);
    expect(ids(["EN50742_B"])).toEqual([]);
    expect(ids(["ISO 21434"])).toEqual([]);
  });

  it("with every tag set, one sub-tab per standard in registry order", () => {
    expect(ids([TAG_EN_50742_A, TAG_IEC_62443, TAG_EN_IEC_62443_CRA])).toEqual([
      "en-iec-62443-4-2-praa-2026",
      "iec-62443-4-2-2019",
      "en-50742-a",
    ]);
  });

  it("until one chapter per standard (CM-9), the report shows the first active standard", () => {
    expect(selectEdition(tags(TAG_IEC_62443, TAG_EN_IEC_62443_CRA))).toBe(EDITION_PRAA_2026);
    expect(selectEdition(tags(TAG_IEC_62443))).toBe(EDITION_2019);
    expect(selectEdition(tags("CRA"))).toBeNull();
  });
});

describe("STANDARDS", () => {
  it("ids are unique and each standard carries its edition's id and family", () => {
    expect(new Set(STANDARDS.map((s) => s.id)).size).toBe(STANDARDS.length);
    for (const s of STANDARDS) {
      expect(s.edition.id).toBe(s.id);
      expect(s.edition.family).toBe(s.family);
      expect(s.tags.length).toBeGreaterThan(0);
    }
  });

  it("the tag editor's matrix tags are exactly the tags of the matrix-only standards", () => {
    // EN 50742 A is shown by a method tag (it selects the regulation preset too).
    const matrixOnly = STANDARDS.filter((s) => s.tags.every((tag) => tagEffectOf(tag) !== "method"));
    expect([...new Set(matrixOnly.flatMap((s) => s.tags))].sort()).toEqual([...MATRIX_TAGS].sort());
    for (const tag of STANDARDS.flatMap((s) => s.tags)) expect(tagEffectOf(tag), tag).not.toBeNull();
  });

  it("EN 50742 A: own family, SRSL header, the five groups, no levels", () => {
    const en = STANDARDS.find((s) => s.id === "en-50742-a")!;
    expect(en.family).toBe("en-50742");
    expect(en.label).toBe("EN 50742 A");
    expect(en.header).toBe("srsl");
    expect(en.edition.draft).toBe(true);
    expect(en.edition.groups).toEqual([
      "threat-assessment",
      "information-collection",
      "software-identification",
      "protection-measures",
      "information-for-use",
    ]);
    for (const row of en.edition.rows) expect(row.minSl, row.label).toBeNull();
  });

  it("62443 editions use the SL header and group by foundational requirement", () => {
    for (const s of STANDARDS.filter((s) => s.family === "iec-62443-4-2")) {
      expect(s.header).toBe("security-levels");
      expect(s.edition.groups).toEqual(["IAC", "UC", "SI", "DC", "RDF", "TRE", "RA"]);
    }
  });
});

describe("requirement namespaces (K-4)", () => {
  it("namespaces are unique per family", () => {
    const namespaces = Object.values(REQUIREMENT_NAMESPACES);
    expect(new Set(namespaces).size).toBe(namespaces.length);
  });

  it("qualify and parse are inverse", () => {
    expect(qualifyRequirementId("iec-62443-4-2", "cr-1.1")).toBe("iec62443:cr-1.1");
    for (const id of REQUIREMENT_IDS) {
      expect(parseRequirementId(qualifyRequirementId("iec-62443-4-2", id))).toEqual({ family: "iec-62443-4-2", id });
    }
  });

  it("an unqualified id or an unknown namespace parses to nothing", () => {
    expect(parseRequirementId("cr-1.1")).toBeUndefined();
    expect(parseRequirementId(":cr-1.1")).toBeUndefined();
    expect(parseRequirementId("en303645:5.1-1")).toBeUndefined();
    expect(parseRequirementId("en50742:en-7.3.2-295")).toEqual({ family: "en-50742", id: "en-7.3.2-295" });
  });

  it("unqualified ids never contain the separator", () => {
    expect(REQUIREMENT_IDS.filter((id) => id.includes(":"))).toEqual([]);
  });
});
