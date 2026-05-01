// ==================== TAG VALIDATOR ====================
// Soft validation for project tag combinations.
// Warnings only — never blocks the user.
//
// Design principle:
//   Hard errors are for impossible combinations (none exist here).
//   Warnings are for unusual combinations that MIGHT be mistakes.
//   A consultant tagging a Medical project with CRA is valid — no hard block.

import i18n from "i18next";
import type { ProjectTags } from "../models/overview-types";

// ==================== TYPES ====================

export interface TagWarning {
  /** Short warning message for inline display */
  message: string;
  /** Which regulation triggered the warning */
  regulation: string;
  /** Suggested domain or platform tag to add */
  suggestedTag?: string;
}

// ==================== RULES ====================

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

// ==================== VALIDATOR ====================

/**
 * Validate tag combinations and return soft warnings.
 * Never throws — always returns an array (empty = no warnings).
 *
 * Logic per rule:
 *   If regulation is selected AND
 *   none of the expected domains are present AND
 *   none of the expected platforms are present
 *   → emit warning
 */
export function getTagWarnings(tags: ProjectTags): TagWarning[] {
  const warnings: TagWarning[] = [];

  for (const rule of TAG_RULES) {
    if (!tags.regulation.includes(rule.regulation)) continue;

    const domainMatch = rule.expectedDomains ?.some((d) => tags.domain.includes(d)) ?? null;

    const platformMatch = rule.expectedPlatforms ?.some((p) => tags.platform.includes(p)) ?? null;

    const anySatisfied = domainMatch === true || platformMatch === true;

    // Only warn if NEITHER domain nor platform matches
    if (!anySatisfied) {
      warnings.push({
        message: i18n.t(rule.messageKey),
        regulation: rule.regulation,
        suggestedTag: rule.suggestedTag,
      });
    }
  }

  return warnings;
}

/**
 * Quick check — returns true if any warnings exist.
 * Use for conditional rendering of warning indicator.
 */
export function hasTagWarnings(tags: ProjectTags): boolean {
  return getTagWarnings(tags).length > 0;
}