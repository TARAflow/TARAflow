// ==================== ASSET VALIDATOR ====================
// Pure validation logic for AssetData.
// Returns structured AssetValidation — no side effects, no service deps.

import type { AssetData, AssetValidation } from "../models/asset-types";
import type {
  SecurityGoalType,
  StaleReason,
} from "../models/asset-security-goals-types";
import { assetImpactFindings, goalFindings, goalStates } from "./asset-goal-state";
import type { GoalFindingCode } from "./asset-goal-state";
import type { PhaseStatus, ThreatGoalLink } from "shared";
import { compareDisplayIds, goalTypesFor } from "shared";
import { threatGoalFindings } from "./asset-threat-crosscheck";

/**
 * How a validation message names an asset: display id plus name, e.g.
 * "DA-001 (Calibration data)". Never the internal UUID — the analyst cannot
 * find an asset by it. Colons are stripped from the name because the message
 * key uses ":" as separator (key:asset:goal).
 */
export function assetLabel(asset: {
  id: string;
  displayId?: string;
  name?: string;
}): string {
  const name = asset.name?.trim().replace(/\s*:\s*/g, " ");
  const id = asset.displayId || asset.id;
  return name ? `${id} (${name})` : id;
}

/** Asset dialog tab a finding is fixed in: 0 = General, 1 = Security Goals. */
export type AssetDialogTab = 0 | 1;

/**
 * One validation finding, structured — for the notification panel below the
 * asset table (click → open the asset in the right dialog tab). The string
 * form in AssetValidation is derived from these, so both always agree.
 */
export interface AssetFinding {
  severity: "error" | "warning" | "info";
  /** i18n key, e.g. tabs.assets.validation.goalOverrideStale.levelRaised */
  key: string;
  /** Asset the finding is about; absent for project-level findings. */
  assetId?: string;
  assetLabel?: string;
  goal?: SecurityGoalType;
  /** Impact criterion the finding is about (per-goal impact findings). */
  criterionId?: string;
  /** Extra message parameters (threat ↔ goal cross-checks: count, threats …). */
  params?: Record<string, string | number>;
  dialogTab: AssetDialogTab;
}

const GENERAL: AssetDialogTab = 0;
const GOALS: AssetDialogTab = 1;

/** How many threat ids a message lists before it says "…". */
const MAX_LISTED_THREATS = 5;

/**
 * @param threatLinks  threats of the enabled generators, projected by the app
 *                     layer. Given → the threat ↔ goal cross-checks run
 *                     (Phase 6). They live only in the findings panel and the
 *                     review filter, not in the persisted AssetValidation —
 *                     that is built without the threat data.
 */
export function collectAssetFindings(
  assetData: AssetData,
  threatLinks?: readonly ThreatGoalLink[],
): AssetFinding[] {
  const out: AssetFinding[] = [];
  const impactScale = assetData.configuration?.impactScale ?? "4-level";

  if (assetData.assets.length === 0) {
    out.push({ severity: "error", key: "tabs.assets.validation.noAssets", dialogTab: GENERAL });
  }

  for (const asset of assetData.assets) {
    const at = {
      assetId: asset.id,
      assetLabel: assetLabel(asset),
    };
    const push = (
      severity: AssetFinding["severity"],
      key: string,
      dialogTab: AssetDialogTab,
      goal?: SecurityGoalType,
      criterionId?: string,
    ) =>
      out.push({
        severity,
        key,
        dialogTab,
        ...at,
        ...(goal ? { goal } : {}),
        ...(criterionId ? { criterionId } : {}),
      });

    if (!asset.name.trim()) push("error", "tabs.assets.validation.noName", GENERAL);

    // At least one CIANAAA dimension must be active (level !== "none")
    if (!asset.securityGoals.some((sg) => sg.level !== "none")) {
      push("error", "tabs.assets.validation.noSecurityGoal", GOALS);
    }

    // Active goals without a formal requirement text — INFO: the text matters
    // for the report, not for the analysis (one per goal would drown the
    // findings that do matter).
    for (const sg of asset.securityGoals.filter(
      (sg) => sg.level !== "none" && !sg.formalDescription.trim(),
    )) {
      push("info", "tabs.assets.validation.noSecurityGoalDescription", GOALS, sg.type);
    }

    // Manual physicalImpact override requires rationale (IEC 62443-4-1)
    if (
      asset.physicalImpactSource === "manual" &&
      !asset.physicalImpactRationale?.trim()
    ) {
      push("warning", "tabs.assets.validation.noPhysicalImpactRationale", GENERAL);
    }

    if (asset.linkedDFDElements.length === 0) {
      push("warning", "tabs.assets.validation.notLinkedToDFD", GENERAL);
    }

    if (asset.impactRatings.some((r) => r.value === 0)) {
      push("warning", "tabs.assets.validation.unratedImpact", GENERAL);
    }

    // Security-goal findings — from the single domain truth (goalStates).
    const states = goalStates(asset, impactScale);
    asset.securityGoals.forEach((goal, i) => {
      for (const f of goalFindings(states[i], goal)) {
        const key = `${GOAL_FINDING_KEY[f.code]}${f.reason ? `.${STALE_KEY[f.reason]}` : ""}`;
        // Assessment missing → open the impact ratings: rating them is the fix,
        // not a rationale or an exclusion on the goal card.
        push(f.severity, key, f.code === "GOAL_UNASSESSED" ? GENERAL : GOALS, f.goal, f.criterionId);
      }
    });
    for (const f of assetImpactFindings(asset)) {
      push(f.severity, GOAL_FINDING_KEY[f.code], GOALS, undefined, f.criterionId);
    }
  }

  // Threat ↔ goal cross-checks (only with the app layer's threat projection).
  if (threatLinks) {
    const byId = new Map(assetData.assets.map((a) => [a.id, a]));
    for (const f of threatGoalFindings(assetData.assets, threatLinks)) {
      const asset = byId.get(f.assetId)!;
      const ids = f.threats.map((x) => x.displayId).sort(compareDisplayIds);
      out.push({
        severity: f.severity,
        key:
          f.code === "THREAT_WITHOUT_GOAL"
            ? "tabs.assets.validation.threatWithoutGoal"
            : "tabs.assets.validation.goalWithoutThreat",
        dialogTab: GOALS,
        assetId: asset.id,
        assetLabel: assetLabel(asset),
        goal: f.goal,
        ...(f.strideCategory
          ? {
              params: {
                count: f.threats.length,
                stride: f.strideCategory,
                goals: goalTypesFor(f.strideCategory).join(" / "),
                threats:
                  ids.slice(0, MAX_LISTED_THREATS).join(", ") +
                  (ids.length > MAX_LISTED_THREATS ? ", …" : ""),
              },
            }
          : {}),
      });
    }
  }
  return out;
}

/**
 * Assets the analyst still has to look at: at least one error or warning in
 * the findings ("Needs review only" filter of the asset table, design §4.4).
 * Infos never count — they describe legitimate states.
 */
export function assetIdsNeedingReview(findings: AssetFinding[]): Set<string> {
  const ids = new Set<string>();
  for (const f of findings) {
    if (f.assetId && (f.severity === "error" || f.severity === "warning")) ids.add(f.assetId);
  }
  return ids;
}

/** String form "key[:asset[:goal]]" — persisted in AssetValidation. */
function findingToString(f: AssetFinding): string {
  return [f.key, f.assetLabel, f.goal, f.criterionId].filter(Boolean).join(":");
}

export function validateAssetData(assetData: AssetData): AssetValidation {
  const findings = collectAssetFindings(assetData);
  const by = (sev: AssetFinding["severity"]) =>
    findings.filter((f) => f.severity === sev).map(findingToString);
  const errors = by("error");
  return {
    isComplete: errors.length === 0 && assetData.assets.length > 0,
    errors,
    warnings: by("warning"),
    infos: by("info"),
    lastValidated: new Date().toISOString(),
  };
}

const GOAL_FINDING_KEY: Record<GoalFindingCode, string> = {
  GOAL_OVERRIDE_EXCEEDS_ASSET: "tabs.assets.validation.goalOverrideExceedsAsset",
  GOAL_ENVELOPE_SLACK: "tabs.assets.validation.goalEnvelopeSlack",
  GOAL_RATIONALE_MISSING: "tabs.assets.validation.goalRationaleMissing",
  GOAL_OVERRIDE_STALE: "tabs.assets.validation.goalOverrideStale",
  GOAL_UNASSESSED: "tabs.assets.validation.goalUnassessed",
  GOAL_PROVISIONAL: "tabs.assets.validation.goalProvisional",
  GOAL_NO_APPLICABLE_IMPACT: "tabs.assets.validation.goalNoApplicableImpact",
};

const STALE_KEY: Record<StaleReason, string> = {
  "suggestion-removed": "suggestionRemoved",
  "suggestion-added": "suggestionAdded",
  "level-raised": "levelRaised",
  "level-lowered": "levelLowered",
  "basis-changed": "basisChanged",
};

export function derivePhaseStatus(validation: AssetValidation): PhaseStatus {
  if (validation.isComplete) return "complete";
  if (validation.errors.length > 0) return "incomplete";
  return "in-progress";
}