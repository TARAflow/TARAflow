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

  // 0.20 (rule sheet R1): EN 50742 A adds AP and SRSL to a base method — the
  // record names both; TVRA + A was named "ETSI TVRA" only.
  describe("the method as a whole: base method + EN 50742 A or B", () => {
    const project = (regulation: string[], risks: Record<string, unknown> = {}) =>
      ({
        ...parseAndRepair(loadProjectFixture("Simple_Test_Project.tara.json"))!,
        info: { name: "P", tags: { domain: [], platform: [], regulation, custom: [] } },
        risks: { configuration: { method: "complex", ...risks }, risks: [] },
      }) as never;
    const A = "regulationPresets.en-50742-a.name";
    const B = "regulationPresets.en-50742-b.name";

    it.each([
      ["standard", [], {}, ["regulationPresets.standard.name"]],
      ["ETSI TVRA", ["ETSI TVRA"], { likelihoodMethod: "etsi-tvra" }, ["regulationPresets.etsi-tvra.name"]],
      ["ETSI TVRA + A", ["ETSI TVRA", "EN 50742 A"], { likelihoodMethod: "etsi-tvra", en50742Overlay: true }, ["regulationPresets.etsi-tvra.name", A]],
      ["standard + A", ["EN 50742 A"], { likelihoodMethod: "en-50742-a" }, ["regulationPresets.standard.name", A]],
      // review 2026-11-22: B alike
      ["ETSI TVRA + B", ["ETSI TVRA", "IEC 62443", "EN 50742 B"], { likelihoodMethod: "etsi-tvra" }, ["regulationPresets.etsi-tvra.name", B]],
      ["standard + B", ["IEC 62443", "EN 50742 B"], {}, ["regulationPresets.standard.name", B]],
    ])("%s", (_name, regulation, risks, keys) => {
      const p = project(regulation as string[], risks as Record<string, unknown>);
      expect(buildMethodologyRecord(p).basisNameKeys).toEqual(keys);
      expect(buildMethodologySummary(p).basisNameKeys).toEqual(keys);
    });
  });
});
