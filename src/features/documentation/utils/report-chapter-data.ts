// ==================== REPORT CHAPTER DATA ====================
// The content of six chapters as plain data — applicable regulations, DFD
// element descriptions, asset-element relations, attack-path threat
// scenarios, traceability matrix (and, in methodology-sections.ts, the
// methodology). The template generators (base-generator.ts) and the PDF
// (pdfmake-converter.ts) render the same data, so no format drops a chapter
// or tells it differently (CLI PDF review 2026-10-30). Values are raw text:
// escaping is the format's job.

import type { DocLanguage, DocProjectData } from "../models/doc-types";
import type { DFDConnection, DFDElement, DFDElementType } from "../../dfd/models/dfd-types";
import type { Asset } from "features/assets";
import type { Iso21434Feasibility as Iso21434FeasibilityLevel } from "../../risks/models/iso21434-core";
import { isoFeasibilityFromFactors } from "../../risks/models/iso-risk-matrix";
import {
  treatmentFallbackLabel,
  treatmentI18nKey,
  treatmentVocabulary,
} from "../../risks/models/risk-treatment-vocabulary";
import { assetImpactResolver } from "../../assets/services/asset-impact-resolver";
import { getDFDElementTypeText } from "../../dfd/models/dfd-formatters";
import { getRegulationTags } from "../../../shared/utils/tag-categories";
import { flattenProjectTags } from "../../../shared/models/project-tags";
import { isoRiskLabel } from "./iso-risk-label";
import { goalsClaimsOfRisk } from "./cybersecurity-concept-report";
import { controlLabels } from "./control-text";
import { resolveAttackPathChain } from "./iso-scenario-text";
import { getRelationTypeLabel } from "./generators/property-doc-mappers";

type TranslationFn = (key: string, defaultValue?: string) => string;

// ==================== APPLICABLE REGULATIONS ====================

export interface RegulationEntry {
  name: string;
  description: string;
}

/** The regulation tags of the project with their description; [] = no chapter. */
export function regulationEntries(project: DocProjectData, t: TranslationFn): RegulationEntry[] {
  return getRegulationTags(flattenProjectTags(project.info.tags)).map((tagDef) => ({
    name: tagDef.name,
    description: tagDef.docDescriptionKey
      ? t(tagDef.docDescriptionKey, tagDef.name)
      : t(`tags.tooltips.${tagDef.name.toLowerCase().replace(/[^a-z0-9]/g, "")}`, tagDef.name),
  }));
}

// ==================== DFD ELEMENT DESCRIPTIONS ====================

/** Elements grouped by type in first-seen order, data flows left out (they have their own section). */
export function dfdElementsByType(elements: readonly DFDElement[]): [DFDElementType, DFDElement[]][] {
  const byType = new Map<DFDElementType, DFDElement[]>();
  for (const element of elements) {
    if (!byType.has(element.type)) byType.set(element.type, []);
    byType.get(element.type)!.push(element);
  }
  return [...byType].filter(([type]) => type !== "DataFlow");
}

/** The names of a flow's endpoints (the id when the element is unknown). */
export function connectionEndpointNames(
  project: DocProjectData,
  connection: DFDConnection,
): { from: string; to: string } {
  const nameOf = (id: string) => project.dfd?.elements?.find((e) => e.id === id)?.name || id;
  return { from: nameOf(connection.from), to: nameOf(connection.to) };
}

// ==================== ASSET-ELEMENT RELATIONS ====================

export interface AssetRelationRow {
  elementDisplayId: string;
  elementType: string;
  elementName: string;
  relationTypes: string;
  notes?: string;
}

export interface AssetRelationSection {
  asset: Asset;
  displayId: string;
  name: string;
  description?: string;
  relations: AssetRelationRow[];
}

/** One section per asset linked to DFD elements; [] when none is. */
export function assetRelationSections(
  project: DocProjectData,
  t: TranslationFn,
  lang: DocLanguage,
): AssetRelationSection[] {
  return (project.assets?.assets ?? [])
    .filter((asset) => asset.linkedDFDElements && asset.linkedDFDElements.length > 0)
    .map((asset) => ({
      asset,
      displayId: asset.displayId ?? asset.id,
      name: asset.name,
      ...(asset.properties?.description ? { description: asset.properties.description } : {}),
      relations: (asset.linkedDFDElements ?? []).map((rel) => ({
        elementDisplayId: rel.displayId,
        elementType: getDFDElementTypeText(rel.elementType as DFDElementType, t),
        elementName: rel.elementName,
        relationTypes: rel.relationType ? getRelationTypeLabel(rel.relationType, lang) : "",
        ...(rel.notes ? { notes: rel.notes } : {}),
      })),
    }));
}

// ==================== ATTACK-PATH THREAT SCENARIOS ====================

export interface AttackPathThreatRow {
  /** Link target of #threat-<id>. */
  anchor: string;
  /** AT-<n>.<m> — the label the traceability matrix shows too. */
  tsId: string;
  strideCategory: string;
  asset: string;
  threat: string;
  mitigations: string[];
  verifications: string[];
}

/**
 * One row per attack-path threat scenario (unique threatDisplayId), won't-
 * address risks left out (they are in the accepted-risks chapter). ISO mode:
 * mitigations and verifications are the ones selected on the path's risk.
 */
export function attackPathThreatRows(project: DocProjectData): AttackPathThreatRow[] {
  const assets = project.assets?.assets ?? [];
  const assetLabel = (ids?: string[]): string => {
    const first = ids?.[0];
    const asset = first ? assets.find((a) => a.id === first) : undefined;
    if (!asset) return "-";
    const extra = (ids?.length ?? 0) > 1 ? ` (+${ids!.length - 1})` : "";
    return `${asset.displayId ?? asset.id} ${asset.name}${extra}`;
  };
  const seen = new Set<string>();
  const rows: AttackPathThreatRow[] = [];
  for (const r of project.risks?.risks ?? []) {
    if (r.sourceStrideMethod !== "attack-path") continue;
    if (r.moscowPriority === "wont") continue;
    if (!r.threatDisplayId || seen.has(r.threatDisplayId)) continue;
    seen.add(r.threatDisplayId);
    const chain = resolveAttackPathChain(project.attackTree, r.attackTreeAssessment);
    rows.push({
      anchor: r.threatDisplayId,
      tsId: r.threatDisplayId,
      strideCategory: r.attackTreeAssessment?.strideCategory ?? "-",
      asset: assetLabel(r.linkedAssetIds),
      threat: chain ? chain.join(" → ") : r.threatDescription || "-",
      mitigations: controlLabels(
        (r.selectedMitigations ?? []).filter((m) => m.status !== "rejected"),
        "mitigation",
      ),
      verifications: controlLabels((r.selectedVerifications ?? []).map((id) => ({ id })), "verification"),
    });
  }
  return rows;
}

// ==================== TRACEABILITY MATRIX (ISO/SAE 21434) ====================

/**
 * A risk's five ISO 21434 Annex G.2 factor ratings (if all five are rated) as
 * attack potential + feasibility band. null when any factor is unrated — that
 * null IS the "AF-" coverage gap the matrix surfaces.
 */
function resolveIso21434Feasibility(
  factorRatings: { factorId: string; value: number }[],
): { attackPotential: number; feasibility: Iso21434FeasibilityLevel } | null {
  return isoFeasibilityFromFactors(factorRatings);
}

/**
 * A risk's attack feasibility from its attack tree — the ISO source of truth
 * (15.7/15.8): the path the risk was raised for, else the scenario aggregate
 * (cheapest / MAX-feasibility path, 15.8 NOTE 2). null when none resolves.
 */
function resolveTreeFeasibility(
  attackTree: DocProjectData["attackTree"],
  assessment: { treeId: string; pathKey: string } | undefined,
): { attackPotential: number | null; feasibility: Iso21434FeasibilityLevel } | null {
  if (!attackTree || !assessment) return null;
  const tree = attackTree.trees?.find((tr) => tr.id === assessment.treeId);
  const analysis = tree?.pathAnalysis;
  if (!analysis) return null;
  const path = analysis.paths?.find((p) => p.pathKey === assessment.pathKey);
  if (path?.feasibilityLevel) {
    return { attackPotential: path.attackPotential ?? null, feasibility: path.feasibilityLevel };
  }
  const cheapest = analysis.cheapestPath;
  if (cheapest?.feasibilityLevel) {
    return { attackPotential: cheapest.attackPotential ?? null, feasibility: cheapest.feasibilityLevel };
  }
  if (analysis.aggregatedFeasibility) {
    return { attackPotential: null, feasibility: analysis.aggregatedFeasibility };
  }
  return null;
}

export interface TraceabilityRow {
  asId: string;
  asName: string;
  dsStatus: string;
  dsLabel: string;
  /** The threat scenario's display id — also the #threat-<id> anchor. */
  tsId: string;
  tsDescription: string;
  afStatus: string;
  afLabel: string;
  riskBefore: string;
  treatment: string;
  riskAfter: string;
  goalsClaims: string;
}

/**
 * The chain AS → DS → TS → AF → risk → treatment → residual per risk
 * (Clause 15). null = no chapter (not an ISO project, or no risks).
 */
export function traceabilityRows(project: DocProjectData, t: TranslationFn): TraceabilityRow[] | null {
  const config = project.risks?.configuration;
  if (config?.likelihoodMethod !== "iso-21434") return null;
  const risks = project.risks?.risks ?? [];
  if (risks.length === 0) return null;

  const assetsById = new Map((project.assets?.assets ?? []).map((a) => [a.id, a]));
  const resolvedText = t("tabs.doc.traceability.resolved", "resolved");
  const missingText = t("tabs.doc.traceability.missing", "missing");

  return risks.map((risk) => {
    const primaryAsset = (risk.linkedAssetIds ?? [])
      .map((id) => assetsById.get(id))
      .filter((a): a is NonNullable<typeof a> => Boolean(a))[0];

    // DS: asset-level damage-scenario impact.
    const resolvedImpact = primaryAsset ? assetImpactResolver.resolveImpactRatings(primaryAsset, undefined) : null;
    const impactByCategory = resolvedImpact ? assetImpactResolver.deriveImpactByCategory(resolvedImpact.ratings) : null;
    const dominantCategory = impactByCategory ? assetImpactResolver.findDominantCategory(impactByCategory) : undefined;

    // AF: tree feasibility first, the five factors on the risk as fallback.
    const af =
      resolveTreeFeasibility(project.attackTree, risk.attackTreeAssessment) ??
      resolveIso21434Feasibility(risk.factorRatings ?? []);
    const afFeasibilityLabel = af ? t(`tabs.doc.traceability.feasibility.${af.feasibility}`, af.feasibility) : "";

    return {
      asId: primaryAsset ? (primaryAsset.displayId ?? primaryAsset.id) : "-",
      asName: primaryAsset ? primaryAsset.name : "-",
      dsStatus: dominantCategory ? resolvedText : missingText,
      dsLabel: dominantCategory ? t(`tabs.doc.traceability.category.${dominantCategory}`, dominantCategory) : "-",
      tsId: risk.threatDisplayId,
      tsDescription: risk.threatDescription || "-",
      afStatus: af ? resolvedText : missingText,
      afLabel: !af ? "-" : af.attackPotential != null ? `${af.attackPotential} (${afFeasibilityLabel})` : afFeasibilityLabel,
      riskBefore: isoRiskLabel(risk, t, false),
      treatment: t(
        `${treatmentI18nKey(risk.treatment, treatmentVocabulary(config))}.label`,
        treatmentFallbackLabel(risk.treatment, treatmentVocabulary(config)),
      ),
      riskAfter: isoRiskLabel(risk, t, true),
      goalsClaims: goalsClaimsOfRisk(project.cybersecurityConcept, risk.id),
    };
  });
}
