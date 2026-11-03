// EN 50742 Approach A module (model-coverage-implementation-plan.md §8.1,
// CM-11): every row of en-50742-rq-coverage.md §9.2 is in the module — same
// label, order, group, type and evidence kind — with a rule and texts in
// English and German. The ids never collide with the IEC 62443 ids, so one
// lookup serves both families.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  EDITION_EN50742_A,
  EN50742_A_REQUIREMENT_IDS,
  EN50742_A_RULES,
  EN50742_A_TEXTS,
  REQUIREMENT_IDS,
  RULES_BY_ID,
  TEXTS_BY_ID,
} from "features/compliance";

const COVERAGE = "doc/InProgress/RegulationCompliance/en-50742-rq-coverage.md";

const GROUPS: Record<string, string> = {
  "Threat assessment": "threat-assessment",
  "Information collection (7.3)": "information-collection",
  "SW identification (7.5)": "software-identification",
  "Protection measures (7.4.3)": "protection-measures",
  "Information for use (9)": "information-for-use",
};

interface DocRow {
  group: string;
  label: string;
  type: string;
  evidence: string;
}

/** The table of §9.2: a blank group cell continues the group above. */
function docRows(): DocRow[] {
  const text = readFileSync(COVERAGE, "utf-8");
  const section = text.slice(text.indexOf("### 9.2 Rows"), text.indexOf("### 9.3"));
  const rows: DocRow[] = [];
  let group = "";
  for (const line of section.split("\n")) {
    const cells = line.split("|").map((c) => c.trim());
    if (cells.length < 7 || !cells[2]?.startsWith("EN-")) continue;
    if (cells[1]) group = GROUPS[cells[1]] ?? `unknown group ${cells[1]}`;
    rows.push({ group, label: cells[2], type: cells[3], evidence: cells[4] });
  }
  return rows;
}

const byId = new Map(EN50742_A_RULES.map((r) => [r.id, r]));

describe("EN 50742 A rows (coverage §9.2)", () => {
  const doc = docRows();

  it("the module has exactly the rows of §9.2, in order, with their group", () => {
    expect(doc.length).toBe(23);
    expect(EDITION_EN50742_A.rows.map((r) => [r.label, r.group])).toEqual(doc.map((d) => [d.label, d.group]));
  });

  it.each(doc.map((d, i) => [d.label, d, i] as const))("%s: type and evidence kind as in §9.2", (_label, d, i) => {
    const row = EDITION_EN50742_A.rows[i];
    expect(row.requirementIds).toHaveLength(1);
    const rule = byId.get(row.requirementIds[0])!;
    expect(rule.type).toBe(d.type);
    const kinds = d.evidence.split("+").map((k) => k.trim());
    expect(rule.targets.length > 0, "M").toBe(kinds.includes("M"));
    expect(rule.external?.kind === "risk", "R").toBe(kinds.includes("R"));
    expect(rule.external?.kind === "project", "P").toBe(kinds.includes("P"));
    if (d.type === "B") expect(rule.checklist?.length, "type B has a checklist").toBeGreaterThan(0);
    if (d.type !== "B") expect(rule.checklist, "only type B has a checklist").toBeUndefined();
  });

  it("every requirement id has one rule and is used by one row", () => {
    expect(EN50742_A_RULES.map((r) => r.id)).toEqual([...EN50742_A_REQUIREMENT_IDS]);
    expect(EDITION_EN50742_A.rows.flatMap((r) => r.requirementIds).sort()).toEqual([...EN50742_A_REQUIREMENT_IDS].sort());
  });

  it("7.4.3.5.1 applies from SRSL 2 and reads the 62443 security properties (E-4)", () => {
    const rule = byId.get("en-7.4.3.5.1-438")!;
    expect(rule.minSrsl).toBe(2);
    const properties = rule.targets.flatMap((t) => (t.satisfiedIf ?? []).map((c) => c.property));
    expect(properties.sort()).toEqual(["integrityProtection", "malwareProtection", "updateMechanism"]);
  });
});

describe("EN 50742 A texts", () => {
  it("every id has a title and both summaries, nothing else", () => {
    expect(Object.keys(EN50742_A_TEXTS).sort()).toEqual([...EN50742_A_REQUIREMENT_IDS].sort());
    for (const id of EN50742_A_REQUIREMENT_IDS) {
      const text = EN50742_A_TEXTS[id];
      expect(text.title.length, id).toBeGreaterThan(3);
      expect(text.en.length, id).toBeGreaterThan(10);
      expect(text.de.length, id).toBeGreaterThan(10);
    }
  });

  it("summaries stay short and never use normative wording (licence rule D-27)", () => {
    for (const id of EN50742_A_REQUIREMENT_IDS) {
      const { en, de } = EN50742_A_TEXTS[id];
      expect(en.length, id).toBeLessThanOrEqual(160);
      expect(de.length, id).toBeLessThanOrEqual(180);
      expect(en, id).not.toMatch(/\bshall\b/i);
      expect(de, id).not.toMatch(/\bmuss\b|\bmüssen\b/i);
    }
  });

  it("every checklist has its German version, item by item", () => {
    for (const rule of EN50742_A_RULES) {
      expect(EN50742_A_TEXTS[rule.id].checklistDe?.length ?? 0, rule.id).toBe(rule.checklist?.length ?? 0);
    }
  });
});

describe("one lookup for every family", () => {
  it("EN 50742 ids never collide with IEC 62443 ids", () => {
    const iec = new Set<string>(REQUIREMENT_IDS);
    expect(EN50742_A_REQUIREMENT_IDS.filter((id) => iec.has(id))).toEqual([]);
    expect(RULES_BY_ID.size).toBe(REQUIREMENT_IDS.length + EN50742_A_REQUIREMENT_IDS.length);
    expect(Object.keys(TEXTS_BY_ID)).toHaveLength(REQUIREMENT_IDS.length + EN50742_A_REQUIREMENT_IDS.length);
  });
});
