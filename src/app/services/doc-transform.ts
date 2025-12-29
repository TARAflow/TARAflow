// ==================== DOCUMENTATION TRANSFORM ====================
// App-layer service for transforming Project data to DocProjectData
// This file belongs to the APP layer, not the Documentation feature!
//
// Location: src/app/services/doc-transform.ts
//
// This is "glue code" that connects all features to the Documentation feature.
// It needs knowledge of ALL feature types (Assets, Threats, Risks).

import type { StrideCategory, StrideMethod } from "shared";
import type { Project } from "app/models/project-types";

// Import Documentation types
import type {
  DocProjectData,
  DocAsset,
  DocThreat,
  DocRisk,
  DocLanguage,
} from "features/documentation";

// ==================== LABEL HELPERS ====================

/**
 * STRIDE category names
 */
const STRIDE_NAMES: Record<StrideCategory, { en: string; de: string }> = {
  S: { en: "Spoofing", de: "Spoofing" },
  T: { en: "Tampering", de: "Manipulation" },
  R: { en: "Repudiation", de: "Abstreitbarkeit" },
  I: { en: "Information Disclosure", de: "Informationspreisgabe" },
  D: { en: "Denial of Service", de: "Dienstverweigerung" },
  E: { en: "Elevation of Privilege", de: "Rechteausweitung" },
};

/**
 * Impact/Risk scale labels
 */
const SCALE_LABELS: Record<string, Record<number, { en: string; de: string }>> = {
  "3-level": {
    1: { en: "Low", de: "Niedrig" },
    2: { en: "Medium", de: "Mittel" },
    3: { en: "High", de: "Hoch" },
  },
  "4-level": {
    1: { en: "Low", de: "Niedrig" },
    2: { en: "Medium", de: "Mittel" },
    3: { en: "High", de: "Hoch" },
    4: { en: "Critical", de: "Kritisch" },
  },
  "5-level": {
    1: { en: "Low", de: "Niedrig" },
    2: { en: "Medium", de: "Mittel" },
    3: { en: "High", de: "Hoch" },
    4: { en: "Very High", de: "Sehr Hoch" },
    5: { en: "Critical", de: "Kritisch" },
  },
};

/**
 * MoSCoW priority labels
 */
const MOSCOW_LABELS: Record<string, { en: string; de: string }> = {
  must: { en: "Must", de: "Muss" },
  should: { en: "Should", de: "Sollte" },
  could: { en: "Could", de: "Könnte" },
  wont: { en: "Won't", de: "Wird nicht" },
};

/**
 * Risk status labels
 */
const STATUS_LABELS: Record<string, { en: string; de: string }> = {
  open: { en: "Open", de: "Offen" },
  "in-review": { en: "In Review", de: "In Prüfung" },
  mitigated: { en: "Mitigated", de: "Mitigiert" },
  accepted: { en: "Accepted", de: "Akzeptiert" },
  "wont-do": { en: "Won't Do", de: "Wird nicht gemacht" },
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Get STRIDE category name
 */
export function getStrideName(category: StrideCategory, lang: DocLanguage): string {
  return STRIDE_NAMES[category]?.[lang] ?? category;
}

/**
 * Get scale label (for impact or risk)
 */
export function getScaleLabel(
  value: number,
  scale: "3-level" | "4-level" | "5-level",
  lang: DocLanguage
): string {
  if (value <= 0) return "-";
  const roundedValue = Math.round(value);
  const maxLevel = parseInt(scale.charAt(0));
  const clampedValue = Math.min(Math.max(roundedValue, 1), maxLevel);
  return SCALE_LABELS[scale]?.[clampedValue]?.[lang] ?? String(value);
}

/**
 * Get MoSCoW priority label
 */
export function getMoSCoWLabel(priority: string, lang: DocLanguage): string {
  return MOSCOW_LABELS[priority]?.[lang] ?? priority;
}

/**
 * Get risk status label
 */
export function getStatusLabel(status: string, lang: DocLanguage): string {
  return STATUS_LABELS[status]?.[lang] ?? status;
}

/**
 * Format data flow for display
 */
export function formatDataFlowDisplay(
  dataFlow?: { dataFlowName: string; sourceName: string; targetName: string } | null
): string {
  if (!dataFlow) return "-";
  return `${dataFlow.sourceName} → ${dataFlow.targetName}`;
}

// ==================== MAIN TRANSFORMATION ====================

/**
 * Transform Project to DocProjectData
 * Call this from main-layout.tsx before passing to DocTab
 */
export function transformProjectToDocData(
  project: Project,
  lang: DocLanguage
): DocProjectData {
  const impactScale = project.assets?.configuration?.impactScale ?? "4-level";
  const riskScale = project.risks?.configuration?.scale ?? "4-level";

  // Transform assets
  const docAssets: DocAsset[] = (project.assets?.assets ?? []).map((asset) => ({
    id: asset.id,
    name: asset.name,
    description: asset.description,
    overallImpact: asset.overallImpact,
    impactLabel: getScaleLabel(asset.overallImpact, impactScale, lang),
    securityGoals: asset.securityGoals
      .filter((sg) => sg.enabled)
      .map((sg) => ({ type: sg.type, description: sg.formalDescription })),
    linkedElements: asset.linkedDFDElements?.map((e) => e.elementName) ?? [],
  }));

  // Transform threats per element
  const docThreatsPerElement: DocThreat[] = (
    project.threats?.perElementTables ?? []
  ).flatMap((table) =>
    table.threats.map((threat) => ({
      id: threat.id,
      strideCategory: threat.strideCategory,
      strideName: getStrideName(threat.strideCategory, lang),
      elementOrFlow: threat.linkedElement?.elementName ?? "-",
      trustBoundary: table.trustBoundaryName,
      threatDescription: threat.threatDescription,
      attackDescription: threat.attackDescription,
      mitigation: threat.mitigation,
      verification: threat.verification,
    }))
  );

  // Transform threats per interaction
  const docThreatsPerInteraction: DocThreat[] = (
    project.threats?.perInteractionTables ?? []
  ).flatMap((table) =>
    table.threats.map((threat) => ({
      id: threat.id,
      strideCategory: threat.strideCategory,
      strideName: getStrideName(threat.strideCategory, lang),
      elementOrFlow: formatDataFlowDisplay(threat.dataFlow),
      trustBoundary: table.trustBoundaryName,
      threatDescription: threat.threatDescription,
      attackDescription: threat.attackDescription,
      mitigation: threat.mitigation,
      verification: threat.verification,
    }))
  );

  // Transform risks (excluding won't)
  const transformRisks = (method: StrideMethod): DocRisk[] =>
    (project.risks?.risks ?? [])
      .filter((r) => r.sourceStrideMethod === method && r.moscowPriority !== "wont")
      .map((risk) => ({
        id: risk.id,
        threatId: risk.threatId,
        strideCategory: risk.strideCategory,
        strideName: getStrideName(risk.strideCategory, lang),
        threatDescription: risk.threatDescription,
        riskBeforeMitigation: risk.calculatedRiskBeforeMitigation,
        riskBeforeLabel: getScaleLabel(risk.calculatedRiskBeforeMitigation, riskScale, lang),
        selectedMitigations: risk.selectedMitigations,
        riskAfterMitigation: risk.calculatedRiskAfterMitigation,
        riskAfterLabel: getScaleLabel(risk.calculatedRiskAfterMitigation, riskScale, lang),
        moscowPriority: risk.moscowPriority,
        moscowLabel: getMoSCoWLabel(risk.moscowPriority, lang),
        status: risk.status,
        statusLabel: getStatusLabel(risk.status, lang),
      }));

  // Transform won't risks
  const wontRisks: DocRisk[] = (project.risks?.risks ?? [])
    .filter((r) => r.moscowPriority === "wont")
    .map((risk) => ({
      id: risk.id,
      threatId: risk.threatId,
      strideCategory: risk.strideCategory,
      strideName: getStrideName(risk.strideCategory, lang),
      threatDescription: risk.threatDescription,
      riskBeforeMitigation: risk.calculatedRiskBeforeMitigation,
      riskBeforeLabel: getScaleLabel(risk.calculatedRiskBeforeMitigation, riskScale, lang),
      selectedMitigations: risk.selectedMitigations,
      riskAfterMitigation: risk.calculatedRiskAfterMitigation,
      riskAfterLabel: "-",
      moscowPriority: risk.moscowPriority,
      moscowLabel: getMoSCoWLabel(risk.moscowPriority, lang),
      status: risk.status,
      statusLabel: getStatusLabel(risk.status, lang),
      wontJustification: risk.wontJustification,
    }));

  // Determine active STRIDE methods based on actual content
  const activeStrideMethods: StrideMethod[] = [];
  if ((project.threats?.perElementTables ?? []).some((t) => t.threats.length > 0)) {
    activeStrideMethods.push("per-element");
  }
  if ((project.threats?.perInteractionTables ?? []).some((t) => t.threats.length > 0)) {
    activeStrideMethods.push("per-interaction");
  }

  return {
    id: project.id,
    name: project.name,
    phaseStatus: project.phaseStatus,
    lastModified: project.lastModified,
    info: {
      id: project.id,
      name: project.name,
      description: project.description,
      version: project.version,
      responsible: project.responsible,
      created: project.created,
      lastModified: project.lastModified,
      tags: project.tags,
      team: project.team,
    },
    dfd: {
      hasDFD: !!(project.dfd?.xml),
      imagePath: "./images/dfd.png",
      stats: project.dfd?.stats,
    },
    assets: docAssets,
    threatsPerElement: docThreatsPerElement,
    threatsPerInteraction: docThreatsPerInteraction,
    risksPerElement: transformRisks("per-element"),
    risksPerInteraction: transformRisks("per-interaction"),
    wontRisks,
    activeStrideMethods,
    documentation: project.documentation ?? null,
  };
}