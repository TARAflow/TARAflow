// ==================== ISO/SAE 21434 THREAT SCENARIOS AND REVIEW LIST ====================
// Conformance plan 3a-3 (decision 20 E2/E3/E5).
//
// Threat scenario (E2): an attack tree anchored at asset × property — its
// attack-path risks are the paths of one scenario; a risk without a tree is a
// scenario of its own. The scenario value is derived, never stored (E3):
//   value     = MAX over its paths (same impact, MAX feasibility — 15.8 NOTE 2)
//   residual  = MAX over the paths' residual values (absent if none rated)
//   treatment = the union of the paths' options (15.9 "one or more options")
//
// Review list (E5): Retain at a value ≥ 4 (warning) and Reduce at a value of
// 1 (info). Avoid and Share never; hard rules come with the acceptance
// criteria of 3b. Never changes a treatment.

import type { Risk } from "./risk-assessment-types";
import type { RiskTreatment } from "./risk-scale-types";

export interface IsoScenario {
  /** Tree id, or the risk id for a risk without a tree. */
  key: string;
  /** Scenario id as the analyst sees it: "AT-2" for the paths AT-2.1 … */
  displayId: string;
  label: string;
  risks: Risk[];
  value?: number;
  residual?: number;
  treatments: RiskTreatment[];
}

const TREATMENT_ORDER: RiskTreatment[] = ["eliminate", "reduce", "share", "transfer", "accept"];

/** "AT-2.4" → "AT-2"; any other id stays as it is. */
function scenarioDisplayId(risk: Risk): string {
  const m = /^(AT-\d+)\.\d+$/.exec(risk.threatDisplayId ?? "");
  return m ? m[1] : risk.threatDisplayId;
}

const max = (values: (number | undefined)[]) => {
  const defined = values.filter((v): v is number => v !== undefined);
  return defined.length ? Math.max(...defined) : undefined;
};

/** Group ISO risks into threat scenarios, in first-seen order. */
export function groupIsoScenarios(risks: readonly Risk[]): IsoScenario[] {
  const byKey = new Map<string, Risk[]>();
  for (const risk of risks) {
    const key = risk.attackTreeAssessment?.treeId ?? risk.id;
    byKey.set(key, [...(byKey.get(key) ?? []), risk]);
  }
  return [...byKey].map(([key, list]) => {
    const treatments = new Set(list.map((r) => r.treatment));
    return {
      key,
      displayId: scenarioDisplayId(list[0]),
      label: list[0].threatDescription,
      risks: list,
      value: max(list.map((r) => r.isoRisk?.value)),
      residual: max(list.map((r) => r.isoRisk?.residual?.value)),
      treatments: TREATMENT_ORDER.filter((t) => treatments.has(t)),
    };
  });
}

export type IsoReviewKind = "retain-high" | "reduce-minimal";

export interface IsoReviewItem {
  risk: Risk;
  kind: IsoReviewKind;
  severity: "warning" | "info";
}

/** Decisions to review (E5) — only Retain ≥ 4 and Reduce = 1. */
export function isoReviewItems(risks: readonly Risk[]): IsoReviewItem[] {
  const out: IsoReviewItem[] = [];
  for (const risk of risks) {
    const value = risk.isoRisk?.value;
    if (value === undefined) continue;
    if (risk.treatment === "accept" && value >= 4) {
      out.push({ risk, kind: "retain-high", severity: "warning" });
    } else if (risk.treatment === "reduce" && value === 1) {
      out.push({ risk, kind: "reduce-minimal", severity: "info" });
    }
  }
  return out;
}
