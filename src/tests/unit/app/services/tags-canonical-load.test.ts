// Loading (0.20): method tags in their catalogue spelling — the bare
// "EN 50742" and "EN50742_A" become "EN 50742 A" (as the preset read them).
import { describe, it, expect } from "vitest";
import { parseAndRepair } from "app/services/migration-service";
import { CURRENT_SCHEMA_VERSION } from "app/services/schema-version";
import { regulationPresetFromTags } from "shared";

const raw = (regulation: string[]) => ({
  id: "P",
  schemaVersion: CURRENT_SCHEMA_VERSION,
  info: { name: "Machine", description: "", tags: { domain: [], platform: [], custom: [], regulation }, team: [] },
  currentPhase: 0,
  phaseStatus: {},
  settings: {},
  hazards: null,
  dfd: null,
  assets: null,
  threats: null,
  risks: null,
  attackTrees: null,
  documentation: null,
  audit: null,
  integration: null,
});

describe("method tags on load", () => {
  it("old spellings become the catalogue tag; the preset stays", () => {
    const loaded = parseAndRepair(raw(["EN 50742", "CRA"]))!;
    expect(loaded.info.tags.regulation).toEqual(["EN 50742 A", "CRA"]);
    expect(regulationPresetFromTags(loaded.info.tags)).toBe("en-50742-a");
    expect(parseAndRepair(raw(["EN50742_B", "IEC 62443"]))!.info.tags.regulation).toEqual(["EN 50742 B", "IEC 62443"]);
  });

  it("excluded combinations are kept for the analyst to resolve", () => {
    expect(parseAndRepair(raw(["ISO 21434", "EN 50742 A"]))!.info.tags.regulation).toEqual(["ISO 21434", "EN 50742 A"]);
  });
});
