// ==================== COMPONENT SNAPSHOT BUILDER ====================
// Multi-project TARA (doc/Open/multi-project-tara-design.md v3, phase 0):
// builds the snapshot a machine TARA embeds from a component project, plus
// its content hash and the component's methodology fingerprint. Pure — the
// caller loads and migrates the component file (phase 1).
//
// App layer on purpose: it reads the data of several features (DFD, threats,
// risks, assets, attack trees, concept, Item Definition); the features stay
// independent of each other.
//
// What crosses (design §4.2): the DFD, threats with their relevance, attack
// trees, the raw values of the intrinsic likelihood factors, treatment and
// measures, goals and claims, assets, assumptions, and the overview (`about`:
// description, responsible, tags, Item Definition texts and functions, source
// bindings — user 2026-11-11). What stays behind: impact values and ratings,
// risk levels, aggregated feasibility, context-dependent factors, hazards,
// tickets, audit, the team, and timestamps (they change with every save and
// carry no analysis content).

import { canonicalStringify } from "shared/utils/tcs-canonical";
import { fnv1aHex12 } from "shared/utils/fnv1a";
import { withoutUrlCredentials } from "shared/utils/url-credentials";
import { buildMethodologyFingerprint, type MethodologyFingerprint } from "shared";
import {
  factorClassOf,
  getFactorDefinition,
  intrinsicFactorScales,
  likelihoodMethodOf,
} from "features/risks";
import type { Project } from "../../models/project-types";
import { projectMeasureOptions } from "./assumption-status";
import type {
  ComponentSnapshot,
  SnapshotAsset,
  SnapshotRisk,
} from "../../models/component-snapshot-types";

/** Keys dropped everywhere: save timestamps, no analysis content. */
const VOLATILE_KEYS = new Set(["created", "lastModified", "statusChangedAt"]);

/** Asset fields that are impact (§7.3) — the machine rates impact itself. */
const ASSET_IMPACT_KEYS = [
  "impactRatings",
  "overallImpact",
  "aggregatedImpact",
  "physicalImpact",
  "physicalImpactSource",
  "physicalImpactRationale",
] as const;

/** Plain JSON copy without undefined values and volatile keys. */
function clean<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (key, v) => (VOLATILE_KEYS.has(key) ? undefined : v)),
  ) as T;
}

/** The methodology fingerprint of a project's risk configuration (design §7.2). */
export function projectMethodologyFingerprint(project: Pick<Project, "risks">): MethodologyFingerprint | null {
  const configuration = project.risks?.configuration;
  if (!configuration) return null;
  return buildMethodologyFingerprint(
    likelihoodMethodOf(configuration),
    intrinsicFactorScales(configuration),
  );
}

function snapshotRisks(project: Project): SnapshotRisk[] {
  const configuration = project.risks?.configuration;
  const customFactors = configuration?.customFactors ?? [];
  const isIntrinsic = (factorId: string) =>
    factorClassOf(getFactorDefinition(factorId, customFactors)) === "intrinsic";
  return (project.risks?.risks ?? []).map((r) => ({
    id: r.id,
    threatId: r.threatId,
    strideCategory: r.strideCategory,
    sourceStrideMethod: r.sourceStrideMethod,
    treatment: r.treatment,
    ...(r.treatmentJustification ? { treatmentJustification: r.treatmentJustification } : {}),
    selectedMitigations: (r.selectedMitigations ?? []).map((m) =>
      typeof m === "string"
        ? { id: m, status: "open" }
        : {
            ...(m.id ? { id: m.id } : {}),
            ...(m.notes ? { notes: m.notes } : {}),
            status: m.status,
          },
    ),
    selectedVerifications: (r.selectedVerifications ?? []).map((v) =>
      typeof v === "string" ? v : ((v as { id?: string; notes?: string }).id ?? (v as { notes?: string }).notes ?? ""),
    ),
    intrinsicFactors: (r.factorRatings ?? [])
      .filter((f) => f.value > 0 && isIntrinsic(f.factorId))
      .map((f) => ({ factorId: f.factorId, value: f.value }))
      .sort((a, b) => (a.factorId < b.factorId ? -1 : a.factorId > b.factorId ? 1 : 0)),
  }));
}

function snapshotAssets(project: Project): SnapshotAsset[] {
  return (project.assets?.assets ?? []).map((asset) => {
    const copy: Record<string, unknown> = { ...asset };
    for (const key of ASSET_IMPACT_KEYS) delete copy[key];
    // The protection need is a rating in the component's context, like impact.
    const properties = copy.properties as Record<string, unknown> | undefined;
    if (properties && "protectionNeed" in properties) {
      const { protectionNeed: _drop, ...rest } = properties;
      copy.properties = rest;
    }
    // Per security goal (= damage scenario, asset × property): its impact and
    // its consequence text are the component's damage view — the machine
    // rates the damage scenarios itself (§7.3, §7.5). The goal and its level
    // (CIANAAA) cross.
    if (Array.isArray(copy.securityGoals)) {
      copy.securityGoals = (copy.securityGoals as Record<string, unknown>[]).map(
        ({ impactRatings: _impact, consequence: _consequence, ...goal }) => goal,
      );
    }
    return copy as SnapshotAsset;
  });
}

/** The snapshot of a component project (design §4.2). */
/**
 * Assumptions without their owner; the measures relying on them only as far
 * as the project still has them (phase 3c — an id that no longer resolves
 * would name a dependency an importing machine cannot find).
 */
function snapshotAssumptions(project: Project): ComponentSnapshot["assumptions"] {
  const known = new Set(projectMeasureOptions(project).map((m) => m.id));
  return (project.itemDefinition?.assumptions ?? []).map(({ owner: _owner, mitigationIds, ...rest }) => {
    const ids = (mitigationIds ?? []).filter((id) => known.has(id));
    return ids.length > 0 ? { ...rest, mitigationIds: ids } : rest;
  });
}

/** The component's overview (design §4.2): only what is set. */
function snapshotAbout(project: Project): ComponentSnapshot["about"] {
  const info = project.info;
  const tags = info?.tags;
  const hasTags = !!tags && Object.values(tags).some((v) => Array.isArray(v) && v.length > 0);
  const sections = Object.fromEntries(
    Object.entries(project.itemDefinition?.sections ?? {})
      .map(([id, section]) => [id, { ...(section?.text?.trim() ? { text: section.text } : {}), ...(section?.source ? { source: section.source } : {}) }] as const)
      .filter(([, section]) => Object.keys(section).length > 0),
  );
  const functions = (project.itemDefinition?.functions ?? []).map(({ functionAssetId: _asset, ...f }) => f);
  const bindings = (project.sourceBindings ?? []).map((b) => ({
    id: b.id,
    // Never credentials into another project (review 2026-11-11).
    repoUrl: withoutUrlCredentials(b.repoUrl),
    refType: b.refType,
    refLabel: b.refLabel,
    ...(b.resolvedCommitSha ? { resolvedCommitSha: b.resolvedCommitSha } : {}),
  }));
  return {
    ...(info?.description?.trim() ? { description: info.description } : {}),
    ...(info?.responsible?.trim() ? { responsible: info.responsible } : {}),
    ...(hasTags ? { tags } : {}),
    ...(info?.safetyRelevant ? { safetyRelevant: true } : {}),
    ...(Object.keys(sections).length ? { sections } : {}),
    ...(functions.length ? { functions } : {}),
    ...(bindings.length ? { sourceBindings: bindings } : {}),
  };
}

export function buildComponentSnapshot(project: Project): ComponentSnapshot {
  const dfd = project.dfd;
  const threats = project.threats;
  const snapshot: ComponentSnapshot = {
    snapshotFormat: 1,
    component: {
      projectId: project.id,
      name: project.info?.name ?? "",
      ...(project.info?.version ? { version: project.info.version } : {}),
    },
    about: snapshotAbout(project),
    dfd: dfd
      ? {
          xml: dfd.xml,
          elements: dfd.elements,
          connections: dfd.connections,
          // The asset mirror without the protection need (a context rating).
          assets: (dfd.assets ?? []).map(({ protectionNeed: _need, ...asset }) => asset),
          ...(dfd.pages ? { pages: dfd.pages } : {}),
        }
      : null,
    threats: threats
      ? {
          perElementTables: threats.perElementTables,
          perInteractionTables: threats.perInteractionTables,
          customMitigations: threats.configuration?.customMitigations ?? [],
          customVerifications: threats.configuration?.customVerifications ?? [],
        }
      : null,
    attackTrees: project.attackTrees ?? null,
    risks: snapshotRisks(project),
    assets: snapshotAssets(project),
    assetRelations: project.assets?.relations ?? [],
    concept: {
      goals: project.cybersecurityConcept?.goals ?? [],
      claims: project.cybersecurityConcept?.claims ?? [],
    },
    assumptions: snapshotAssumptions(project),
    ...(project.components ? { components: project.components } : {}),
  };
  return clean(snapshot);
}

/** 12-hex FNV-1a over the canonical form of a snapshot (design §8.2). */
export function snapshotContentHash(snapshot: ComponentSnapshot): string {
  return fnv1aHex12(canonicalStringify(snapshot));
}
