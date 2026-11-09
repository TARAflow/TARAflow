// ==================== COMPONENT FINDINGS ====================
// Multi-project TARA (doc/Open/multi-project-tara-design.md v3, §4.1, §6.3,
// §8.1): findings about the imported components, shown with the DFD's own
// findings (DFD tab). Pure.
//
//   CMP_SOURCE_UNPINNED (warning)  an import that is not pinned to a commit
//   CMP_INSTANCE_ORPHANED (error)  an instance whose multiprocess is not in
//                                  the DFD (deleted, or the DFD save of the
//                                  import was refused)
//   CMP_FLOW_NOT_IN_COMPONENT      a flow on an imported multiprocess that is
//                    (error)       none of the component's boundary flows (Q3)
//   CMP_METHOD_MISMATCH (info)     the component's likelihood methodology
//                                  differs from the machine's (§7.2): only
//                                  identical factors are prefilled
//   CMP_FACTOR_UNRATED (warning)   with a mismatch: imported risks with
//                                  likelihood factors still unrated
//   CMP_FACTOR_OVERRIDE_RATIONALE  a value taken over from the component was
//                    (warning)     overridden without a rationale (§7.2)
//   CMP_NO_ATTACK_PATHS (warning)  an ISO/SAE 21434 machine imports a
//                                  component without attack paths — only
//                                  attack-path threats make risks there, it
//                                  would add none, silently (patch 17)
//   CMP_PATH_WINDOW_UNRATED        ISO: component attack paths without the
//                    (warning)     machine's window of opportunity — unrated,
//                                  they make no risk (§7.2, review 2026-11-07)
//   CMP_PATH_NOT_RATABLE           ISO: quick-mode component paths (no factor
//                    (warning)     breakdown) — the machine cannot rate them,
//                                  they make no risk until the component
//                                  rates them in audit mode
//   CMP_MEASURE_PENDING (warning)  phase 3a, §7.4: imported risks whose
//                                  component measures are not implemented /
//                                  verified yet — they depend on a release
//   CMP_HANDOVER_OPEN (warning)    phase 3a, §7.4: risks the component handed
//                                  over (share / transfer) or accepted arrive
//                                  untreated; open until the machine sets its
//                                  own treatment
//   CMP_MEASURE_NOT_EFFECTIVE      phase 3d-1, I7: a component measure an
//                    (warning)     imported risk relies on is not effective
//                                  here (an assumption not fulfilled, or
//                                  invalid in the component)
//   CMP_MEASURE_UNCLEAR (warning)  … unclear here because an assumption it
//                                  relies on is still open, or fulfilled by
//                                  a machine measure not implemented yet (a
//                                  measure only pending is
//                                  CMP_MEASURE_PENDING)
//   CMP_MEASURE_OVERRIDDEN         phase 3d-2b, I7 (5): component measures
//                    (warning)     this machine marked "not effective here"
//                                  — residual not credited; the signal to
//                                  the component team (an AoU is missing)
//   CMP_MEASURE_OVERRIDE_UNKNOWN   an override naming a measure the
//                    (warning)     component no longer chooses (e.g. after
//                                  an update) — it acts on nothing
//   CMP_ACCEPTANCE_TO_REVIEW       phase 3d-2a, I7 (4): an accepted imported
//                    (warning)     risk whose residual risk is not credited
//                                  (a component measure not effective /
//                                  unclear here) — the acceptance rested on
//                                  it; derived, never stored
//   CMP_AOU_OPEN (warning)         phase 3b, §7.6: assumptions of use still
//                                  open in an instance
//   CMP_AOU_VIOLATED (error)       an assumption not fulfilled — the
//                                  component's analysis is not valid here
//   CMP_AOU_MET_BY_PENDING         "fulfilled" backed by a machine measure
//                    (warning)     not implemented yet (I7 (2))
//   CMP_AOU_EVIDENCE_NOT_CHOSEN    … backed by a measure no machine risk
//                    (warning)     chooses (no status, no ticket)
//   CMP_COMPONENT_PAGE_CHANGED     the component's pages differ from the
//                    (warning)     imported state — elements missing or
//                                  added there (the pages are locked in the
//                                  editor; e.g. edited in external draw.io).
//                                  Repaired with the update path (phase 5).
//
// Also the multiprocesses whose pages belong to a component (renumber skips
// them, §6.6).

import {
  componentInstanceTfId,
  lockedPageIdsOf,
  parseDfd,
  type ValidationFinding,
} from "features/dfd";
import type { Project } from "../../models/project-types";
import { compareFingerprints } from "shared";
import { factorClassOf, getFactorDefinition } from "features/risks";
import { projectMethodologyFingerprint } from "./snapshot-builder";
import { componentPathRatingGaps } from "../../utils/component-attack-trees";
import { componentTreatments, machineDecided, uncreditedResiduals } from "../../utils/component-treatments";
import { acceptanceToReview } from "shared";
import { assumptionGaps } from "./assumption-status";
import { unknownMeasureOverrides } from "./measure-overrides";

export interface ComponentFindings {
  errors: ValidationFinding[];
  warnings: ValidationFinding[];
  infos: ValidationFinding[];
}

const EMPTY: ComponentFindings = { errors: [], warnings: [], infos: [] };
const KEY = (code: string) => `components.findings.${code}`;

export function componentFindings(
  project: Pick<Project, "components" | "dfd"> & Partial<Pick<Project, "risks">>,
): ComponentFindings {
  const components = project.components;
  if (!components || (components.imports.length === 0 && components.instances.length === 0)) return EMPTY;
  const out: ComponentFindings = { errors: [], warnings: [], infos: [] };
  const elements = new Map((project.dfd?.elements ?? []).map((e) => [e.id, e]));
  const importsById = new Map(components.imports.map((i) => [i.id, i]));

  for (const imported of components.imports) {
    if (!imported.source.unpinned) continue;
    const firstMp = components.instances.find((i) => i.importId === imported.id)?.multiprocessTfId;
    out.warnings.push({
      key: KEY("CMP_SOURCE_UNPINNED"),
      ...(firstMp && elements.has(firstMp) ? { elementId: firstMp, displayId: elements.get(firstMp)!.displayId } : {}),
      params: { component: imported.name, reason: imported.source.unpinned },
    });
  }

  // Methodology (§7.2, patch 16).
  const machineFingerprint = project.risks ? projectMethodologyFingerprint({ risks: project.risks }) : null;
  const mismatched = new Set<string>();
  if (machineFingerprint) {
    for (const imported of components.imports) {
      if (compareFingerprints(imported.methodology, machineFingerprint).identical) continue;
      mismatched.add(imported.id);
      out.infos.push({
        key: KEY("CMP_METHOD_MISMATCH"),
        params: { component: imported.name, method: imported.methodology.likelihoodMethod, machineMethod: machineFingerprint.likelihoodMethod },
      });
    }
  }
  const riskConfig = project.risks?.configuration;
  if (riskConfig?.likelihoodMethod === "iso-21434") {
    for (const imported of components.imports) {
      const hasPaths = (imported.snapshot.attackTrees?.trees ?? []).some(
        (t) => t.anchor?.type === "asset" && (t.pathAnalysis?.paths.length ?? 0) > 0,
      );
      if (!hasPaths) {
        out.warnings.push({ key: KEY("CMP_NO_ATTACK_PATHS"), params: { component: imported.name } });
      }
    }
    for (const gap of componentPathRatingGaps({ components })) {
      const params = { prefix: gap.instance.prefix, component: gap.imported.name };
      if (gap.unrated > 0) out.warnings.push({ key: KEY("CMP_PATH_WINDOW_UNRATED"), params: { ...params, count: gap.unrated } });
      if (gap.notRatable > 0) out.warnings.push({ key: KEY("CMP_PATH_NOT_RATABLE"), params: { ...params, count: gap.notRatable } });
    }
  }
  const isLikelihood = (factorId: string) =>
    !!riskConfig && getFactorDefinition(factorId, riskConfig.customFactors)?.category === "likelihood";
  const isIntrinsic = (factorId: string) =>
    !!riskConfig && factorClassOf(getFactorDefinition(factorId, riskConfig.customFactors)) === "intrinsic";
  const risksByThreat = new Map((project.risks?.risks ?? []).map((r) => [r.threatId, r]));

  const treatments = componentTreatments({ components, risks: project.risks ?? null });
  const uncredited = uncreditedResiduals({ components, risks: project.risks ?? null }, treatments);
  for (const instance of components.instances) {
    const imported = importsById.get(instance.importId);
    const name = imported?.name ?? instance.prefix;

    // Measures and handovers of the component (§7.4, phase 3a) — over the
    // imported risks the machine's register holds.
    {
      let pending = 0;
      let handover = 0;
      const toReview: string[] = [];
      const overridden = new Set<string>();
      const notEffective = new Map<string, Set<string>>();
      const unclear = new Map<string, Set<string>>();
      const note = (into: Map<string, Set<string>>, measure: string, assumptions: (string | undefined)[]) => {
        const set = into.get(measure) ?? new Set<string>();
        for (const a of assumptions) if (a) set.add(a);
        into.set(measure, set);
      };
      for (const risk of project.risks?.risks ?? []) {
        const tr = treatments.get(risk.threatId);
        if (!tr || tr.instanceId !== instance.id) continue;
        if (acceptanceToReview(risk, uncredited)) toReview.push(risk.threatDisplayId);
        if (tr.handedOver) {
          if (!machineDecided(risk)) handover++;
          continue;
        }
        if (tr.measures.some((m) => m.state === "pending")) pending++;
        for (const m of tr.measures) {
          const label = m.id ?? m.text;
          if (m.override) overridden.add(label);
          const aouCause = (m.reasons ?? []).some((r) => r.kind === "aou_not_fulfilled" || r.kind === "aou_invalid_in_component");
          if (m.effectiveness === "not_effective" && aouCause) {
            note(notEffective, label, (m.reasons ?? []).filter((r) => r.kind === "aou_not_fulfilled" || r.kind === "aou_invalid_in_component").map((r) => r.assumption));
          } else if (m.effectiveness === "unclear" && (m.reasons ?? []).some((r) => r.kind === "aou_open" || r.kind === "aou_evidence_pending")) {
            note(unclear, label, (m.reasons ?? []).filter((r) => r.kind === "aou_open" || r.kind === "aou_evidence_pending").map((r) => r.assumption));
          }
        }
      }
      const params = { prefix: instance.prefix, component: name };
      const listOf = (m: Map<string, Set<string>>) => [...m.entries()].map(([k, v]) => `${k} (${[...v].join(", ")})`).join("; ");
      if (pending > 0) out.warnings.push({ key: KEY("CMP_MEASURE_PENDING"), params: { ...params, count: pending } });
      if (handover > 0) out.warnings.push({ key: KEY("CMP_HANDOVER_OPEN"), params: { ...params, count: handover } });
      if (notEffective.size > 0) out.warnings.push({ key: KEY("CMP_MEASURE_NOT_EFFECTIVE"), params: { ...params, list: listOf(notEffective) } });
      if (unclear.size > 0) out.warnings.push({ key: KEY("CMP_MEASURE_UNCLEAR"), params: { ...params, list: listOf(unclear) } });
      if (overridden.size > 0) out.warnings.push({ key: KEY("CMP_MEASURE_OVERRIDDEN"), params: { ...params, list: [...overridden].join(", ") } });
      if (imported) {
        const unknown = unknownMeasureOverrides(instance, imported);
        if (unknown.length > 0) out.warnings.push({ key: KEY("CMP_MEASURE_OVERRIDE_UNKNOWN"), params: { ...params, list: unknown.join(", ") } });
      }
      if (toReview.length > 0) out.warnings.push({ key: KEY("CMP_ACCEPTANCE_TO_REVIEW"), params: { ...params, list: toReview.join(", ") } });
    }

    // Assumptions of use per instance (§7.6, phase 3b).
    if (imported) {
      const gaps = assumptionGaps(instance, imported, project.risks?.risks);
      const params = { prefix: instance.prefix, component: name };
      if (gaps.violated.length > 0) {
        out.errors.push({ key: KEY("CMP_AOU_VIOLATED"), params: { ...params, list: gaps.violated.map((a) => a.displayId).join(", ") } });
      }
      if (gaps.open.length > 0) {
        out.warnings.push({ key: KEY("CMP_AOU_OPEN"), params: { ...params, count: gaps.open.length } });
      }
      for (const g of gaps.evidenceNotChosen) {
        out.warnings.push({
          key: KEY("CMP_AOU_EVIDENCE_NOT_CHOSEN"),
          params: { ...params, assumption: g.assumption.displayId, measures: g.mitigationIds.join(", ") },
        });
      }
      for (const g of gaps.metByPending) {
        out.warnings.push({
          key: KEY("CMP_AOU_MET_BY_PENDING"),
          params: { ...params, assumption: g.assumption.displayId, measures: g.mitigationIds.join(", ") },
        });
      }
    }

    // Imported risks: unrated factors (only with a mismatch) and overrides without rationale.
    if (imported) {
      let unrated = 0;
      let withoutRationale = 0;
      for (const sr of imported.snapshot.risks) {
        const risk = risksByThreat.get(componentInstanceTfId(instance.id, `threat|${sr.threatId}`));
        if (!risk) continue;
        if (mismatched.has(imported.id) && risk.factorRatings.some((f) => isLikelihood(f.factorId) && isIntrinsic(f.factorId) && f.value === 0)) unrated++;
        if (risk.factorRatings.some((f) => f.derivedFrom === "component" && f.source === "manual" && f.value !== f.derivedValue && !(f.overrideRationale ?? "").trim())) withoutRationale++;
      }
      if (unrated > 0) {
        out.warnings.push({ key: KEY("CMP_FACTOR_UNRATED"), params: { prefix: instance.prefix, component: name, count: unrated } });
      }
      if (withoutRationale > 0) {
        out.warnings.push({ key: KEY("CMP_FACTOR_OVERRIDE_RATIONALE"), params: { prefix: instance.prefix, component: name, count: withoutRationale } });
      }
    }
    const mp = elements.get(instance.multiprocessTfId);
    if (!mp) {
      out.errors.push({ key: KEY("CMP_INSTANCE_ORPHANED"), params: { prefix: instance.prefix, component: name } });
      continue;
    }
    if (!imported) continue;
    // The instance's boundary flows: component flows between an EE and the component.
    const snapshotDfd = imported.snapshot.dfd;
    const ees = new Set((snapshotDfd?.elements ?? []).filter((e) => e.type === "ExternalEntity").map((e) => e.id));
    const boundary = new Set(
      (snapshotDfd?.connections ?? [])
        .filter((c) => ees.has(c.from) !== ees.has(c.to))
        .map((c) => componentInstanceTfId(instance.id, c.id)),
    );
    for (const c of project.dfd?.connections ?? []) {
      if (c.from !== mp.id && c.to !== mp.id) continue;
      if (boundary.has(c.id)) continue;
      out.errors.push({
        key: KEY("CMP_FLOW_NOT_IN_COMPONENT"),
        elementId: c.id,
        displayId: c.displayId,
        params: { flow: [c.displayId, c.name].filter(Boolean).join(" "), component: name, prefix: instance.prefix },
      });
    }

    const changed = pageChanges(project, instance.id, instance.multiprocessTfId, imported.snapshot.dfd);
    if (changed.missing + changed.added > 0) {
      out.warnings.push({
        key: KEY("CMP_COMPONENT_PAGE_CHANGED"),
        elementId: mp.id,
        displayId: mp.displayId,
        params: { prefix: instance.prefix, component: name, missing: changed.missing, added: changed.added },
      });
    }
  }
  return out;
}

/**
 * How the instance's pages differ from the imported state: component
 * elements / flows missing in the DFD, and definitions on the component's
 * pages that are not the component's (copies of machine elements are fine).
 */
function pageChanges(
  project: Pick<Project, "dfd">,
  instanceId: string,
  multiprocessTfId: string,
  snapshotDfd: { elements?: { id: string; type: string }[]; connections?: { id: string; from: string; to: string }[] } | null | undefined,
): { missing: number; added: number } {
  const dfd = project.dfd;
  if (!dfd?.xml || !snapshotDfd) return { missing: 0, added: 0 };
  const ees = new Set((snapshotDfd.elements ?? []).filter((e) => e.type === "ExternalEntity").map((e) => e.id));
  const expected = new Set<string>();
  for (const e of snapshotDfd.elements ?? []) if (!ees.has(e.id)) expected.add(componentInstanceTfId(instanceId, e.id));
  for (const c of snapshotDfd.connections ?? []) {
    if (ees.has(c.from) && ees.has(c.to)) continue;
    expected.add(componentInstanceTfId(instanceId, c.id));
  }
  const present = new Set([...(dfd.elements ?? []), ...(dfd.connections ?? [])].map((x) => x.id));
  const missing = [...expected].filter((id) => !present.has(id)).length;

  const componentMps = (snapshotDfd.elements ?? [])
    .filter((e) => e.type === "Multiprocess")
    .map((e) => componentInstanceTfId(instanceId, e.id));
  const pages = lockedPageIdsOf(dfd.pages, [multiprocessTfId, ...componentMps]);
  let added = 0;
  if (pages.size > 0) {
    for (const o of parseDfd(dfd.xml, dfd.pages).occurrences) {
      if (pages.has(o.pageId) && o.role === "definition" && !expected.has(o.tfId)) added++;
    }
  }
  return { missing, added };
}

/**
 * The multiprocesses whose pages belong to a component: each instance's
 * multiprocess and the component's own multiprocesses (as machine tfIds).
 */
export function importedMultiprocessIds(project: Pick<Project, "components">): string[] {
  const components = project.components;
  if (!components) return [];
  const importsById = new Map(components.imports.map((i) => [i.id, i]));
  const ids: string[] = [];
  for (const instance of components.instances) {
    ids.push(instance.multiprocessTfId);
    for (const e of importsById.get(instance.importId)?.snapshot.dfd?.elements ?? []) {
      if (e.type === "Multiprocess") ids.push(componentInstanceTfId(instance.id, e.id));
    }
  }
  return ids;
}
