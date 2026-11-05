// ==================== HAZARD FINDINGS ====================
// What the hazard validation reports, as codes with parameters (FX-1): the
// findings panel below the hazard table, the toolbar chip and the phase
// indicators translate them into the UI language. The English sentences
// (errors / warnings of HazardValidation) are rendered from the same
// findings with the text below — word for word what the validator said
// before.

export type HazardFindingCode =
  | "danglingContributesTo"
  | "danglingEndangers"
  | "noContributor"
  | "endangersNothing"
  | "noHazardType"
  | "noDescription"
  | "noRationale"
  | "allWithSingleInput"
  | "negativeDistance"
  | "contributorGroup"
  | "targetGroup"
  | "targetMismatch";

export interface HazardFinding {
  code: HazardFindingCode;
  severity: "error" | "warning";
  /** The hazard to open; absent for an edge to an unknown hazard. */
  hazardId?: string;
  params: Record<string, string | number>;
}

/** A finding of one edge, before the validator assigns hazard and severity. */
export type EdgeFinding = Pick<HazardFinding, "code" | "params">;

/** The English sentence (stored form, fallback); keys under tabs.hazards.findings. */
export const HAZARD_FINDING_TEXT: Record<HazardFindingCode, string> = {
  danglingContributesTo: 'Dangling contributes_to edge -> unknown hazard "{{id}}".',
  danglingEndangers: 'Dangling endangers edge from unknown hazard "{{id}}".',
  noContributor: 'Hazard "{{hazard}}" has no contributes_to input.',
  endangersNothing: 'Hazard "{{hazard}}" endangers no protection target.',
  noHazardType: 'Hazard "{{hazard}}" has no ISO 12100 hazard type.',
  noDescription: 'Hazard "{{hazard}}" has no description.',
  noRationale: 'Hazard "{{hazard}}" has no rationale.',
  allWithSingleInput:
    'Hazard "{{hazard}}" uses combinationType "ALL" with a single input — combinatorics has no effect here.',
  negativeDistance: "contributes_to: hazardDistance must be >= 0 (got {{distance}})",
  contributorGroup: 'contributes_to: asset group "{{group}}" is not an allowed hazard source',
  targetGroup: 'endangers: asset group "{{group}}" is not a valid protection target',
  targetMismatch: 'endangers: impact.target "{{target}}" does not match target asset group "{{group}}"',
};

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** One finding as a sentence: in the UI language with `t`, the English form without. */
export function hazardFindingText(finding: Pick<HazardFinding, "code" | "params">, t?: Translate): string {
  const english = HAZARD_FINDING_TEXT[finding.code];
  if (t) return t(`tabs.hazards.findings.${finding.code}`, { ...finding.params, defaultValue: english });
  return english.replace(/\{\{(\w+)\}\}/g, (_m, name: string) => String(finding.params[name] ?? ""));
}

/** Errors and warnings as sentences — for the toolbar chip and the phase indicators. */
export function hazardFindingLines(
  findings: readonly HazardFinding[],
  t?: Translate,
): { errors: string[]; warnings: string[] } {
  const lines = (severity: HazardFinding["severity"]) =>
    findings.filter((f) => f.severity === severity).map((f) => hazardFindingText(f, t));
  return { errors: lines("error"), warnings: lines("warning") };
}
