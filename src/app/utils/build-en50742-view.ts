// src/app/utils/build-en50742-view.ts
//
// EN 50742 Approach A (model coverage plan §8.1, CM-12): what the rows with
// risk or project evidence read, built from the project — the compliance
// feature imports `shared` only, so the risk-side knowledge (anchor type,
// mandated clauses per STRIDE and SRSL, design §11.4) is applied here.
//
//   risks            per risk: the SRSL (calculatedSrsl), the anchor's EL from
//                    the exposure_level rating (the input of the SRSL), the
//                    clauses mandated at that SRSL and the selected mandated
//                    controls `en50742-<clause>` with their status
//   safety functions assets with a physical impact (design §2: a safety
//                    function is an asset carrying the severity), with the
//                    interfaces on a path to them (safety-function-paths.ts)
//   interfaces       on such a path: Interfaces and flows with an EL above
//                    EL0; an Interface without EL is unrated (flows without
//                    EL are internal)
//   hazards          in-scope hazards without a contributes_to input
//   WoO, system definition (item definition sections boundary / environment)

import type { En50742Risk, En50742View, SrslLevel } from "features/compliance";
import {
  clauseFromMandatedId,
  en50742LevelFromRating,
  mandatedRequirementsForThreat,
  type Srsl,
  type SrslAnchorType,
} from "features/risks";
import { formatRiskLabel } from "shared";
import { DONE_MITIGATION_STATUSES } from "shared/models/control-instance";
import type { Project } from "../models/project-types";
import { pathAnchors, type SafetyPathInput } from "./safety-function-paths";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const SRSL_LEVEL: Record<Srsl, SrslLevel> = { SRSL0: 0, SRSL1: 1, SRSL2: 2, SRSL3: 3 };

const hasText = (text: string | undefined) => !!text && text.trim().length > 0;

function anchorOf(threat: Any): { id?: string; type?: SrslAnchorType } {
  const linked = threat?.linkedElement;
  if (linked?.elementId) {
    const type = linked.elementType === "Interface" ? "Interface" : linked.elementType === "DataFlow" ? "DataFlow" : undefined;
    return { id: linked.elementId, type };
  }
  const flow = threat?.dataFlow?.connectionId;
  return flow ? { id: flow, type: "DataFlow" } : {};
}

export function buildEn50742View(project: Project, paths: SafetyPathInput): En50742View {
  const threats = new Map<string, Any>(
    [
      ...((project.threats as Any)?.perElementTables ?? []).flatMap((t: Any) => t.threats ?? []),
      ...((project.threats as Any)?.perInteractionTables ?? []).flatMap((t: Any) => t.threats ?? []),
    ].map((t: Any) => [t.id, t]),
  );
  const elements = (project.dfd?.elements ?? []) as Any[];
  const connections = (project.dfd?.connections ?? []) as Any[];
  const typeOf = new Map<string, string>(elements.map((e) => [e.id, e.type]));
  const onPath = new Set<string>();
  const safetyFunctions = ((project.assets?.assets ?? []) as Any[])
    .filter((a) => !!a.physicalImpact)
    .map((a) => {
      const linked = ((a.linkedDFDElements ?? []) as Any[]).map((l) => l.elementId as string).filter(Boolean);
      const anchors = pathAnchors(linked, paths);
      for (const id of anchors) onPath.add(id);
      return {
        id: a.id as string,
        name: (a.name as string) ?? a.id,
        linked: linked.length > 0,
        interfaces: [...anchors].filter((id) => typeOf.get(id) === "Interface"),
      };
    });
  const safetyIds = new Set(safetyFunctions.map((s) => s.id));

  const risks: En50742Risk[] = ((project.risks?.risks ?? []) as Any[]).map((risk) => {
    const anchor = anchorOf(threats.get(risk.threatId));
    const srsl: SrslLevel | null | undefined =
      risk.calculatedSrsl === undefined ? undefined : risk.calculatedSrsl === null ? null : SRSL_LEVEL[risk.calculatedSrsl as Srsl];
    const elRating = (risk.factorRatings ?? []).find((f: Any) => f.factorId === "exposure_level")?.value ?? 0;
    const el = en50742LevelFromRating("exposure_level", elRating);
    const mandated =
      anchor.type && typeof srsl === "number"
        ? mandatedRequirementsForThreat(anchor.type, risk.strideCategory, risk.calculatedSrsl).map((r) => r.clause)
        : [];
    const controls = ((risk.selectedMitigations ?? []) as Any[]).flatMap((m) => {
      const clause = typeof m.id === "string" ? clauseFromMandatedId(m.id) : null;
      return clause ? [{ clause, done: DONE_MITIGATION_STATUSES.includes(m.status), planned: m.status !== "rejected" }] : [];
    });
    return {
      id: risk.id,
      label: formatRiskLabel(risk),
      ...(anchor.id ? { anchorId: anchor.id } : {}),
      safetyFunctionIds: ((risk.linkedAssetIds ?? []) as string[]).filter((id) => safetyIds.has(id)),
      srsl,
      ...(el ? { exposed: el !== "EL0" } : {}),
      mandated,
      anyOfMandated: mandated.length > 1,
      controls,
      accepted: risk.treatment === "accept",
      excluded: risk.moscowPriority === "wont" && hasText(risk.wontJustification),
    };
  });

  const hazards = (project.hazards?.hazards ?? []) as Any[];
  const relations = (project.hazards?.relations ?? []) as Any[];
  const contributed = new Set(relations.filter((r) => r.type === "contributes_to").map((r) => r.to));

  const exposed: string[] = [];
  const unrated: string[] = [];
  for (const item of [...elements.filter((e) => e.type === "Interface"), ...connections]) {
    if (!onPath.has(item.id)) continue;
    const level = item.properties?.exposureLevel;
    if (!level) {
      if (item.type === "Interface") unrated.push(item.id);
    } else if (level !== "EL0") {
      exposed.push(item.id);
    }
  }

  const sections = project.itemDefinition?.sections ?? {};
  const woo = (project.info as Any)?.windowOfOpportunity as string | undefined;
  return {
    ...(woo ? { windowOfOpportunity: woo } : {}),
    systemDefinition: { boundary: hasText(sections.boundary?.text), environment: hasText(sections.environment?.text) },
    hazards: {
      total: hazards.length,
      unlinked: hazards.filter((h) => h.systemRelevance !== "out_of_scope" && !contributed.has(h.id)).map((h) => h.label ?? h.id),
    },
    safetyFunctions,
    interfaces: { exposed, unrated },
    risks,
  };
}
