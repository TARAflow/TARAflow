// ==================== TRANSFORM PROJECT TO DOC DATA ====================
// Simplified transform - direct references + cached labels only
// Location: src/app/services/doc-transform.ts (or src/app/utils/doc-transform.ts)

import { docVerificationOf } from "./verification-state";
import { buildDocCompliance } from "./compliance-report";
import type { Project } from "../models/project-types";
import type {
  DocProjectData,
  DocLanguage,
  DocComputedValues,
} from "../../features/documentation/models/doc-types";
import type { StrideCategory } from "../../shared";
import { EMPTY_PROJECT_TAGS, regulationPresetFromTags } from "../../shared";
import { buildMethodologyRecord } from "./methodology-record";
import { docResidualView } from "./doc-residual";
import { docImportedAttackTrees, docImportedRiskNotes, docImportedThreats } from "./doc-imported";

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
 * Impact label on the 4-level scale with the ISO/SAE 21434 RQ-15-05 names
 * (conformance plan 0b2) — same thresholds as getScaleLabel "4-level".
 */
function getIsoImpactLabel(value: number, language: DocLanguage): string {
  const de = language === "de";
  if (value >= 4) return de ? "Schwerwiegend" : "Severe";
  if (value >= 3) return de ? "Erheblich" : "Major";
  if (value >= 2) return de ? "Moderat" : "Moderate";
  return de ? "Vernachlässigbar" : "Negligible";
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
  uncredited?: DocComputedValues["uncreditedResiduals"],
): DocComputedValues {
  const impactScale = project.assets?.configuration?.impactScale ?? "4-level";
  // ISO/SAE 21434 names on the 4-level impact scale (display only).
  const isoImpactLabels =
    impactScale === "4-level" &&
    regulationPresetFromTags(project.info?.tags ?? EMPTY_PROJECT_TAGS) ===
      "iso-21434";

  // Cache impact labels (asset ID -> label)
  const impactLabels = new Map<string, string>();
  project.assets?.assets?.forEach((asset) => {
    const label = isoImpactLabels
      ? getIsoImpactLabel(asset.overallImpact, language)
      : getScaleLabel(asset.overallImpact, impactScale, language);
    impactLabels.set(asset.id, label);
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

  // The threats of imported components (6a-1), per component and method.
  const importedThreats = docImportedThreats(project);
  const importedRiskNotes = docImportedRiskNotes(project);
  const importedAttackTrees = docImportedAttackTrees(project);
  const imports = (method: "per-element" | "per-interaction") =>
    importedThreats.some((g) => g.method === method && g.threats.length > 0);

  // Determine active STRIDE methods based on actual content (own and imported threats)
  const activeStrideMethods: Array<"per-element" | "per-interaction"> = [];
  if (project.threats?.perElementTables?.some((t) => t.threats.length > 0) || imports("per-element")) {
    activeStrideMethods.push("per-element");
  }
  if (
    project.threats?.perInteractionTables?.some((t) => t.threats.length > 0) ||
    imports("per-interaction")
  ) {
    activeStrideMethods.push("per-interaction");
  }

  return {
    // Item definition as "system definition" outside ISO/SAE 21434.
    neutralItemDefinition:
      regulationPresetFromTags(project.info?.tags ?? EMPTY_PROJECT_TAGS) !== "iso-21434",
    activeStrideMethods,
    language,
    impactLabels,
    strideNames,
    moscowLabels,
    statusLabels,
    // Methodology chapter (ISO/SAE 21434 conformance plan 0d).
    methodology: buildMethodologyRecord(project),
    // Verification status as of now, the document's creation (plan Phase 4).
    verification: docVerificationOf(project, new Date().toISOString().slice(0, 10)),
    // IEC 62443-4-2 requirement matrix (iec-62443-4-2-cra-coverage.md §5).
    compliance: buildDocCompliance(project, language),
    // Residual risks not credited (I7 (4)) — for the report's note.
    ...(uncredited && uncredited.size > 0 ? { uncreditedResiduals: uncredited } : {}),
    // Imported components (6a-1): their threats, the provenance of their risks' ratings.
    ...(importedThreats.length > 0 ? { importedThreats } : {}),
    ...(importedRiskNotes.size > 0 ? { importedRiskNotes } : {}),
    ...(importedAttackTrees.length > 0 ? { importedAttackTrees } : {}),
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
  // The credited residual (I7 (4)), applied once for every report reader.
  const residual = docResidualView(project);
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
    risks: residual.risks,
    attackTree: project.attackTrees ?? null,
    ...(project.itemDefinition ? { itemDefinition: project.itemDefinition } : {}),
    ...(project.cybersecurityConcept ? { cybersecurityConcept: project.cybersecurityConcept } : {}),
    ...(project.compliance?.componentId ? { complianceComponentId: project.compliance.componentId } : {}),

    // Computed values (performance optimization)
    computed: computeDocValues(project, language, residual.uncredited),

    // Documentation state
    documentation: project.documentation ?? null,
  };
}

// ==================== HELPER EXPORTS ====================

export { getScaleLabel, getStrideName, getMoSCoWLabel, getStatusLabel };
