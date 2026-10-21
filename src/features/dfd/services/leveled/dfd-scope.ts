// ==================== DFD SCOPE ====================
// Leveled-DFD Phase 6f (leveled-dfd-multi-diagram-design.md §10): the
// index behind the page and analysis-state filters of the threat and risk
// tables — pages in tree order, what each page shows (definitions and
// context copies), its child pages, and the flows analysed on a parent
// level.

import type { DfdScopeIndex } from "shared";
import type { LeveledAnalysis } from "./leveled-analysis";

export function dfdScopeFrom(
  analysis: Pick<LeveledAnalysis, "parse" | "tree" | "model">,
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
  };
}
