// ==================== TRANSFORM PROJECT TO DOC DATA ====================
// Simplified transform - direct references + cached labels only
// Location: src/app/services/doc-transform.ts (or src/app/utils/doc-transform.ts)

import type { Project } from "../models/project-types";
import type {
  DocProjectData,
  DocLanguage,
  DocComputedValues,
} from "../../features/documentation/models/doc-types";
import type { StrideCategory } from "../../shared";

// ==================== LABEL CALCULATION HELPERS ====================

/**
 * Get scale label (impact or risk) based on scale type
 */
function getScaleLabel(
  value: number,
  scaleType: "3-level" | "4-level" | "5-level",
  language: DocLanguage,
): string {
  const de = language === "de";

  switch (scaleType) {
    case "3-level":
      if (value >= 3) return de ? "Hoch" : "High";
      if (value >= 2) return de ? "Mittel" : "Medium";
      return de ? "Niedrig" : "Low";

    case "4-level":
      if (value >= 4) return de ? "Kritisch" : "Critical";
      if (value >= 3) return de ? "Hoch" : "High";
      if (value >= 2) return de ? "Mittel" : "Medium";
      return de ? "Niedrig" : "Low";

    case "5-level":
      if (value >= 5) return de ? "Kritisch" : "Critical";
      if (value >= 4) return de ? "Sehr Hoch" : "Very High";
      if (value >= 3) return de ? "Hoch" : "High";
      if (value >= 2) return de ? "Mittel" : "Medium";
      return de ? "Niedrig" : "Low";

    default:
      return value.toString();
  }
}

/**
 * Get STRIDE category name
 */
function getStrideName(
  category: StrideCategory,
  language: DocLanguage,
): string {
  const names: Record<StrideCategory, { en: string; de: string }> = {
    S: { en: "Spoofing", de: "Spoofing" },
    T: { en: "Tampering", de: "Manipulation" },
    R: { en: "Repudiation", de: "Abstreitbarkeit" },
    I: { en: "Information Disclosure", de: "Informationspreisgabe" },
    D: { en: "Denial of Service", de: "Dienstverweigerung" },
    E: { en: "Elevation of Privilege", de: "Rechteausweitung" },
  };
  return names[category]?.[language] ?? category;
}

/**
 * Get MoSCoW priority label
 */
function getMoSCoWLabel(priority: string, language: DocLanguage): string {
  const labels: Record<string, { en: string; de: string }> = {
    must: { en: "Must", de: "Muss" },
    should: { en: "Should", de: "Sollte" },
    could: { en: "Could", de: "Könnte" },
    wont: { en: "Won't", de: "Wird nicht" },
  };
  return labels[priority]?.[language] ?? priority;
}

/**
 * Get risk status label
 */
function getStatusLabel(status: string, language: DocLanguage): string {
  const labels: Record<string, { en: string; de: string }> = {
    open: { en: "Open", de: "Offen" },
    "in-progress": { en: "In Progress", de: "In Bearbeitung" },
    mitigated: { en: "Mitigated", de: "Gemildert" },
    accepted: { en: "Accepted", de: "Akzeptiert" },
  };
  return labels[status]?.[language] ?? status;
}

// ==================== COMPUTE CACHED VALUES ====================

/**
 * Pre-compute labels and lookups for performance
 */
function computeDocValues(
  project: Project,
  language: DocLanguage,
): DocComputedValues {
  const impactScale = project.assets?.configuration?.impactScale ?? "4-level";
  const riskScale = project.risks?.configuration?.scale ?? "4-level";

  // Cache impact labels (asset ID -> label)
  const impactLabels = new Map<string, string>();
  project.assets?.assets?.forEach((asset) => {
    const label = getScaleLabel(asset.overallImpact, impactScale, language);
    impactLabels.set(asset.id, label);
  });

  // Cache risk labels (risk ID -> label)
  const riskBeforeLabels = new Map<string, string>();
  const riskAfterLabels = new Map<string, string>();
  project.risks?.risks?.forEach((risk) => {
    const beforeLabel = getScaleLabel(
      risk.calculatedRiskBeforeMitigation,
      riskScale,
      language,
    );
    const afterLabel = getScaleLabel(
      risk.calculatedRiskAfterMitigation,
      riskScale,
      language,
    );
    riskBeforeLabels.set(risk.id, beforeLabel);
    riskAfterLabels.set(risk.id, afterLabel);
  });

  // Cache STRIDE names (category -> name)
  const strideNames = new Map<StrideCategory, string>();
  const categories: StrideCategory[] = ["S", "T", "R", "I", "D", "E"];
  categories.forEach((cat) => {
    strideNames.set(cat, getStrideName(cat, language));
  });

  // Cache MoSCoW labels (priority -> label)
  const moscowLabels = new Map<string, string>();
  ["must", "should", "could", "wont"].forEach((priority) => {
    moscowLabels.set(priority, getMoSCoWLabel(priority, language));
  });

  // Cache status labels (status -> label)
  const statusLabels = new Map<string, string>();
  ["open", "in-progress", "mitigated", "accepted"].forEach((status) => {
    statusLabels.set(status, getStatusLabel(status, language));
  });

  // Determine active STRIDE methods based on actual content
  const activeStrideMethods: Array<"per-element" | "per-interaction"> = [];
  if (project.threats?.perElementTables?.some((t) => t.threats.length > 0)) {
    activeStrideMethods.push("per-element");
  }
  if (
    project.threats?.perInteractionTables?.some((t) => t.threats.length > 0)
  ) {
    activeStrideMethods.push("per-interaction");
  }

  return {
    activeStrideMethods,
    language,
    impactLabels,
    riskBeforeLabels,
    riskAfterLabels,
    strideNames,
    moscowLabels,
    statusLabels,
  };
}

// ==================== MAIN TRANSFORM ====================

/**
 * Transform Project to DocProjectData
 *
 * NEW APPROACH:
 * - Direct references to feature data (no duplication!)
 * - Only pre-compute labels for performance
 * - 90% smaller than old transform
 */
export function transformProjectToDocData(
  project: Project,
  language: DocLanguage,
): DocProjectData {
  return {
    // Basic metadata
    id: project.id,
    name: project.info.name,
    phaseStatus: project.phaseStatus,
    lastModified: project.info.lastModified,

    // Direct references (Single Source of Truth!)
    info: project.info,
    dfd: project.dfd ?? null,
    assets: project.assets ?? null,
    threats: project.threats ?? null,
    risks: project.risks ?? null,
    attackTree: project.attackTrees ?? null,

    // Computed values (performance optimization)
    computed: computeDocValues(project, language),

    // Documentation state
    documentation: project.documentation ?? null,
  };
}

// ==================== HELPER EXPORTS ====================

export { getScaleLabel, getStrideName, getMoSCoWLabel, getStatusLabel };
