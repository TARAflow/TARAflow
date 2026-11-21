// Project setting "Show exposure levels in the diagram" (0.20): absent = on,
// only an explicit false is stored — and survives loading and repair.
import { describe, it, expect } from "vitest";
import { parseAndRepair, repairProject } from "app/services/migration-service";
import { CURRENT_SCHEMA_VERSION } from "app/services/schema-version";
import { EMPTY_PROJECT_TAGS } from "shared";

const raw = (settings: object) => ({
  id: "P",
  schemaVersion: CURRENT_SCHEMA_VERSION,
  info: { name: "Machine", description: "", tags: { ...EMPTY_PROJECT_TAGS }, team: [] },
  currentPhase: 0,
  phaseStatus: {},
  settings,
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

describe("settings.dfdBadges", () => {
  it("false survives loading and repair", () => {
    const off = raw({ strictMode: false, autoSave: true, dfdBadges: false });
    expect(parseAndRepair(off)?.settings.dfdBadges).toBe(false);
    expect(repairProject(off)?.settings.dfdBadges).toBe(false);
  });

  it("absent or true is not written (on by default)", () => {
    expect(repairProject(raw({ strictMode: false, autoSave: true }))?.settings).not.toHaveProperty("dfdBadges");
    expect(repairProject(raw({ strictMode: false, autoSave: true, dfdBadges: true }))?.settings).not.toHaveProperty("dfdBadges");
  });
});
