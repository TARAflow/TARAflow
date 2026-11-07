// ==================== PATH OVERLAYS ====================
// Multi-project TARA (design §7.2, patch 17): the machine's window of
// opportunity on a path of a component's attack tree, per instance and
// pathKey. Pure: returns the new components block (diff-detected with the
// instance).

import type { ComponentPathOverlay } from "shared";
import type { Project } from "../../models/project-types";

/** Sets (level) or removes (null) the window of opportunity of one path. */
export function withPathOverlay(
  components: NonNullable<Project["components"]>,
  instanceId: string,
  treeKey: string,
  pathKey: string,
  windowOfOpportunity: ComponentPathOverlay["windowOfOpportunity"] | null,
  today: string,
): NonNullable<Project["components"]> {
  return {
    ...components,
    instances: components.instances.map((i) => {
      if (i.id !== instanceId) return i;
      const others = (i.pathOverlays ?? []).filter((o) => !(o.treeKey === treeKey && o.pathKey === pathKey));
      const next = windowOfOpportunity ? [...others, { treeKey, pathKey, windowOfOpportunity, date: today }] : others;
      const { pathOverlays: _old, ...rest } = i;
      return next.length > 0 ? { ...rest, pathOverlays: next } : rest;
    }),
  };
}
