// src/app/services/rating-loss.ts
//
// A tag change can switch off risk factors (the base method or EN 50742 A
// changes): the reconciliation keeps only the ratings of the active factors
// (riskService.updateConfiguration), so the ratings of the switched-off ones
// are deleted. The Overview asks before it saves such a change (user
// 2026-11-21: a warning, no parked data — a committed project can be taken
// back from the repository).
//
// Pure: runs the same reconciliation as the save (applyRegulationFromTags)
// and compares the ratings per risk.

import type { Project } from "../models/project-types";
import type { ProjectTags } from "shared";
import type { RatingLoss } from "features/overview";
import { applyRegulationFromTags } from "./regulation-preset-orchestrator";
import { ALL_PREDEFINED_FACTORS } from "features/risks/models/risk-factor-types";

interface RatedRisk {
  id: string;
  factorRatings?: readonly { factorId: string; value: number }[];
  mitigatedFactorRatings?: readonly { factorId: string; value: number }[];
}

const rated = (ratings: RatedRisk["factorRatings"]) =>
  new Set((ratings ?? []).filter((r) => r.value > 0).map((r) => r.factorId));

/** What saving `tags` would delete, or undefined when no rating goes. */
export function ratingLossOfTagChange(project: Project, tags: ProjectTags): RatingLoss | undefined {
  if (!project.risks || project.risks.risks.length === 0) return undefined;
  const after = applyRegulationFromTags(
    { ...project, info: { ...project.info, tags } },
    project.info?.windowOfOpportunity,
  ).project;
  const afterById = new Map((after.risks?.risks ?? []).map((r) => [r.id, r as RatedRisk]));

  const factorIds = new Set<string>();
  let ratings = 0;
  let risks = 0;
  for (const risk of project.risks.risks as RatedRisk[]) {
    const next = afterById.get(risk.id);
    let lost = 0;
    for (const field of ["factorRatings", "mitigatedFactorRatings"] as const) {
      const kept = rated(next?.[field]);
      for (const id of rated(risk[field])) {
        if (kept.has(id)) continue;
        factorIds.add(id);
        lost++;
      }
    }
    if (lost > 0) {
      risks++;
      ratings += lost;
    }
  }
  if (ratings === 0) return undefined;
  const custom = project.risks.configuration.customFactors ?? [];
  return {
    factors: [...factorIds].sort().map((id) => ({
      id,
      name: [...ALL_PREDEFINED_FACTORS, ...custom].find((f) => f.id === id)?.name ?? id,
    })),
    ratings,
    risks,
  };
}
