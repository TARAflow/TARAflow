// Project setting "Show exposure levels in the diagram" (0.20): absent = by
// the EN 50742 tag (patch 24), an explicit choice true / false is stored and
// survives loading and repair.
import { describe, it, expect } from "vitest";
import { parseAndRepair, repairProject } from "app/services/migration-service";
import { CURRENT_SCHEMA_VERSION } from "app/services/schema-version";
import { EMPTY_PROJECT_TAGS, dfdBadgesShown } from "shared";

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

  it("true survives too (a choice in a project without EN 50742); absent is not written", () => {
    expect(repairProject(raw({ strictMode: false, autoSave: true, dfdBadges: true }))?.settings.dfdBadges).toBe(true);
    expect(repairProject(raw({ strictMode: false, autoSave: true }))?.settings).not.toHaveProperty("dfdBadges");
  });

  it("dfdBadgesShown: the choice, else the EN 50742 tag", () => {
    expect(dfdBadgesShown(undefined, true)).toBe(true);
    expect(dfdBadgesShown(undefined, false)).toBe(false);
    expect(dfdBadgesShown(true, false)).toBe(true);
    expect(dfdBadgesShown(false, true)).toBe(false);
  });
});
