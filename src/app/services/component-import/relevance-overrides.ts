// ==================== RELEVANCE OVERRIDES ====================
// Multi-project TARA (design §17 I3, patch 15): the machine's relevance
// decision on a threat of a component's boundary flow. Pure: returns the new
// components block; the app writes it (diff-detected with the instance).

import type { ComponentRelevanceOverride } from "shared";
import type { Project } from "../../models/project-types";

export type RelevanceDecision = Pick<ComponentRelevanceOverride, "relevance" | "rationale" | "componentRelevance">;

/** Sets (decision) or removes (null) the override of one threat of one instance. */
export function withRelevanceOverride(
  components: NonNullable<Project["components"]>,
  instanceId: string,
  threatKey: string,
  decision: RelevanceDecision | null,
  today: string,
): NonNullable<Project["components"]> {
  if (decision && !decision.rationale.trim()) throw new Error("A relevance override needs a rationale.");
  return {
    ...components,
    instances: components.instances.map((i) => {
      if (i.id !== instanceId) return i;
      const others = (i.relevanceOverrides ?? []).filter((o) => o.threatKey !== threatKey);
      const next = decision
        ? [...others, { threatKey, relevance: decision.relevance, rationale: decision.rationale.trim(), componentRelevance: decision.componentRelevance, date: today }]
        : others;
      const { relevanceOverrides: _old, ...rest } = i;
      return next.length > 0 ? { ...rest, relevanceOverrides: next } : rest;
    }),
  };
}
