// IEC 62443 references in the built-in mitigation catalog
// (iec-62443-4-2-cra-coverage.md D-6): every reference is a known
// requirement id — the threats feature stores them as strings, the
// compliance feature owns the list.
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { REQUIREMENT_IDS, REQUIREMENT_NAMESPACES, ruleElementTypes, type RequirementId } from "features/compliance";

const DIR = join(process.cwd(), "src/features/threats/services/catalog/mitigations");
const entries = readdirSync(DIR)
  .filter((f) => f.endsWith(".json"))
  .flatMap(
    (f) =>
      JSON.parse(readFileSync(join(DIR, f), "utf-8")).mitigations as {
        id: string;
        iec62443?: string[];
        affectsProperties?: { targetType: string }[];
      }[],
  );

describe("mitigation catalog → IEC 62443 references", () => {
  const known = new Set<string>(REQUIREMENT_IDS);

  it("the reference field is named after the family's namespace (K-4)", () => {
    const field = REQUIREMENT_NAMESPACES["iec-62443-4-2"];
    expect(entries.some((m) => field in m)).toBe(true);
  });

  it("every reference is a known requirement id, none twice on one mitigation", () => {
    for (const m of entries) {
      for (const id of m.iec62443 ?? []) expect(known.has(id), `${m.id} → ${id}`).toBe(true);
      expect(new Set(m.iec62443 ?? []).size, m.id).toBe((m.iec62443 ?? []).length);
    }
  });

  it("controls without a DFD property mapping can still meet rows the model cannot show", () => {
    // e.g. resource limits (CR 7.2), island mode (CR 5.2 RE(2)), session management (CR 3.8)
    const refs = (id: string) => entries.find((m) => m.id === id)?.iec62443;
    expect(refs("M-D-002")).toContain("cr-7.2");
    expect(refs("M-D-009")).toContain("cr-5.2-re2");
    expect(refs("M-S-003")).toContain("cr-3.8");
  });
});

/**
 * References wider than the mitigation's property effects (D-29), each with
 * its reason. Anything else that sets properties only on types the rule does
 * not check is a wrong reference.
 */
const WIDER_REFERENCES: Record<string, string> = {
  "M-S-001 cr-1.1-re2": "MFA is the requirement; the effect sets it at the system boundary, the rule checks the human access flows",
  "M-T-012 cr-4.3": "recognised crypto on the chip serves the encrypted flows and stores the rule checks",
  "M-D-004 cr-7.1": "a redundant system keeps essential functions in degraded mode (CR 7.1), the rule checks the exposed interfaces",
  "M-CB-I-002 cr-1.5-re1": "the hardware key store on the chip protects the authenticators of the processes the rule checks",
  "M-PB-R-002 cr-6.2": "physical SOC monitoring is part of the continuous monitoring the rule checks on boundaries and interfaces",
};

describe("references fit the element types of their rules (D-29)", () => {
  it("a mitigation with property effects names an A / B requirement only for a type the rule checks — or a listed wider reference", () => {
    const misfits: string[] = [];
    for (const m of entries) {
      const effectTypes = (m.affectsProperties ?? []).map((e) => e.targetType);
      if (effectTypes.length === 0) continue;
      for (const id of m.iec62443 ?? []) {
        const ruleTypes = ruleElementTypes(id as RequirementId);
        if (ruleTypes.size === 0 || effectTypes.some((t) => ruleTypes.has(t))) continue;
        if (!WIDER_REFERENCES[`${m.id} ${id}`]) misfits.push(`${m.id} ${id}`);
      }
    }
    expect(misfits).toEqual([]);
  });

  it("every listed wider reference still exists", () => {
    for (const key of Object.keys(WIDER_REFERENCES)) {
      const [mid, id] = key.split(" ");
      expect(entries.find((m) => m.id === mid)?.iec62443, key).toContain(id);
    }
  });
});

describe("the catalog references match the design document (§10)", () => {
  it("same mitigations, same requirement ids", () => {
    const doc = readFileSync(join(process.cwd(), "doc/Done/RegulationCompliance/iec-62443-4-2-cra-coverage.md"), "utf-8");
    const section = doc.slice(doc.indexOf("## 10. Mitigation catalog references"));
    const fromDoc = Object.fromEntries(
      [...section.matchAll(/^\| (M-[A-Z0-9-]+) \| .*? \| (.*) \|$/gm)].map((m) => [m[1], [...m[2].matchAll(/`([^`]+)`/g)].map((x) => x[1])]),
    );
    const fromCatalog = Object.fromEntries(entries.filter((m) => m.iec62443?.length).map((m) => [m.id, m.iec62443]));
    expect(fromDoc).toEqual(fromCatalog);
  });
});
