// ==================== TAG VALIDATOR ====================
// Soft validation for project tag combinations.
// Warnings only — never blocks the user.
//
// Design principle:
//   Hard errors are for impossible combinations. The one genuinely exclusive
//   choice — which regulatory METHOD drives the project — is enforced hard on
//   the single-select regulation PRESET, not here. Tags are free-form / multi,
//   so this file only emits warnings:
//     - "missing-context": a regulation without its expected domain/platform.
//     - "mutual-exclusion": two regulations that each define the project's
//       single risk/compliance method (e.g. ISO 21434 vs EN 50742, or
//       EN 50742 Approach A vs B). Flagged prominently, but still non-blocking —
//       a consultant may tag several norms for documentation.
//   A consultant tagging a Medical project with CRA is valid — no hard block.

import i18n from "i18next";
import type { ProjectTags } from "shared";

// ==================== TYPES ====================

export type TagWarningKind = "missing-context" | "mutual-exclusion";

export interface TagWarning {
  /** Short warning message for inline display */
  message: string;
  /** Which regulation triggered the warning */
  regulation: string;
  /** Suggested domain or platform tag to add (missing-context only) */
  suggestedTag?: string;
  /**
   * Kind of warning. Defaults to "missing-context" for the domain/platform
   * rules so existing consumers keep working; "mutual-exclusion" for regulation
   * conflicts, which the UI should surface more prominently.
   */
  kind?: TagWarningKind;
  /**
   * The other regulation(s) this one conflicts with (mutual-exclusion only).
   */
  conflictsWith?: string[];
}

// ==================== MISSING-CONTEXT RULES ====================

interface TagRule {
  /** Regulation tag that triggers this rule */
  regulation: string;
  /** At least one of these domain tags should be present */
  expectedDomains?: string[];
  /** At least one of these platform tags should be present */
  expectedPlatforms?: string[];
  /** Warning message key suffix — shown to user */
  messageKey: string;
  /** Optional: suggest adding this tag */
  suggestedTag?: string;
}

const TAG_RULES: TagRule[] = [
  {
    regulation: "ISO 21434",
    expectedDomains: ["Automotive"],
    messageKey: "projectInfo.tagWarnings.iso21434",
    suggestedTag: "Automotive",
  },
  {
    regulation: "CLC/TS 50701",
    expectedDomains: ["Railway"],
    messageKey: "projectInfo.tagWarnings.clcTs50701",
    suggestedTag: "Railway",
  },
  {
    regulation: "IEC 63452",
    expectedDomains: ["Railway"],
    messageKey: "projectInfo.tagWarnings.iec63452",
    suggestedTag: "Railway",
  },
  {
    regulation: "IEC 81001",
    expectedDomains: ["Medical"],
    messageKey: "projectInfo.tagWarnings.iec81001",
    suggestedTag: "Medical",
  },
  {
    regulation: "IEC TR 60601",
    expectedDomains: ["Medical"],
    messageKey: "projectInfo.tagWarnings.iecTr60601",
    suggestedTag: "Medical",
  },
  {
    regulation: "IEC 62351",
    expectedDomains: ["Energy"],
    messageKey: "projectInfo.tagWarnings.iec62351",
    suggestedTag: "Energy",
  },
  {
    regulation: "ETSI EN 303 645",
    expectedPlatforms: ["Embedded", "IoT"],
    messageKey: "projectInfo.tagWarnings.etsiEn303645",
    suggestedTag: "IoT",
  },
  {
    regulation: "EN 17927",
    expectedPlatforms: ["Embedded", "IoT"],
    messageKey: "projectInfo.tagWarnings.en17927",
    suggestedTag: "IoT",
  },
  {
    regulation: "EN 18031",
    expectedPlatforms: ["Embedded", "IoT", "Web", "Mobile"],
    messageKey: "projectInfo.tagWarnings.en18031",
  },
  {
    regulation: "IEC 62443",
    expectedPlatforms: ["OT", "Embedded"],
    expectedDomains: ["Industrial", "Energy", "Water", "Transportation"],
    messageKey: "projectInfo.tagWarnings.iec62443",
    suggestedTag: "OT",
  },
  {
    regulation: "ISO 27017",
    expectedPlatforms: ["Cloud"],
    messageKey: "projectInfo.tagWarnings.iso27017",
    suggestedTag: "Cloud",
  },
];

// ==================== MUTUAL-EXCLUSION RULES ====================

/**
 * A regulation regime is classified into a "method group" when it prescribes
 * the project's single risk/compliance METHOD (which likelihood factors exist,
 * how they combine, whether it is a compliance-subset model). Two regulations
 * in different method groups cannot both drive one project.
 *
 * The real, hard exclusivity lives on the single-select regulation PRESET
 * (regulation-presets-design.md): a project has exactly one preset, so it has
 * exactly one method. This tag-layer check is a soft safety-net for the
 * free-form tag list, which can legitimately list several norms.
 *
 * Matching is done on a normalized form so it survives tag-string variance
 * ("EN 50742 A" / "EN50742_A" / "EN 50742 Approach A" all match). Extend the
 * classifiers below when new method-defining regimes are added.
 */

/** Normalize a tag for robust, punctuation-insensitive matching. */
function normalizeTag(tag: string): string {
  return tag.toUpperCase().replace(/[\s_/.\-]/g, "");
}

/** Which risk/compliance method group a regulation tag belongs to, or null. */
function methodGroupOf(tag: string): string | null {
  const n = normalizeTag(tag);
  if (n === "ISO21434" || n === "ISOSAE21434") return "ISO 21434";
  if (n.startsWith("EN50742")) return "EN 50742";
  // Extend here as further method-defining presets are added (e.g. a future
  // regime that also owns the likelihood/compliance method).
  return null;
}

/** EN 50742 Approach (A/B) of a tag, or null if not an EN 50742 approach tag. */
function en50742ApproachOf(tag: string): "A" | "B" | null {
  const n = normalizeTag(tag);
  if (!n.startsWith("EN50742")) return null;
  const rest = n.slice("EN50742".length); // e.g. "A", "APPROACHA", "B"
  if (rest.endsWith("A")) return "A";
  if (rest.endsWith("B")) return "B";
  return null;
}

// ==================== SAFETY / HAZARD IMPLICATION ====================

/**
 * Whether the selected regulations MANDATE hazard analysis (the Hazard tab).
 * EN 50742 is fundamentally a machinery-safety standard, so any EN 50742 tag
 * (Approach A or B) forces `safetyRelevant = true` and locks the Hazard slide
 * switch. Consumed by project-info to derive the switch state; keep the safety
 * classification next to the other EN 50742 tag classifiers above.
 */
export function requiresHazardAnalysis(tags: ProjectTags): boolean {
  return tags.regulation.some((reg) => methodGroupOf(reg) === "EN 50742");
}

// ==================== VALIDATOR ====================

/**
 * Missing-context warnings: a regulation is selected but neither its expected
 * domains nor platforms are present.
 */
function getMissingContextWarnings(tags: ProjectTags): TagWarning[] {
  const warnings: TagWarning[] = [];

  for (const rule of TAG_RULES) {
    if (!tags.regulation.includes(rule.regulation)) continue;

    const domainMatch = rule.expectedDomains?.some((d) => tags.domain.includes(d)) ?? null;
    const platformMatch = rule.expectedPlatforms?.some((p) => tags.platform.includes(p)) ?? null;

    const anySatisfied = domainMatch === true || platformMatch === true;

    // Only warn if NEITHER domain nor platform matches
    if (!anySatisfied) {
      warnings.push({
        kind: "missing-context",
        message: i18n.t(rule.messageKey),
        regulation: rule.regulation,
        suggestedTag: rule.suggestedTag,
      });
    }
  }

  return warnings;
}

/**
 * Mutual-exclusion warnings: two selected regulations each define the project's
 * risk/compliance method, or EN 50742 Approach A and B are both selected.
 * One warning per conflicting pair (deduplicated, order-independent).
 */
export function getRegulationConflicts(tags: ProjectTags): TagWarning[] {
  const warnings: TagWarning[] = [];
  const seenPairs = new Set<string>();

  const pairKey = (a: string, b: string) => [a, b].sort().join("|");

  // (1) Cross-method conflict: distinct method groups selected together.
  const groupToTag = new Map<string, string>();
  for (const reg of tags.regulation) {
    const group = methodGroupOf(reg);
    if (group && !groupToTag.has(group)) groupToTag.set(group, reg);
  }
  const groups = [...groupToTag.entries()]; // [group, representativeTag]
  for (let i = 0; i < groups.length; i++) {
    for (let j = i + 1; j < groups.length; j++) {
      const [, tagA] = groups[i];
      const [, tagB] = groups[j];
      const key = pairKey(tagA, tagB);
      if (seenPairs.has(key)) continue;
      seenPairs.add(key);
      warnings.push({
        kind: "mutual-exclusion",
        regulation: tagA,
        conflictsWith: [tagB],
        message: i18n.t("projectInfo.tagConflicts.methodRegime", {
          a: tagA,
          b: tagB,
          defaultValue:
            "{{a}} and {{b}} each define the project's risk method — a project follows only one. Choose a single regulation preset.",
        }),
      });
    }
  }

  // (2) EN 50742 Approach A vs B — mutually exclusive per Clause 4.1.
  const approachTags = { A: undefined as string | undefined, B: undefined as string | undefined };
  for (const reg of tags.regulation) {
    const ap = en50742ApproachOf(reg);
    if (ap === "A" && !approachTags.A) approachTags.A = reg;
    if (ap === "B" && !approachTags.B) approachTags.B = reg;
  }
  if (approachTags.A && approachTags.B) {
    const key = pairKey(approachTags.A, approachTags.B);
    if (!seenPairs.has(key)) {
      seenPairs.add(key);
      warnings.push({
        kind: "mutual-exclusion",
        regulation: approachTags.A,
        conflictsWith: [approachTags.B],
        message: i18n.t("projectInfo.tagConflicts.en50742Approach", {
          a: approachTags.A,
          b: approachTags.B,
          defaultValue:
            "EN 50742 Approach A and Approach B are mutually exclusive (Clause 4.1) — choose one approach.",
        }),
      });
    }
  }

  return warnings;
}

/**
 * Validate tag combinations and return soft warnings.
 * Never throws — always returns an array (empty = no warnings).
 * Conflicts (mutual-exclusion) are listed first so the UI can surface them
 * above the softer missing-context hints.
 */
export function getTagWarnings(tags: ProjectTags): TagWarning[] {
  return [...getRegulationConflicts(tags), ...getMissingContextWarnings(tags)];
}

/**
 * Quick check — returns true if any warnings exist.
 * Use for conditional rendering of warning indicator.
 */
export function hasTagWarnings(tags: ProjectTags): boolean {
  return getTagWarnings(tags).length > 0;
}

/**
 * Quick check — returns true if any mutual-exclusion conflict exists.
 * Use to render the stronger conflict indicator distinctly from soft hints.
 */
export function hasTagConflicts(tags: ProjectTags): boolean {
  return getRegulationConflicts(tags).length > 0;
}