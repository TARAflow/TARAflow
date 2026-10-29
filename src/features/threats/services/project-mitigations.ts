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
