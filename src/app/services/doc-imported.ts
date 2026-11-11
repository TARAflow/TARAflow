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

import type { DocComponentAt, DocImportedRiskNote, DocImportedThreat, DocImportedThreatGroup } from "../../features/documentation/models/doc-types";
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
        const counterparts = new Set(rows.map((r) => r.row.counterpart ?? ""));
        return {
          displayId: withoutPrefix(t.displayId, rows[0].prefix),
          instanceIds: rows.map((r) => r.row.threat.displayId),
          strideCategory: t.strideCategory,
          elementOrFlow: t.linkedElement?.elementName || t.dataFlow?.dataFlowName || "-",
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
