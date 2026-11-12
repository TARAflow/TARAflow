// ==================== IMPORTED COMPONENTS IN THE REPORT (6a-1) ====================
// Multi-project TARA phase 6a-1 (design §8.3, E10; review 2026-11-11): the
// report's threat chapters showed none of the imported threats while its
// risk tables listed their risks. Built here, in the app layer, from the
// snapshots — the documentation feature renders it:
//
//   - threats per component, each threat once (the instances of one
//     component share its text); below it only the instances that differ:
//     a relevance override of this TARA, another counterpart on a boundary
//     flow — the picture of the Threats tab (patch 31)
//   - per imported risk the provenance of its rating: instance, commit,
//     factors prefilled from the component, factors this TARA overrode
//     (with the rationale), quantity
//
// Pure; the CLI reporter gets it through the same transform.

import type {
  DocComponentAt,
  DocImportedAttackTree,
  DocImportedComponent,
  DocImportedRiskNote,
  DocImportedThreat,
  DocImportedThreatGroup,
} from "../../features/documentation/models/doc-types";
import { attackPathDisplayId } from "features/attacktree/services/attacktree-threat-generator";
import { componentAttackPathGroups, componentAttackTrees } from "../utils/component-attack-trees";
import { componentTreatments } from "../utils/component-treatments";
import { componentOverviewItems } from "./component-import/component-overview";
import { instanceAssumptions } from "./component-import/assumption-status";
import { flattenProjectTags } from "shared";
import type { Project } from "../models/project-types";
import type { ComponentSource } from "shared";
import { componentFactorPrefills, componentThreatGroups } from "../utils/component-threats";
import { quantityOf } from "./component-import/instance-quantity";

const atOf = (source: ComponentSource): DocComponentAt => ({
  ...(source.tag ? { tag: source.tag } : {}),
  ...(source.commitSha ? { commit: source.commitSha } : {}),
  ...(source.unpinned ? { unpinned: true } : {}),
});

/** "SD1:P2-T-1" → "P2-T-1". */
const withoutPrefix = (displayId: string, prefix: string) =>
  displayId.startsWith(`${prefix}:`) ? displayId.slice(prefix.length + 1) : displayId;

export function docImportedThreats(project: Pick<Project, "components" | "dfd">): DocImportedThreatGroup[] {
  const components = project.components;
  if (!components) return [];
  const groups = componentThreatGroups(project);
  return components.imports.flatMap((imported) => {
    const instances = groups.filter((g) => g.componentKey === imported.id);
    if (instances.length === 0) return [];
    return (["per-element", "per-interaction"] as const).flatMap((method): DocImportedThreatGroup[] => {
      // threat key (id in the component) → the rows of every instance, in instance order
      const byKey = new Map<string, { prefix: string; row: (typeof instances)[number]["rows"][number] }[]>();
      for (const g of instances) {
        for (const row of g.rows.filter((r) => r.method === method)) {
          const list = byKey.get(row.threatKey) ?? [];
          list.push({ prefix: g.prefix, row });
          byKey.set(row.threatKey, list);
        }
      }
      if (byKey.size === 0) return [];
      const threats = [...byKey.values()].map((rows): DocImportedThreat => {
        const first = rows[0].row;
        const t = first.threat;
        // A boundary flow: the machine element at its outer end (patch 32, "↔ PLC") —
        // in the flow's name when all instances share it, else per instance below.
        const counterparts = new Set(rows.map((r) => r.row.counterpart ?? ""));
        const shared = counterparts.size === 1 ? [...counterparts][0] : "";
        return {
          displayId: withoutPrefix(t.displayId, rows[0].prefix),
          instanceIds: rows.map((r) => r.row.threat.displayId),
          strideCategory: t.strideCategory,
          elementOrFlow: `${t.linkedElement?.elementName || t.dataFlow?.dataFlowName || "-"}${shared ? ` ↔ ${shared}` : ""}`,
          ...(t.trustBoundaryName ? { trustBoundary: t.trustBoundaryName } : {}),
          threatDescription: t.threatDescription || "-",
          attackDescription: t.attackDescription || "-",
          proposedMitigations: t.proposedMitigations ?? [],
          proposedVerifications: t.proposedVerifications ?? [],
          relevance: first.componentRelevance ?? "unrated",
          differences: rows
            .map(({ prefix, row }) => ({
              prefix,
              ...(row.override ? { override: { relevance: row.override.relevance ?? "unrated", rationale: row.override.rationale } } : {}),
              // the counterpart only where instances differ in it
              ...(counterparts.size > 1 && row.counterpart ? { counterpart: row.counterpart } : {}),
            }))
            .filter((d) => d.override || d.counterpart),
        };
      });
      return [{ componentName: imported.name, at: atOf(imported.source), method, instances: instances.map((g) => g.prefix), threats }];
    });
  });
}

export function docImportedRiskNotes(project: Pick<Project, "components" | "risks">): Map<string, DocImportedRiskNote> {
  const out = new Map<string, DocImportedRiskNote>();
  const components = project.components;
  if (!components || !project.risks) return out;
  const prefills = componentFactorPrefills(project);
  const importsById = new Map(components.imports.map((i) => [i.id, i]));
  for (const risk of project.risks.risks) {
    // the instance by its display-id prefix ("SD1:…"), unique per machine
    const instance = components.instances.find((i) => risk.threatDisplayId?.startsWith(`${i.prefix}:`));
    const imported = instance && importsById.get(instance.importId);
    if (!instance || !imported) continue;
    const offered = new Set((prefills.get(risk.threatId) ?? []).map((f) => f.factorId));
    const ratings = risk.factorRatings ?? [];
    out.set(risk.id, {
      componentName: imported.name,
      prefix: instance.prefix,
      at: atOf(imported.source),
      quantity: quantityOf(instance),
      prefilled: ratings.filter((f) => f.derivedFrom === "component" && f.source === "derived" && f.value > 0).map((f) => f.factorId),
      overridden: ratings
        .filter((f) => offered.has(f.factorId) && f.source === "manual")
        .map((f) => ({ factorId: f.factorId, ...(f.overrideRationale ? { rationale: f.overrideRationale } : {}) })),
    });
  }
  return out;
}

/** "path-12" → 12; unnumbered ids last (the order of the report's own trees). */
const pathNo = (id: string | undefined): number => {
  const m = /(\d+)\s*$/.exec(id ?? "");
  return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
};

/**
 * The attack trees of the imported components (6a-1b; review 2026-11-11: in
 * an ISO/SAE 21434 machine the component's risks come from its paths, and
 * the window of opportunity per step is this TARA's decision, to be shown
 * in the audit): per component and tree the structure once, the paths per
 * instance with this TARA's feasibility and window per step.
 */
export function docImportedAttackTrees(project: Pick<Project, "components" | "attackTrees">): DocImportedAttackTree[] {
  const components = project.components;
  if (!components) return [];
  const machine = { components, attackTrees: project.attackTrees ?? null };
  const derived = componentAttackTrees(machine);
  const ratings = componentAttackPathGroups(machine);
  return components.imports.flatMap((imported) => {
    const instances = derived.filter((d) => d.imported.id === imported.id);
    const source = (imported.snapshot as { attackTrees?: { trees?: DocImportedAttackTree["tree"][] } | null }).attackTrees?.trees ?? [];
    if (instances.length === 0 || source.length === 0) return [];
    return source.map((tree, index): DocImportedAttackTree => ({
      componentName: imported.name,
      at: atOf(imported.source),
      treeNumber: index + 1,
      tree,
      instances: instances.map(({ instance, trees }) => {
        const mine = trees[index];
        const rows = (ratings.find((g) => g.key === instance.id)?.paths ?? []).filter((r) => r.treeKey === tree.id);
        return {
          prefix: instance.prefix,
          paths: [...(mine?.pathAnalysis?.paths ?? [])]
            .sort((a, b) => pathNo(a.id) - pathNo(b.id))
            .map((p) => ({
              id: `${instance.prefix}:${attackPathDisplayId(index + 1, p)}`,
              chain: [...p.path],
              ...(p.attackPotential != null ? { potential: p.attackPotential } : {}),
              ...(p.feasibilityLevel ? { feasibility: p.feasibilityLevel } : {}),
              relevance: (mine?.pathAssessments ?? [])
                .filter((a) => a.pathKey === p.pathKey)
                .map((a) => ({ relevance: a.relevance, ...(a.strideCategory ? { strideCategory: a.strideCategory } : {}) })),
              steps: rows
                .filter((r) => r.pathKey === p.pathKey)
                .map((r) => ({
                  ...(r.stepName ? { name: r.stepName } : {}),
                  ...(r.machineWindow ? { window: r.machineWindow } : {}),
                  ...(r.componentWindow ? { componentWindow: r.componentWindow } : {}),
                  ...(r.componentFactors ? { componentFactors: { ...r.componentFactors } } : {}),
                  ratable: r.ratable,
                })),
            })),
        };
      }),
    }));
  });
}

/**
 * The chapter "Imported components" (6a-2): per component what the Overview's
 * tab shows (patch 70) plus, per instance, the EE mapping, every assumption
 * with this TARA's decision, and the component's measures that do not count
 * fully here (not effective / unclear, with the reasons — I7).
 */
export function docImportedComponents(project: Pick<Project, "components" | "risks" | "dfd">): DocImportedComponent[] {
  const components = project.components;
  if (!components) return [];
  const machineNames = new Map(((project.dfd?.elements ?? []) as { id: string; displayId?: string; name?: string }[]).map((e) => [e.id, `${e.displayId ? `${e.displayId} ` : ""}${e.name ?? e.id}`]));
  const treatments = [...componentTreatments({ components, risks: project.risks ?? null }).values()];
  const overview = componentOverviewItems({ components, risks: project.risks ?? null });
  return components.imports.flatMap((imported): DocImportedComponent[] => {
    const item = overview.find((o) => o.importId === imported.id);
    if (!item) return [];
    const snapshotEes = new Map(((imported.snapshot as { dfd?: { elements?: { id: string; name?: string }[] } | null }).dfd?.elements ?? []).map((e) => [e.id, e.name ?? e.id]));
    const instances = components.instances.filter((i) => i.importId === imported.id);
    return [
      {
        componentName: item.name,
        ...(item.version ? { version: item.version } : {}),
        ...(item.description ? { description: item.description } : {}),
        ...(item.responsible ? { responsible: item.responsible } : {}),
        tags: item.tags ? flattenProjectTags(item.tags) : [],
        ...(item.safetyRelevant ? { safetyRelevant: true } : {}),
        at: atOf(imported.source),
        origin: {
          ...(item.origin.repoUrl ? { repoUrl: item.origin.repoUrl } : {}),
          ...(item.origin.sameRepo ? { sameRepo: true } : {}),
          ...(item.origin.path ? { path: item.origin.path } : {}),
          ...(item.origin.branch ? { branch: item.origin.branch } : {}),
          importedAt: item.origin.importedAt,
          ...(item.origin.lastUpdateAt ? { lastUpdateAt: item.origin.lastUpdateAt } : {}),
        },
        ...(item.methodologyMatches !== undefined ? { methodologyMatches: item.methodologyMatches } : {}),
        sourceBindings: item.sourceBindings,
        instances: instances.map((instance) => {
          // the component's measures that do not count fully here, once each
          const measures = new Map<string, DocImportedComponent["instances"][number]["measures"][number]>();
          for (const tr of treatments.filter((x) => x.instanceId === instance.id)) {
            for (const m of tr.measures) {
              if (!m.effectiveness || m.effectiveness === "effective") continue;
              const label = m.id ? `${m.id} — ${m.text}` : m.text;
              if (measures.has(label)) continue;
              measures.set(label, {
                label,
                effectiveness: m.effectiveness,
                reasons: (m.reasons ?? []).map((r) => ({ kind: r.kind, ...(r.assumption ?? r.rationale ? { ref: r.assumption ?? r.rationale } : {}) })),
              });
            }
          }
          return {
            prefix: instance.prefix,
            quantity: quantityOf(instance),
            eeMapping: instance.eeMapping.map((m) => ({
              componentEe: snapshotEes.get(m.componentEeId) ?? m.componentEeId,
              machineElement: machineNames.get(m.machineTfId) ?? m.machineTfId,
            })),
            assumptions: instanceAssumptions(instance, imported).map((a) => ({
              displayId: a.displayId,
              text: a.text,
              status: a.status,
              ...(a.rationale ? { rationale: a.rationale } : {}),
            })),
            measures: [...measures.values()],
          };
        }),
      },
    ];
  });
}
