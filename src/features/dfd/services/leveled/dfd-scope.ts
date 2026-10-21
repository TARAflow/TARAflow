// ==================== DFD SCOPE ====================
// Leveled-DFD Phase 6f (leveled-dfd-multi-diagram-design.md §10): the
// index behind the page and analysis-state filters of the threat and risk
// tables — pages in tree order, what each page shows (definitions and
// context copies), its child pages, the flows analysed on a parent
// level, and per decomposed multiprocess what lies inside it (risk-matrix
// roll-up).

import type { DfdScopeIndex } from "shared";
import type { LeveledAnalysis } from "./leveled-analysis";

export function dfdScopeFrom(
  analysis: Pick<LeveledAnalysis, "parse" | "tree" | "model" | "records">,
): DfdScopeIndex {
  const { parse, tree, model } = analysis;
  const names = new Map(parse.pages.map((p) => [p.pageId, p.name || p.pageId]));
  const placed = tree.pages;

  const itemsOnPage: Record<string, string[]> = {};
  for (const page of placed) itemsOnPage[page.pageId] = [];
  for (const o of parse.occurrences) {
    const items = itemsOnPage[o.pageId];
    if (items && !items.includes(o.tfId)) items.push(o.tfId);
  }

  const childPages: Record<string, string[]> = {};
  for (const page of placed) {
    const parent = tree.parentOf.get(page.pageId);
    if (parent) (childPages[parent] ??= []).push(page.pageId);
  }

  return {
    pages: placed.map((p) => ({
      pageId: p.pageId,
      name: names.get(p.pageId) ?? p.name ?? p.pageId,
      depth: tree.depthOf.get(p.pageId)!,
    })),
    itemsOnPage,
    childPages,
    parentLevelFlows: model.flows.filter((f) => f.state === "fallback").map((f) => f.tfId),
    multiprocesses: multiprocessesOf(analysis),
  };
}

function multiprocessesOf(
  analysis: Pick<LeveledAnalysis, "tree" | "model" | "records">,
): DfdScopeIndex["multiprocesses"] {
  const { tree, model, records } = analysis;
  const parent = model.containmentParent;
  const ancestors = (tfId: string): string[] => {
    const out: string[] = [];
    for (let current = parent.get(tfId); current && !out.includes(current); current = parent.get(current)) {
      out.push(current);
    }
    return out;
  };
  const items = new Map<string, string[]>();
  const add = (mp: string, tfId: string) => items.set(mp, [...(items.get(mp) ?? []), tfId]);
  for (const tfId of parent.keys()) for (const mp of ancestors(tfId)) add(mp, tfId);
  // A flow lies inside every multiprocess that holds both of its ends.
  for (const flow of model.flows) {
    const to = new Set(ancestors(flow.to));
    for (const mp of ancestors(flow.from)) if (to.has(mp)) add(mp, flow.tfId);
  }
  const label = (id: string) => {
    const r = records.elements.get(id);
    return r ? [r.displayId, r.name].filter(Boolean).join(" ") || id : id;
  };
  return tree.pages
    .map((p) => p.decomposes)
    .filter((mp): mp is string => !!mp && items.has(mp))
    .map((mp) => ({
      tfId: mp,
      label: label(mp),
      depth: ancestors(mp).length,
      items: items.get(mp)!,
    }));
}
