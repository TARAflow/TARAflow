// ==================== ISO/SAE 21434 THREAT SCENARIOS IN THE REPORT ====================
// Conformance plan F4: title and summary line of a threat-scenario group in
// the attack-path risk chapter — shared by the template generators and the
// pdfmake converter. Display only; the values come from groupIsoScenarios.

// Deep paths: the generation path imports no feature barrel (depcruise-doc).
import type { IsoScenario } from "../../risks/models/iso-scenarios";
import {
  isoRiskValueFallback,
  isoRiskValueI18nKey,
} from "../../risks/models/iso-risk-display";
import {
  treatmentFallbackLabel,
  treatmentI18nKey,
  treatmentVocabulary,
} from "../../risks/models/risk-treatment-vocabulary";
import type { DocProjectData } from "../models/doc-types";

type TranslateFn = (key: string, defaultValue?: string) => string;

/**
 * Resolve the attack-path node chain (root goal → … → leaf) a risk was raised
 * for, for human-readable display. Reads the same tree + pathKey as
 * resolveTreeFeasibility; falls back to the cheapest path. Returns null when no
 * path is found, so the caller can fall back to the plain threat description.
 */
export function resolveAttackPathChain(
  attackTree: DocProjectData["attackTree"],
  assessment: { treeId: string; pathKey: string } | undefined,
): string[] | null {
  if (!attackTree || !assessment) return null;
  const tree = attackTree.trees?.find((tr) => tr.id === assessment.treeId);
  const analysis = tree?.pathAnalysis;
  if (!analysis) return null;
  const path =
    analysis.paths?.find((p) => p.pathKey === assessment.pathKey) ??
    analysis.cheapestPath;
  const chain = path?.path;
  return chain && chain.length > 0 ? chain : null;
}

/** "AT-2 <tree name>" — else the tree's root goal, else the first path's threat. */
export function isoScenarioTitle(
  scenario: IsoScenario,
  attackTree: DocProjectData["attackTree"],
): string {
  const assessment = scenario.risks[0]?.attackTreeAssessment;
  const name = attackTree?.trees?.find((tr) => tr.id === assessment?.treeId)?.name?.trim();
  const root = resolveAttackPathChain(attackTree, assessment)?.[0];
  return `${scenario.displayId} ${name || root || scenario.label}`;
}

const valueText = (value: number | undefined, t: TranslateFn): string =>
  value ? `${value} – ${t(isoRiskValueI18nKey(value), isoRiskValueFallback(value))}` : "–";

/** "Risk value 5 – Critical · Residual – · Treatment: Reduce". */
export function isoScenarioSummary(
  scenario: IsoScenario,
  t: TranslateFn,
  config: Parameters<typeof treatmentVocabulary>[0],
): string {
  const vocabulary = treatmentVocabulary(config);
  const treatments =
    scenario.treatments
      .map((tr) => t(`${treatmentI18nKey(tr, vocabulary)}.label`, treatmentFallbackLabel(tr, vocabulary)))
      .join(", ") || "–";
  return [
    `${t("tabs.doc.iso.scenarioRisk", "Risk value")} ${valueText(scenario.value, t)}`,
    `${t("tabs.doc.iso.scenarioResidual", "Residual")} ${valueText(scenario.residual, t)}`,
    `${t("tabs.doc.iso.scenarioTreatment", "Treatment")}: ${treatments}`,
  ].join(" · ");
}
