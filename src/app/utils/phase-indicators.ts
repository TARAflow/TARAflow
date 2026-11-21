// ==================== PHASE INDICATORS ====================
// What the phase tabs and the Overview's phase progress show per phase —
// status, error and warning count, and the details behind them — computed
// once, keyed by PhaseId (review 2026-10-30). Before, the Overview indexed its
// validation info by hand and showed the DFD's findings under Hazard (phase 1
// is Hazard since the v2 renumbering), and both read the DFD validation
// stored in the file: a file saved by an older version kept showing a finding
// the current validation no longer reports until the DFD was edited.
//
// The DFD part comes from validating the stored diagram now
// (dfdService.validateSavedState) — the same validation the DFD tab runs,
// against the canonical asset registry; the Hazard details from the same
// validation the Hazard tab shows. The stored status stays for every other
// phase; the file is not changed (it follows with the next save).
//
// details: what the tooltips show (Overview cards, phase tabs) — the
// findings in the UI language, at most MAX_DETAILS, then "… n more".

import type { PhaseStatus, PhaseStatusMap } from "shared";
import { missingGeneralFields, type GeneralField } from "features/overview";
import type { ProjectInfoData } from "features/overview";
import { translateFinding, type ValidationFinding } from "features/dfd";
import { PhaseId } from "../models/phase-types";
import { hasUrlCredentials, withoutUrlCredentials } from "shared/utils/url-credentials";

type Translate = (key: string, options?: Record<string, unknown>) => string;

export const MAX_DETAILS = 5;

export interface PhaseCounts {
  errors: number;
  warnings: number;
}

export interface PhaseIndicatorInput {
  phaseStatus: PhaseStatusMap;
  info: Pick<ProjectInfoData, "name" | "description" | "version" | "responsible" | "tags">;
  /** Validation of the stored diagram (validateSavedState); null = no diagram. */
  dfdValidation: { errors: readonly ValidationFinding[]; warnings: readonly ValidationFinding[] } | null;
  /** The DFD phase status that validation stands for (dfdService.phaseStatusOf). */
  dfdStatus?: PhaseStatus;
  /**
   * Findings of imported components (multi-project TARA, 6c): shown in the
   * DFD tab's panel, so counted on the DFD phase too — errors make it
   * incomplete, warnings keep it from complete.
   */
  componentFindings?: { errors: readonly ValidationFinding[]; warnings: readonly ValidationFinding[] } | null;
  /** The project's source references (Overview → Sources): one with credentials in its URL is a warning (6c). */
  sourceBindings?: readonly { repoUrl: string }[];
  /** The Hazard tab's validation (safety-relevant projects with hazards), translated (hazardFindingLines, FX-1). */
  hazardValidation?: { errors: readonly string[]; warnings: readonly string[] } | null;
  /** The Risk tab's validation of the current state, translated (riskFindingLines, FX-4). */
  riskValidation?: { errors: readonly string[]; warnings: readonly string[] } | null;
  /** Why the risks not done are open, one line per reason (0.20 item 14) — details only, not counted. */
  openRisks?: readonly string[];
  /** Stored threats the current rules would no longer / additionally generate. */
  threatDrift?: { obsolete: number; added: number };
  /**
   * The oldest threat catalogue version among the methods whose generated
   * threats are outdated (catalogue divergence phase A); absent = current.
   */
  threatCatalog?: { stored: number; current: number };
  /**
   * DFD elements, flows and assets without a description (display ids):
   * the DFD is complete only when everything is described — a tooltip
   * without them gave no reason for "in progress" (manual test 2026-11-17).
   */
  undescribed?: readonly string[];
  /** Threats not rated yet (display ids) — why the Threats phase is in progress. */
  unratedThreats?: readonly string[];
  /**
   * TARA verification (iso-21434 only): its kind and the Overview's status
   * text. Counted on the General phase, where the status line lives — not
   * verified / changed / reconfirm / outdated a warning, failed an error.
   */
  verification?: { kind: "verified" | "changed" | "reconfirm" | "outdated" | "failed" | "none"; text: string };
  t: Translate;
}

export interface PhaseIndicators {
  /** The stored phase status, the DFD's replaced by the current validation. */
  status: PhaseStatusMap;
  counts: Record<number, PhaseCounts>;
  /** Why a phase is not complete — translated lines for the tooltips. */
  details: Record<number, string[]>;
}

const FIELD_FALLBACK: Record<GeneralField, string> = {
  name: "Name",
  description: "Description",
  version: "Version",
  responsible: "Responsible",
  tags: "Tags",
};

function capped(lines: string[], t: Translate): string[] {
  if (lines.length <= MAX_DETAILS) return lines;
  return [
    ...lines.slice(0, MAX_DETAILS),
    t("phases.details.more", { count: lines.length - MAX_DETAILS, defaultValue: "… {{count}} more" }),
  ];
}

/** "<label> (n): A, B, C, D, E …" — at most MAX_DETAILS names. */
function namedList(t: Translate, key: string, fallback: string, ids: readonly string[]): string {
  const list = ids.slice(0, MAX_DETAILS).join(", ") + (ids.length > MAX_DETAILS ? " …" : "");
  return t(key, { count: ids.length, list, defaultValue: fallback });
}

export function phaseIndicators(input: PhaseIndicatorInput): PhaseIndicators {
  const { t } = input;
  const counts: Record<number, PhaseCounts> = {};
  const details: Record<number, string[]> = {};

  // General: the required project information still missing, and the TARA
  // verification (ISO/SAE 21434; user 2026-10-30) — its status lives here.
  const missing = missingGeneralFields(input.info);
  const general: string[] = [];
  if (missing.length > 0) {
    general.push(
      t("phases.details.missing", {
        fields: missing.map((f) => t(`phases.details.field.${f}`, { defaultValue: FIELD_FALLBACK[f] })).join(", "),
        defaultValue: "Missing: {{fields}}",
      }),
    );
  }
  const verificationOpen = !!input.verification && input.verification.kind !== "verified";
  const verificationFailed = input.verification?.kind === "failed";
  if (verificationOpen) general.push(input.verification!.text);
  // A source reference with credentials in its URL (review of patch 73): the
  // token stays in the git history — clean the URL and revoke it.
  const withCredentials = (input.sourceBindings ?? []).filter((b) => hasUrlCredentials(b.repoUrl));
  for (const b of withCredentials) {
    general.push(
      t("phases.details.credentialsInUrl", {
        url: withoutUrlCredentials(b.repoUrl),
        defaultValue: "Source reference {{url}} carries credentials in its URL — clean it (Overview → Sources) and revoke the token at the provider",
      }),
    );
  }
  counts[PhaseId.General] = {
    errors: verificationFailed ? 1 : 0,
    warnings: missing.length + (verificationOpen && !verificationFailed ? 1 : 0) + withCredentials.length,
  };
  if (general.length > 0) details[PhaseId.General] = general;

  // Risk: the Risk tab's validation messages (user 2026-10-30).
  if (input.riskValidation) {
    counts[PhaseId.Risk] = {
      errors: input.riskValidation.errors.length,
      warnings: input.riskValidation.warnings.length,
    };
    const lines = [...input.riskValidation.errors, ...input.riskValidation.warnings];
    if (lines.length > 0) details[PhaseId.Risk] = capped(lines, t);
  }
  // Why risks are open (0.20 item 14): "In Progress" with no finding said nothing.
  if (input.openRisks && input.openRisks.length > 0) {
    details[PhaseId.Risk] = [...(details[PhaseId.Risk] ?? []), ...input.openRisks];
  }

  // Hazard: the Hazard tab's validation messages.
  if (input.hazardValidation) {
    counts[PhaseId.Hazard] = {
      errors: input.hazardValidation.errors.length,
      warnings: input.hazardValidation.warnings.length,
    };
    const lines = [...input.hazardValidation.errors, ...input.hazardValidation.warnings];
    if (lines.length > 0) details[PhaseId.Hazard] = capped(lines, t);
  }

  // DFD: the current validation and the imported components' findings (6c), errors first.
  let status = input.phaseStatus;
  const cmpErrors = input.componentFindings?.errors ?? [];
  const cmpWarnings = input.componentFindings?.warnings ?? [];
  if (input.dfdValidation || cmpErrors.length + cmpWarnings.length > 0) {
    const errors = [...(input.dfdValidation?.errors ?? []), ...cmpErrors];
    const warnings = [...(input.dfdValidation?.warnings ?? []), ...cmpWarnings];
    counts[PhaseId.DFD] = { errors: errors.length, warnings: warnings.length };
    const lines = [...errors, ...warnings].map((f) => translateFinding(t, f));
    if (lines.length > 0) details[PhaseId.DFD] = capped(lines, t);
    let dfdStatus = input.dfdValidation ? input.dfdStatus : undefined;
    // the component findings keep the DFD from complete / make it incomplete
    if (dfdStatus && cmpErrors.length > 0) dfdStatus = "incomplete";
    else if (dfdStatus === "complete" && cmpWarnings.length > 0) dfdStatus = "in-progress";
    if (dfdStatus) status = { ...status, [PhaseId.DFD]: dfdStatus };
  }
  const undescribed = input.undescribed ?? [];
  if (undescribed.length > 0 && status[PhaseId.DFD as keyof PhaseStatusMap] !== "complete") {
    details[PhaseId.DFD] = [...(details[PhaseId.DFD] ?? []), namedList(t, "phases.details.undescribed", "Without a description ({{count}}): {{list}}", undescribed)];
  }

  // Threats: generation drift (not a validation finding).
  const obsolete = input.threatDrift?.obsolete ?? 0;
  const added = input.threatDrift?.added ?? 0;
  const catalog = input.threatCatalog;
  counts[PhaseId.Threats] = { errors: 0, warnings: obsolete + added + (catalog ? 1 : 0) };
  const drift: string[] = [];
  if (catalog) {
    drift.push(
      t("phases.details.threatCatalog", {
        stored: catalog.stored,
        current: catalog.current,
        defaultValue:
          "Generated with threat catalogue v{{stored}}, current is v{{current}} — regenerate in the Threats tab to re-evaluate the threats",
      }),
    );
  }
  if (obsolete > 0) {
    drift.push(
      t("tabs.threats.drift.banner.obsolete", {
        count: obsolete,
        defaultValue: "{{count}} stored threats would no longer be generated",
      }),
    );
  }
  if (added > 0) {
    drift.push(t("tabs.threats.drift.banner.added", { count: added, defaultValue: "{{count}} threats would be added" }));
  }
  const unrated = input.unratedThreats ?? [];
  if (unrated.length > 0) drift.push(namedList(t, "phases.details.unrated", "Not decided yet — unrated or uncertain ({{count}}): {{list}}", unrated));
  if (drift.length > 0) details[PhaseId.Threats] = drift;

  return { status, counts, details };
}
