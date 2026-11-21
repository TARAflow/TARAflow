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
import type { RegulationPresetId } from "../models/regulation-preset";

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
    regulation: "EN IEC 62443 (CRA)",
    expectedPlatforms: ["OT", "Embedded"],
    expectedDomains: ["Industrial", "Energy", "Water", "Transportation"],
    messageKey: "projectInfo.tagWarnings.enIec62443Cra",
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
  if (n === "ETSITVRA" || n === "TVRA" || n.startsWith("ETSITS102165"))
    return "ETSI TVRA";
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

/**
 * The tag selects EN 50742 Approach A — "EN 50742 A", "EN50742_A", "EN 50742
 * Approach A" and the bare "EN 50742" (the preset defaults to A). One rule for
 * the preset and the Compliance sub-tab `en-50742-a` (model coverage plan §8.1).
 */
export function isEn50742ApproachATag(tag: string): boolean {
  return methodGroupOf(tag) === "EN 50742" && en50742ApproachOf(tag) !== "B";
}

/** The tag selects EN 50742 Approach B — "EN 50742 B", "EN50742_B", "EN 50742 Approach B" (Compliance sub-tab `en-50742-b`). */
export function isEn50742ApproachBTag(tag: string): boolean {
  return methodGroupOf(tag) === "EN 50742" && en50742ApproachOf(tag) === "B";
}

// ==================== METHOD TAG COMBINATIONS (0.20) ====================
// Which method tags go together (user 2026-11-21). R = L × I comes from one
// base method — TARAflow standard (no tag), ETSI TVRA or ISO 21434. EN 50742
// A is an addition: AP and SRSL for the safety-relevant risks next to
// L × I, never alone; EN 50742 B always comes with an IEC 62443-4-2 edition.
//
//   allowed    standard / ETSI TVRA + EN 50742 A
//              standard / ETSI TVRA + EN 50742 B (+ IEC 62443-4-2)
//   excluded   EN 50742 A <-> EN 50742 B (Clause 4.1)
//              ISO 21434  <-> EN 50742 A, EN 50742 B, ETSI TVRA
//
// The tag editor enforces it: an excluded tag is replaced by the one added
// (project-tags.ts addTagWithOutcome). The warnings of getRegulationConflicts
// stay for projects saved before. Tags are written in their catalogue
// spelling; the bare "EN 50742" is refused (choose A or B).

/** A method tag in its catalogue spelling. */
export type MethodTag = "ISO 21434" | "ETSI TVRA" | "EN 50742 A" | "EN 50742 B";

/** The method tag of any spelling ("EN50742_B" → "EN 50742 B"; the bare "EN 50742" reads as A), or null. */
export function methodTagOf(tag: string): MethodTag | null {
  const group = methodGroupOf(tag);
  if (group === "EN 50742") return en50742ApproachOf(tag) === "B" ? "EN 50742 B" : "EN 50742 A";
  if (group === "ISO 21434") return "ISO 21434";
  if (group === "ETSI TVRA") return "ETSI TVRA";
  return null;
}

const EXCLUDED_PAIRS: readonly (readonly [MethodTag, MethodTag])[] = [
  ["EN 50742 A", "EN 50742 B"],
  ["ISO 21434", "EN 50742 A"],
  ["ISO 21434", "EN 50742 B"],
  ["ISO 21434", "ETSI TVRA"],
];

/** The two method tags cannot be in one project. */
export function methodTagsExclude(a: MethodTag, b: MethodTag): boolean {
  return EXCLUDED_PAIRS.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

/**
 * EN 50742 without an approach ("EN 50742", "EN50742") — no catalogue tag:
 * the editor asks for A or B. Projects saved with it are read as A.
 */
export function isBareEn50742Tag(tag: string): boolean {
  return methodGroupOf(tag) === "EN 50742" && en50742ApproachOf(tag) === null;
}

/** The catalogue spelling of a method tag; other tags as they are (trimmed). */
export function canonicalMethodTag(tag: string): string {
  return methodTagOf(tag) ?? tag.trim();
}

// ==================== SAFETY / HAZARD IMPLICATION ====================

/**
 * Whether the selected regulations MANDATE hazard analysis (the Hazard tab).
 * A set of safety-relevant standards forces `safetyRelevant = true` and locks
 * the Hazard slide switch: EN 50742 (machinery), IEC 81001 / IEC TR 60601
 * (medical), IEC 63452 / CLC/TS 50701 (railway). Independent of the likelihood
 * preset — e.g. IEC 81001 activates the Hazard tab while the method stays
 * `standard`. Consumed by project-info to derive the switch state.
 */
const HAZARD_REGULATIONS: ReadonlySet<string> = new Set(
  ["EN 50742", "IEC 81001", "IEC TR 60601", "IEC 63452", "CLC/TS 50701"].map(
    normalizeTag,
  ),
);

export function requiresHazardAnalysis(tags: ProjectTags): boolean {
  return tags.regulation.some((reg) => {
    const n = normalizeTag(reg);
    // EN 50742 (any approach) matches by prefix; the rest by exact normalized id.
    return n.startsWith("EN50742") || HAZARD_REGULATIONS.has(n);
  });
}

/**
 * Derive the regulation preset from the project's regulation tags. The tag IS
 * the selection — there is no separate preset picker. First matching regime
 * wins; falls back to the default when no regime tag is present. A bare
 * "EN 50742" tag (no approach suffix) defaults to Approach A.
 */
export function regulationPresetFromTags(
  tags: ProjectTags,
): RegulationPresetId {
  for (const reg of tags.regulation) {
    const group = methodGroupOf(reg);
    if (group === "EN 50742") {
      return en50742ApproachOf(reg) === "B" ? "en-50742-b" : "en-50742-a";
    }
    if (group === "ISO 21434") return "iso-21434";
    if (group === "ETSI TVRA") return "etsi-tvra";
  }
  return "standard";
}

// ==================== TAG EFFECT ====================

/** Regulation tags that enable an IEC 62443-4-2 requirement matrix (compliance standard registry). */
export const MATRIX_TAGS: readonly string[] = ["IEC 62443", "EN IEC 62443 (CRA)"];

/**
 * What a tag changes in the workflow, for marking it in the tag editor:
 *   method  selects the regulation preset — risk method, threat generators,
 *           work products, report (ISO 21434, EN 50742, ETSI TVRA)
 *   matrix  enables a requirement matrix — Compliance tab and report chapter
 *   null    documentation and context only
 */
export function tagEffectOf(tag: string): "method" | "matrix" | null {
  if (methodGroupOf(tag)) return "method";
  if (MATRIX_TAGS.includes(tag)) return "matrix";
  return null;
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
  // The first tag of each method (any spelling; the bare "EN 50742" is A —
  // the same rule as the preset and the Compliance sub-tabs).
  const first = new Map<MethodTag, string>();
  for (const reg of tags.regulation) {
    const method = methodTagOf(reg);
    if (method && !first.has(method)) first.set(method, reg);
  }
  const warnings: TagWarning[] = [];
  for (const [x, y] of EXCLUDED_PAIRS) {
    const a = first.get(x);
    const b = first.get(y);
    if (!a || !b) continue;
    const approaches = x === "EN 50742 A" && y === "EN 50742 B";
    warnings.push({
      kind: "mutual-exclusion",
      regulation: a,
      conflictsWith: [b],
      message: approaches
        ? i18n.t("projectInfo.tagConflicts.en50742Approach", {
            a,
            b,
            defaultValue:
              "EN 50742 Approach A and Approach B are mutually exclusive (Clause 4.1) — choose one approach.",
          })
        : i18n.t("projectInfo.tagConflicts.methodRegime", {
            a,
            b,
            defaultValue: "{{a}} and {{b}} cannot be combined in one project — remove one of them.",
          }),
    });
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
  return [
    ...getRegulationConflicts(tags),
    ...getMissingContextWarnings(tags),
    ...getCraPairingHints(tags),
    ...getEn50742BPairingHints(tags),
  ];
}

/**
 * EN 50742 B is a subset of IEC 62443-4-2 (Table 4): it always goes with an
 * edition of it — the 2019 one (added with the B tag) or the CRA one.
 */
function getEn50742BPairingHints(tags: ProjectTags): TagWarning[] {
  const b = tags.regulation.find(isEn50742ApproachBTag);
  if (!b || MATRIX_TAGS.some((m) => tags.regulation.includes(m))) return [];
  return [
    {
      kind: "missing-context",
      regulation: b,
      suggestedTag: "IEC 62443",
      message: i18n.t("projectInfo.tagWarnings.en50742BWithout62443", {
        defaultValue:
          "EN 50742 B evaluates a subset of IEC 62443-4-2 — add IEC 62443 (2019 edition) or EN IEC 62443 (CRA).",
      }),
    },
  ];
}

/**
 * The CRA edition of IEC 62443-4-2 is a harmonised standard under the CRA
 * (iec-62443-4-2-cra-coverage.md D-3): with "EN IEC 62443 (CRA)" the generic
 * "CRA" tag belongs to the project too. A hint, never a block.
 */
function getCraPairingHints(tags: ProjectTags): TagWarning[] {
  if (!tags.regulation.includes("EN IEC 62443 (CRA)") || tags.regulation.includes("CRA")) return [];
  return [
    {
      kind: "missing-context",
      regulation: "EN IEC 62443 (CRA)",
      message: i18n.t("projectInfo.tagWarnings.enIec62443CraWithoutCra", {
        defaultValue: "EN IEC 62443 (CRA) is a harmonised standard under the Cyber Resilience Act — consider adding the CRA tag as well.",
      }),
    },
  ];
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