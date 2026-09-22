// ==================== REGULATION PRESET ORCHESTRATOR ====================
// App-layer glue: applies a regulation preset to a whole Project. `Project`
// holds `settings` and `risks` as siblings, so this is the one place that can
// both record the chosen preset (settings, the project-level source of truth)
// AND reconcile the risk factor configuration — without threading settings
// through the risks-tab / RiskUpdateResult contract (which is risk-scoped).
//
// App layer → features is allowed, so importing applyRegulationPreset and
// riskService here is fine (unlike importing them into shared).

import type { Project } from "../models/project-types";
import type { RegulationPresetId, WindowOfOpportunity } from "shared";
 import { regulationPresetFromTags } from "shared";
import { getRegulationPreset } from "shared";
import { applyRegulationPreset } from "features/risks/services/regulation-preset-service";
import { isAssetImpactMandatory } from "features/risks/services/regulation-preset-service";
import { getMandatoryAssetCriteriaIds } from "features/risks/services/regulation-preset-service";
import type { ActiveFactor } from "features/risks";
import { assetService } from "features/assets/services/asset-service";
import { DEFAULT_ASSET_CONFIGURATION } from "features/assets/models/asset-types";
import { SAFETY_CRITERION_ID } from "features/assets/models/asset-impact-types";
import { riskService } from "features/risks/services/risk-service";

export interface RegulationPresetProjectResult {
  project: Project;
  /** Managed factors kept ON because the analyst enabled them by hand. */
  conflicts: string[];
  /** True if the risk factor configuration actually changed. */
  changed: boolean;
}

/**
 * Record `presetId` on the project settings and reconcile the risk factor
 * configuration to match. Pure — returns a new Project, never mutates the
 * input. If the project has no risk data yet, only the setting is recorded;
 * factors are reconciled when risk data is first created / next applied.
 */
/**
 * Exclusive-mode presets (iso-21434 → SFOP) mandate a fixed set of impact
 * factors that must ALWAYS be enabled: neither the analyst nor the system may
 * disable them — only ADD further factors. Force them on (adding any that are
 * missing), overriding the "analyst disabled" heuristic in
 * updateImpactFactorsAutoEnable. Data-driven — the set is the preset's
 * impactCriteriaIds, so extending the preset extends the mandate. Idempotent:
 * returns the same array reference when nothing changes.
 */
function enforceMandatoryImpactFactors(
  activeFactors: ActiveFactor[],
  presetId: RegulationPresetId,
): { activeFactors: ActiveFactor[]; changed: boolean } {
  if (!isAssetImpactMandatory(presetId)) {
    return { activeFactors, changed: false };
  }
  const mandatory = getRegulationPreset(presetId).impactCriteriaIds ?? [];
  if (mandatory.length === 0) return { activeFactors, changed: false };

  let changed = false;
  const next = [...activeFactors];
  for (const id of mandatory) {
    const i = next.findIndex((factor) => factor.factorId === id);
    if (i === -1) {
      next.push({ factorId: id, enabled: true, weight: 1.0, autoEnabled: true });
      changed = true;
    } else if (next[i].enabled !== true) {
      next[i] = { ...next[i], enabled: true, autoEnabled: true };
      changed = true;
    }
  }
  return changed ? { activeFactors: next, changed: true } : { activeFactors, changed: false };
}

export function applyRegulationPresetToProject(
  project: Project,
  presetId: RegulationPresetId,
): RegulationPresetProjectResult {
  // Project-level source of truth — always recorded.
  const settings = { ...project.settings, regulationPreset: presetId };

  if (!project.risks) {
    return { project: { ...project, settings }, conflicts: [], changed: false };
  }

  const preset = applyRegulationPreset(
    project.risks.configuration.activeFactors,
    presetId,
  );
  const conflicts = preset.conflicts;
  // Fold in the mandatory-impact enforcement so exclusive-mode presets always
  // carry their full SFOP set, even if a factor was left/marked disabled.
  const mandated = enforceMandatoryImpactFactors(preset.activeFactors, presetId);
  const activeFactors = mandated.activeFactors;
  const changed = preset.changed || mandated.changed;

  if (!changed) {
    // Factor config untouched, but the method may still differ (e.g. a preset
    // that manages no factors). Set it without a rating migration.
    const method = getRegulationPreset(presetId).likelihoodMethod;
    const risks =
      project.risks.configuration.likelihoodMethod === method
        ? project.risks
        : {
            ...project.risks,
            configuration: {
              ...project.risks.configuration,
              likelihoodMethod: method,
            },
          };
    return {
      project: { ...project, settings, risks },
      conflicts,
      changed: false,
    };
  }

  // Migrate ratings + recalc via the existing config-update path, then pin the
  // method on the result (independent of whether updateConfiguration preserves
  // unknown config fields).
  const method = getRegulationPreset(presetId).likelihoodMethod;
  const migrated = riskService.updateConfiguration(project.risks, {
    ...project.risks.configuration,
    activeFactors,
  });
  const risks = {
    ...migrated,
    configuration: { ...migrated.configuration, likelihoodMethod: method },
  };

  return {
    project: { ...project, settings, risks },
    conflicts,
    changed: true,
  };
}

/**
 * Thread the project-global Window of Opportunity (Overview / Security Context,
 * design §3.3) onto the risk configuration. Pure and idempotent — returns the
 * SAME project when nothing changes (woo undefined, no risks yet, or already
 * equal), so it never triggers a needless write/re-render.
 */
export function threadWindowOfOpportunity(
  project: Project,
  woo: WindowOfOpportunity | undefined,
): Project {
  if (woo === undefined || !project.risks) return project;
  const cfg = project.risks.configuration;
  if (cfg.windowOfOpportunity === woo) return project;
  return {
    ...project,
    risks: {
      ...project.risks,
      configuration: { ...cfg, windowOfOpportunity: woo },
    },
  };
}

/**
 * Force useAssetImpact = true for exclusive-mode presets (iso-21434 / etsi-tvra):
 * they lock every impact factor off, so impact can only come from asset-impact,
 * or R = I × L = 0 (design DS-4). Pure and idempotent — returns the SAME project
 * when nothing changes (non-exclusive preset, no risks, or already true), so it
 * never triggers a needless write/re-render. The config dialog additionally
 * locks the toggle interactively; this is the backstop for the import / legacy /
 * tag-change paths that don't go through the dialog.
 */
export function threadUseAssetImpact(
  project: Project,
  presetId: RegulationPresetId,
): Project {
  if (!project.risks || !isAssetImpactMandatory(presetId)) return project;
  const cfg = project.risks.configuration;
  if (cfg.useAssetImpact === true) return project;
  return {
    ...project,
    risks: {
      ...project.risks,
      configuration: { ...cfg, useAssetImpact: true },
    },
  };
}

function setEquals(a: Set<string>, b: Set<string>): boolean {
  return a.size === b.size && [...a].every((x) => b.has(x));
}

/**
 * "Pristine default" = the analyst has not touched the impact-criteria SET: it
 * is exactly the package default, or the default plus the DFD-driven safety
 * criterion. Compared by id-set only (weights and order are irrelevant to
 * whether the analyst chose the dimensions).
 */
function isPristineDefaultCriteria(ids: string[]): boolean {
  const current = new Set(ids);
  const def = new Set(
    DEFAULT_ASSET_CONFIGURATION.impactCriteria.map((c) => c.id),
  );
  const defPlusSafety = new Set(def).add(SAFETY_CRITERION_ID);
  return setEquals(current, def) || setEquals(current, defPlusSafety);
}

/**
 * Seed the preset's impact criteria onto the Asset Tab when a preset declares
 * them (iso-21434 → SFOP). REPLACE-on-pristine-default: while the criteria set
 * is still the untouched default (or default + safety), set it to EXACTLY the
 * preset's criteria; otherwise leave it alone. That makes it idempotent (after
 * seeding, the set no longer matches the default → never runs again) and
 * preserves any criteria the analyst adds afterwards (design DS-1 / §3.11 impact
 * side). Routed through assetService.updateConfiguration so every asset's
 * impactRatings are realigned to the new criteria (existing values kept, new
 * ones start unrated, removed ones dropped). Pure and idempotent — returns the
 * SAME project when nothing changes.
 */
export function threadImpactCriteria(
  project: Project,
  presetId: RegulationPresetId,
): Project {
  if (!project.assets) return project;
  const wanted = getRegulationPreset(presetId).impactCriteriaIds ?? [];
  if (wanted.length === 0) return project;

  const current = project.assets.configuration.impactCriteria;
  if (!isPristineDefaultCriteria(current.map((c) => c.id))) return project;

  const newConfig = {
    ...project.assets.configuration,
    impactCriteria: wanted.map((id) => ({ id, weight: 1 / wanted.length })),
  };
  return {
    ...project,
    assets: assetService.updateConfiguration(project.assets, newConfig),
  };
}
 
/**
 * Data backstop for the asset-side SFOP lock: ensures every mandatory impact
 * criterion is present on the asset config (self-correcting on import / legacy
 * / tag-change), mirroring enforceMandatoryImpactFactors on the risk side.
 * Unlike threadImpactCriteria it runs regardless of pristine state, but only
 * ADDS missing criteria — existing criteria and their weights are untouched.
 */
export function enforceMandatoryAssetCriteria(
  project: Project,
  presetId: RegulationPresetId,
): Project {
  if (!project.assets) return project;
  const mandatory = getMandatoryAssetCriteriaIds(presetId);
  if (mandatory.length === 0) return project;

  const current = project.assets.configuration.impactCriteria;
  const present = new Set(current.map((c) => c.id));
  const missing = mandatory.filter((id) => !present.has(id));
  if (missing.length === 0) return project;

  const newConfig = {
    ...project.assets.configuration,
    impactCriteria: [
      ...current,
      ...missing.map((id) => ({ id, weight: 1 })),
    ],
  };
  return {
    ...project,
    assets: assetService.updateConfiguration(project.assets, newConfig),
  };
}

/**
 * The single entry point the workspace handlers call: derive the preset from
 * the project's regulation tags (the tag IS the selection — no separate
 * picker), apply it (settings.regulationPreset + factor/method reconcile), and
 * thread the project-global WoO onto the config. Pure — returns a new Project.
 *
 * Safe to call on every general-tab AND risks-tab update: applyRegulationPreset
 * is non-destructive and reports changed=false when factors already match, so
 * repeated calls are idempotent (they only pin the method / WoO, no rating
 * migration) — which is exactly what closes the ordering gap (tags are usually
 * set before risk data exists, so the general-tab call can't touch factors yet;
 * the risks-tab call reconciles once risk data appears).
 */
export function applyRegulationFromTags(
  project: Project,
  woo?: WindowOfOpportunity,
): RegulationPresetProjectResult {
  const presetId = regulationPresetFromTags(project.info.tags);
  const applied = applyRegulationPresetToProject(project, presetId);
  const withWoo = threadWindowOfOpportunity(applied.project, woo);
  const withImpact = threadUseAssetImpact(withWoo, presetId);
  const withCriteria = threadImpactCriteria(withImpact, presetId);
  return {
    ...applied,
    project: enforceMandatoryAssetCriteria(withCriteria, presetId),
  };
}