// scripts/results-dump/core.ts
//
// Results dump (roadmap-to-1.0.md rule 3.1): what the CURRENT code computes
// from one project file — threats generated fresh, their drift against the
// stored set, the risk values recalculated from the stored ratings, and the
// requirement matrices of the project's active standards. The dump of 0.19
// on the example projects is the reference every later change of results is
// compared with (doc/Testing/results-dump/README.md).
//
// Pure apart from the inputs: no file access, no clock, no random ids in the
// output. The same production functions as the app — load (migrations +
// repair), DFD graph, generators, risk sync's recalculation, ISO risk values,
// compliance-report — so a dump cannot drift from what the app shows.

import type { Project } from "app/models/project-types";
import { parseAndRepairWithMetadata } from "app/services/migration-service";
import { prepareProjectCompliance } from "app/services/compliance-report";
import { resolveDfdGraph } from "app/utils/resolve-dfd-graph";
import { toReferenceGraph } from "app/utils/to-reference-graph";
import { buildAssetDataReference } from "app/utils/build-asset-data-reference";
import { buildAssetHazardLinks } from "app/utils/build-asset-hazard-links";
import { computeIsoRisks, isIsoProject } from "app/utils/commit-iso-risk-values";
import { componentExcludedIds } from "app/services/component-import/component-scope";
import { dfdRefResolver, threatIsolation, threatRelevance } from "app/utils/en50742-relevance";
import { buildAttackPathThreatReferences } from "app/utils/build-attack-path-threat-references";
import { DFDGraphAnalysisContext } from "features/dfd";
import {
  DEFAULT_THREAT_CONFIGURATION,
  type StrideMethod,
  type Threat,
  type ThreatProjectData,
} from "features/threats/models/threat-types";
import {
  detectGenerationDrift,
  generateFresh,
  keyFnFor,
  storedTables,
} from "features/threats/services/threat-generation-drift";
import { recalculateRiskValues } from "features/risks/services/risk-sync-service";
import { calculateRiskValues } from "features/risks/services/risk-calculation-service";
import { calculateProgress } from "features/risks/utils/risk-progress";
import { riskFindings } from "features/risks/services/risk-findings";
import { activeStandards } from "features/compliance";
import {
  EMPTY_PROJECT_TAGS,
  getDisabledThreatGenerators,
  regulationPresetFromTags,
  en50742ApproachFromTags,
  type DFDReference,
} from "shared";

/** Bumped when the dump's own shape changes (not when results change). */
export const RESULTS_DUMP_FORMAT = 1;

export interface DumpHeader {
  taraflowVersion: string;
  taraflowCommit: string;
  /** THREAT_CATALOG_VERSION of the code that made the dump (from 0.20). */
  threatCatalogVersion?: number;
  /** Commit of the repository the input file comes from (e.g. TARAflow_Examples). */
  inputCommit?: string;
  inputFile: string;
  inputSha256: string;
}

// ==================== CANONICAL JSON ====================

/** Keys sorted at every level; undefined dropped — same order rule as TCS. */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value instanceof Set) return [...value].map(canonical);
  if (value instanceof Map) return canonical(Object.fromEntries(value));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      const v = (value as Record<string, unknown>)[key];
      if (v !== undefined) out[key] = canonical(v);
    }
    return out;
  }
  return value;
}

/** Shown first, so a reader sees what was dumped before the results. */
const LEADING_KEYS = ["format", "header", "project"];

/** Pretty, key-sorted JSON — readable in a git diff, byte-stable. */
export function stringifyDump(dump: unknown): string {
  const sorted = canonical(dump) as Record<string, unknown>;
  const leading = LEADING_KEYS.filter((k) => k in sorted);
  const ordered = Object.fromEntries([
    ...leading.map((k) => [k, sorted[k]]),
    ...Object.entries(sorted).filter(([k]) => !leading.includes(k)),
  ]);
  return JSON.stringify(ordered, null, 2) + "\n";
}

// ==================== THREATS ====================

/**
 * Fields of a generated threat that are not results: its random id and the
 * clocks the generator stamps per run. Everything else is kept — a changed
 * text, actor, asset link or proposed mitigation (catalogue id) is a changed
 * result.
 */
function stripVolatile(threat: Threat): Record<string, unknown> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, created, lastModified, ...rest } = threat;
  const out: Record<string, unknown> = { ...rest };
  if (rest.retainedAfterRuleChange) out.retainedAfterRuleChange = { ...rest.retainedAfterRuleChange, at: undefined };
  if (rest.review) out.review = { ...rest.review, since: undefined };
  if (rest.importedOverride) out.importedOverride = { ...rest.importedOverride, date: undefined };
  return out;
}

/** The threat input the Threats tab gets (workspace-layout.tsx), headless. */
function threatProjectOf(project: Project): {
  data: ThreatProjectData;
  context: DFDGraphAnalysisContext;
} | null {
  const dfd = project.dfd;
  const graph = resolveDfdGraph(dfd);
  if (!dfd || !graph) return null;
  const assets = project.assets?.assets;
  const assetDataRef = assets?.length
    ? buildAssetDataReference(
        assets,
        buildAssetHazardLinks(project.hazards ?? null),
        project.assets?.configuration?.impactScale ?? "4-level",
        project.assets?.configuration?.impactCriteria,
      )
    : undefined;
  // use-dfd-derived-data.ts: dfdReference
  const dfdReference: DFDReference = {
    processes: dfd.elements
      ?.filter((e) => e.type === "Process" || e.type === "Multiprocess")
      .map((e) => {
        const annotation = (e.properties as any)?.safetyAnnotation;
        return {
          id: e.id,
          label: e.name ?? e.id,
          safetyAnnotation: annotation
            ? { severity: annotation.severity, description: annotation.description }
            : undefined,
        };
      }),
    elements: dfd.elements?.map((e) => ({ id: e.id, properties: e.properties as Record<string, unknown> })),
    connections: dfd.connections?.map((c) => ({ id: c.id, properties: c.properties as Record<string, unknown> })),
  };
  const excluded = project.components ? componentExcludedIds(project) : undefined;
  const data = {
    id: project.id,
    name: project.info?.name || "",
    threats: project.threats ?? null,
    phaseStatus: project.phaseStatus,
    dfdXml: dfd.xml,
    dfdPageIds: dfd.pages?.map((p) => p.pageId),
    dfdElements: dfd.elements ?? [],
    dfdConnections: dfd.connections ?? [],
    assetIds: assets?.map((a) => a.id),
    lastModified: "",
    dfdGraph: toReferenceGraph(graph),
    assetDataRef,
    dfd: dfdReference,
    ...(excluded ? { excludedElementIds: excluded } : {}),
    info: { tags: project.info?.tags ?? EMPTY_PROJECT_TAGS },
  } as unknown as ThreatProjectData;
  return { data, context: new DFDGraphAnalysisContext(graph) };
}

function dumpThreats(project: Project) {
  const input = threatProjectOf(project);
  if (!input) return { skipped: "no DFD" };
  const stored = project.threats?.configuration;
  const configuration = stored ?? DEFAULT_THREAT_CONFIGURATION;
  const disabled = getDisabledThreatGenerators(
    regulationPresetFromTags(project.info?.tags ?? EMPTY_PROJECT_TAGS),
  );
  const methods: Record<string, unknown> = {};
  for (const method of ["per-element", "per-interaction"] as StrideMethod[]) {
    if (disabled.includes(method)) {
      methods[method] = { skipped: "disabled by the regulation preset" };
      continue;
    }
    const keyFn = keyFnFor(method);
    const fresh = generateFresh(input.data, input.context, configuration, method);
    // Keyed by natural key (stable across runs); a repeated key gets #2, #3 …
    const threats: Record<string, unknown> = {};
    for (const table of fresh) {
      for (const threat of table.threats) {
        const base = keyFn(threat) ?? `nokey:${threat.displayId}`;
        let key = base;
        for (let n = 2; key in threats; n++) key = `${base}#${n}`;
        threats[key] = { table: table.displayIdentifier, ...stripVolatile(threat) };
      }
    }
    const storedThreats = storedTables(input.data, method).flatMap((t) => t.threats);
    const drift = detectGenerationDrift(input.data, input.context, configuration, method);
    methods[method] = {
      count: Object.keys(threats).length,
      threats,
      stored: {
        generated: storedThreats.filter((t: Threat) => t.source !== "manual").length,
        manual: storedThreats.filter((t: Threat) => t.source === "manual").length,
      },
      drift: {
        added: drift.addedCount,
        obsolete: drift.obsolete.map((o) => ({
          displayId: o.displayId,
          stride: o.strideCategory,
          element: o.ownerDisplayId ?? o.elementName,
        })),
      },
    };
  }
  return {
    configuration: stored ? "stored" : "default",
    activeMethod: configuration.activeMethod,
    methods,
  };
}

// ==================== RISKS ====================

function dumpRisks(project: Project) {
  const riskData = project.risks;
  if (!riskData?.risks?.length) return { skipped: "no risks" };
  const configuration = riskData.configuration;
  const assets = project.assets?.assets;
  const assetDataRef = assets?.length
    ? buildAssetDataReference(
        assets,
        buildAssetHazardLinks(project.hazards ?? null),
        project.assets?.configuration?.impactScale ?? "4-level",
        project.assets?.configuration?.impactCriteria,
      )
    : undefined;
  const iso = isIsoProject(project) ? computeIsoRisks(project).risks?.risks : undefined;
  // EN 50742 (O18): the relevance of each risk's anchor, as the Risk tab gets it.
  const prepared =
    en50742ApproachFromTags(project.info?.tags ?? EMPTY_PROJECT_TAGS) !== undefined
      ? prepareProjectCompliance(project)
      : undefined;
  const relevance = prepared?.en50742Relevance();
  // Patch 22: SRSL0 only for a completely isolated safety function.
  const isolation = prepared?.en50742Isolation();
  const threatsById = new Map<string, Parameters<typeof threatRelevance>[0] & { linkedAssetIds?: string[] }>([
    ...[...(project.threats?.perElementTables ?? []), ...(project.threats?.perInteractionTables ?? [])]
      .flatMap((t) => t.threats)
      .map((t) => [t.id, t] as const),
    // attack paths (review 2026-11-21): relevance from the leaves' DFD refs
    ...(relevance
      ? buildAttackPathThreatReferences(project.attackTrees, false, project.info?.tags ?? EMPTY_PROJECT_TAGS).map(
          (t) => [t.id, t] as const,
        )
      : []),
  ]);
  const resolveRef = dfdRefResolver(project.dfd);
  const relevantOf = (threatId: string) => {
    const threat = threatsById.get(threatId);
    return relevance && threat ? threatRelevance(threat, relevance, resolveRef).relevant : undefined;
  };
  const isolatedOf = (threatId: string) => {
    const threat = threatsById.get(threatId);
    return isolation && threat ? threatIsolation(threat.linkedAssetIds, isolation)?.isolated : undefined;
  };
  const isoById = new Map((iso ?? []).map((r) => [r.id, r.isoRisk]));
  const risks: Record<string, unknown> = {};
  for (const risk of riskData.risks) {
    const en50742Relevant = relevantOf(risk.threatId);
    const before = recalculateRiskValues(risk, configuration, assetDataRef, en50742Relevant, isolatedOf(risk.threatId));
    const after = risk.mitigatedFactorRatings
      ? calculateRiskValues(risk.mitigatedFactorRatings, configuration)
      : undefined;
    const value = {
      threat: risk.threatDisplayId,
      stride: risk.strideCategory,
      method: risk.sourceStrideMethod,
      treatment: risk.treatment,
      impact: before.calculatedImpact,
      likelihood: before.calculatedLikelihood,
      riskBefore: before.calculatedRiskBeforeMitigation,
      riskAfter: after?.risk,
      srsl: before.calculatedSrsl,
      apScore: before.calculatedApScore,
      apBand: before.calculatedApBand,
      iso: isoById.get(risk.id),
      en50742Relevant,
    };
    // What the file says, only where the current code computes otherwise —
    // a stale stored value is a finding of its own, not a result change.
    const storedDiffers =
      (risk.calculatedSrsl ?? null) !== (before.calculatedSrsl ?? null) ||
      risk.calculatedImpact !== before.calculatedImpact ||
      risk.calculatedLikelihood !== before.calculatedLikelihood ||
      risk.calculatedRiskBeforeMitigation !== before.calculatedRiskBeforeMitigation;
    risks[risk.id] = storedDiffers
      ? {
          ...value,
          stored: {
            impact: risk.calculatedImpact,
            likelihood: risk.calculatedLikelihood,
            riskBefore: risk.calculatedRiskBeforeMitigation,
            srsl: risk.calculatedSrsl,
          },
        }
      : value;
  }
  return {
    count: riskData.risks.length,
    progress: calculateProgress(riskData.risks),
    findings: riskFindings(riskData).map((f) => ({
      code: f.code,
      severity: f.severity,
      count: f.count,
      riskIds: f.riskIds ? [...f.riskIds].sort() : undefined,
    })),
    risks,
  };
}

// ==================== COMPLIANCE ====================

function dumpCompliance(project: Project) {
  const standards = activeStandards(project.info?.tags);
  if (standards.length === 0) return { skipped: "no active standard" };
  const context = prepareProjectCompliance(project);
  if (!context) return { skipped: "no DFD" };
  const out: Record<string, unknown> = {};
  for (const standard of standards) {
    const result = context.evaluate(standard.edition);
    const byLabel = (rows: readonly { label: string }[]) =>
      Object.fromEntries(rows.map((r) => [r.label, r]));
    out[standard.id] = {
      scope: [...result.scope].sort(),
      achieved: { ...result.achieved, rows: byLabel(result.achieved.rows) },
      planned: { ...result.planned, rows: byLabel(result.planned.rows) },
    };
  }
  return out;
}

// ==================== ENTRY ====================

/**
 * Ids a migration or repair creates on load (older files) would differ per
 * run: while dumping, crypto.randomUUID counts up from a fixed start. The
 * dumps of current files contain none of them; for an older file a change in
 * the number of ids created before it shifts them (a known limit — the diff
 * then shows renamed ids, not changed results).
 */
function withStableIds<T>(run: () => T): T {
  const original = crypto.randomUUID;
  let n = 0;
  crypto.randomUUID = () =>
    `00000000-0000-4000-8000-${(++n).toString(16).padStart(12, "0")}` as ReturnType<typeof crypto.randomUUID>;
  try {
    return run();
  } finally {
    crypto.randomUUID = original;
  }
}

/** The dump of one project file's content (parsed JSON). */
export function dumpProject(raw: unknown, header: DumpHeader): Record<string, unknown> {
  return withStableIds(() => dump(raw, header));
}

function load(raw: unknown, name: string) {
  const migrated = parseAndRepairWithMetadata(structuredClone(raw));
  if (!migrated) throw new Error(`${name}: not a TARAflow project`);
  return migrated;
}

/**
 * Only the threat part of a dump — what the threat catalogue version guards
 * (threat-catalog-version.golden.test.ts).
 */
export function dumpThreatResults(raw: unknown, name: string): Record<string, unknown> {
  return withStableIds(() => dumpThreats(load(raw, name).project));
}

function dump(raw: unknown, header: DumpHeader): Record<string, unknown> {
  const migrated = load(raw, header.inputFile);
  const project = migrated.project;
  return {
    format: RESULTS_DUMP_FORMAT,
    header,
    project: {
      name: project.info?.name,
      schemaVersion: project.schemaVersion,
      migratedFrom: migrated.migrated ? migrated.fromVersion : undefined,
      tags: project.info?.tags,
    },
    threats: dumpThreats(project),
    risks: dumpRisks(project),
    compliance: dumpCompliance(project),
  };
}
