// tests/unit/app/utils/build-methodology-summary.test.ts
//
// ISO/SAE 21434 conformance plan Phase 1 stage A, A-4: the Methodology
// sub-tab shows the methodology record (0b), reduced to values.

import { describe, it, expect } from "vitest";
import { buildMethodologySummary } from "app/utils/build-methodology-summary";
import { buildMethodologyRecord } from "app/services/methodology-record";
import { parseAndRepair } from "app/services/migration-service";
import { loadProjectFixture } from "../../../fixtures/load-fixture";

describe("buildMethodologySummary", () => {
  it("an ISO project: preset, 4-level scale, H.8 matrix and stamps from the record", () => {
    const project = parseAndRepair(loadProjectFixture("headlamp-iso21434.tara.json"))!;
    const record = buildMethodologyRecord(project);
    const s = buildMethodologySummary(project);
    expect(s.presetNameKey).toBe(record.presetNameKey);
    expect(s.impactScale).toBe(record.impact.scale);
    expect(s.riskMatrix).toBe(true);
    expect(s.treatmentOptions).toEqual(record.treatment.options.map((o) => o.label));
    expect(s.calcStamps?.risk).toBe(
      `${record.calcStamps!.risk.method} · ${record.calcStamps!.risk.calcVersion} · ${record.calcStamps!.risk.mappingVersion}`,
    );
  });

  it("another preset: no matrix, no stamps", () => {
    const project = parseAndRepair(loadProjectFixture("Simple_Test_Project.tara.json"))!;
    const s = buildMethodologySummary(project);
    expect(s.riskMatrix).toBe(false);
    expect(s.calcStamps).toBeUndefined();
  });
});
