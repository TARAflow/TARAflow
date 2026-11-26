// src/tests/examples/en50742-examples.ts
//
// The two EN 50742 example projects for TARAflow_Examples (doc/Testing/manual/
// en-50742.md §9): Approach A and Approach B on the same small machine — the
// Simple Test Project (fixtures/examples/en50742.base.tara.json, drawn in the
// app; its tracker and audit settings removed). The trust boundary MTB is the
// safety zone: the flows crossing it and the interfaces they pass are EN 50742
// relevant (rule sheet R2).
//
// Like the other examples, only the analyst's decisions are written here —
// the tags, the store holding the audit records, the likelihood ratings and
// the attacker capability. Everything else runs through the REAL services:
// the regulation preset, the EN 50742 relevance and isolation (as the Risk
// tab gets them), the EL derived from the DFD, the risk calculation with its
// SRSL gate. en50742-examples.test.ts checks what the examples promise and
// writes the files when WRITE_EXAMPLES=<dir> is set.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Project } from "app/models/project-types";
import { applyRegulationPresetToProject } from "app/services/regulation-preset-orchestrator";
import { prepareProjectCompliance } from "app/services/compliance-report";
import { extractThreatReferences } from "app/utils/extract-threat-references";
import { buildAssetDataReference } from "app/utils/build-asset-data-reference";
import { buildAssetHazardLinks } from "app/utils/build-asset-hazard-links";
import { attackPathExposureLevel, dfdRefResolver, threatIsolation, threatRelevance } from "app/utils/en50742-relevance";
import { buildAttackPathThreatReferences } from "app/utils/build-attack-path-threat-references";
import { EMPTY_PROJECT_TAGS, regulationPresetFromTags, en50742ApproachFromTags, type ThreatReference } from "shared";
import { ALL_PREDEFINED_FACTORS, type FactorRating } from "features/risks/models/risk-factor-types";
import { calculateRiskValues } from "features/risks/services/risk-calculation-service";
import { recalculateRiskValues } from "features/risks/services/risk-sync-service";
import { applyExposureLevelToFactorRatings, EN50742_AC_FACTOR, EN50742_EL_FACTOR } from "features/risks/services/en50742-risk-calculation";
import {
  EN50742_ATTACKER_CAPABILITY_LEVELS,
  EN50742_EXPOSURE_LEVELS,
  EN50742_SRSL_FACTOR_IDS,
  type AttackerCapability,
} from "features/risks/models/en50742-approach-a-core";
import type { Risk } from "features/risks/models/risk-assessment-types";
import { getAllMitigations } from "features/threats";
import type { ComplianceData } from "shared/models/compliance-data-types";

const HERE = dirname(fileURLToPath(import.meta.url));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ProjectJson = any;

export const DATE = "2026-11-22T00:00:00.000Z";

export function loadBase(): ProjectJson {
  return JSON.parse(readFileSync(join(HERE, "../fixtures/examples/en50742.base.tara.json"), "utf-8"));
}

/** Likelihood the analyst rates per element: 3 on the interfaces reachable from outside, 2 elsewhere. */
const LIKELIHOOD_AT: Record<string, number> = { "IF-1": 3, "IF-2": 3, "DF-3": 3, "DF-4": 3 };

/**
 * Attacker capability per relevant anchor (A only): USB needs no more than a
 * basic attacker, the debug port (JTAG) a specialist; the flows over them
 * alike.
 */
/**
 * A relevant attack-path risk whose leaves name no DFD element: its relevance
 * cannot be told, so it counts (rule sheet R4), and no EL can be derived —
 * the analyst sets it: the tree's MITM and input attacks need local access.
 */
const PATH_EL = "EL2";
/** A relevant risk without an anchor of its own (an attack path): a medium attacker. */
const DEFAULT_CAPABILITY: AttackerCapability = "medium";
const CAPABILITY_AT: Record<string, AttackerCapability> = {
  "IF-1": "basic",
  "IF-2": "specialist",
  "DF-3": "basic",
  "DF-4": "specialist",
};

const isEn50742Factor = (id: string) => EN50742_SRSL_FACTOR_IDS.includes(id);
const isLikelihood = (id: string) =>
  !isEn50742Factor(id) && ALL_PREDEFINED_FACTORS.find((f) => f.id === id)?.category === "likelihood";

/** The threats as the Risk tab gets them: with the EN 50742 relevance and isolation. */
function threatReferences(project: Project): ThreatReference[] {
  const elements = [...(project.dfd?.elements ?? []), ...(project.dfd?.connections ?? [])];
  const assets = project.assets?.assets ?? [];
  const refs = [
    ...extractThreatReferences(project.threats, "per-element", assets, elements as never),
    ...extractThreatReferences(project.threats, "per-interaction", assets, elements as never),
    // attack paths: their leaves name the DFD elements (rule sheet R4, R5)
    ...buildAttackPathThreatReferences(project.attackTrees, false, project.info?.tags ?? EMPTY_PROJECT_TAGS),
  ];
  const prepared = prepareProjectCompliance(project);
  const relevance = prepared?.en50742Relevance();
  const isolation = prepared?.en50742Isolation();
  if (!relevance) return refs;
  const resolveRef = dfdRefResolver(project.dfd);
  const levels = new Map(
    [...(project.dfd?.elements ?? []), ...(project.dfd?.connections ?? [])].map((e) => [e.id, (e.properties as { exposureLevel?: string })?.exposureLevel]),
  );
  const relevantIds = new Set(relevance.relevant.keys());
  return refs.map((ref) => {
    const r = threatRelevance(ref, relevance, resolveRef);
    const pathEl =
      r.relevant && ref.attackPathLeaves ? attackPathExposureLevel(ref.attackPathLeaves, resolveRef, (id) => levels.get(id), relevantIds) : undefined;
    const iso = isolation ? threatIsolation(ref.linkedAssetIds, isolation) : undefined;
    return {
      ...ref,
      en50742: { relevant: r.relevant, reason: "", ...(pathEl ? { exposureLevel: pathEl } : {}), ...(iso ? { functionIsolated: iso.isolated } : {}) },
    };
  });
}

/** The DFD as the risk services read it (anchor properties for the EL). */
function dfdReference(project: Project) {
  const dfd = project.dfd!;
  return {
    processes: dfd.elements
      .filter((e) => e.type === "Process" || e.type === "Multiprocess")
      .map((e) => ({ id: e.id, label: e.name ?? e.id })),
    elements: dfd.elements.map((e) => ({ id: e.id, properties: e.properties })),
    connections: dfd.connections.map((c) => ({ id: c.id, properties: c.properties })),
  };
}

/**
 * The analyst's rating of every risk, then the values through the risk
 * service: likelihood per element (residual one level lower with chosen
 * mitigations), in Approach A the EL from the DFD and the attacker capability
 * on the relevant risks.
 */
function rateRisks(project: Project): Project {
  const riskData = project.risks!;
  const configuration = riskData.configuration;
  const refs = new Map(threatReferences(project).map((r) => [r.id, r]));
  const dfdRef = dfdReference(project);
  const assetDataRef = buildAssetDataReference(
    project.assets!.assets,
    buildAssetHazardLinks(project.hazards ?? null),
    project.assets!.configuration.impactScale,
    project.assets!.configuration.impactCriteria,
  );
  const displayOf = new Map([...project.dfd!.elements, ...project.dfd!.connections].map((x) => [x.id, x.displayId ?? ""]));
  const approachA = en50742ApproachFromTags(project.info?.tags ?? EMPTY_PROJECT_TAGS) === "A";

  const known = new Set(getAllMitigations().map((m) => m.id));
  const risks = riskData.risks.map((input): Risk => {
    const ref = refs.get(input.threatId);
    // Reduce without a chosen mitigation: the first two catalog proposals,
    // planned (the analysis is done, the implementation is not).
    const proposals = (input.proposedMitigations ?? []).map((m) => m.id).filter((id): id is string => !!id && known.has(id));
    const risk =
      input.treatment === "reduce" && (input.selectedMitigations ?? []).length === 0 && proposals.length > 0
        ? { ...input, selectedMitigations: proposals.slice(0, 2).map((id) => ({ id, status: "open" as const })) }
        : input;
    const at = displayOf.get(ref?.linkedElement?.elementId ?? ref?.dataFlow?.connectionId ?? "") ?? "";
    const base = LIKELIHOOD_AT[at] ?? 2;
    const relevant = ref?.en50742?.relevant === true;
    const capability = CAPABILITY_AT[at] ?? DEFAULT_CAPABILITY;
    const rated = (ratings: FactorRating[], value: number): FactorRating[] =>
      ratings.map((r) => {
        if (isLikelihood(r.factorId)) return { ...r, value };
        if (r.factorId === EN50742_AC_FACTOR && approachA && relevant && capability) {
          return { ...r, value: EN50742_ATTACKER_CAPABILITY_LEVELS.indexOf(capability) + 1, source: "manual" as const };
        }
        return r;
      });
    let factorRatings = rated(risk.factorRatings, base);
    if (calculateRiskValues(factorRatings, configuration).impact === 0) {
      factorRatings = factorRatings.map((r) => (r.factorId === "operational" ? { ...r, value: 2, source: "manual" as const } : r));
    }
    if (ref) factorRatings = applyExposureLevelToFactorRatings(factorRatings, ref as never, dfdRef as never);
    if (approachA && relevant && ref?.attackPathLeaves) {
      factorRatings = factorRatings.map((r) =>
        r.factorId === EN50742_EL_FACTOR && !r.value
          ? { ...r, value: EN50742_EXPOSURE_LEVELS.indexOf(PATH_EL) + 1, source: "manual" as const }
          : r,
      );
    }
    const residual = (risk.selectedMitigations ?? []).length > 0 ? Math.max(1, base - 1) : base;
    const mitigatedFactorRatings = factorRatings.map((r) => (isLikelihood(r.factorId) ? { ...r, value: residual } : r));
    const after = calculateRiskValues(mitigatedFactorRatings, configuration);
    const computed = recalculateRiskValues(
      { ...risk, factorRatings, mitigatedFactorRatings },
      configuration,
      assetDataRef,
      ref?.en50742?.relevant,
      ref?.en50742?.functionIsolated,
    );
    return { ...computed, calculatedRiskAfterMitigation: after.risk, lastModified: DATE };
  });
  return { ...project, risks: { ...riskData, risks, lastModified: DATE } };
}

/** Tags, preset and the method configuration as the tag editor sets them. */
function withRegulation(project: ProjectJson, regulation: string[]): Project {
  const tags = { ...project.info.tags, regulation };
  const tagged = { ...project, info: { ...project.info, tags } } as Project;
  return applyRegulationPresetToProject(tagged, regulationPresetFromTags(tags), en50742ApproachFromTags(tags) === "A").project;
}

/** The store DS-1 holds the audit records of the safety function, kept five years (7.3.4, 8.5). */
function withAuditRecords(project: ProjectJson): ProjectJson {
  const dfd = project.dfd;
  return {
    ...project,
    dfd: {
      ...dfd,
      elements: dfd.elements.map((e: ProjectJson) =>
        e.displayId === "DS-1"
          ? {
              ...e,
              properties: {
                ...e.properties,
                storedDataTypes: [...new Set([...(e.properties?.storedDataTypes ?? []), "audit_logs"])],
                auditRecordRetention: "at_least_5_years",
              },
            }
          : e,
      ),
    },
  };
}

export interface Example {
  file: string;
  title: string;
  project: ProjectJson;
}

/**
 * Approach B: the component is an embedded device (EDR); the IEC 62443 target
 * follows the fixed SL-T of Table 4 (FR1–FR3, FR7: 2; FR5, FR6: 1), FR4 at 1.
 */
const COMPLIANCE_B: ComplianceData = {
  families: {
    "iec-62443-4-2": {
      target: { IAC: 2, UC: 2, SI: 2, DC: 1, RDF: 1, TRE: 1, RA: 2 },
      deviceCategories: { categories: ["EDR"], source: "manual" },
    },
    // the B matrix reads its own family's choice
    "en-50742": { deviceCategories: { categories: ["EDR"], source: "manual" } },
  },
};

function example(file: string, name: string, description: string, regulation: string[], compliance?: ComplianceData): Example {
  const loaded = withAuditRecords(loadBase());
  const base = compliance ? { ...loaded, compliance } : loaded;
  const project = rateRisks(
    withRegulation(
      {
        ...base,
        id: `example-${file.replace(/\.tara\.json$/, "").toLowerCase()}`,
        info: { ...base.info, name, description, lastModified: DATE },
      },
      regulation,
    ),
  );
  return { file, title: name, project };
}

export function buildExamples(): Example[] {
  return [
    example(
      "EN50742-A-SafetyZone.tara.json",
      "TARAflow Example – EN 50742 Approach A (safety zone)",
      "Small machine controller with a safety function (E-Stop). The trust boundary MTB is the safety zone: the flows crossing it and the interfaces they pass are EN 50742 relevant and get exposure level, attacker capability and an SRSL next to likelihood × impact; the other risks are rated as usual. Standard method + EN 50742 Approach A.",
      ["EN 50742 A"],
    ),
    example(
      "EN50742-B-SafetyZone.tara.json",
      "TARAflow Example – EN 50742 Approach B (safety zone)",
      "The same machine controller under EN 50742 Approach B: the IEC 62443-4-2 requirements of Table 4 for the safety functions with the fixed SL-T, next to the IEC 62443 matrix. The risks use the standard factors; B has no SRSL.",
      ["IEC 62443", "EN 50742 B"],
      COMPLIANCE_B,
    ),
  ];
}
