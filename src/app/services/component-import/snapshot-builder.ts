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
// measures, goals and claims, assets, assumptions. What stays behind: impact
// values and ratings, risk levels, aggregated feasibility, context-dependent
// factors, hazards, Item Definition sections, tickets, audit, people, and
// timestamps (they change with every save and carry no analysis content).

import { canonicalStringify } from "shared/utils/tcs-canonical";
import { fnv1aHex12 } from "shared/utils/fnv1a";
import { buildMethodologyFingerprint, type MethodologyFingerprint } from "shared";
import {
  factorClassOf,
  getFactorDefinition,
  intrinsicFactorScales,
  likelihoodMethodOf,
} from "features/risks";
import type { Project } from "../../models/project-types";
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
    return copy as SnapshotAsset;
  });
}

/** The snapshot of a component project (design §4.2). */
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
    dfd: dfd
      ? {
          xml: dfd.xml,
          elements: dfd.elements,
          connections: dfd.connections,
          assets: dfd.assets,
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
    assumptions: (project.itemDefinition?.assumptions ?? []).map(({ owner: _owner, ...rest }) => rest),
    ...(project.components ? { components: project.components } : {}),
  };
  return clean(snapshot);
}

/** 12-hex FNV-1a over the canonical form of a snapshot (design §8.2). */
export function snapshotContentHash(snapshot: ComponentSnapshot): string {
  return fnv1aHex12(canonicalStringify(snapshot));
}
