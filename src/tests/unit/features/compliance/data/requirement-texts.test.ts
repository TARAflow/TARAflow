// Requirement texts (iec-62443-4-2-cra-coverage.md D-27): every requirement
// id has a title and a short summary in our own words, English and German;
// the German checklists match the evidence rules. The guards keep the texts
// short and free of normative wording — never the standard's text.
import { describe, it, expect } from "vitest";
import { ALL_EVIDENCE_RULES, REQUIREMENT_IDS, REQUIREMENT_TEXTS } from "features/compliance";

describe("requirement texts", () => {
  it("every requirement id has a title and both summaries, nothing else", () => {
    expect(Object.keys(REQUIREMENT_TEXTS).sort()).toEqual([...REQUIREMENT_IDS].sort());
    for (const id of REQUIREMENT_IDS) {
      const text = REQUIREMENT_TEXTS[id];
      expect(text.title.length, id).toBeGreaterThan(3);
      expect(text.en.length, id).toBeGreaterThan(10);
      expect(text.de.length, id).toBeGreaterThan(10);
    }
  });

  it("summaries stay short and never use normative wording (licence rule)", () => {
    for (const id of REQUIREMENT_IDS) {
      const { en, de } = REQUIREMENT_TEXTS[id];
      expect(en.length, id).toBeLessThanOrEqual(160);
      expect(de.length, id).toBeLessThanOrEqual(180);
      expect(en, id).not.toMatch(/\bshall\b/i);
      expect(de, id).not.toMatch(/\bmuss\b|\bmüssen\b/i);
    }
  });

  it("every type B checklist has its German version, item by item", () => {
    for (const rule of ALL_EVIDENCE_RULES) {
      const de = REQUIREMENT_TEXTS[rule.id].checklistDe ?? [];
      expect(de.length, rule.id).toBe(rule.checklist?.length ?? 0);
    }
  });
});
