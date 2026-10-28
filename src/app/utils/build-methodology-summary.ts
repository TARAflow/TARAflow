// app/utils/build-methodology-summary.ts
//
// The methodology record (buildMethodologyRecord, conformance plan 0b) reduced
// to the values the Overview's Methodology sub-tab shows (Phase 1 stage A,
// A-4). App layer: the record reads several features; the overview feature
// gets plain values.

import type { Project } from "app/models/project-types";
import type { MethodologySummary } from "features/overview";
import type { CalcStamp } from "shared";
import { buildMethodologyRecord } from "app/services/methodology-record";

const stampText = (s: CalcStamp) => `${s.method} · ${s.calcVersion} · ${s.mappingVersion}`;

export function buildMethodologySummary(project: Project): MethodologySummary {
  const r = buildMethodologyRecord(project);
  return {
    presetNameKey: r.presetNameKey,
    impactScale: r.impact.scale,
    ...(r.impact.requiredScale ? { requiredImpactScale: r.impact.requiredScale } : {}),
    impactScaleConforms: r.impact.scaleConforms,
    impactCriteriaIds: r.impact.criteriaIds,
    impactAggregation: r.impact.aggregation,
    likelihoodMethod: r.likelihood.method,
    feasibilityMethod: r.likelihood.feasibilityMethod,
    likelihoodModel: r.likelihood.likelihoodModel,
    treatmentOptions: r.treatment.options.map((o) => o.label),
    securityProperties: [...r.securityProperties],
    riskMatrix: !!r.riskMatrix,
    ...(r.calcStamps
      ? { calcStamps: { risk: stampText(r.calcStamps.risk), path: stampText(r.calcStamps.path) } }
      : {}),
  };
}
