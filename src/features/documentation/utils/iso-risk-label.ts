// ==================== ISO/SAE 21434 RISK VALUE IN THE REPORT ====================
// Conformance plan 3a-2 / decision 23: "4 – High (Impact Major × AF High)".
// All three quantities carry their name, because impact, attack feasibility
// and risk use overlapping words. The word is display only; the number is
// the risk value (RQ-15-16).

// Deep paths: the generation path imports no feature barrel (depcruise-doc).
import type { IsoRisk } from "../../risks/models/iso-risk-matrix";
import {
  ISO_FEASIBILITY_FALLBACK,
  ISO_IMPACT_FALLBACK,
  isoFeasibilityI18nKey,
  isoImpactI18nKey,
  isoRiskValueFallback,
  isoRiskValueI18nKey,
} from "../../risks/models/iso-risk-display";

type TranslateFn = (key: string, defaultValue?: string) => string;

/** The report shows the ISO value for iso-21434 risk data. */
export const isIsoReport = (config: { likelihoodMethod?: string } | undefined): boolean =>
  config?.likelihoodMethod === "iso-21434";

/** "4 – High (Impact Major × AF High)"; "–" while no value can be determined. */
export function isoRiskLabel(
  risk: { isoRisk?: IsoRisk },
  t: TranslateFn,
  residual: boolean,
): string {
  const r = risk.isoRisk;
  const feasibility = residual ? r?.residual?.feasibility : r?.feasibility;
  const value = residual ? r?.residual?.value : r?.value;
  if (!r || !feasibility || !value) return "–";
  const word = t(isoRiskValueI18nKey(value), isoRiskValueFallback(value));
  const impact = t(isoImpactI18nKey(r.impact), ISO_IMPACT_FALLBACK[r.impact]);
  const feas = t(isoFeasibilityI18nKey(feasibility), ISO_FEASIBILITY_FALLBACK[feasibility]);
  const impactName = t("tabs.doc.iso.impact", "Impact");
  const feasName = t("tabs.doc.iso.feasibilityShort", "AF");
  return `${value} – ${word} (${impactName} ${impact} × ${feasName} ${feas})`;
}
