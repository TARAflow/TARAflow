// IEC 62443 references in the built-in mitigation catalog
// (iec-62443-4-2-cra-coverage.md D-6): every reference is a known
// requirement id — the threats feature stores them as strings, the
// compliance feature owns the list.
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { REQUIREMENT_IDS } from "features/compliance";

const DIR = join(process.cwd(), "src/features/threats/services/catalog/mitigations");
const entries = readdirSync(DIR)
  .filter((f) => f.endsWith(".json"))
  .flatMap((f) => (JSON.parse(readFileSync(join(DIR, f), "utf-8")).mitigations as { id: string; iec62443?: string[] }[]));

describe("mitigation catalog → IEC 62443 references", () => {
  const known = new Set<string>(REQUIREMENT_IDS);

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

describe("the catalog references match the design document (§10)", () => {
  it("same mitigations, same requirement ids", () => {
    const doc = readFileSync(join(process.cwd(), "doc/InProgress/RegulationCompliance/iec-62443-4-2-cra-coverage.md"), "utf-8");
    const section = doc.slice(doc.indexOf("## 10. Mitigation catalog references"));
    const fromDoc = Object.fromEntries(
      [...section.matchAll(/^\| (M-[A-Z0-9-]+) \| .*? \| (.*) \|$/gm)].map((m) => [m[1], [...m[2].matchAll(/`([^`]+)`/g)].map((x) => x[1])]),
    );
    const fromCatalog = Object.fromEntries(entries.filter((m) => m.iec62443?.length).map((m) => [m.id, m.iec62443]));
    expect(fromDoc).toEqual(fromCatalog);
  });
});
