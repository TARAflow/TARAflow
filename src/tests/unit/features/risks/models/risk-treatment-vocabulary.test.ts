// tests/unit/features/risks/models/risk-treatment-vocabulary.test.ts
//
// ISO/SAE 21434 conformance plan, Phase 0: ISO projects show the 15.9 option
// names (Avoid / Reduce / Share / Retain); stored values stay unchanged; a
// stored "transfer" is shown as "Share (transfer)" and flagged for review;
// every other risk method keeps the old labels and all five options.

import { describe, it, expect } from "vitest";

import {
  isTreatmentToReview,
  offeredTreatments,
  treatmentFallbackLabel,
  treatmentI18nKey,
  treatmentVocabulary,
} from "features/risks/models/risk-treatment-vocabulary";
import { RISK_TREATMENTS } from "features/risks/models/risk-scale-types";
import type { RiskTreatment } from "features/risks/models/risk-scale-types";
import { riskService } from "features/risks/services/risk-service";
import { DEFAULT_CONFIGURATION } from "features/risks/models/risk-config-types";
import type { LikelihoodMethod } from "shared";
import en from "../../../../../i18n/locales/en/risks.json";
import de from "../../../../../i18n/locales/de/risks.json";

const ALL: RiskTreatment[] = RISK_TREATMENTS.map((tr) => tr.value);

describe("treatment vocabulary", () => {
  it("is ISO only for the iso-21434 risk method", () => {
    expect(treatmentVocabulary({ likelihoodMethod: "iso-21434" })).toBe("iso-21434");
    for (const m of ["weighted-mean", "en-50742-a", "etsi-tvra"] as LikelihoodMethod[])
      expect(treatmentVocabulary({ likelihoodMethod: m })).toBe("default");
    expect(treatmentVocabulary({})).toBe("default");
    expect(treatmentVocabulary(undefined)).toBe("default");
  });

  it("ISO offers Avoid / Reduce / Share / Retain, in that order, no transfer", () => {
    const offered = offeredTreatments("iso-21434").map((tr) => tr.value);
    expect(offered).toEqual(["eliminate", "reduce", "share", "accept"]);
    expect(offered.map((v) => treatmentFallbackLabel(v, "iso-21434"))).toEqual([
      "Avoid",
      "Reduce",
      "Share",
      "Retain",
    ]);
  });

  it("ISO keeps a stored transfer visible as 'Share (transfer)' and flags it", () => {
    const offered = offeredTreatments("iso-21434", "transfer").map((tr) => tr.value);
    expect(offered).toContain("transfer");
    expect(treatmentFallbackLabel("transfer", "iso-21434")).toBe("Share (transfer)");
    expect(isTreatmentToReview("transfer", "iso-21434")).toBe(true);
    for (const v of ["eliminate", "reduce", "share", "accept"] as RiskTreatment[])
      expect(isTreatmentToReview(v, "iso-21434")).toBe(false);
  });

  it("default mode is unchanged: all five options, old labels and keys, no review flag", () => {
    expect(offeredTreatments("default")).toBe(RISK_TREATMENTS);
    expect(offeredTreatments("default", "transfer")).toBe(RISK_TREATMENTS);
    for (const tr of RISK_TREATMENTS) {
      expect(treatmentFallbackLabel(tr.value, "default")).toBe(tr.label);
      expect(treatmentI18nKey(tr.value, "default")).toBe(`risks.treatment.${tr.value}`);
      expect(isTreatmentToReview(tr.value, "default")).toBe(false);
    }
  });

  it("every ISO label exists in en and de, and matches the fallback in en", () => {
    for (const v of ALL) {
      expect(en.risks.treatmentIso[v].label).toBe(treatmentFallbackLabel(v, "iso-21434"));
      expect(de.risks.treatmentIso[v].label).toBeTruthy();
      expect(de.risks.treatmentIso[v].description).toBeTruthy();
    }
  });
});

describe("validation: stored transfer in an ISO project", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (likelihoodMethod: LikelihoodMethod): any => ({
    configuration: { ...DEFAULT_CONFIGURATION, likelihoodMethod },
    risks: [
      {
        id: "R-1",
        treatment: "transfer",
        treatmentJustification: "insured",
        moscowPriority: "wont",
        wontJustification: "insured",
        calculatedRiskBeforeMitigation: 2,
        selectedMitigations: [],
        threatRelevance: "relevant",
      },
    ],
  });

  it("warns under iso-21434 and leaves the treatment unchanged", () => {
    const d = data("iso-21434");
    const v = riskService.validate(d);
    expect(v.warnings.some((w) => w.includes('"transfer"'))).toBe(true);
    expect(d.risks[0].treatment).toBe("transfer");
  });

  it("does not warn under the other risk methods", () => {
    for (const m of ["weighted-mean", "en-50742-a", "etsi-tvra"] as LikelihoodMethod[]) {
      const v = riskService.validate(data(m));
      expect(v.warnings.some((w) => w.includes('"transfer"'))).toBe(false);
    }
  });
});
