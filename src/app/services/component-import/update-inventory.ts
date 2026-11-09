// ==================== UPDATE INVENTORY ====================
// Multi-project TARA phase 5b (design §9.2; cut with the user and the second
// instance 2026-11-09). On an update everything DERIVED recomputes from the
// new snapshot by itself (threats, effectiveness, the credited residual,
// matrix evidence); only the machine's STORED decisions per instance need a
// rule. DECISION_KINDS is a Record over every kind of stored decision — like
// FINDING_CLASS, a new kind of decision does not compile until it has its
// update rule (otherwise it would be lost silently on the next update).
//
// Each kind defines:
//   decided   the keys of this kind the machine has decided for an instance
//             (keys in the component's terms: its threat, path, assumption …)
//   basis     the part of a snapshot the decision rests on, as a hash;
//             undefined = no counterpart there → the decision is ORPHANED
//   orphaned  what the update does with an orphaned decision
//
// Outcome per decision, old snapshot against new: counterpart gone →
// orphaned; basis changed → review; else take over. "Review" outlives the
// update in ComponentInstance.reviewBasis — only the open reviews, keyed
// "<kind>|<key>", with the hash of the OLDEST basis not reviewed yet; it is
// derived "to review" while that hash differs from the current basis, and
// settles by itself when a later state restores the basis. Confirming
// removes the entry. Nothing is stored for unchanged decisions (review
// 2026-11-09). Pure.

import { isContributesTo, type ComponentInstance } from "shared";
import { canonicalStringify } from "shared/utils/tcs-canonical";
import { fnv1aHex12 } from "shared/utils/fnv1a";
import { buildThreatId } from "features/attacktree";
import { componentInstanceTfId, instanceAssetId } from "features/dfd";
import type { Project } from "../../models/project-types";
import type { ComponentSnapshot } from "../../models/component-snapshot-types";
import { leavesOf } from "../../utils/component-attack-trees";
import { overlayKey } from "./path-overlays";

export type DecisionKind =
  | "eeMapping"
  | "pathOverlay"
  | "relevanceOverride"
  | "aouStatus"
  | "measureOverride"
  | "citedClaim"
  | "riskRating"
  | "riskTreatment"
  | "assetRating"
  | "a2aRelation"
  | "hazardLink"
  | "conceptRiskRef"
  | "boundaryThreat"
  | "quantity";

/** What the machine holds beside the instance — the stores its decisions live in. */
export type MachineData = Pick<Project, "risks" | "assets" | "threats"> &
  Partial<Pick<Project, "hazards" | "cybersecurityConcept">>;

export interface DecisionRule {
  /** The keys of this kind the machine decided for the instance, against the snapshot it holds. */
  decided: (machine: MachineData, instance: ComponentInstance, snapshot: ComponentSnapshot) => string[];
  /** Hash of the basis of `key` in `snapshot`; undefined = no counterpart (orphaned). */
  basis: (snapshot: ComponentSnapshot, key: string) => string | undefined;
  /** drop: the decision goes (listed in the preview and the commit message); unlink: the reference is removed. */
  orphaned: "drop" | "unlink";
}

const hash = (value: unknown) => fnv1aHex12(canonicalStringify(value ?? null));
const EXISTS = "";

// ── Helpers: the snapshot's parts by key ────────────────────────────────

const threatsOf = (s: ComponentSnapshot) => [
  ...(s.threats?.perElementTables ?? []).flatMap((t) => t.threats),
  ...(s.threats?.perInteractionTables ?? []).flatMap((t) => t.threats),
];
const threatOf = (s: ComponentSnapshot, id: string) => threatsOf(s).find((t) => t.id === id);
const riskOfThreat = (s: ComponentSnapshot, threatKey: string) => s.risks.find((r) => r.threatId === threatKey);
const treeOf = (s: ComponentSnapshot, id: string) => (s.attackTrees?.trees ?? []).find((t) => t.id === id);
const assetOf = (s: ComponentSnapshot, id: string) => s.assets.find((a) => a.id === id);
const eeIds = (s: ComponentSnapshot) => new Set((s.dfd?.elements ?? []).filter((e) => e.type === "ExternalEntity").map((e) => e.id));

/**
 * The threat content a rating rests on (not the component's own relevance —
 * that is the override's basis). Typed, no casts (review of patch 57: a cast
 * hid the field name, `description` instead of `threatDescription`, so a
 * changed threat text never put its rating to review). An empty text means
 * "use the i18n template", so the template id belongs to it.
 */
const threatBasis = (t: NonNullable<ReturnType<typeof threatOf>>) => ({
  stride: t.strideCategory,
  text: t.threatDescription,
  attack: t.attackDescription,
  template: t.templateId,
  element: (t.linkedElement as { elementId?: string } | null)?.elementId,
  flow: (t.dataFlow as { connectionId?: string } | null)?.connectionId,
});

/**
 * What the machine's treatment rests on: the component's treatment and,
 * per measure, only id and status — not its notes or ticket fields (the
 * component's tracker state must not put the machine's treatment to review).
 * The status belongs: a component measure delivered now may be a reason to
 * rethink the machine's own compensation (review of patch 57).
 */
const treatmentBasis = (risk: ComponentSnapshot["risks"][number] | undefined) =>
  hash({
    treatment: risk?.treatment,
    justification: risk?.treatmentJustification,
    measures: (risk?.selectedMitigations ?? []).map((m) => ({ id: m.id, status: m.status })),
  });

/**
 * Machine threat id → the component's key: "threat|<id>" for a threat of
 * its tables, "path|<tree>|<pathKey>|<stride>" for an attack-path threat
 * (ISO). The ids are hashed per instance, so the map is built forward.
 */
export function instanceThreatKeys(instanceId: string, snapshot: ComponentSnapshot): Map<string, string> {
  const out = new Map<string, string>();
  for (const t of threatsOf(snapshot)) out.set(componentInstanceTfId(instanceId, `threat|${t.id}`), `threat|${t.id}`);
  for (const tree of snapshot.attackTrees?.trees ?? []) {
    const treeId = componentInstanceTfId(instanceId, `tree|${tree.id}`);
    for (const p of tree.pathAnalysis?.paths ?? []) {
      for (const stride of ["S", "T", "R", "I", "D", "E"] as const) {
        out.set(buildThreatId(treeId, p.pathKey, stride), `path|${tree.id}|${p.pathKey}|${stride}`);
      }
    }
  }
  return out;
}

/** The basis of a risk key ("threat|…" / "path|…") in a snapshot. */
function riskKeyBasis(s: ComponentSnapshot, key: string, part: "rating" | "treatment"): string | undefined {
  const [kind, a, b, c] = key.split("|");
  if (kind === "threat") {
    const threat = threatOf(s, a);
    if (!threat) return undefined;
    const risk = riskOfThreat(s, a);
    return part === "rating" ? hash({ threat: threatBasis(threat), intrinsic: risk?.intrinsicFactors ?? [] }) : treatmentBasis(risk);
  }
  if (kind === "path") {
    const path = treeOf(s, a)?.pathAnalysis?.paths.find((p) => p.pathKey === b);
    if (!path) return undefined;
    const risk = s.risks.find((r) => r.threatId === buildThreatId(a, b, c as "S"));
    return part === "rating" ? hash({ factors: path.attackPotentialFactors ?? null, nodes: path.nodeIds }) : treatmentBasis(risk);
  }
  return undefined;
}

/** The machine's risks on the instance's imported threats, by component key. */
function machineRisks(machine: MachineData, instance: ComponentInstance, snapshot: ComponentSnapshot) {
  const keys = instanceThreatKeys(instance.id, snapshot);
  return (machine.risks?.risks ?? []).flatMap((r) => (keys.has(r.threatId) ? [{ risk: r, key: keys.get(r.threatId)! }] : []));
}

/** The instance's assets in the machine, by component asset id. */
function instanceAssets(machine: MachineData, instance: ComponentInstance, snapshot: ComponentSnapshot) {
  const byId = new Map((machine.assets?.assets ?? []).map((a) => [a.id, a]));
  return snapshot.assets.flatMap((a) => {
    const own = byId.get(instanceAssetId(instance.id, a.id));
    return own ? [{ asset: own, key: a.id }] : [];
  });
}

/** Component flows with exactly one component-EE end — the boundary flows. */
function boundaryFlowIds(snapshot: ComponentSnapshot): string[] {
  const ees = eeIds(snapshot);
  return (snapshot.dfd?.connections ?? []).filter((c) => ees.has(c.from) !== ees.has(c.to)).map((c) => c.id);
}

// ==================== THE INVENTORY ====================

export const DECISION_KINDS: Record<DecisionKind, DecisionRule> = {
  eeMapping: {
    decided: (_m, i) => (i.eeMapping ?? []).map((e) => e.componentEeId),
    basis: (s, ee) =>
      eeIds(s).has(ee)
        ? hash((s.dfd?.connections ?? []).filter((c) => c.from === ee || c.to === ee).map((c) => [c.id, c.from, c.to]).sort())
        : undefined,
    orphaned: "drop",
  },
  pathOverlay: {
    decided: (_m, i) => (i.pathOverlays ?? []).map(overlayKey),
    basis: (s, key) => {
      const [treeKey, pathKey, leafId] = key.split("|");
      const tree = treeOf(s, treeKey);
      const path = tree?.pathAnalysis?.paths.find((p) => p.pathKey === pathKey);
      if (!tree || !path) return undefined;
      if (!leafId) return hash({ factors: path.attackPotentialFactors ?? null, nodes: path.nodeIds });
      const leaf = path.nodeIds.includes(leafId) ? leavesOf(tree).get(leafId) : undefined;
      return leaf ? hash(leaf) : undefined;
    },
    orphaned: "drop",
  },
  relevanceOverride: {
    decided: (_m, i) => (i.relevanceOverrides ?? []).map((o) => o.threatKey),
    basis: (s, id) => {
      const t = threatOf(s, id);
      return t ? hash({ ...threatBasis(t), relevance: t.relevance }) : undefined;
    },
    orphaned: "drop",
  },
  aouStatus: {
    decided: (_m, i) => (i.assumptions ?? []).filter((a) => a.status !== "open").map((a) => a.assumptionId),
    basis: (s, id) => {
      const a = (s.assumptions ?? []).find((x) => x.id === id);
      return a ? hash({ text: a.text, status: a.status, measures: a.mitigationIds ?? [] }) : undefined;
    },
    orphaned: "drop",
  },
  measureOverride: {
    decided: (_m, i) => (i.measureOverrides ?? []).map((o) => o.measureId),
    basis: (s, id) => {
      if (!s.risks.some((r) => r.selectedMitigations.some((m) => m.id === id))) return undefined;
      const text = (s.threats?.customMitigations ?? []).find((m) => m.id === id)?.text;
      const relies = (s.assumptions ?? []).filter((a) => a.mitigationIds?.includes(id)).map((a) => [a.id, a.text, a.status]);
      return hash({ text, relies });
    },
    orphaned: "drop",
  },
  citedClaim: {
    decided: (_m, i) => (i.citedClaims ?? []).map((c) => c.claimId),
    basis: (s, id) => {
      const c = (s.concept?.claims ?? []).find((x) => x.id === id && x.kind === "supporting");
      return c ? hash({ statement: c.statement, assumptions: c.assumptionIds, requirements: c.requirements ?? [] }) : undefined;
    },
    orphaned: "drop",
  },
  riskRating: {
    // a rating of the machine: any factor rated on the imported risk
    decided: (m, i, s) =>
      machineRisks(m, i, s)
        .filter(({ risk }) => [...(risk.factorRatings ?? []), ...(risk.mitigatedFactorRatings ?? [])].some((f) => (f.value ?? 0) > 0))
        .map(({ key }) => key),
    basis: (s, key) => riskKeyBasis(s, key, "rating"),
    orphaned: "drop",
  },
  riskTreatment: {
    // the machine's own treatment: measures, or a justification (acceptance, transfer …)
    decided: (m, i, s) =>
      machineRisks(m, i, s)
        .filter(({ risk }) => (risk.selectedMitigations ?? []).length > 0 || !!(risk.treatmentJustification ?? "").trim())
        .map(({ key }) => key),
    basis: (s, key) => riskKeyBasis(s, key, "treatment"),
    orphaned: "drop",
  },
  assetRating: {
    decided: (m, i, s) =>
      instanceAssets(m, i, s)
        .filter(({ asset }) => (asset.impactRatings ?? []).some((r) => r.value !== null && r.value !== undefined))
        .map(({ key }) => key),
    basis: (s, id) => {
      const a = assetOf(s, id);
      if (!a) return undefined;
      const goals = (a.securityGoals ?? [])
        .filter((g) => g.level !== "none")
        .map((g) => g.type)
        .sort();
      return hash({ group: a.assetGroup, goals });
    },
    orphaned: "drop",
  },
  a2aRelation: {
    // the machine's own relations to the instance's assets (not the component's, which come with it)
    decided: (m, i, s) => {
      const own = new Set(s.assetRelations?.map((r) => componentInstanceTfId(i.id, `rel|${r.id}`)) ?? []);
      const ids = new Map(s.assets.map((a) => [instanceAssetId(i.id, a.id), a.id]));
      return [
        ...new Set(
          (m.assets?.relations ?? [])
            .filter((r) => !own.has(r.id))
            .flatMap((r) => [ids.get(r.sourceAssetId), ids.get(r.targetAssetId)])
            .filter((x): x is string => !!x),
        ),
      ];
    },
    basis: (s, id) => (assetOf(s, id) ? EXISTS : undefined),
    orphaned: "drop",
  },
  hazardLink: {
    // hazard ↔ asset links live in hazards.relations (contributes_to: asset → hazard;
    // endangers: hazard → asset) — review of patch 57: a cast had read a field
    // that only the import format has (affectedAssets), so nothing was found
    decided: (m, i, s) => {
      const ids = new Map(s.assets.map((a) => [instanceAssetId(i.id, a.id), a.id]));
      const linked = (m.hazards?.relations ?? []).map((r) => (isContributesTo(r) ? r.from : r.to));
      return [...new Set(linked.map((id) => ids.get(id)).filter((x): x is string => !!x))];
    },
    basis: (s, id) => (assetOf(s, id) ? EXISTS : undefined),
    orphaned: "unlink",
  },
  conceptRiskRef: {
    // goals / claims of the machine naming a risk on an imported threat
    decided: (m, i, s) => {
      const byRiskId = new Map(machineRisks(m, i, s).map(({ risk, key }) => [risk.id, key]));
      const concept = m.cybersecurityConcept;
      const named = [...(concept?.goals ?? []), ...(concept?.claims ?? [])].flatMap((x) => x.riskIds);
      return [...new Set(named.map((id) => byRiskId.get(id)).filter((x): x is string => !!x))];
    },
    basis: (s, key) => (riskKeyBasis(s, key, "rating") !== undefined ? EXISTS : undefined),
    orphaned: "unlink",
  },
  boundaryThreat: {
    // the machine's own threats on a boundary flow (victimRole): their ids hang on the component's flow id
    decided: (m, i, s) => {
      const byTfId = new Map(boundaryFlowIds(s).map((id) => [componentInstanceTfId(i.id, id), id]));
      const flows = [...(m.threats?.perInteractionTables ?? []), ...(m.threats?.perElementTables ?? [])]
        .flatMap((t) => t.threats)
        .flatMap((t) => {
          const x = t as { dataFlow?: { connectionId?: string } | null; linkedElement?: { elementId?: string } | null };
          return [x.dataFlow?.connectionId, x.linkedElement?.elementId];
        })
        .map((id) => (id ? byTfId.get(id) : undefined))
        .filter((x): x is string => !!x);
      return [...new Set(flows)];
    },
    basis: (s, flowId) => {
      if (!boundaryFlowIds(s).includes(flowId)) return undefined;
      const c = (s.dfd?.connections ?? []).find((x) => x.id === flowId)!;
      return hash({ from: c.from, to: c.to, properties: c.properties ?? {} });
    },
    orphaned: "drop",
  },
  quantity: {
    // the machine's own count of identical units — no counterpart in the component
    decided: () => [],
    basis: () => EXISTS,
    orphaned: "drop",
  },
};

// ==================== DELTA AND REVIEWS ====================

export type DecisionOutcome = "take_over" | "review" | "orphaned";

export interface DecisionChange {
  kind: DecisionKind;
  key: string;
  outcome: DecisionOutcome;
  /** The basis hash in the old state (review: what reviewBasis keeps). */
  oldBasis?: string;
  /** Tracker tickets of the machine's measures on an orphaned risk — "ticket ABC-123 loses its risk". */
  ticketIds?: string[];
}

export const reviewKey = (kind: DecisionKind, key: string) => `${kind}|${key}`;

/**
 * Every stored decision of one instance, old snapshot against new: take
 * over, review (its basis changed) or orphaned (no counterpart any more).
 */
export function decisionDelta(
  machine: MachineData,
  instance: ComponentInstance,
  oldSnapshot: ComponentSnapshot,
  newSnapshot: ComponentSnapshot,
): DecisionChange[] {
  const out: DecisionChange[] = [];
  for (const kind of Object.keys(DECISION_KINDS) as DecisionKind[]) {
    const rule = DECISION_KINDS[kind];
    for (const key of rule.decided(machine, instance, oldSnapshot)) {
      const before = rule.basis(oldSnapshot, key);
      const after = rule.basis(newSnapshot, key);
      const outcome: DecisionOutcome = after === undefined ? "orphaned" : before !== after ? "review" : "take_over";
      const tickets =
        outcome === "orphaned" && kind === "riskTreatment"
          ? machineRisks(machine, instance, oldSnapshot)
              .filter((r) => r.key === key)
              .flatMap(({ risk }) => (risk.selectedMitigations ?? []).map((m) => m.ticketId).filter((t): t is string => !!t))
          : [];
      out.push({
        kind,
        key,
        outcome,
        ...(before !== undefined && outcome === "review" ? { oldBasis: before } : {}),
        ...(tickets.length > 0 ? { ticketIds: tickets } : {}),
      });
    }
  }
  return out;
}

/**
 * reviewBasis after an update: an entry already open keeps its OLDEST
 * basis; a decision newly to review gets its old basis; an orphaned
 * decision's entry goes; an entry whose oldest basis equals the new state's
 * basis settles by itself (the component restored it).
 */
export function nextReviewBasis(
  instance: ComponentInstance,
  delta: readonly DecisionChange[],
  newSnapshot: ComponentSnapshot,
): Record<string, string> | undefined {
  const next: Record<string, string> = { ...(instance.reviewBasis ?? {}) };
  for (const change of delta) {
    const k = reviewKey(change.kind, change.key);
    if (change.outcome === "orphaned") delete next[k];
    else if (change.outcome === "review" && next[k] === undefined && change.oldBasis !== undefined) next[k] = change.oldBasis;
  }
  for (const [k, oldest] of Object.entries(next)) {
    const [kind, ...rest] = k.split("|");
    const current = DECISION_KINDS[kind as DecisionKind]?.basis(newSnapshot, rest.join("|"));
    if (current === undefined || current === oldest) delete next[k];
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

/** The decisions of an instance still to review against its current snapshot (derived). */
export function openReviews(instance: ComponentInstance, snapshot: ComponentSnapshot): { kind: DecisionKind; key: string }[] {
  return Object.entries(instance.reviewBasis ?? {}).flatMap(([k, oldest]) => {
    const [kind, ...rest] = k.split("|");
    const key = rest.join("|");
    const current = DECISION_KINDS[kind as DecisionKind]?.basis(snapshot, key);
    return current !== undefined && current !== oldest ? [{ kind: kind as DecisionKind, key }] : [];
  });
}

/** The analyst confirmed a decision after an update: its review entry goes. */
export function withReviewConfirmed(instance: ComponentInstance, kind: DecisionKind, key: string): ComponentInstance {
  const { [reviewKey(kind, key)]: _done, ...rest } = instance.reviewBasis ?? {};
  const { reviewBasis: _old, ...base } = instance;
  return Object.keys(rest).length > 0 ? { ...base, reviewBasis: rest } : base;
}

// ==================== WHAT CHANGED IN THE COMPONENT ====================

export interface IdDelta {
  added: string[];
  removed: string[];
}

/** Old against new snapshot, by id — the preview's "what changed" (5c). */
export interface SnapshotDelta {
  elements: IdDelta;
  /** Component EEs new in this state: each needs a mapping to a machine element before the update. */
  newEes: string[];
  flows: IdDelta;
  threats: IdDelta;
  /** "tree|pathKey" */
  paths: IdDelta;
  /** Measures chosen on the component's risks. */
  measures: IdDelta;
  assumptions: IdDelta;
  /** Supporting claims. */
  claims: IdDelta;
  assets: IdDelta;
  relations: IdDelta;
}

const idDelta = (before: Iterable<string>, after: Iterable<string>): IdDelta => {
  const a = new Set(before);
  const b = new Set(after);
  return { added: [...b].filter((x) => !a.has(x)).sort(), removed: [...a].filter((x) => !b.has(x)).sort() };
};

export function snapshotDelta(oldSnapshot: ComponentSnapshot, newSnapshot: ComponentSnapshot): SnapshotDelta {
  const elements = (s: ComponentSnapshot) => (s.dfd?.elements ?? []).map((e) => e.id);
  const paths = (s: ComponentSnapshot) => (s.attackTrees?.trees ?? []).flatMap((t) => (t.pathAnalysis?.paths ?? []).map((p) => `${t.id}|${p.pathKey}`));
  const measures = (s: ComponentSnapshot) => s.risks.flatMap((r) => r.selectedMitigations.map((m) => m.id).filter((id): id is string => !!id));
  const supporting = (s: ComponentSnapshot) => (s.concept?.claims ?? []).filter((c) => c.kind === "supporting").map((c) => c.id);
  const oldEes = eeIds(oldSnapshot);
  return {
    elements: idDelta(elements(oldSnapshot), elements(newSnapshot)),
    newEes: [...eeIds(newSnapshot)].filter((id) => !oldEes.has(id)).sort(),
    flows: idDelta((oldSnapshot.dfd?.connections ?? []).map((c) => c.id), (newSnapshot.dfd?.connections ?? []).map((c) => c.id)),
    threats: idDelta(threatsOf(oldSnapshot).map((t) => t.id), threatsOf(newSnapshot).map((t) => t.id)),
    paths: idDelta(paths(oldSnapshot), paths(newSnapshot)),
    measures: idDelta(measures(oldSnapshot), measures(newSnapshot)),
    assumptions: idDelta((oldSnapshot.assumptions ?? []).map((a) => a.id), (newSnapshot.assumptions ?? []).map((a) => a.id)),
    claims: idDelta(supporting(oldSnapshot), supporting(newSnapshot)),
    assets: idDelta(oldSnapshot.assets.map((a) => a.id), newSnapshot.assets.map((a) => a.id)),
    relations: idDelta((oldSnapshot.assetRelations ?? []).map((r) => r.id), (newSnapshot.assetRelations ?? []).map((r) => r.id)),
  };
}
