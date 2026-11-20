// EN 50742 Approach B module (en-50742-rq-coverage.md §6.2, roadmap 0.20):
// the edition reproduces the row list of §6.2 — the 26 counted IEC 62443-4-2
// rows of Table 4 derived from the 2019 edition, the 12 recommended HDR / NDR
// / SAR variants (O14), the EN rows of Clauses 4, 6, 8 and 9 — with the fixed
// SL-T (B-F5), the statement family per row (K-6) and a rule and texts for
// every new EN id.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  EDITION_2019,
  EDITION_EN50742_B,
  EN50742_B_REQUIREMENT_IDS,
  EN50742_B_RULES,
  EN50742_B_TEXTS,
  REQUIREMENT_IDS,
  RULES_BY_ID,
  TEXTS_BY_ID,
} from "features/compliance";

const COVERAGE = "doc/InProgress/RegulationCompliance/en-50742-rq-coverage.md";

interface DocGroup {
  group: string;
  labels: string[];
}

/** The table of §6.2: group cell, then the comma-separated row labels; a blank group cell continues the group above. */
function docGroups(): DocGroup[] {
  const text = readFileSync(COVERAGE, "utf-8");
  const section = text.slice(text.indexOf("### 6.2 Sub-tab `en-50742-b`"), text.indexOf("## 7. Clause 9"));
  const out: DocGroup[] = [];
  for (const line of section.split("\n")) {
    const cells = line.split("|").map((c) => c.trim());
    if (cells.length < 6 || cells[1] === "Group" || /^-+$/.test(cells[1]) || cells[2] === "—") continue;
    const labels = cells[2].split(",").map((l) => l.trim()).filter(Boolean);
    if (labels.length === 0) continue;
    if (cells[1]) out.push({ group: cells[1], labels });
    else out[out.length - 1].labels.push(...labels);
  }
  return out;
}

const doc = docGroups();
const docLabels = (prefix: string) => doc.filter((g) => g.group.startsWith(prefix)).flatMap((g) => g.labels);
const rows = EDITION_EN50742_B.rows;
const counted = rows.filter((r) => r.family === "iec-62443-4-2" && !r.recommended);
const recommended = rows.filter((r) => r.recommended);

describe("EN 50742 B rows (coverage §6.2)", () => {
  it("26 counted rows of Table 4, per FR in the order of §6.2", () => {
    expect(counted).toHaveLength(26);
    for (const [fr, prefix] of [["IAC", "FR1"], ["UC", "FR2"], ["SI", "FR3"], ["RDF", "FR5"], ["TRE", "FR6"], ["RA", "FR7"]] as const) {
      expect(counted.filter((r) => r.group === fr).map((r) => r.label), fr).toEqual(docLabels(prefix));
    }
    expect(counted.filter((r) => r.group === "DC")).toEqual([]);
  });

  it("12 recommended variants (O14), with the reason, outside the count", () => {
    expect(recommended.map((r) => r.label).sort()).toEqual(docLabels("Recommended").sort());
    expect(recommended).toHaveLength(12);
    for (const r of recommended) expect(r.recommended).toMatch(/analogy/);
  });

  it("the Table 4 rows are the 2019 rows: same requirement ids, lowest SL-C and device categories; statements shared with IEC 62443-4-2", () => {
    for (const r of [...counted, ...recommended]) {
      const source = EDITION_2019.rows.find((s) => s.label === r.label)!;
      expect(source, r.label).toBeDefined();
      expect(r.requirementIds).toEqual(source.requirementIds);
      expect(r.minSl).toBe(source.minSl);
      expect(r.deviceCategories).toEqual(source.deviceCategories);
      expect(r.family).toBe("iec-62443-4-2");
      expect(r.minSl! <= EDITION_EN50742_B.fixedSlTarget![r.group as "IAC"]).toBe(true);
    }
  });

  it("the EN rows of §6.2, family en-50742 (the edition's)", () => {
    const enRows = rows.filter((r) => r.label.startsWith("EN-")).map((r) => r.label);
    const enDoc = doc.flatMap((g) => g.labels).filter((l) => l.startsWith("EN-"));
    expect(enRows.sort()).toEqual([...new Set(enDoc)].sort());
    for (const r of rows.filter((x) => x.label.startsWith("EN-"))) expect(r.family).toBeUndefined();
  });

  it("8.4 shares the requirement of 7.5 (O9); the common clauses share Approach A's", () => {
    const id = (label: string) => rows.find((r) => r.label === label)!.requirementIds[0];
    expect(id("EN-8.4/482–484")).toBe("en-7.5-444");
    expect(id("EN-4.3/217")).toBe("en-4.3-217");
    expect(id("EN-9/491–496")).toBe("en-9-491");
  });

  it("fixed SL-T of Table 4 (B-F5)", () => {
    expect(EDITION_EN50742_B.fixedSlTarget).toEqual({ IAC: 2, UC: 2, SI: 2, DC: 0, RDF: 1, TRE: 1, RA: 2 });
  });

  it("every row's group is one of the edition's groups; labels unique", () => {
    for (const r of rows) expect(EDITION_EN50742_B.groups).toContain(r.group);
    expect(new Set(rows.map((r) => r.label)).size).toBe(rows.length);
  });
});

describe("EN 50742 B rules and texts", () => {
  it("one rule and one text per new id, ids disjoint from IEC 62443", () => {
    expect(EN50742_B_RULES.map((r) => r.id)).toEqual([...EN50742_B_REQUIREMENT_IDS]);
    expect(Object.keys(EN50742_B_TEXTS).sort()).toEqual([...EN50742_B_REQUIREMENT_IDS].sort());
    for (const id of EN50742_B_REQUIREMENT_IDS) {
      expect((REQUIREMENT_IDS as readonly string[]).includes(id)).toBe(false);
      expect(RULES_BY_ID.get(id)).toBeDefined();
      expect(TEXTS_BY_ID[id]).toBeDefined();
    }
  });

  it("every requirement of every row resolves to a rule and a text", () => {
    for (const r of rows) for (const id of r.requirementIds) {
      expect(RULES_BY_ID.get(id), `${r.label} ${id}`).toBeDefined();
      expect(TEXTS_BY_ID[id], `${r.label} ${id}`).toBeDefined();
    }
  });

  it("texts are own words: short, no 'shall' / 'muss' (D-27)", () => {
    for (const id of EN50742_B_REQUIREMENT_IDS) {
      const { en, de } = EN50742_B_TEXTS[id];
      expect(en.length, id).toBeLessThanOrEqual(180);
      expect(de.length, id).toBeLessThanOrEqual(200);
      expect(en, id).not.toMatch(/\bshall\b/i);
      expect(de, id).not.toMatch(/\bmuss\b|\bmüssen\b/i);
    }
  });
});
