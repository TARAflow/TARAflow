// ==================== RESOLVE DFD GRAPH ====================
// Single Responsibility: return the derived DFD graph of a project, building
// it from the persisted elements/connections when it is missing.
//
// dfd.graph is DERIVED and never written to disk (prepare-for-disk drops it).
// It is rebuilt on load (use-project-manager ensureProjectGraph) and on every
// DFD save. Several consumers gate on it — most visibly the Threats tab, which
// is only rendered when a DFD analysis context exists. Until the thumbnail
// fix, the DFD editor saved a thumbnail on every project open, and that save
// rebuilt the graph as a side effect; with that save gone, any path that
// leaves a project without a graph showed an EMPTY Threats tab. Deriving the
// graph at the point of use removes that hidden dependency.

import { DefaultDFDGraphBuilder } from "features/dfd";
import type { Project } from "../models/project-types";

type ProjectDfd = Project["dfd"];
type DfdGraph = NonNullable<NonNullable<ProjectDfd>["graph"]>;

/**
 * The project's DFD graph: the stored one if present, otherwise built from
 * the persisted DFD. Undefined for an empty DFD or when building fails (the
 * failure is logged — it would otherwise surface only as an empty tab).
 */
export function resolveDfdGraph(dfd: ProjectDfd | null | undefined): DfdGraph | undefined {
  if (!dfd) return undefined;
  if (dfd.graph) return dfd.graph;
  if (!dfd.elements?.length) return undefined;
  try {
    console.warn("[workspace] DFD graph missing in project state — rebuilding from the persisted DFD");
    return new DefaultDFDGraphBuilder().build(dfd as any) as DfdGraph;
  } catch (err) {
    console.error("[workspace] DFD graph could not be built:", err);
    return undefined;
  }
}
