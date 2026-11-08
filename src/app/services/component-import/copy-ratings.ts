// ==================== COPY RATINGS BETWEEN INSTANCES ====================
// Multi-project TARA, I5 (user 2026-11-08, scope reviewed by the second
// instance): units of one component in different installation contexts
// are separate instances with their own ratings. Often only a part of the
// context differs, so the machine may copy the ratings of one instance to
// another — once, explicitly; afterwards the instances are independent (no
// live coupling, no inheritance level). Pure.
//
//   decisions (default on)  likelihood factor ratings of the imported risks
//                           (context factors and the overrides of prefilled
//                           intrinsic factors with their rationale), the
//                           relevance overrides on boundary flows, the
//                           window of opportunity per attack path
//   asset impact (off)      impact ratings of the instance assets and the
//                           impact factors of the imported risks
//   mode                    "fill": only what the target has not rated;
//                           "overwrite": the source's values replace the
//                           target's (what the source has not rated stays)
//
// Only the machine's DECISIONS are copied (review 2026-11-08): factor
// ratings with source "manual" (incl. the overrides of prefilled factors with
// their rationale) or without a source (rated by hand where nothing is
// derived). Derived values ("derived" — Asset Tab, DFD, e.g. the EN 50742
// exposure level from the anchor's boundary crossing; "attack-tree") belong
// to the target's own context: the sync derives them for the target.
//
// Only instances of the same import: threat keys, path keys and factors
// match only within one state of the component. Risk treatment (measures)
// stays out — it is a decision per risk (phase 3).

import type { Asset, AssetData } from "features/assets";
import { assetService } from "features/assets";
import { componentInstanceTfId, instanceAssetId } from "features/dfd";
import { getFactorDefinition } from "features/risks";
import type { Project } from "../../models/project-types";
import { overlayKey } from "./path-overlays";

type Components = NonNullable<Project["components"]>;
type Risks = NonNullable<Project["risks"]>;
type Risk = Risks["risks"][number];
type Rating = Risk["factorRatings"][number];

export interface CopyRatingsOptions {
  decisions: boolean;
  assetImpact: boolean;
  mode: "fill" | "overwrite";
}

export interface CopyRatingsCounts {
  factors: number;
  relevanceOverrides: number;
  pathOverlays: number;
  assetRatings: number;
}

export interface CopyRatingsResult {
  components: Components;
  /** Changed risk list; null = risks unchanged. Values recalculated by the caller's recalc. */
  risks: Risk[] | null;
  /** Changed asset data; null = assets unchanged. */
  assets: AssetData | null;
  counts: CopyRatingsCounts;
}

/** The instances a target can copy from: the same import, not itself. */
export function copySourcesOf(components: Components, targetId: string): Components["instances"] {
  const target = components.instances.find((i) => i.id === targetId);
  if (!target) return [];
  return components.instances.filter((i) => i.id !== targetId && i.importId === target.importId);
}

const unrated = (r: Rating | undefined) => !r || r.value === null || r.value === undefined || r.value === 0;
/** A machine decision — not a value derived from the instance's own context. */
const decided = (r: Rating) => r.source === undefined || r.source === "manual";

export function copyInstanceRatings(
  project: Pick<Project, "components" | "risks" | "assets">,
  sourceId: string,
  targetId: string,
  options: CopyRatingsOptions,
  recalc: (risk: Risk) => Risk = (r) => r,
): CopyRatingsResult {
  const components = project.components;
  if (!components) throw new Error("No imported components.");
  const source = components.instances.find((i) => i.id === sourceId);
  const target = components.instances.find((i) => i.id === targetId);
  if (!source || !target) throw new Error("Unknown instance.");
  if (source.importId !== target.importId) throw new Error("Ratings are copied between instances of the same import only.");
  const imported = components.imports.find((i) => i.id === source.importId);
  const counts: CopyRatingsCounts = { factors: 0, relevanceOverrides: 0, pathOverlays: 0, assetRatings: 0 };
  const fill = options.mode === "fill";

  // ── decisions: overrides and windows of opportunity ────────────────────
  let nextTarget = target;
  if (options.decisions) {
    const mergeBy = <T,>(own: readonly T[] | undefined, theirs: readonly T[] | undefined, key: (x: T) => string, count: (n: number) => void) => {
      const out = new Map((own ?? []).map((x) => [key(x), x]));
      let n = 0;
      for (const x of theirs ?? []) {
        if (fill && out.has(key(x))) continue;
        if (JSON.stringify(out.get(key(x))) === JSON.stringify(x)) continue;
        out.set(key(x), x);
        n++;
      }
      count(n);
      return [...out.values()];
    };
    const overrides = mergeBy(target.relevanceOverrides, source.relevanceOverrides, (o) => o.threatKey, (n) => (counts.relevanceOverrides = n));
    const overlays = mergeBy(target.pathOverlays, source.pathOverlays, overlayKey, (n) => (counts.pathOverlays = n));
    const { relevanceOverrides: _r, pathOverlays: _p, ...rest } = target;
    nextTarget = {
      ...rest,
      ...(overrides.length > 0 ? { relevanceOverrides: overrides } : {}),
      ...(overlays.length > 0 ? { pathOverlays: overlays } : {}),
    };
  }

  // ── risks: factor ratings per imported threat ──────────────────────────
  let risks: Risk[] | null = null;
  const config = project.risks?.configuration;
  if (project.risks && config && imported && (options.decisions || options.assetImpact)) {
    const category = (factorId: string) => getFactorDefinition(factorId, config.customFactors)?.category;
    const copies = (factorId: string) =>
      (options.decisions && category(factorId) === "likelihood") || (options.assetImpact && category(factorId) === "impact");
    const byThreat = new Map(project.risks.risks.map((r) => [r.threatId, r]));
    const replaced = new Map<string, Risk>();
    // every imported threat (the machine's risks exist for what is relevant
    // in the machine, whatever risks the component had)
    const tables = [...(imported.snapshot.threats?.perElementTables ?? []), ...(imported.snapshot.threats?.perInteractionTables ?? [])];
    const keys = [...new Set(tables.flatMap((tb) => tb.threats.map((th) => th.id)))];
    for (const key of keys) {
      const from = byThreat.get(componentInstanceTfId(source.id, `threat|${key}`));
      const to = byThreat.get(componentInstanceTfId(target.id, `threat|${key}`));
      if (!from || !to) continue;
      const theirs = new Map(from.factorRatings.map((f) => [f.factorId, f]));
      let changed = 0;
      const ratings = to.factorRatings.map((f) => {
        const t = theirs.get(f.factorId);
        if (!t || unrated(t) || !decided(t) || !copies(f.factorId)) return f;
        if (fill && !unrated(f)) return f;
        if (JSON.stringify(t) === JSON.stringify(f)) return f;
        changed++;
        return { ...t };
      });
      if (changed > 0) {
        counts.factors += changed;
        replaced.set(to.id, recalc({ ...to, factorRatings: ratings }));
      }
    }
    if (replaced.size > 0) risks = project.risks.risks.map((r) => replaced.get(r.id) ?? r);
  }

  // ── asset impact of the instance assets ────────────────────────────────
  let assets: AssetData | null = null;
  if (options.assetImpact && project.assets && imported) {
    let data = project.assets;
    for (const a of imported.snapshot.assets) {
      const from = data.assets.find((x) => x.id === instanceAssetId(source.id, a.id));
      const to = data.assets.find((x) => x.id === instanceAssetId(target.id, a.id));
      if (!from || !to) continue;
      const theirs = new Map(from.impactRatings.map((r) => [r.criterionId, r]));
      let changed = 0;
      const impactRatings = to.impactRatings.map((r) => {
        const t = theirs.get(r.criterionId);
        if (!t || t.value === null || t.value === undefined) return r;
        if (fill && r.value !== null && r.value !== undefined) return r;
        if (t.value === r.value) return r;
        changed++;
        return { ...r, value: t.value };
      });
      // criteria the target has no row for yet (e.g. imported before patch 28)
      for (const t of from.impactRatings) {
        if (impactRatings.some((r) => r.criterionId === t.criterionId) || t.value === null || t.value === undefined) continue;
        impactRatings.push({ ...t });
        changed++;
      }
      if (changed > 0) {
        counts.assetRatings += changed;
        data = assetService.updateAsset(data, { ...to, impactRatings } as Asset);
      }
    }
    if (counts.assetRatings > 0) assets = data;
  }

  return {
    components: { ...components, instances: components.instances.map((i) => (i.id === targetId ? nextTarget : i)) },
    risks,
    assets,
    counts,
  };
}
