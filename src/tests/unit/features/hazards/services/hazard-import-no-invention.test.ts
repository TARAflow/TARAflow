// tests/unit/features/hazards/services/hazard-import-no-invention.test.ts
//
// Hazard import design HI-6 / HI-11 (doc/InProgress/Hazard/hazard-import-
// iso12100-extensions.md): the import writes nothing it did not read —
//   HI-6  no hard-coded "Restrisiken:" text in the rationale; the source's
//         residual-risk note is import metadata (importMeta.residualRisk);
//   HI-11 a missing or unknown severity creates no person edge (it used to
//         be coerced to "marginal" → an invented reversible_minor injury).

import { describe, it, expect } from "vitest";

import fixture from "../../../../fixtures/hazards/label-applicator-iso12100.json";
import { applyImportProfile } from "features/hazards/services/apply-import-profile";
import { bridgeSafetyHazards } from "features/hazards/services/hazard-bridge";
import { finalizeImport } from "features/hazards/services/safety-hazard-importer";
import type { ImportProfile, SheetGrid } from "features/hazards/models/import-profile-types";
import type { SafetyHazard } from "features/hazards/models/safety-hazard-types";

const sheets = fixture.sheets as unknown as SheetGrid[];

const profile: ImportProfile = {
  id: "p",
  name: "p",
  format: "spreadsheet",
  sheetName: "Risk assessment",
  headerRow: 2,
  dataStartRow: 3,
  idPattern: "^[1-9]\\d*(\\.\\d+)?$",
  columns: [
    { field: "id", column: 0 },
    { field: "description", column: 4 },
    { field: "severity", column: 7, valueMap: { "1": "negligible", "2": "marginal", "3": "critical", "4": "catastrophic" } },
    { field: "notes", column: 14 },
  ],
  markerGroups: [],
  metaColumns: [],
};

const bridge = (hazards: SafetyHazard[]) => {
  let n = 0;
  return bridgeSafetyHazards(hazards, {
    makeHazardItemId: () => `HZ-${++n}` as never,
    existingAssets: [],
    mintHumanAsset: (name: string) =>
      ({ id: `H-${name}`, displayId: `HU-${name}`, name, assetGroup: "human" }) as never,
  });
};

describe("HI-6 — no text in stored data", () => {
  const { items } = bridge(applyImportProfile(sheets, profile).hazards);

  it("no item gets a rationale from the import, none contains the old prefix", () => {
    expect(items.every((i) => i.rationale === undefined)).toBe(true);
  });

  it("the residual-risk note is kept as importMeta.residualRisk", () => {
    expect(items.find((i) => i.externalRef === "3")!.importMeta?.residualRisk).toBe(
      "Residual voltage in the drive",
    );
  });
});

describe("HI-11 — no invented severity", () => {
  it("importer: a missing severity stays undefined, with a warning", () => {
    const result = applyImportProfile(sheets, profile);
    const row8 = result.hazards.find((h) => h.id === "8")!;
    expect(row8.severity).toBeUndefined();
    expect(result.warnings.some((w) => w.field === "severity" && /Missing severity/.test(w.message))).toBe(true);
  });

  it("importer: an unknown severity stays undefined, with a warning", () => {
    const result = finalizeImport(
      [{ row: 1, data: { id: "a", description: "d", severity: "dreadful" as never } }],
      "test",
    );
    expect(result.hazards[0].severity).toBeUndefined();
    expect(result.warnings.some((w) => /Unknown severity "dreadful"/.test(w.message))).toBe(true);
  });

  it("bridge: an affected person without a severity gets no edge", () => {
    const { items, relations, warnings } = bridge([
      { id: "a", description: "no severity", hazardCategory: "other", affectedPersons: ["Operator"] },
      { id: "b", description: "rated", hazardCategory: "other", severity: "critical", affectedPersons: ["Operator"] },
    ]);
    expect(items).toHaveLength(2);
    const edges = relations.filter((r) => r.type === "endangers");
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({ from: items[1].id, impact: { severity: "irreversible_major" } });
    // no "no affected person" hint for the unrated row — the severity warning covers it
    expect(warnings.some((w) => w.message.includes('"a"'))).toBe(false);
  });
});
