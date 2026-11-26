// src/features/threats/services/threat-text-repair.ts
//
// Unresolved i18n keys as stored threat text (doc/Open/persisted-threat-text-fix.md,
// roadmap 3.1, 0.20 patch 30). A catalog threat's texts are resolved once and
// stored. When a template's text did not exist yet, the resolver returned the
// raw key ("general.D-009.threat") — or, for the "general" domain itself,
// i18next's marker "__MISSING__" — and that string was saved and shown as is,
// even after the translation was added.
//
// Two parts:
//   - the resolvers (threat-catalog-service.ts) return a detectable
//     placeholder instead, "[D-009] (threat text pending translation)";
//   - loading repairs stored text that is a raw key, the marker or such a
//     placeholder: resolved again from the template's CURRENT domain in the
//     catalog (the stored key carries the fallback "general", not the real
//     domain). Still missing → the placeholder stays, detectable for the next
//     load. A text the analyst wrote is never touched.

import type { Threat, ThreatData, ThreatTable } from "../models/threat-types";
import { ALL_ELEMENT_TEMPLATES, ALL_INTERACTION_TEMPLATES } from "./catalog/threats/index";
import {
  getLocalizedElementAttack,
  getLocalizedElementCause,
  getLocalizedElementThreat,
  getLocalizedInteractionAttack,
  getLocalizedInteractionCause,
  getLocalizedInteractionThreat,
  pendingTranslationText,
} from "./threat-catalog-service";

export { pendingTranslationText };

type Kind = "threat" | "attack" | "cause";

const RAW_KEY = /^[a-z][a-z-]*\.([A-Z]+-\d+)\.(threat|attack|cause)$/;
const PLACEHOLDER = /^\[([A-Z]+-\d+)\] \((threat|attack|cause) text pending translation\)$/;
const MISSING_MARKER = "__MISSING__";

/** Stored text that is an unresolved i18n key, the i18next marker or the placeholder. */
export function isUnresolvedThreatText(value: string | undefined | null): boolean {
  return !!value && (value === MISSING_MARKER || RAW_KEY.test(value) || PLACEHOLDER.test(value));
}

/** The template id an unresolved text names, if it names one. */
function templateIdIn(value: string): string | undefined {
  return RAW_KEY.exec(value)?.[1] ?? PLACEHOLDER.exec(value)?.[1];
}

const FIELDS: { field: "threatDescription" | "attackDescription" | "causeDescription"; kind: Kind }[] = [
  { field: "threatDescription", kind: "threat" },
  { field: "attackDescription", kind: "attack" },
  { field: "causeDescription", kind: "cause" },
];

/**
 * The threat with its unresolved texts resolved again (same object when none
 * is unresolved). `table` gives an interaction threat its trust boundary name.
 */
export function repairThreatTexts(threat: Threat, method: "per-element" | "per-interaction", table?: ThreatTable): Threat {
  const broken = FIELDS.filter(({ field }) => isUnresolvedThreatText(threat[field] as string | undefined));
  if (broken.length === 0) return threat;
  const templateId = threat.templateId ?? broken.map(({ field }) => templateIdIn(threat[field] as string)).find(Boolean);
  if (!templateId) return threat;
  const templates = (method === "per-element" ? ALL_ELEMENT_TEMPLATES : ALL_INTERACTION_TEMPLATES) as { id: string; domain?: string }[];
  const domain = templates.find((t) => t.id === templateId)?.domain ?? "general";

  const flow = threat.dataFlow ?? {};
  const placeholders = {
    sourceName: flow.sourceName ?? "",
    targetName: flow.targetName ?? "",
    sourceType: flow.sourceType,
    targetType: flow.targetType,
    dataFlowName: flow.dataFlowId ?? flow.dataFlowName ?? "",
    trustBoundaryName: table?.trustBoundaryName ?? "",
  };
  const resolve = (kind: Kind): string =>
    method === "per-element"
      ? kind === "threat"
        ? getLocalizedElementThreat(templateId, domain)
        : kind === "attack"
          ? getLocalizedElementAttack(templateId, domain)
          : getLocalizedElementCause(templateId, domain)
      : kind === "threat"
        ? getLocalizedInteractionThreat(templateId, placeholders, domain)
        : kind === "attack"
          ? getLocalizedInteractionAttack(templateId, placeholders, domain)
          : getLocalizedInteractionCause(templateId, placeholders, domain);

  const next: Threat = { ...threat };
  let changed = false;
  for (const { field, kind } of broken) {
    const text = resolve(kind) || pendingTranslationText(templateId, kind);
    if (text !== threat[field]) {
      next[field] = text;
      changed = true;
    }
  }
  return changed ? next : threat;
}

/** Every stored threat repaired (same object when nothing changed). */
export function repairThreatDataTexts(data: ThreatData): ThreatData {
  const repairTables = (tables: ThreatTable[] | undefined, method: "per-element" | "per-interaction") => {
    if (!Array.isArray(tables)) return tables;
    let changed = false;
    const next = tables.map((table) => {
      const threats = (table.threats ?? []).map((t) => repairThreatTexts(t, method, table));
      if (threats.some((t, i) => t !== table.threats[i])) {
        changed = true;
        return { ...table, threats };
      }
      return table;
    });
    return changed ? next : tables;
  };
  const perElementTables = repairTables(data.perElementTables, "per-element");
  const perInteractionTables = repairTables(data.perInteractionTables, "per-interaction");
  if (perElementTables === data.perElementTables && perInteractionTables === data.perInteractionTables) return data;
  return { ...data, perElementTables: perElementTables ?? [], perInteractionTables: perInteractionTables ?? [] };
}
