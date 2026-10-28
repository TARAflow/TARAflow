// app/utils/build-item-model-items.ts
//
// The model items a Definition section can link to (ISO/SAE 21434 conformance
// plan Phase 1 stage A, A-2): DFD elements and flows, DFD pages, assets — in
// that order, each sorted by display id. Pure; the app layer hands the list to
// the Overview tab, which imports no other feature.

import type { Project } from "app/models/project-types";
import type { ItemModelItem } from "features/overview";
import { compareDisplayIds } from "shared";

const label = (displayId: string | undefined, name: string | undefined, id: string) =>
  [displayId, name].filter((s) => s && s.trim()).join(" ") || id;

const byLabel = (a: { sort: string }, b: { sort: string }) => compareDisplayIds(a.sort, b.sort);

export function buildItemModelItems(
  project: Pick<Project, "dfd" | "assets">,
): ItemModelItem[] {
  const dfd = project.dfd;
  const elements = (dfd?.elements ?? [])
    .map((e) => ({
      sort: e.displayId || e.id,
      item: { id: e.id, kind: "element", label: label(e.displayId, e.name, e.id), detail: e.type } as ItemModelItem,
    }))
    .sort(byLabel);
  const flows = (dfd?.connections ?? [])
    .map((c) => ({
      sort: c.displayId || c.id,
      item: { id: c.id, kind: "flow", label: label(c.displayId, c.name, c.id) } as ItemModelItem,
    }))
    .sort(byLabel);
  const pages = (dfd?.pages ?? []).map(
    (p): ItemModelItem => ({ id: p.pageId, kind: "page", label: p.name || p.pageId }),
  );
  const assets = (project.assets?.assets ?? [])
    .map((a) => ({
      sort: a.displayId || a.id,
      item: {
        id: a.id,
        kind: "asset",
        label: label(a.displayId, a.name, a.id),
        detail: a.assetGroup,
      } as ItemModelItem,
    }))
    .sort(byLabel);
  return [...elements.map((x) => x.item), ...flows.map((x) => x.item), ...pages, ...assets.map((x) => x.item)];
}
