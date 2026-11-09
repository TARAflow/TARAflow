// ==================== RISK FINDINGS ====================
// What the Risk-tab validation reports, as codes with parameters (FX-4):
// the toolbar chip and the phase indicators translate them into the UI
// language. The file keeps the English sentences it always held
// (`risks.validation` — schema 13 is closed for 0.18): riskService.validate
// renders them from the same findings with the English text below, so the
// stored sentences do not change.

import type { RiskData } from "../models/risk-assessment-types";
import { isTreatmentToReview, treatmentVocabulary } from "../models/risk-treatment-vocabulary";
import { needsStatusEvidence } from "./mitigation-evidence";

export type RiskFindingCode =
  | "unrated"
  | "wontNoJustification"
  | "treatmentNoJustification"
  | "transferToReview"
  | "reduceUnmitigated"
  | "residualMissing"
  | "uncertainThreats"
  | "doneWithoutEvidence";

export interface RiskFinding {
  code: RiskFindingCode;
  severity: "error" | "warning";
  /** Number of risks concerned. */
  count: number;
  /** Their display ids where the message names them (first five, then "…"). */
  ids?: readonly string[];
}

/**
 * i18n key (under tabs.risks.findings) and the English sentence — the
 * stored form and the fallback. `{{count}}` and `{{list}}` (", …" past five).
 */
export const RISK_FINDING_TEXT: Record<RiskFindingCode, string> = {
  unrated: "{{count}} risk(s) have not been rated",
  wontNoJustification: '{{count}} "Won\'t" risk(s) missing justification',
  treatmentNoJustification: "{{count}} risk(s) with accept/transfer/share treatment require a justification",
  transferToReview:
    '{{count}} risk(s) with treatment "transfer" — ISO/SAE 21434 offers no transfer option; confirm as share',
  reduceUnmitigated: "{{count}} risk(s) to reduce have no mitigation ({{list}})",
  residualMissing: "{{count}} risk(s) to reduce have no residual risk rating ({{list}})",
  uncertainThreats: "{{count}} risk(s) based on uncertain threats — confirm relevance in Threat Eval",
  doneWithoutEvidence: "{{count}} risk(s) with a mitigation done without ticket or evidence ({{list}})",
};

const LIST_MAX = 5;

/** The ids a message names: the first five, then "…". */
function idList(ids: readonly string[] | undefined): string {
  if (!ids) return "";
  return ids.slice(0, LIST_MAX).join(", ") + (ids.length > LIST_MAX ? ", …" : "");
}

/**
 * The findings of the current risk data, errors and warnings in the order the
 * tab shows them. `trackerConnected`: the project has an issue tracker — a
 * mitigation done by hand then needs a ticket or evidence (user 2026-11-10).
 */
export function riskFindings(riskData: RiskData, options: { trackerConnected?: boolean } = {}): RiskFinding[] {
  const risks = riskData.risks;
  const out: RiskFinding[] = [];
  const add = (code: RiskFindingCode, severity: RiskFinding["severity"], hits: typeof risks, named = false) => {
    if (hits.length === 0) return;
    out.push({ code, severity, count: hits.length, ...(named && { ids: hits.map((r) => r.threatDisplayId) }) });
  };

  add("unrated", "warning", risks.filter((r) => r.calculatedRiskBeforeMitigation === 0));
  add("wontNoJustification", "error", risks.filter((r) => r.moscowPriority === "wont" && !r.wontJustification.trim()));

  // Treatment justification is mandatory for accept / transfer / share
  const passiveTreatments = ["accept", "transfer", "share"] as const;
  add(
    "treatmentNoJustification",
    "error",
    risks.filter(
      (r) =>
        passiveTreatments.includes(r.treatment as (typeof passiveTreatments)[number]) &&
        !r.treatmentJustification?.trim(),
    ),
  );

  // ISO/SAE 21434 15.9 has no "transfer" option: a stored transfer is a
  // decision to review (confirm as share), never changed automatically.
  const vocabulary = treatmentVocabulary(riskData.configuration);
  add("transferToReview", "warning", risks.filter((r) => isTreatmentToReview(r.treatment, vocabulary)));

  // A risk to reduce needs a mitigation, at any risk value (user
  // 2026-10-30). Accept / transfer / share need none — their justification
  // is checked above; the former "high risk without mitigation" rule
  // flagged exactly those accepted risks.
  add(
    "reduceUnmitigated",
    "warning",
    risks.filter(
      (r) =>
        r.treatment === "reduce" &&
        r.selectedMitigations.filter((m) => m.status !== "rejected").length === 0 &&
        r.moscowPriority !== "wont",
    ),
    true,
  );

  // A risk to reduce needs its residual rated — the factors after
  // mitigation (user 2026-10-30, Smoke Detector SHE-D-1). Not under
  // ISO/SAE 21434: there the residual is isoRisk.residual and its absence
  // is the RESIDUAL_MISSING finding; the classic after-value stays 0.
  if (riskData.configuration?.likelihoodMethod !== "iso-21434") {
    add(
      "residualMissing",
      "warning",
      risks.filter(
        (r) =>
          r.treatment === "reduce" &&
          r.calculatedRiskBeforeMitigation > 0 &&
          !(r.calculatedRiskAfterMitigation > 0) &&
          r.moscowPriority !== "wont",
      ),
      true,
    );
  }

  add("uncertainThreats", "warning", risks.filter((r) => r.threatRelevance === "uncertain"));
  if (options.trackerConnected) {
    add(
      "doneWithoutEvidence",
      "warning",
      risks.filter((r) => r.selectedMitigations.some((m) => needsStatusEvidence(m, true))),
      true,
    );
  }
  return out;
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** One finding as a sentence: in the UI language with `t`, the stored English form without. */
export function riskFindingText(finding: RiskFinding, t?: Translate): string {
  const params = { count: finding.count, list: idList(finding.ids) };
  const english = RISK_FINDING_TEXT[finding.code];
  if (t) return t(`tabs.risks.findings.${finding.code}`, { ...params, defaultValue: english });
  return english.replace(/\{\{(\w+)\}\}/g, (_m, name: keyof typeof params) => String(params[name]));
}

/** Errors and warnings as sentences — for the toolbar chip and the phase indicators. */
export function riskFindingLines(
  findings: readonly RiskFinding[],
  t?: Translate,
): { errors: string[]; warnings: string[] } {
  const lines = (severity: RiskFinding["severity"]) =>
    findings.filter((f) => f.severity === severity).map((f) => riskFindingText(f, t));
  return { errors: lines("error"), warnings: lines("warning") };
}
