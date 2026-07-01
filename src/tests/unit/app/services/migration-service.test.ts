// src/tests/unit/app/services/migration-service.test.ts  (vitest)
//
// Keystone test for the v1 -> v2 schema migration (Hazard phase insertion).
// A wrong remap silently shifts users' phase-completion state, so this is the
// one piece of the refactor that must be exactly right.

import { describe, it, expect } from "vitest";
import { applyMigrations } from "app/services/migration-service";
import { CURRENT_SCHEMA_VERSION } from "app/services/schema-version";

describe("migrate 1 -> 2 (Hazard phase insertion)", () => {
  it("inserts Hazard at 1 and shifts every phase >= 1 up by one", () => {
    const v1 = {
      schemaVersion: 1,
      currentPhase: 3, // old Threats
      phaseStatus: {
        0: "complete", //     General
        1: "complete", //     DFD
        2: "in-progress", //  Assets
        3: "not-started", //  Threats
        4: "not-started", //  Risk
        5: "not-started", //  Attack Tree
        6: "not-started", //  Documentation
        7: "not-started", //  Audit
        8: "not-started", //  Integration
      },
    };

    const { data, migrated, fromVersion } = applyMigrations(v1);

    expect(migrated).toBe(true);
    expect(fromVersion).toBe(1);
    expect(data.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);

    expect(data.phaseStatus[0]).toBe("complete"); //     General unchanged
    expect(data.phaseStatus[1]).toBe("not-started"); //  Hazard (new)
    expect(data.phaseStatus[2]).toBe("complete"); //     DFD       (old 1)
    expect(data.phaseStatus[3]).toBe("in-progress"); //  Assets    (old 2)
    expect(data.phaseStatus[9]).toBe("not-started"); //  Integration (old 8)

    expect(data.currentPhase).toBe(4); // old Threats (3) -> 4
    expect(data.hazards).toBeNull(); // new project slot
  });

  it("keeps General (0) as current phase unchanged", () => {
    const v1 = {
      schemaVersion: 1,
      currentPhase: 0,
      phaseStatus: { 0: "in-progress" },
    };
    const { data } = applyMigrations(v1);
    expect(data.currentPhase).toBe(0);
  });

  it("runs the full 0 -> 1 -> 2 chain for pre-release projects", () => {
    const v0: any = {}; // no schemaVersion field

    const { data, fromVersion } = applyMigrations(v0);

    expect(fromVersion).toBe(0);
    expect(data.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(data.phaseStatus[1]).toBe("not-started"); // Hazard present
    expect(data.hazards).toBeNull();
  });

  it("is a no-op for projects already at the current version", () => {
    const v2 = { schemaVersion: CURRENT_SCHEMA_VERSION, currentPhase: 2, phaseStatus: {}, hazards: null };
    const { migrated } = applyMigrations(v2);
    expect(migrated).toBe(false);
  });
});
