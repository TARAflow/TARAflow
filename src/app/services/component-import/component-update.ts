// ==================== COMPONENT UPDATE ====================
// Multi-project TARA phase 5c (design §9.2; decided 2026-11-09: per IMPORT —
// every instance at once —, applied as ONE change = one commit, rollback by
// git revert, "discard update" before saving). Pure: the project before →
// the project after, plus what the preview and the commit message list.
//
//   DFD        each instance's pages replaced with the SAME instance id
//              (replaceComponentInstance): what the new state still has
//              keeps its machine id, so the machine's decisions on it stay
//   decisions  per DECISION_KINDS (update-inventory): take over / review /
//              orphaned; a PAIRED threat or path (the analyst says "this
//              obsolete one is that new one") moves its decisions to the new
//              key and puts them to review, the review entry under the NEW
//              key with the basis of the OLD state (review 2026-11-09) —
//              otherwise a paired decision would look taken over unchanged
//   stores     instance assets: the component's parts from the new state,
//              the machine's impact and added goals kept; new assets as on
//              import; removed ones purged (with their relations, hazard
//              links, risk links). The component's relations replaced. Risks
//              of removed threats go (with the concept's references); risks
//              of paired threats move. The machine's own threats on removed
//              boundary flows go with their risks.
//   import     the new snapshot, hash, source and methodology
//
// Everything DERIVED recomputes from the new snapshot by itself.

import type { ComponentInstance } from "shared";
import { replaceComponentInstance, componentInstanceTfId, instanceAssetId } from "features/dfd";
import { buildThreatId } from "features/attacktree";
import { generateRiskId } from "features/risks";
import type { Asset } from "features/assets";
import type { Project } from "../../models/project-types";
import type { ComponentSnapshot } from "../../models/component-snapshot-types";
import type { ComponentSourceOk } from "./component-source";
import { purgeAssetFromProject } from "../asset-deletion";
import { instanceAssetRecords } from "./import-flow";
import { instanceLabel } from "./instance-quantity";
import {
  DECISION_KINDS,
  decisionDelta,
  instanceThreatKeys,
  nextReviewBasis,
  reviewKey,
  snapshotDelta,
  type DecisionChange,
  type DecisionKind,
  type SnapshotDelta,
} from "./update-inventory";
import { overlayKey } from "./path-overlays";

export interface ComponentUpdatePairing {
  /** Obsolete threat id → new threat id (component terms). */
  threats?: Readonly<Record<string, string>>;
  /** Obsolete "tree|pathKey" → new "tree|pathKey". */
  paths?: Readonly<Record<string, string>>;
  /**
   * Obsolete boundary flow id → new one (review of patch 59): the machine's
   * own threats on it (victimRole) move with their risks, ratings, measures
   * and tickets instead of being dropped.
   */
  flows?: Readonly<Record<string, string>>;
}

export interface ComponentUpdateInput {
  project: Project;
  importId: string;
  /** The new state, read like an import (readComponentSource). */
  result: Pick<ComponentSourceOk, "snapshot" | "contentHash" | "source" | "methodology">;
  pairing?: ComponentUpdatePairing;
  /** Per instance: the mapping of component EEs new in this state (absent = taken over as a new EE). */
  newEeMappings?: Readonly<Record<string, Readonly<Record<string, string | undefined>>>>;
  /** ISO timestamp of the update. */
  updatedAt: string;
}

export interface InstanceUpdateSummary {
  instanceId: string;
  label: string;
  decisions: DecisionChange[];
  /** Decisions moved by the pairing: kind, old key → new key (to review). */
  paired: { kind: DecisionKind; from: string; to: string }[];
}

export interface ComponentUpdateResult {
  project: Project;
  delta: SnapshotDelta;
  instances: InstanceUpdateSummary[];
  /** Lines for the commit message: what the update dropped (orphaned decisions, lost tickets). */
  commitLines: string[];
}

type Components = NonNullable<Project["components"]>;
type Snap = ComponentSnapshot;

const dfdOf = (s: Snap) => ({
  xml: s.dfd?.xml ?? "",
  pages: s.dfd?.pages,
  elements: s.dfd?.elements ?? [],
  connections: s.dfd?.connections ?? [],
  assets: s.dfd?.assets,
});

/** Paired key of a decision (component terms), or undefined. */
function pairedKey(kind: DecisionKind, key: string, pairing: ComponentUpdatePairing): string | undefined {
  const threats = pairing.threats ?? {};
  const paths = pairing.paths ?? {};
  if (kind === "relevanceOverride") return threats[key];
  if (kind === "boundaryThreat") return pairing.flows?.[key];
  if (kind === "riskRating" || kind === "riskTreatment" || kind === "conceptRiskRef") {
    const [k, a, b, c] = key.split("|");
    if (k === "threat" && threats[a]) return `threat|${threats[a]}`;
    if (k === "path" && paths[`${a}|${b}`]) return `path|${paths[`${a}|${b}`]}|${c}`;
  }
  if (kind === "pathOverlay") {
    const [tree, pathKey, leaf] = key.split("|");
    const to = paths[`${tree}|${pathKey}`];
    if (to) return `${to}|${leaf ?? ""}`;
  }
  return undefined;
}

/** The machine threat id of a component risk key in one instance. */
function machineThreatId(instanceId: string, key: string): string | undefined {
  const [k, a, b, c] = key.split("|");
  if (k === "threat") return componentInstanceTfId(instanceId, `threat|${a}`);
  if (k === "path") return buildThreatId(componentInstanceTfId(instanceId, `tree|${a}`), b, c as "S");
  return undefined;
}

export function applyComponentUpdate(input: ComponentUpdateInput): ComponentUpdateResult {
  const { importId, result, updatedAt } = input;
  const pairing = input.pairing ?? {};
  let project = input.project;
  const components = project.components;
  const imported = components?.imports.find((i) => i.id === importId);
  if (!components || !imported) throw new Error(`import ${importId} not found`);
  const oldSnap = imported.snapshot as Snap;
  const newSnap = result.snapshot;
  const delta = snapshotDelta(oldSnap, newSnap);
  const instances = components.instances.filter((i) => i.importId === importId);
  const summaries: InstanceUpdateSummary[] = [];
  const nextInstances = new Map<string, ComponentInstance>();

  // ── decisions per instance (against the project BEFORE the update) ────
  const riskMoves = new Map<string, string>(); // machine threat id old → new
  const riskDrops = new Set<string>(); // machine threat ids whose risks go
  for (const instance of instances) {
    const decisions = decisionDelta(project, instance, oldSnap, newSnap);
    const paired: InstanceUpdateSummary["paired"] = [];
    const extraReview: Record<string, string> = {};
    for (const d of decisions) {
      if (d.outcome !== "orphaned") continue;
      const to = pairedKey(d.kind, d.key, pairing);
      if (to && DECISION_KINDS[d.kind].basis(newSnap, to) !== undefined) {
        paired.push({ kind: d.kind, from: d.key, to });
        // A paired decision rests on another threat / path — always to review,
        // even when the two bases happen to be equal (a rename) or the kind
        // has none: the "paired:" basis never equals a current one, so the
        // review stays open until the analyst confirms.
        const before = DECISION_KINDS[d.kind].basis(oldSnap, d.key);
        extraReview[reviewKey(d.kind, to)] = `paired:${before ?? ""}`;
      }
    }
    const pairedFrom = new Set(paired.map((p) => `${p.kind}|${p.from}`));
    const effective = decisions.filter((d) => !(d.outcome === "orphaned" && pairedFrom.has(`${d.kind}|${d.key}`)));
    for (const d of effective) {
      if ((d.kind === "riskRating" || d.kind === "riskTreatment") && d.outcome === "orphaned") {
        const id = machineThreatId(instance.id, d.key);
        if (id) riskDrops.add(id);
      }
    }
    for (const p of paired) {
      if (p.kind !== "riskRating" && p.kind !== "riskTreatment") continue;
      const from = machineThreatId(instance.id, p.from);
      const to = machineThreatId(instance.id, p.to);
      if (from && to) riskMoves.set(from, to);
    }
    // the machine's risks on threats the new state no longer has go too (also unrated ones)
    const newKeys = instanceThreatKeys(instance.id, newSnap);
    for (const [tfId] of instanceThreatKeys(instance.id, oldSnap)) if (!newKeys.has(tfId) && !riskMoves.has(tfId)) riskDrops.add(tfId);

    const orphaned = (kind: DecisionKind) => new Set(effective.filter((d) => d.kind === kind && d.outcome === "orphaned").map((d) => d.key));
    const moved = (kind: DecisionKind) => new Map(paired.filter((p) => p.kind === kind).map((p) => [p.from, p.to]));
    const relGone = orphaned("relevanceOverride");
    const relMoved = moved("relevanceOverride");
    const overlayGone = orphaned("pathOverlay");
    const overlayMoved = moved("pathOverlay");
    const aouGone = orphaned("aouStatus");
    const measureGone = orphaned("measureOverride");
    const claimGone = orphaned("citedClaim");
    const eeGone = orphaned("eeMapping");
    const newMapping = input.newEeMappings?.[instance.id] ?? {};

    const reviewBasis = nextReviewBasis(instance, effective, newSnap);
    const mergedReview = { ...(reviewBasis ?? {}), ...extraReview };
    const next: ComponentInstance = {
      ...instance,
      eeMapping: [
        ...instance.eeMapping.filter((e) => !eeGone.has(e.componentEeId)),
        ...delta.newEes.flatMap((ee) => (newMapping[ee] ? [{ componentEeId: ee, machineTfId: newMapping[ee]! }] : [])),
      ],
      assumptions: (instance.assumptions ?? []).filter((a) => !aouGone.has(a.assumptionId)),
    };
    const relevanceOverrides = (instance.relevanceOverrides ?? [])
      .filter((o) => !relGone.has(o.threatKey) || relMoved.has(o.threatKey))
      .map((o) => (relMoved.has(o.threatKey) ? { ...o, threatKey: relMoved.get(o.threatKey)! } : o));
    const pathOverlays = (instance.pathOverlays ?? [])
      .filter((o) => !overlayGone.has(overlayKey(o)) || overlayMoved.has(overlayKey(o)))
      .map((o) => {
        const to = overlayMoved.get(overlayKey(o));
        if (!to) return o;
        const [treeKey, pathKey, leafId] = to.split("|");
        return { ...o, treeKey, pathKey, ...(leafId ? { leafId } : {}) };
      });
    const measureOverrides = (instance.measureOverrides ?? []).filter((o) => !measureGone.has(o.measureId));
    const citedClaims = (instance.citedClaims ?? []).filter((c) => !claimGone.has(c.claimId));
    const {
      relevanceOverrides: _r,
      pathOverlays: _p,
      measureOverrides: _m,
      citedClaims: _c,
      reviewBasis: _b,
      ...base
    } = next;
    nextInstances.set(instance.id, {
      ...base,
      ...(relevanceOverrides.length > 0 ? { relevanceOverrides } : {}),
      ...(pathOverlays.length > 0 ? { pathOverlays } : {}),
      ...(measureOverrides.length > 0 ? { measureOverrides } : {}),
      ...(citedClaims.length > 0 ? { citedClaims } : {}),
      ...(Object.keys(mergedReview).length > 0 ? { reviewBasis: mergedReview } : {}),
    });
    summaries.push({ instanceId: instance.id, label: instanceLabel(instance, imported.name), decisions: effective, paired });
  }

  // ── DFD: each instance's pages replaced, same instance id ──────────────
  let dfd = project.dfd!;
  const insertedByInstance = new Map<string, ReturnType<typeof replaceComponentInstance>>();
  for (const instance of instances) {
    const next = nextInstances.get(instance.id)!;
    const mapping: Record<string, string | undefined> = Object.fromEntries(next.eeMapping.map((e) => [e.componentEeId, e.machineTfId]));
    const r = replaceComponentInstance({
      machine: { xml: dfd.xml ?? "", pages: dfd.pages, elements: dfd.elements ?? [], connections: dfd.connections ?? [], assets: dfd.assets },
      oldComponent: dfdOf(oldSnap),
      component: dfdOf(newSnap),
      instanceId: instance.id,
      prefix: instance.prefix,
      eeMapping: mapping,
    });
    insertedByInstance.set(instance.id, r);
    // EEs new in this state and not mapped were taken over as new machine EEs: record their mapping
    const taken = delta.newEes.filter((ee) => !mapping[ee]).map((ee) => ({ componentEeId: ee, machineTfId: r.idMap[ee] }));
    if (taken.length > 0) nextInstances.set(instance.id, { ...next, eeMapping: [...next.eeMapping, ...taken] });
    dfd = {
      ...dfd,
      xml: r.xml,
      pages: r.pages,
      elements: [...r.remaining.elements, ...r.elements],
      connections: [...r.remaining.connections, ...r.connections],
      assets: [...r.remaining.assets, ...r.assets],
    } as typeof dfd;
  }
  project = { ...project, dfd };

  // ── asset store: component parts new, the machine's ratings kept ───────
  const oldAssetIds = new Set(oldSnap.assets.map((a) => a.id));
  const newAssetIds = new Set(newSnap.assets.map((a) => a.id));
  let assets = project.assets;
  if (assets) {
    const byId = new Map(assets.assets.map((a) => [a.id, a]));
    const records: Asset[] = [];
    for (const instance of instances) {
      const inserted = insertedByInstance.get(instance.id)!;
      const fresh = instanceAssetRecords(newSnap, instance.id, instance.prefix, `${instance.prefix} · ${imported.name}`, inserted, assets.configuration);
      for (const rec of fresh) {
        const own = byId.get(rec.id);
        if (!own) {
          records.push(rec);
          continue;
        }
        // the component's: name, group, description, links, its goals' requirement text; the machine's: impact, levels, added goals
        const ownGoals = new Map(own.securityGoals.map((g) => [g.type, g]));
        const goals = rec.securityGoals.map((g) => {
          const mine = ownGoals.get(g.type);
          return mine ? { ...mine, formalDescription: g.formalDescription } : g;
        });
        const added = own.securityGoals.filter((g) => !rec.securityGoals.some((x) => x.type === g.type));
        records.push({
          ...own,
          name: rec.name,
          assetGroup: rec.assetGroup,
          properties: { ...own.properties, ...rec.properties },
          linkedDFDElements: rec.linkedDFDElements,
          securityGoals: [...goals, ...added],
        });
      }
    }
    const replaced = new Set(records.map((r) => r.id));
    assets = { ...assets, assets: [...assets.assets.filter((a) => !replaced.has(a.id)), ...records] };
    // the component's relations: the old state's go, the new state's come (ids per instance)
    const oldRel = new Set(instances.flatMap((i) => (oldSnap.assetRelations ?? []).map((r) => componentInstanceTfId(i.id, `rel|${r.id}`))));
    const newRel = instances.flatMap((i) =>
      (newSnap.assetRelations ?? []).map((r) => ({
        ...r,
        id: componentInstanceTfId(i.id, `rel|${r.id}`),
        sourceAssetId: instanceAssetId(i.id, r.sourceAssetId),
        targetAssetId: instanceAssetId(i.id, r.targetAssetId),
      })),
    );
    const relations = [...(assets.relations ?? []).filter((r) => !oldRel.has(r.id)), ...newRel];
    assets = { ...assets, ...(relations.length > 0 ? { relations } : {}) };
    project = { ...project, assets };
    // removed assets: purged like a deleted asset (relations, hazard links, risk links)
    for (const instance of instances) {
      for (const id of oldAssetIds) {
        if (newAssetIds.has(id)) continue;
        const assetId = instanceAssetId(instance.id, id);
        if (!project.assets?.assets.some((a) => a.id === assetId)) continue;
        try {
          project = { ...project, ...purgeAssetFromProject(project, assetId) };
        } catch {
          // blocked by an attack-tree anchor: stays, listed by the findings
        }
      }
    }
  }

  // ── risks and the concept's references ─────────────────────────────────
  if (project.risks) {
    const dropIds = new Set((project.risks.risks ?? []).filter((r) => riskDrops.has(r.threatId)).map((r) => r.id));
    const idMoves = new Map<string, string>();
    const risks = (project.risks.risks ?? [])
      .filter((r) => !dropIds.has(r.id))
      .map((r) => {
        const to = riskMoves.get(r.threatId);
        if (!to) return r;
        const id = generateRiskId(to);
        idMoves.set(r.id, id);
        return { ...r, id, threatId: to };
      });
    project = { ...project, risks: { ...project.risks, risks } };
    const concept = project.cybersecurityConcept;
    if (concept && (dropIds.size > 0 || idMoves.size > 0)) {
      const fix = (ids: string[]) => ids.filter((id) => !dropIds.has(id)).map((id) => idMoves.get(id) ?? id);
      project = {
        ...project,
        cybersecurityConcept: {
          ...concept,
          goals: concept.goals.map((g) => ({ ...g, riskIds: fix(g.riskIds) })),
          claims: concept.claims.map((c) => ({ ...c, riskIds: fix(c.riskIds) })),
        },
      };
    }
  }

  // ── the machine's own threats on boundary flows: paired ones move ──────
  // (their ids stay — only the flow they name changes —, so their risks,
  // ratings, measures and tickets stay with them), on removed ones they go
  const flowMoves = new Map<string, string>();
  for (const s of summaries) {
    for (const pr of s.paired.filter((x) => x.kind === "boundaryThreat")) {
      flowMoves.set(componentInstanceTfId(s.instanceId, pr.from), componentInstanceTfId(s.instanceId, pr.to));
    }
  }
  if (flowMoves.size > 0 && project.threats) {
    const move = <T extends { threats: unknown[] }>(tables: T[]) =>
      tables.map((t) => ({
        ...t,
        threats: t.threats.map((th) => {
          const x = th as { dataFlow?: { connectionId?: string } | null; linkedElement?: { elementId?: string } | null };
          const flow = flowMoves.get(x.dataFlow?.connectionId ?? "");
          const element = flowMoves.get(x.linkedElement?.elementId ?? "");
          if (!flow && !element) return th;
          return {
            ...(th as object),
            ...(flow ? { dataFlow: { ...x.dataFlow, connectionId: flow } } : {}),
            ...(element ? { linkedElement: { ...x.linkedElement, elementId: element } } : {}),
          } as typeof th;
        }),
      }));
    project = {
      ...project,
      threats: {
        ...project.threats,
        perElementTables: move(project.threats.perElementTables ?? []),
        perInteractionTables: move(project.threats.perInteractionTables ?? []),
      },
    };
  }
  const goneFlows = new Set(
    instances.flatMap((i) => delta.flows.removed.map((f) => componentInstanceTfId(i.id, f))).filter((id) => !flowMoves.has(id)),
  );
  if (goneFlows.size > 0 && project.threats) {
    const onGone = (t: unknown) => {
      const x = t as { dataFlow?: { connectionId?: string } | null; linkedElement?: { elementId?: string } | null };
      return goneFlows.has(x.dataFlow?.connectionId ?? "") || goneFlows.has(x.linkedElement?.elementId ?? "");
    };
    const goneThreats = new Set<string>();
    const strip = <T extends { threats: { id: string }[] }>(tables: T[]) =>
      tables.map((t) => ({
        ...t,
        threats: t.threats.filter((x) => {
          if (!onGone(x)) return true;
          goneThreats.add(x.id);
          return false;
        }),
      }));
    project = {
      ...project,
      threats: {
        ...project.threats,
        perElementTables: strip(project.threats.perElementTables ?? []),
        perInteractionTables: strip(project.threats.perInteractionTables ?? []),
      },
    };
    if (goneThreats.size > 0 && project.risks) {
      project = { ...project, risks: { ...project.risks, risks: project.risks.risks.filter((r) => !goneThreats.has(r.threatId)) } };
    }
  }

  // ── commit message lines: what the update dropped ──────────────────────
  // Hazard links and the machine's A2A relations of a removed asset are named
  // one by one (review of patch 59): purgeAssetFromProject removes them, the
  // inventory knows them as the machine's decisions — they must not vanish
  // silently.
  const before = input.project;
  const assetLabel = (id: string) => {
    const a = before.assets?.assets.find((x) => x.id === id);
    return a?.displayId ?? a?.name ?? id;
  };
  const hazardLabel = (id: string) => {
    const h = before.hazards?.hazards.find((x) => x.id === id);
    return h ? `${h.label}` : id;
  };
  const commitLines: string[] = [];
  for (const s of summaries) {
    for (const d of s.decisions.filter((x) => x.outcome === "orphaned")) {
      if (d.kind === "hazardLink") {
        const assetId = instanceAssetId(s.instanceId, d.key);
        for (const r of before.hazards?.relations ?? []) {
          const [hazard, asset] = r.type === "contributes_to" ? [r.to, r.from] : [r.from, r.to];
          if (asset === assetId) commitLines.push(`${s.label}: hazard ${hazardLabel(hazard)} loses its link to ${assetLabel(assetId)}`);
        }
        continue;
      }
      if (d.kind === "a2aRelation") {
        const assetId = instanceAssetId(s.instanceId, d.key);
        const own = new Set((oldSnap.assetRelations ?? []).map((r) => componentInstanceTfId(s.instanceId, `rel|${r.id}`)));
        for (const r of before.assets?.relations ?? []) {
          if (own.has(r.id) || (r.sourceAssetId !== assetId && r.targetAssetId !== assetId)) continue;
          commitLines.push(`${s.label}: relation ${assetLabel(r.sourceAssetId)} → ${assetLabel(r.targetAssetId)} (${r.relationType}) removed`);
        }
        continue;
      }
      commitLines.push(`${s.label}: ${d.kind} ${d.key} dropped${d.ticketIds?.length ? ` (ticket ${d.ticketIds.join(", ")} loses its risk)` : ""}`);
    }
    for (const p of s.paired) commitLines.push(`${s.label}: ${p.kind} ${p.from} → ${p.to} (to review)`);
  }
  // ── the import and the instances ───────────────────────────────────────
  const nextComponents: Components = {
    imports: components.imports.map((i) =>
      i.id === importId
        ? {
            ...i,
            snapshot: newSnap,
            contentHash: result.contentHash,
            source: result.source,
            ...(result.methodology ? { methodology: result.methodology } : {}),
            importedAt: updatedAt,
            lastUpdate: {
              at: updatedAt,
              from: {
                ...(imported.source.commitSha ? { commitSha: imported.source.commitSha } : {}),
                ...(imported.source.tag ? { tag: imported.source.tag } : {}),
                contentHash: imported.contentHash,
              },
              lines: commitLines,
            },
          }
        : i,
    ),
    instances: components.instances.map((i) => nextInstances.get(i.id) ?? i),
  };
  project = { ...project, components: nextComponents };

  return { project, delta, instances: summaries, commitLines };
}

// ==================== PAIRING CANDIDATES ====================

export interface PairingCandidate {
  kind: "threat" | "path" | "flow";
  /** Obsolete key (component terms). */
  from: string;
  to: string;
  /** Why it is offered — for the dialog's hint. */
  reason: "same_stride_and_target" | "same_text" | "same_tree" | "same_ends_and_protocol";
}

/**
 * Pairs the dialog OFFERS — never applied by itself, not even when the match
 * looks unique (review 2026-11-10: the same STRIDE category on the same
 * element is not proof of the same threat; a pairing always goes to review,
 * so confirming costs one click and guards against a silent wrong match).
 */
export function pairingCandidates(oldSnapshot: ComponentSnapshot, newSnapshot: ComponentSnapshot): PairingCandidate[] {
  const out: PairingCandidate[] = [];
  const threats = (s: ComponentSnapshot) => [
    ...(s.threats?.perElementTables ?? []).flatMap((t) => t.threats),
    ...(s.threats?.perInteractionTables ?? []).flatMap((t) => t.threats),
  ];
  const target = (t: ReturnType<typeof threats>[number]) =>
    (t.linkedElement as { elementId?: string } | null)?.elementId ?? (t.dataFlow as { connectionId?: string } | null)?.connectionId ?? "";
  const oldT = threats(oldSnapshot);
  const newT = threats(newSnapshot);
  const oldIds = new Set(oldT.map((t) => t.id));
  const newIds = new Set(newT.map((t) => t.id));
  const gone = oldT.filter((t) => !newIds.has(t.id));
  const added = newT.filter((t) => !oldIds.has(t.id));
  for (const g of gone) {
    for (const a of added) {
      if (a.strideCategory !== g.strideCategory) continue;
      if (target(a) && target(a) === target(g)) out.push({ kind: "threat", from: g.id, to: a.id, reason: "same_stride_and_target" });
      else if (a.threatDescription && a.threatDescription === g.threatDescription) out.push({ kind: "threat", from: g.id, to: a.id, reason: "same_text" });
    }
  }
  const paths = (s: ComponentSnapshot) => (s.attackTrees?.trees ?? []).flatMap((t) => (t.pathAnalysis?.paths ?? []).map((p) => ({ tree: t.id, key: `${t.id}|${p.pathKey}` })));
  const oldP = paths(oldSnapshot);
  const newP = paths(newSnapshot);
  const newPk = new Set(newP.map((p) => p.key));
  const oldPk = new Set(oldP.map((p) => p.key));
  for (const g of oldP.filter((p) => !newPk.has(p.key))) {
    for (const a of newP.filter((p) => !oldPk.has(p.key) && p.tree === g.tree)) out.push({ kind: "path", from: g.key, to: a.key, reason: "same_tree" });
  }
  const ees = (s: ComponentSnapshot) => new Set((s.dfd?.elements ?? []).filter((e) => e.type === "ExternalEntity").map((e) => e.id));
  const boundary = (s: ComponentSnapshot) => {
    const e = ees(s);
    return (s.dfd?.connections ?? []).filter((c) => e.has(c.from) !== e.has(c.to));
  };
  const protocol = (c: { properties?: unknown }) => (c.properties as { protocol?: string } | undefined)?.protocol ?? "";
  const oldF = boundary(oldSnapshot);
  const newF = boundary(newSnapshot);
  const newFid = new Set(newF.map((c) => c.id));
  const oldFid = new Set(oldF.map((c) => c.id));
  for (const g of oldF.filter((c) => !newFid.has(c.id))) {
    for (const a of newF.filter((c) => !oldFid.has(c.id))) {
      if (a.from === g.from && a.to === g.to && protocol(a) === protocol(g)) out.push({ kind: "flow", from: g.id, to: a.id, reason: "same_ends_and_protocol" });
    }
  }
  return out;
}
