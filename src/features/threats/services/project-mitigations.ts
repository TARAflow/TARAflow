// ==================== PROJECT MITIGATION CATALOG ====================
// Custom mitigation catalog design CM-2 (doc/InProgress/Threat/
// custom-mitigation-catalog.md): the analyst's own mitigations M-C-nnn with
// text, STRIDE category and DFD effects, stored in
// `threats.configuration.customMitigations`. Pure operations on the
// configuration; whether an entry is still used is the app's
// `projectMitigationUsage` (it spans threats, risks and attack trees).

import type {
  MitigationPropertyEffect,
  ProjectMitigation,
  ThreatConfiguration,
} from "../models/threat-types";
import type { AttackVector, StrideCategory } from "shared";

export const PROJECT_MITIGATION_PREFIX = "M-C-";

export function isProjectMitigationId(id: string | undefined): boolean {
  return !!id && id.startsWith(PROJECT_MITIGATION_PREFIX);
}

const numberOf = (id: string) => {
  const n = /^M-C-(\d+)$/.exec(id)?.[1];
  return n ? Number(n) : 0;
};

/** "M-C-001" … — one past the highest number ever issued (never reused). */
export function nextProjectMitigationId(configuration: Pick<ThreatConfiguration, "customMitigations" | "customMitigationSeq">): string {
  const max = Math.max(
    configuration.customMitigationSeq ?? 0,
    ...(configuration.customMitigations ?? []).map((m) => numberOf(m.id)),
  );
  return `${PROJECT_MITIGATION_PREFIX}${String(max + 1).padStart(3, "0")}`;
}

export interface ProjectMitigationInput {
  text: string;
  strideCategory: StrideCategory;
  description?: string;
  attackVectors?: AttackVector[];
  affectsProperties?: MitigationPropertyEffect[];
}

/** Add an entry; returns the configuration and the new id. */
export function addProjectMitigation(
  configuration: ThreatConfiguration,
  input: ProjectMitigationInput,
): { configuration: ThreatConfiguration; id: string } {
  const id = nextProjectMitigationId(configuration);
  const entry: ProjectMitigation = {
    id,
    text: input.text.trim(),
    strideCategory: input.strideCategory,
    context: {},
    isCustom: true,
    affectsProperties: input.affectsProperties ?? [],
    ...(input.description?.trim() ? { description: input.description.trim() } : {}),
    ...(input.attackVectors?.length ? { attackVectors: input.attackVectors } : {}),
  };
  return {
    id,
    configuration: {
      ...configuration,
      customMitigations: [...(configuration.customMitigations ?? []), entry],
      customMitigationSeq: numberOf(id),
    },
  };
}

export function updateProjectMitigation(
  configuration: ThreatConfiguration,
  id: string,
  change: Partial<Omit<ProjectMitigation, "id" | "isCustom">>,
): ThreatConfiguration {
  return {
    ...configuration,
    customMitigations: (configuration.customMitigations ?? []).map((m) =>
      m.id === id ? { ...m, ...change, ...(change.text !== undefined ? { text: change.text.trim() } : {}) } : m,
    ),
  };
}

/** Remove an entry — the caller checks it is unused (design §3: delete only unused). */
export function removeProjectMitigation(configuration: ThreatConfiguration, id: string): ThreatConfiguration {
  return {
    ...configuration,
    customMitigations: (configuration.customMitigations ?? []).filter((m) => m.id !== id),
  };
}

// ==================== EFFECT VOCABULARY ====================
// Design §3: the effects editor offers what the closed loop knows — the
// target / property / value combinations the built-in catalog uses — so a
// project mitigation never names a property the DFD and the drift check do
// not have.

export interface EffectVocabularyEntry {
  targetType: MitigationPropertyEffect["targetType"];
  role?: MitigationPropertyEffect["role"];
  property: string;
  /** Expected values seen in the catalog (JSON-comparable). */
  values: unknown[];
}

export function effectVocabulary(catalog: readonly { affectsProperties?: MitigationPropertyEffect[]; isCustom?: boolean }[]): EffectVocabularyEntry[] {
  const byKey = new Map<string, EffectVocabularyEntry>();
  for (const entry of catalog) {
    if (entry.isCustom) continue;
    for (const e of entry.affectsProperties ?? []) {
      const key = `${e.targetType}|${e.role ?? ""}|${e.property}`;
      const v = byKey.get(key) ?? { targetType: e.targetType, ...(e.role ? { role: e.role } : {}), property: e.property, values: [] };
      if (!v.values.some((x) => JSON.stringify(x) === JSON.stringify(e.expectedValue))) v.values.push(e.expectedValue);
      byKey.set(key, v);
    }
  }
  return [...byKey.values()].sort((a, b) =>
    `${a.targetType}|${a.role ?? ""}|${a.property}`.localeCompare(`${b.targetType}|${b.role ?? ""}|${b.property}`),
  );
}

/** Analyst-defined effects are always heuristic (design §3). */
export function projectEffect(
  v: Pick<EffectVocabularyEntry, "targetType" | "role" | "property">,
  expectedValue: unknown,
): MitigationPropertyEffect {
  return {
    targetType: v.targetType,
    ...(v.role ? { role: v.role } : {}),
    property: v.property,
    expectedValue,
    confidence: "heuristic",
  };
}
