// ==================== PATH OVERLAYS ====================
// Multi-project TARA (design §7.2, patch 17): the machine's window of
// opportunity on a path of a component's attack tree, per instance and
// pathKey — for an AND combination per step (leafId, review 2026-11-08).
// Pure: returns the new components block (diff-detected with the instance).

import type { ComponentPathOverlay } from "shared";
import type { Project } from "../../models/project-types";

/** The key of an overlay: tree, path and — for a step of an AND combination — leaf. */
export const overlayKey = (o: { treeKey: string; pathKey: string; leafId?: string }) =>
  `${o.treeKey}|${o.pathKey}|${o.leafId ?? ""}`;

/** Sets (level) or removes (null) the window of opportunity of one path or one step. */
export function withPathOverlay(
  components: NonNullable<Project["components"]>,
  instanceId: string,
  treeKey: string,
  pathKey: string,
  windowOfOpportunity: ComponentPathOverlay["windowOfOpportunity"] | null,
  today: string,
  leafId?: string,
): NonNullable<Project["components"]> {
  const key = overlayKey({ treeKey, pathKey, leafId });
  return {
    ...components,
    instances: components.instances.map((i) => {
      if (i.id !== instanceId) return i;
      const others = (i.pathOverlays ?? []).filter((o) => overlayKey(o) !== key);
      const next = windowOfOpportunity
        ? [...others, { treeKey, pathKey, ...(leafId ? { leafId } : {}), windowOfOpportunity, date: today }]
        : others;
      const { pathOverlays: _old, ...rest } = i;
      return next.length > 0 ? { ...rest, pathOverlays: next } : rest;
    }),
  };
}
