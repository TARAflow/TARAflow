// Completeness of the IEC 62443-4-2 matrices (iec-62443-4-2-cra-coverage.md
// §9.5, D-11): every row of both editions resolves to evidence rules or is
// void, every rule is used, the row lists reproduce the coverage documents.
import { describe, it, expect } from "vitest";
import {
  ALL_EVIDENCE_RULES,
  EDITION_2019,
  EDITION_PRAA_2026,
  EVIDENCE_RULES,
  REQUIREMENT_IDS,
  type Edition,
  type EvidenceRule,
} from "features/compliance";

const EDITIONS: readonly Edition[] = [EDITION_PRAA_2026, EDITION_2019];

/** Row type as the coverage documents state it: the rule type, n/a for void rows. */
function rowType(edition: Edition, label: string): string {
  const row = edition.rows.find((r) => r.label === label);
  if (!row) throw new Error(`no row ${label}`);
  if (row.void) return "n/a";
  const types = new Set(row.requirementIds.map((id) => EVIDENCE_RULES.get(id)!.type));
  if (types.size !== 1) throw new Error(`${label}: mixed types`);
  return [...types][0];
}

function countTypes(edition: Edition, filter: (label: string) => boolean): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of edition.rows.filter((r) => filter(r.label))) {
    const t = rowType(edition, row.label);
    counts[t] = (counts[t] ?? 0) + 1;
  }
  return counts;
}

const hasSatisfiedIf = (rule: EvidenceRule) => rule.targets.some((t) => (t.satisfiedIf?.length ?? 0) > 0);

describe("IEC 62443-4-2 evidence rules", () => {
  it("one rule per requirement id, no rule without an id", () => {
    const ids = ALL_EVIDENCE_RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual([...REQUIREMENT_IDS].sort());
  });

  it("type C rules carry no evidence; A and B rules do", () => {
    for (const rule of ALL_EVIDENCE_RULES) {
      expect(hasSatisfiedIf(rule), rule.id).toBe(rule.type !== "C");
    }
  });

  it("only type B rules carry a checklist, and every B rule has one", () => {
    for (const rule of ALL_EVIDENCE_RULES) {
      expect((rule.checklist?.length ?? 0) > 0, rule.id).toBe(rule.type === "B");
    }
  });

  it('quantifier "any" only for the capabilities of the component as a whole (D-22)', () => {
    // Mirrors the list with reasons in iec-62443-4-2-cra-coverage.md §9.2. A
    // rule that needs "any" is added there first — never silently here.
    const ALLOWED_ANY = [
      "cr-1.3", "cr-1.4", "cr-1.5", "cr-2.8",
      "cr-3.10", "cr-3.10-re1", "cr-3.10-re2", "cr-3.12",
      "cr-5.1", "cr-6.1-re1", "cr-6.2",
      "cr-7.3", "cr-7.4", "cr-7.9",
    ];
    const any = ALL_EVIDENCE_RULES.filter((r) => r.quantifier === "any").map((r) => r.id);
    expect(any.filter((id) => !ALLOWED_ANY.includes(id))).toEqual([]);
  });

  it("every requirement id is used by at least one edition", () => {
    const used = new Set(EDITIONS.flatMap((e) => e.rows.flatMap((r) => r.requirementIds)));
    expect(REQUIREMENT_IDS.filter((id) => !used.has(id))).toEqual([]);
  });
});

describe.each(EDITIONS)("edition $id", (edition) => {
  it("labels are unique", () => {
    const labels = edition.rows.map((r) => r.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("every live row has a lowest SL-C and resolvable requirement ids; void rows have neither", () => {
    for (const row of edition.rows) {
      if (row.void) {
        expect(row.minSl, row.label).toBeNull();
        expect(row.requirementIds, row.label).toEqual([]);
        expect(row.supportingMeasuresAllowed, row.label).toBe(false);
      } else {
        expect(row.minSl, row.label).not.toBeNull();
        expect(row.requirementIds.length, row.label).toBeGreaterThan(0);
        for (const id of row.requirementIds) expect(EVIDENCE_RULES.has(id), `${row.label} → ${id}`).toBe(true);
      }
    }
  });
});

describe("CRA edition (prAA) reproduces iec-62443-4-2-cra-coverage.md §4", () => {
  it("97 rows, 7 void; type split A 36 · B 23 · C 31", () => {
    expect(EDITION_PRAA_2026.rows).toHaveLength(97);
    expect(countTypes(EDITION_PRAA_2026, () => true)).toEqual({ A: 36, B: 23, C: 31, "n/a": 7 });
  });

  it("has no device rows and names the CRA requirements of every live row", () => {
    for (const row of EDITION_PRAA_2026.rows) {
      expect(row.deviceCategories, row.label).toBeUndefined();
      if (!row.void && !["CR 1.12", "CR 2.12", "CR 2.12 RE(1)", "CR 3.9", "CR 3.9 RE(1)", "CR 7.8"].includes(row.label)) {
        expect(row.cra?.length, row.label).toBeGreaterThan(0);
      }
    }
  });

  it("CR 4.1 is split into transit and rest (content differs from 2019)", () => {
    const ids = (label: string) => EDITION_PRAA_2026.rows.find((r) => r.label === label)?.requirementIds;
    expect(ids("CR 4.1")).toEqual(["cr-4.1-transit"]);
    expect(ids("CR 4.1 RE(1)")).toEqual(["cr-4.1-rest"]);
  });

  it("CR 7.9 exists only here", () => {
    expect(EDITION_PRAA_2026.rows.some((r) => r.requirementIds.includes("cr-7.9"))).toBe(true);
    expect(EDITION_2019.rows.some((r) => r.requirementIds.includes("cr-7.9"))).toBe(false);
  });
});

describe("classic edition (2019) reproduces iec-62443-4-2-2019-coverage.md §3 / §4", () => {
  const isCr = (label: string) => label.startsWith("CR ");

  it("73 CR rows (A 24 · B 17 · C 29 · 3 void) plus SAR 3 · EDR 13 · HDR 14 · NDR 22 device rows", () => {
    expect(EDITION_2019.rows.filter((r) => isCr(r.label))).toHaveLength(73);
    expect(countTypes(EDITION_2019, isCr)).toEqual({ A: 24, B: 17, C: 29, "n/a": 3 });
    for (const [category, n] of [["SAR", 3], ["EDR", 13], ["HDR", 14], ["NDR", 22]] as const) {
      expect(EDITION_2019.rows.filter((r) => r.deviceCategories?.includes(category)), category).toHaveLength(n);
    }
  });

  it("CR 4.1 needs both transit and rest (one requirement in 2019)", () => {
    expect(EDITION_2019.rows.find((r) => r.label === "CR 4.1")?.requirementIds).toEqual(["cr-4.1-transit", "cr-4.1-rest"]);
  });

  it("device rows name their category; CR rows apply to every component", () => {
    for (const row of EDITION_2019.rows) {
      const prefix = row.label.split(" ")[0];
      if (prefix === "CR") expect(row.deviceCategories, row.label).toBeUndefined();
      else expect(row.deviceCategories, row.label).toEqual([prefix]);
    }
  });

  it("has no CRA references", () => {
    expect(EDITION_2019.rows.some((r) => r.cra)).toBe(false);
  });
});

describe("no silent fallback between editions (D-11)", () => {
  const usedBy = (edition: Edition) => new Set(edition.rows.flatMap((r) => r.requirementIds));

  it("2019-only content is not referenced by the CRA edition", () => {
    const praa = usedBy(EDITION_PRAA_2026);
    for (const id of ["cr-1.7-re1-human", "cr-1.7-re2-all-users", "cr-1.9-re1", "cr-1.14", "cr-1.14-re1", "cr-3.3", "cr-3.3-re1",
      "sar-3.2-qualify", "edr-3.2-unauthorized-software", "hdr-3.2-re1-report-version", "ndr-5.3"] as const) {
      expect(praa.has(id), id).toBe(false);
    }
  });

  it("prAA-only content is not referenced by the classic edition", () => {
    const classic = usedBy(EDITION_2019);
    for (const id of ["cr-1.7-re2-machines", "cr-2.8-re1", "cr-3.2-re1", "cr-3.10-re2", "cr-7.9"] as const) {
      expect(classic.has(id), id).toBe(false);
    }
  });
});
