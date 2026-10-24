// app/utils/commit-calc-stamps.ts
//
// ISO/SAE 21434 conformance plan 0c (decision 17): calculation stamps, and the
// analysisDate / tree.lastModified churn fix (d1).
//
// Runs in the project write channel (mergeProjectPatch) — the one place where
// the new state replaces the old AND every configuration the values ran
// through is known (risks, assets, attack trees). Features stay unaware.
//
// Stamps (only under iso-21434):
//   - PathAnalysis (per tree): feasibility core version + hash of the G.6 / G.7
//     tables (attack-potential weights, bands).
//   - Risk: risk + feasibility core versions + hash of everything the value
//     runs through: risk configuration, asset impact scale, the attack-tree
//     feasibility configuration, Mapping B (feasibility → risk scale) and the fixed
//     ISO tables of the iso_* fallback.
//   A stamp is written only when a value was actually (re)computed: the risk is
//   new in the same project, or its computed values / factor ratings changed;
//   the path analysis is new or changed. Opening, switching or loading a
//   project never stamps (prev must be the same project). No timestamp in the
//   stamp — an unchanged recomputation leaves the file byte-identical.
//
//   Known, accepted false alarm: a configuration change after which a risk
//   recomputes to the same value does not restamp it; 3a then reads it as
//   "computed with an older configuration" and must recompute in memory before
//   listing it for review.
//
// Churn fix (all presets, no value change): a re-parsed tree whose content is
// unchanged apart from tree.lastModified / pathAnalysis.analysisDate keeps the
// previous object (same reference — also keeps React.memo quiet); a changed
// tree whose path analysis is unchanged apart from analysisDate keeps the old
// analysisDate. The date fields are excluded from the comparison, otherwise it
// would trigger itself.

import type { Project } from "../models/project-types";
import {
  EMPTY_PROJECT_TAGS,
  feasibilityLevelToRiskScale,
  regulationPresetFromTags,
  type CalcStamp,
} from "shared";
import { canonicalStringify } from "shared/utils/tcs-canonical";
import { fnv1aHex12 } from "shared/utils/fnv1a";
import {
  FEASIBILITY_CALC_VERSION,
} from "features/attacktree/services/attacktree-calculator";
import {
  DEFAULT_FEASIBILITY_CONFIGURATION,
  type FeasibilityConfiguration,
} from "features/attacktree/models/attacktree-feasibility-types";
import type {
  AttackTree,
  AttackTreeData,
  PathAnalysis,
} from "features/attacktree/models/attacktree-types";
import {
  ISO_RISK_CALC_TABLES,
  RISK_CALC_VERSION,
} from "features/risks/services/risk-calculation-service";
import type { Risk } from "features/risks/models/risk-assessment-types";
import type { RiskConfiguration } from "features/risks/models/risk-config-types";

const ISO_METHOD = "iso-21434";

/** Canonical JSON; never throws (TCS rejects NaN/Infinity — such data must
 * not break the write channel, it is simply never "equal"). */
function canonicalOrNull(value: unknown): string | null {
  try {
    return canonicalStringify(value);
  } catch {
    return null;
  }
}

const hashOf = (value: unknown): string =>
  fnv1aHex12(canonicalOrNull(value) ?? JSON.stringify(value) ?? "");

// ==================== STAMPS ====================

/** G.6 / G.7 part of the feasibility configuration (what a path runs through). */
function pathTables(config: FeasibilityConfiguration) {
  return {
    method: config.method,
    likelihoodModel: config.likelihoodModel,
    weights: config.weights,
    bands: config.bands,
    quickBands: config.quickBands,
    benefitShift: config.benefitShift,
  };
}

export function pathCalcStamp(config: FeasibilityConfiguration): CalcStamp {
  return {
    method: ISO_METHOD,
    calcVersion: `feasibility-${FEASIBILITY_CALC_VERSION}`,
    mappingVersion: hashOf(pathTables(config)),
  };
}

/** Risk configuration fields that do not change a computed value (UI state). */
function calcRelevantRiskConfig(config: RiskConfiguration | undefined) {
  if (!config) return null;
  const {
    activeStrideMethod: _stride,
    showIndividualFactors: _show,
    pendingSafetySourceRemoval: _pending,
    ...rest
  } = config;
  return rest;
}

export function riskCalcStamp(project: Project): CalcStamp {
  const feasibility =
    project.attackTrees?.configuration?.feasibilityConfiguration ??
    DEFAULT_FEASIBILITY_CONFIGURATION;
  return {
    method: ISO_METHOD,
    calcVersion: `risk-${RISK_CALC_VERSION}+feasibility-${FEASIBILITY_CALC_VERSION}`,
    mappingVersion: hashOf({
      risk: calcRelevantRiskConfig(project.risks?.configuration),
      impactScale: project.assets?.configuration?.impactScale ?? null,
      feasibility: {
        ...pathTables(feasibility),
        // Mapping B as applied: derived from the risk scale (decision 21).
        levelToRiskScale: feasibilityLevelToRiskScale(
          project.risks?.configuration?.scale,
        ),
      },
      isoTables: ISO_RISK_CALC_TABLES,
    }),
  };
}

const sameStamp = (a: CalcStamp | undefined, b: CalcStamp): boolean =>
  !!a &&
  a.method === b.method &&
  a.calcVersion === b.calcVersion &&
  a.mappingVersion === b.mappingVersion;

// ==================== COMPARISON (dates excluded) ====================

function analysisWithoutDate(a: PathAnalysis | undefined): unknown {
  if (!a) return null;
  const { analysisDate: _date, ...rest } = a;
  return rest;
}

function treeWithoutDates(t: AttackTree): unknown {
  const { lastModified: _modified, pathAnalysis, ...rest } = t;
  return { ...rest, pathAnalysis: analysisWithoutDate(pathAnalysis) };
}

function sameContent(a: unknown, b: unknown): boolean {
  const ca = canonicalOrNull(a);
  return ca !== null && ca === canonicalOrNull(b);
}

/** The new analysis, keeping the previous analysisDate when nothing else changed. */
export function keepDateIfUnchanged(
  prev: PathAnalysis | undefined,
  next: PathAnalysis | undefined,
): PathAnalysis | undefined {
  if (!prev || !next || prev === next) return next;
  if (prev.analysisDate === next.analysisDate) return next;
  return sameContent(analysisWithoutDate(prev), analysisWithoutDate(next))
    ? { ...next, analysisDate: prev.analysisDate }
    : next;
}

// ==================== ATTACK TREES ====================

function commitTrees(
  prev: AttackTreeData | null,
  next: AttackTreeData | null,
  stamp: CalcStamp | undefined,
): AttackTreeData | null {
  if (!next || next === prev) return next;
  const prevById = new Map((prev?.trees ?? []).map((t) => [t.id, t]));
  let changed = false;

  const trees = next.trees.map((tree) => {
    const old = prevById.get(tree.id);
    if (tree === old) return tree;

    let t = tree;
    // Stamp a new or recomputed ISO path analysis.
    if (stamp && t.pathAnalysis && t.pathAnalysis !== old?.pathAnalysis &&
        !sameStamp(t.pathAnalysis.calcStamp, stamp)) {
      t = { ...t, pathAnalysis: { ...t.pathAnalysis, calcStamp: stamp } };
    }
    if (old) {
      if (sameContent(treeWithoutDates(old), treeWithoutDates(t))) {
        t = old;
      } else {
        const analysis = keepDateIfUnchanged(old.pathAnalysis, t.pathAnalysis);
        if (analysis !== t.pathAnalysis) t = { ...t, pathAnalysis: analysis };
      }
    }
    if (t !== tree) changed = true;
    return t;
  });

  // Nothing but dates changed anywhere → keep the previous container too.
  if (prev && trees.every((t, i) => t === prev.trees[i]) &&
      trees.length === prev.trees.length) {
    const { trees: _a, lastModified: _b, ...restNext } = next;
    const { trees: _c, lastModified: _d, ...restPrev } = prev;
    if (sameContent(restNext, restPrev)) return prev;
  }
  return changed ? { ...next, trees } : next;
}

// ==================== RISKS ====================

/** What the stamp vouches for: the computed values and their inputs. */
function computedPart(r: Risk): unknown {
  return {
    factorRatings: r.factorRatings,
    mitigatedFactorRatings: r.mitigatedFactorRatings,
    calculatedImpact: r.calculatedImpact,
    calculatedLikelihood: r.calculatedLikelihood,
    calculatedRiskBeforeMitigation: r.calculatedRiskBeforeMitigation,
    calculatedRiskAfterMitigation: r.calculatedRiskAfterMitigation,
    isoRisk: r.isoRisk,
  };
}

function commitRisks(
  prev: Project["risks"],
  next: Project["risks"],
  stamp: CalcStamp,
): Project["risks"] {
  if (!next || next === prev) return next;
  const prevById = new Map((prev?.risks ?? []).map((r) => [r.id, r]));
  let changed = false;
  const risks = next.risks.map((risk) => {
    const old = prevById.get(risk.id);
    if (risk === old) return risk;
    const recomputed = !old || !sameContent(computedPart(old), computedPart(risk));
    if (!recomputed || sameStamp(risk.calcStamp, stamp)) return risk;
    changed = true;
    return { ...risk, calcStamp: stamp };
  });
  return changed ? { ...next, risks } : next;
}

// ==================== ENTRY POINT ====================

/**
 * Stamps and churn fix for one write. `prev` is the state before the patch;
 * a missing prev or another project id (open, switch, load) changes nothing.
 * Pure; returns the SAME project when nothing changes.
 */
export function commitCalcStamps(
  prev: Project | undefined,
  next: Project,
): Project {
  if (!prev || prev.id !== next.id) return next;
  const touchesTrees = next.attackTrees !== prev.attackTrees;
  const touchesRisks = next.risks !== prev.risks;
  if (!touchesTrees && !touchesRisks) return next;

  const iso =
    regulationPresetFromTags(next.info?.tags ?? EMPTY_PROJECT_TAGS) === ISO_METHOD;

  const attackTrees = touchesTrees
    ? commitTrees(
        prev.attackTrees,
        next.attackTrees,
        iso
          ? pathCalcStamp(
              next.attackTrees?.configuration?.feasibilityConfiguration ??
                DEFAULT_FEASIBILITY_CONFIGURATION,
            )
          : undefined,
      )
    : next.attackTrees;
  const risks =
    iso && touchesRisks
      ? commitRisks(prev.risks, next.risks, riskCalcStamp(next))
      : next.risks;

  return attackTrees === next.attackTrees && risks === next.risks
    ? next
    : { ...next, attackTrees, risks };
}
