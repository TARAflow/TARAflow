// ==================== GOALS, CLAIMS AND VERIFICATION IN THE REPORT ====================
// ISO/SAE 21434 conformance plan Phase 4 (decision 25): the chapter
// "goals-claims" — cybersecurity goals (WP-09-03), cybersecurity claims
// (WP-09-04) and the verification entries (WP-09-05) — and the verification
// status the document shows up front. All presets; the chapter appears once
// there is a goal, a claim or a verification entry. Format-neutral.
//
// Goals and claims are linked per risk; the report groups the risks by threat
// scenario ("AT-2: AT-2.1, AT-2.2").

import type { CybersecurityConcept } from "../../../shared/models/cybersecurity-concept-types";
import type { Assumption } from "../../../shared/models/item-definition-types";
import type { DocProjectData, DocVerification } from "../models/doc-types";
import type { ReportSection } from "./report-section";
import { regulationPresetFromTags } from "../../../shared/services/tag-validator";
import type { ProjectTags } from "../../../shared/models/project-tags";

type TranslateFn = (key: string, defaultValue?: string) => string;

const K = "tabs.doc.goalsClaims";

const SCOPE_DEFAULTS: Record<string, string> = {
  tara: "a) TARA",
  treatment: "b) treatment decisions",
  "goals-claims": "c) goals and claims",
  consistency: "d) consistency",
};
const RESULT_DEFAULTS: Record<string, string> = {
  passed: "passed",
  "passed-with-conditions": "passed with conditions",
  failed: "failed",
};

const fill = (text: string, values: Record<string, string | number>) =>
  text.replace(/\{\{(\w+)\}\}/g, (_, n) => String(values[n] ?? ""));

export const goalsClaimsIntro = (t: TranslateFn): string =>
  t(
    `${K}.intro`,
    "The outcome of the risk treatment decisions (ISO/SAE 21434 9.4, 15.9): a cybersecurity goal for every risk that is reduced, a cybersecurity claim for every risk that is retained or shared, and the verification of the TARA, the goals and the claims.",
  );

export function hasConceptContent(concept: CybersecurityConcept | undefined): boolean {
  return !!concept && concept.goals.length + concept.claims.length + concept.verifications.length > 0;
}

/** The status line: same words as in the Overview (keys verificationStatus.*). */
export function verificationStatusSentence(v: DocVerification, t: TranslateFn): string {
  const values = { date: v.latest?.date ?? "", reviewer: v.latest?.reviewer ?? "", days: v.maxAgeDays };
  switch (v.kind) {
    case "verified":
      return fill(t("verificationStatus.verified", "Verified on {{date}} by {{reviewer}} — state unchanged."), values);
    case "changed":
      return fill(
        t("verificationStatus.changed", "Changed since the verification on {{date}} — verify again in the Audit tab."),
        values,
      );
    case "reconfirm":
      return fill(
        t(
          "verificationStatus.reconfirm",
          "The verification on {{date}} cannot vouch for the current state — recorded with an earlier TARAflow version, or the file was converted on loading. Confirm it again in the Audit tab.",
        ),
        values,
      );
    case "outdated":
      return fill(
        t(
          "verificationStatus.outdated",
          "The verification on {{date}} is older than {{days}} days — verify again in the Audit tab.",
        ),
        values,
      );
    case "failed":
      return fill(t("verificationStatus.failed", "The verification on {{date}} did not pass."), values);
    case "none":
      return t("verificationStatus.none", "Not verified yet — record the verification in the Audit tab.");
  }
}

export const verificationStatusLabel = (t: TranslateFn) => t("verificationStatus.label", "TARA verification");

/**
 * Goals, claims and their verification are ISO/SAE 21434 work products: only
 * an iso-21434 project has the chapter (user 2026-10-30, amends decision 25);
 * stored data of another preset stays in the file and is not reported.
 */
export function isConceptPreset(tags: ProjectTags | undefined): boolean {
  return !!tags && regulationPresetFromTags(tags) === "iso-21434";
}

export function goalsClaimsReportSections(
  project: Pick<DocProjectData, "cybersecurityConcept" | "risks" | "assets" | "itemDefinition" | "computed" | "info">,
  t: TranslateFn,
): ReportSection[] {
  const concept = project.cybersecurityConcept;
  if (!isConceptPreset(project.info?.tags) || !hasConceptContent(concept)) return [];
  const risks = new Map((project.risks?.risks ?? []).map((r) => [r.id, r]));
  const assets = new Map((project.assets?.assets ?? []).map((a) => [a.id, a]));
  const assumptions = new Map<string, Assumption>((project.itemDefinition?.assumptions ?? []).map((a) => [a.id, a]));
  const removed = t(`${K}.removed`, "removed");

  /** "AT-2: AT-2.1, AT-2.2; AT-5: AT-5.1" */
  const riskText = (riskIds: readonly string[]) => {
    const groups = new Map<string, string[]>();
    for (const id of riskIds) {
      const label = risks.get(id)?.threatDisplayId ?? `${id} (${removed})`;
      const scenario = /^(AT-\d+)\.\d+$/.exec(label)?.[1] ?? label;
      groups.set(scenario, [...(groups.get(scenario) ?? []), label]);
    }
    return [...groups]
      .map(([scenario, labels]) => (labels.length === 1 && labels[0] === scenario ? scenario : `${scenario}: ${labels.join(", ")}`))
      .join("; ");
  };
  const sections: ReportSection[] = [];

  if (concept!.goals.length > 0) {
    sections.push({
      title: t(`${K}.goals`, "Cybersecurity goals"),
      paragraphs: [],
      facts: [],
      table: {
        headers: [
          t(`${K}.colId`, "ID"),
          t(`${K}.colGoal`, "Cybersecurity goal"),
          t(`${K}.colAssetProperty`, "Asset × property"),
          t(`${K}.colCal`, "CAL"),
          t(`${K}.colRisks`, "Threat scenarios / risks"),
        ],
        rows: concept!.goals.map((g) => [
          g.displayId,
          g.statement,
          g.assetProperties
            .map((ap) => {
              const a = assets.get(ap.assetId);
              return `${a ? `${a.displayId ?? a.id} ${a.name}` : ap.assetId} × ${ap.property}`;
            })
            .join("; "),
          g.cal ? `CAL ${g.cal}${g.calRationale ? ` (${g.calRationale})` : ""}` : "",
          riskText(g.riskIds),
        ]),
      },
    });
  }

  if (concept!.claims.length > 0) {
    sections.push({
      title: t(`${K}.claims`, "Cybersecurity claims"),
      paragraphs: [],
      facts: [],
      table: {
        headers: [
          t(`${K}.colId`, "ID"),
          t(`${K}.colClaim`, "Cybersecurity claim"),
          t(`${K}.colKind`, "Treatment"),
          t(`${K}.colBasis`, "Assumptions / responsible party"),
          t(`${K}.colReview`, "Review by"),
          t(`${K}.colRisks`, "Threat scenarios / risks"),
        ],
        rows: concept!.claims.map((c) => [
          c.displayId,
          c.statement,
          t(`${K}.kind.${c.kind}`, c.kind === "retain" ? "Retain" : "Share"),
          c.kind === "retain"
            ? c.assumptionIds
                .map((id) => {
                  const a = assumptions.get(id);
                  return a ? `${a.displayId} ${a.text}` : `${id} (${removed})`;
                })
                .join("; ")
            : c.responsibleParty ?? "",
          c.reviewBy ?? "",
          riskText(c.riskIds),
        ]),
      },
    });
  }

  const status = project.computed.verification;
  if (concept!.verifications.length > 0 || status) {
    const scopeLabel = (s: string) => t(`${K}.scope.${s}`, SCOPE_DEFAULTS[s] ?? s);
    sections.push({
      title: t(`${K}.verification`, "Verification"),
      paragraphs: status ? [`${verificationStatusLabel(t)}: ${verificationStatusSentence(status, t)}`] : [],
      facts: [],
      ...(concept!.verifications.length > 0
        ? {
            table: {
              headers: [
                t(`${K}.colDate`, "Date"),
                t(`${K}.colReviewer`, "Reviewer"),
                t(`${K}.colChecked`, "Checked (RQ-09-07)"),
                t(`${K}.colResult`, "Result"),
                t(`${K}.colFindings`, "Findings / conditions"),
                t(`${K}.colState`, "Verified state"),
              ],
              rows: [...concept!.verifications]
                .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
                .map((v) => [
                  v.date,
                  v.reviewer,
                  v.scope.map(scopeLabel).join(", "),
                  t(`${K}.result.${v.result}`, RESULT_DEFAULTS[v.result] ?? v.result),
                  v.findings ?? "",
                  [v.projectVersion ? `v${v.projectVersion}` : "", v.stateHash].filter(Boolean).join(" · "),
                ]),
            },
          }
        : {}),
    });
  }
  return sections;
}

/** "CSG-01, CLM-02" for a risk (traceability matrix column CG). */
export function goalsClaimsOfRisk(concept: CybersecurityConcept | undefined, riskId: string): string {
  const ids = [
    ...(concept?.goals ?? []).filter((g) => g.riskIds.includes(riskId)).map((g) => g.displayId),
    ...(concept?.claims ?? []).filter((c) => c.riskIds.includes(riskId)).map((c) => c.displayId),
  ];
  return ids.length > 0 ? ids.join(", ") : "-";
}
