// tests/unit/app/services/iso21434-phase0b.test.ts
//
// ISO/SAE 21434 conformance plan, Phase 0 step 0b (decision 16):
// - the methodology record is derived from the configuration and from the
//   constants the calculation uses — nothing is stored;
// - the ISO impact scale lock never remaps: 4-level silently only while
//   nothing is rated, otherwise a finding; leaving ISO keeps the scale;
// - other presets are unchanged (principle 6).

import { describe, it, expect } from "vitest";

import {
  applyRegulationFromTags,
  threadImpactScale,
} from "app/services/regulation-preset-orchestrator";
import { buildMethodologyRecord } from "app/services/methodology-record";
import { collectAssetFindings } from "features/assets/services/asset-validator";
import { DEFAULT_ASSET_CONFIGURATION } from "features/assets/models/asset-types";
import type { AssetData } from "features/assets";
import type { ImpactScaleType } from "features/assets/models/asset-impact-types";
import { DEFAULT_CONFIGURATION } from "features/risks/models/risk-config-types";
import type { RiskData } from "features/risks";
import { FEASIBILITY_GATE_RULES } from "features/attacktree/services/attacktree-calculator";
import { CIANAAA_TO_CIA, type RegulationPresetId } from "shared";
import type { Project } from "app/models/project-types";

const REGULATION_TAG: Record<RegulationPresetId, string[]> = {
  standard: [],
  "iso-21434": ["ISO 21434"],
  "en-50742-a": ["EN 50742"],
  "en-50742-b": ["EN 50742 Approach B"],
  "etsi-tvra": ["ETSI TVRA"],
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asset = (id: string, values: number[], goalValues: any[] = []): any => ({
  id,
  displayId: id,
  name: id,
  assetGroup: "data",
  impactRatings: values.map((value, i) => ({ criterionId: `c${i}`, value })),
  securityGoals: goalValues.length
    ? [
        {
          type: "I",
          level: "high",
          impactRatings: goalValues.map((value, i) => ({ criterionId: `c${i}`, value })),
        },
      ]
    : [],
  linkedDFDElements: [],
});

const assetData = (
  scale: ImpactScaleType,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  assets: any[] = [],
): AssetData =>
  ({
    assets,
    configuration: { ...DEFAULT_ASSET_CONFIGURATION, impactScale: scale },
    lastModified: "2026-01-01T00:00:00.000Z",
  }) as unknown as AssetData;

const project = (
  presetId: RegulationPresetId,
  assets: AssetData | null,
): Project =>
  ({
    id: "p1",
    info: {
      tags: { domain: [], platform: [], regulation: REGULATION_TAG[presetId], custom: [] },
    },
    settings: { strictMode: false, autoSave: true, autoSaveInterval: 2 },
    assets,
    risks: {
      configuration: {
        ...DEFAULT_CONFIGURATION,
        activeFactors: DEFAULT_CONFIGURATION.activeFactors.map((f) => ({ ...f })),
      },
      risks: [],
      lastModified: "2026-01-01T00:00:00.000Z",
    } as unknown as RiskData,
    attackTrees: null,
  }) as unknown as Project;

describe("threadImpactScale — ISO impact scale lock without remapping", () => {
  it("switching to ISO without ratings sets the 4-level scale silently", () => {
    const p = project("iso-21434", assetData("5-level", [asset("A", [0, 0])]));
    const out = threadImpactScale(p, "iso-21434");
    expect(out.assets!.configuration.impactScale).toBe("4-level");
  });

  it("'na' and per-goal zeros count as not rated", () => {
    const p = project("iso-21434", assetData("3-level", [asset("A", [0], [0])]));
    p.assets!.assets[0].impactRatings.push({ criterionId: "x", value: "na" as never });
    expect(threadImpactScale(p, "iso-21434").assets!.configuration.impactScale).toBe("4-level");
  });

  it("with a rated 5-level scale nothing changes (same project, same values)", () => {
    const p = project("iso-21434", assetData("5-level", [asset("A", [5, 2])]));
    expect(threadImpactScale(p, "iso-21434")).toBe(p);
    expect(p.assets!.assets[0].impactRatings.map((r) => r.value)).toEqual([5, 2]);
  });

  it("a per-goal rating alone counts as rated", () => {
    const p = project("iso-21434", assetData("5-level", [asset("A", [0], [3])]));
    expect(threadImpactScale(p, "iso-21434")).toBe(p);
  });

  it("is a no-op when the scale already conforms", () => {
    const p = project("iso-21434", assetData("4-level"));
    expect(threadImpactScale(p, "iso-21434")).toBe(p);
  });

  it("other presets never touch the scale (principle 6)", () => {
    for (const id of ["standard", "en-50742-a", "en-50742-b", "etsi-tvra"] as RegulationPresetId[]) {
      const p = project(id, assetData("5-level"));
      expect(threadImpactScale(p, id)).toBe(p);
    }
  });

  it("through the tag entry point: ISO sets 4-level, leaving ISO keeps it", () => {
    const iso = applyRegulationFromTags(project("iso-21434", assetData("3-level"))).project;
    expect(iso.assets!.configuration.impactScale).toBe("4-level");
    const back = applyRegulationFromTags({
      ...iso,
      info: { ...iso.info, tags: { ...iso.info.tags, regulation: [] } },
    } as Project).project;
    expect(back.assets!.configuration.impactScale).toBe("4-level");
  });
});

describe("asset validator — impact scale findings", () => {
  const keys = (f: { key: string }[]) => f.map((x) => x.key);

  it("rated 5-level under ISO: one project finding with the count, one per asset outside the scale", () => {
    const data = assetData("5-level", [
      asset("A", [5, 2]),
      asset("B", [3]),
      asset("C", [0]),
    ]);
    const findings = collectAssetFindings(data, undefined, undefined, "4-level");
    const scale = findings.find((f) => f.key === "tabs.assets.validation.impactScaleRequired");
    expect(scale?.params).toEqual({ required: "4-level", current: "5-level", count: 2 });
    const outside = findings.filter((f) => f.key === "tabs.assets.validation.impactOutsideScale");
    expect(outside.map((f) => f.assetId)).toEqual(["A"]);
    expect(outside[0].params).toEqual({ values: "5", max: 4 });
  });

  it("a value outside the scale stays a finding after the switch to 4-level", () => {
    const findings = collectAssetFindings(
      assetData("4-level", [asset("A", [5])]),
      undefined,
      undefined,
      "4-level",
    );
    expect(keys(findings)).not.toContain("tabs.assets.validation.impactScaleRequired");
    expect(keys(findings)).toContain("tabs.assets.validation.impactOutsideScale");
  });

  it("no prescribed scale (other presets): no scale findings", () => {
    const findings = collectAssetFindings(assetData("5-level", [asset("A", [5])]));
    expect(keys(findings)).not.toContain("tabs.assets.validation.impactScaleRequired");
    expect(keys(findings)).not.toContain("tabs.assets.validation.impactOutsideScale");
  });
});

describe("buildMethodologyRecord — derived, never stored", () => {
  it("mirrors the configuration of an ISO project", () => {
    const p = project("iso-21434", assetData("4-level"));
    p.risks!.configuration = {
      ...p.risks!.configuration,
      likelihoodMethod: "iso-21434",
      impactAggregation: "max",
    };
    const r = buildMethodologyRecord(p);
    expect(r.presetId).toBe("iso-21434");
    expect(r.presetNameKey).toBe("regulationPresets.iso-21434.name");
    expect(r.impact).toEqual({
      scale: "4-level",
      requiredScale: "4-level",
      scaleConforms: true,
      criteriaIds: DEFAULT_ASSET_CONFIGURATION.impactCriteria.map((c) => c.id),
      aggregation: "max",
    });
    expect(r.likelihood.method).toBe("iso-21434");
    expect(r.treatment.vocabulary).toBe("iso-21434");
    expect(r.treatment.options).toEqual([
      { stored: "eliminate", label: "Avoid" },
      { stored: "reduce", label: "Reduce" },
      { stored: "share", label: "Share" },
      { stored: "accept", label: "Retain" },
    ]);
  });

  it("fixed rules are the constants the calculation uses, not copies", () => {
    const r = buildMethodologyRecord(project("iso-21434", assetData("4-level")));
    expect(r.likelihood.gateRules).toBe(FEASIBILITY_GATE_RULES);
    expect(r.cianaaaToCia).toBe(CIANAAA_TO_CIA);
  });

  it("reports a non-conforming scale and keeps defaults for a bare project", () => {
    const r = buildMethodologyRecord(project("iso-21434", assetData("5-level")));
    expect(r.impact.scaleConforms).toBe(false);
    const bare = buildMethodologyRecord(project("standard", null));
    expect(bare.impact.requiredScale).toBeUndefined();
    expect(bare.impact.scaleConforms).toBe(true);
    expect(bare.treatment.vocabulary).toBe("default");
    expect(bare.treatment.options).toHaveLength(5);
  });
});

describe("constants behind the record", () => {
  it("attack-tree gate rules per kind of rating", () => {
    expect(FEASIBILITY_GATE_RULES).toEqual({
      potential: { AND: "sum", OR: "min" },
      probability: { AND: "product", OR: "union" },
      ordinal: { AND: "min", OR: "max" },
    });
  });

  it("CIANAAA → CIA covers every goal and keeps C, I, A as themselves", () => {
    expect(Object.keys(CIANAAA_TO_CIA).sort()).toEqual(
      ["A", "Acc", "AuthN", "AuthZ", "C", "I", "N"],
    );
    expect(CIANAAA_TO_CIA.C).toEqual(["C"]);
    expect(CIANAAA_TO_CIA.I).toEqual(["I"]);
    expect(CIANAAA_TO_CIA.A).toEqual(["A"]);
    expect(CIANAAA_TO_CIA.AuthZ).toEqual(["C", "I"]);
    for (const g of ["N", "AuthN", "Acc"] as const) expect(CIANAAA_TO_CIA[g]).toEqual(["I"]);
  });
});
