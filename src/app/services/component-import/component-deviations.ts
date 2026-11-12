// ==================== DEVIATIONS FROM A COMPONENT (6a-3) ====================
// Multi-project TARA phase 6a-3: what this TARA decided differently from each
// imported component — the list for the component's platform team
// (shared/services/component-deviations.ts renders it; the report and the
// Overview's "Copy as text" use it). Derived from the stored decisions and
// the snapshot; nothing new is stored.

import type { AssumptionEvidence, ComponentDeviation } from "shared/services/component-deviations";
import type { ComponentAssumptionStatus } from "shared";
import { instanceAssetId } from "features/dfd";
import { threatGoalFindings } from "features/assets/services/asset-threat-crosscheck";
import type { Project } from "../../models/project-types";
import { buildThreatGoalLinks } from "../../utils/build-threat-goal-links";
import { componentFactorPrefills, componentThreatGroups, withComponentThreats } from "../../utils/component-threats";
import { componentTreatments } from "../../utils/component-treatments";
import { chosenMachineMeasures, implementedMachineMeasures, instanceAssumptions, projectMeasureOptions } from "./assumption-status";

type Machine = Pick<Project, "components" | "risks" | "dfd" | "threats" | "assets" | "attackTrees">;

/**
 * The evidence of an assumption as a reader needs it: this TARA's measures
 * with their state (implemented / not implemented yet / chosen by no risk),
 * its elements by name, the note. Undefined without evidence.
 */
export function assumptionEvidenceOf(project: Pick<Project, "risks" | "threats" | "dfd">): (e: ComponentAssumptionStatus["evidence"]) => AssumptionEvidence | undefined {
  const labels = new Map(projectMeasureOptions({ risks: project.risks ?? null, threats: project.threats ?? null }).map((m) => [m.id, m.label]));
  const done = implementedMachineMeasures(project.risks?.risks);
  const chosen = chosenMachineMeasures(project.risks?.risks);
  const names = new Map((project.dfd?.elements ?? []).map((e) => [e.id, `${e.displayId ? `${e.displayId} ` : ""}${e.name ?? e.id}`]));
  return (e) =>
    e && ((e.mitigationIds?.length ?? 0) > 0 || (e.elementIds?.length ?? 0) > 0 || e.note)
      ? {
          measures: (e.mitigationIds ?? []).map((id) => ({
            label: labels.get(id) ?? id,
            state: done.has(id) ? ("implemented" as const) : chosen.has(id) ? ("pending" as const) : ("not_chosen" as const),
          })),
          elements: (e.elementIds ?? []).map((id) => names.get(id) ?? id),
          ...(e.note ? { note: e.note } : {}),
        }
      : undefined;
}

/** Import id → the deviations of its instances, in instance order. */
export function componentDeviations(project: Machine): Map<string, ComponentDeviation[]> {
  const out = new Map<string, ComponentDeviation[]>();
  const components = project.components;
  if (!components) return out;
  const evidenceOf = assumptionEvidenceOf(project);
  const rows = componentThreatGroups(project);
  const treatments = [...componentTreatments({ components, risks: project.risks ?? null }).values()];
  const assets = project.assets?.assets ?? [];
  // Goals added without a threat of the component: only the component can add one (patch 51).
  const links = buildThreatGoalLinks({
    threats: withComponentThreats(project.threats, project),
    assets,
    dfdElements: project.dfd?.elements,
    attackTrees: project.attackTrees,
    disabledStrideMethods: [],
  });
  const noThreat = new Set(
    threatGoalFindings(assets, links)
      .filter((f) => f.code === "GOAL_WITHOUT_THREAT")
      .map((f) => `${f.assetId}|${f.goal}`),
  );
  const importsById = new Map(components.imports.map((i) => [i.id, i]));
  // The component's intrinsic factor values a risk was prefilled with (§7.2).
  const prefills = componentFactorPrefills({ components, risks: project.risks ?? null });

  for (const instance of components.instances) {
    const imported = importsById.get(instance.importId);
    if (!imported) continue;
    const list = out.get(imported.id) ?? [];
    const prefix = instance.prefix;
    const snapshot = imported.snapshot;

    // goals this TARA added to a component asset
    for (const a of snapshot.assets) {
      const own = new Set((a.securityGoals ?? []).filter((g) => g.level && g.level !== "none").map((g) => g.type));
      const mine = assets.find((x) => x.id === instanceAssetId(instance.id, a.id));
      for (const g of mine?.securityGoals ?? []) {
        if (!g.level || g.level === "none" || own.has(g.type)) continue;
        list.push({
          kind: "goal_added",
          prefix,
          asset: `${mine!.displayId ? `${mine!.displayId} ` : ""}${mine!.name}`,
          goal: g.type,
          level: g.level,
          ...(g.rationale ? { rationale: g.rationale } : {}),
          revision: noThreat.has(`${mine!.id}|${g.type}`),
        });
      }
    }

    // measures marked "not effective here"
    for (const o of instance.measureOverrides ?? []) {
      const m = treatments.filter((tr) => tr.instanceId === instance.id).flatMap((tr) => tr.measures).find((x) => x.id === o.measureId);
      list.push({ kind: "measure_not_effective", prefix, measure: m ? `${o.measureId} — ${m.text}` : o.measureId, rationale: o.rationale });
    }

    // assumptions of use not fulfilled
    for (const a of instanceAssumptions(instance, imported).filter((x) => x.status === "not_fulfilled")) {
      const evidence = evidenceOf(a.evidence);
      list.push({
        kind: "assumption_not_fulfilled",
        prefix,
        assumption: `${a.displayId} ${a.text}`,
        ...(a.rationale ? { rationale: a.rationale } : {}),
        ...(evidence ? { evidence } : {}),
      });
    }

    // threat relevances overridden (boundary flows)
    const instanceRows = rows.find((g) => g.key === instance.id)?.rows ?? [];
    for (const o of instance.relevanceOverrides ?? []) {
      const row = instanceRows.find((r) => r.threatKey === o.threatKey);
      list.push({
        kind: "relevance_overridden",
        prefix,
        threat: row ? `${row.threat.displayId} ${row.threat.threatDescription ?? ""}`.trim() : o.threatKey,
        from: o.componentRelevance,
        to: o.relevance,
        rationale: o.rationale,
      });
    }

    // intrinsic factors of the component this TARA rated anew (review 2026-11-12)
    for (const risk of (project.risks?.risks ?? []).filter((r) => r.threatDisplayId?.startsWith(`${prefix}:`))) {
      const offered = new Map((prefills.get(risk.threatId) ?? []).map((f) => [f.factorId, f.value]));
      for (const f of risk.factorRatings ?? []) {
        const from = offered.get(f.factorId);
        if (from === undefined || f.source !== "manual" || f.value === from) continue;
        list.push({
          kind: "factor_overridden",
          prefix,
          risk: `${risk.threatDisplayId} ${risk.threatDescription ?? ""}`.trim(),
          factor: f.factorId,
          from,
          to: f.value,
          ...(f.overrideRationale ? { rationale: f.overrideRationale } : {}),
        });
      }
    }

    // supporting claims cited — not a deviation, listed apart
    for (const c of instance.citedClaims ?? []) {
      const claim = (snapshot.concept?.claims ?? []).find((x) => x.id === c.claimId);
      list.push({ kind: "claim_cited", prefix, claim: claim ? `${claim.displayId} ${claim.statement}` : c.claimId, requirements: [...c.requirements] });
    }
    out.set(imported.id, list);
  }
  return out;
}
