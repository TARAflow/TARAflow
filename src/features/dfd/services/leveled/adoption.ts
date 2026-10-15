// ==================== ADOPTION ====================
// Leveled-DFD Phase 1.5 (leveled-dfd-multi-diagram-design.md §11.2.1, D13).
//
// A multi-page file drawn before identity links existed (or outside
// TARAflow) has context copies that are plain cells: lazy identity makes
// every copy an element of its own, with a duplicate displayId. Adoption
// PROPOSES which cells are copies of which element and which page details
// which multiprocess; the analyst confirms (dialog, Phase 5); only then
// applyAdoption writes dfd.pages. Nothing is merged silently, the XML is
// never touched.
//
// Proposal (design §11.2.1):
//   1. Group: cells already linked to one tfId stay together (priority);
//      the remaining groups are merged by (displayId, type). A cell without
//      a real displayId stays a singleton. A (displayId, type) bucket that
//      holds two or more already-linked tfIds is a CONFLICT: nothing in it
//      is merged.
//   2. Decomposition: starting from the root, an unplaced page P is proposed
//      to detail the multiprocess M of a placed page K that is missing on P
//      and whose flow neighbours on K (flows touching M, elements at their
//      other end) appear most often on P. A tie is AMBIGUOUS, no candidate
//      UNPLACED — the analyst decides.
//   3. Definition per group: an existing definition stays; otherwise the
//      root page, then the highest page (minimal depth), then a technical
//      tie-break (page order, then lower cell id) that the dialog shows.
//   4. Label divergence among the merged records is flagged.

import type { DFDCellLink, DFDPage } from "../../models/dfd-types";
import type { ParseResult, ParsedOccurrence } from "../dfd-parser";
import type { CellRef } from "./identity-links";
import { computeHomePages } from "./home-pages";
import { buildPageTree } from "./page-tree";
import {
  recordInfos,
  recordKey,
  signatureOf,
  type RecordInfo,
} from "./signatures";

type Kind = ParsedOccurrence["kind"];

export type DefinitionReason = "existing" | "root" | "highest" | "tie-break";

export interface AdoptionGroup {
  /** `${kind}:${tfId}` — stable key for decisions */
  key: string;
  kind: Kind;
  type: string;
  displayId: string;
  /** Logical identity the group keeps. */
  tfId: string;
  definition: CellRef;
  definitionReason: DefinitionReason;
  /** All other cells of the group — they become context copies. */
  copies: CellRef[];
  /** The merged records carry different labels (BAL_LABEL_DIVERGENCE). */
  labelDivergence: boolean;
  /** Other already-linked tfIds sharing this (displayId, type): not merged. */
  conflictWith?: string[];
}

export type PageStatus =
  "root" | "existing" | "proposed" | "ambiguous" | "unplaced";

export interface AdoptionPage {
  pageId: string;
  name: string;
  status: PageStatus;
  /** Proposed (or existing) decomposed multiprocess tfId. */
  decomposes?: string;
  /** Candidate multiprocess tfIds, best first (for ambiguous / to override). */
  candidates: string[];
}

export interface AdoptionProposal {
  pages: AdoptionPage[];
  /** Groups the dialog shows: merges (≥ 2 cells) and conflicts. */
  groups: AdoptionGroup[];
}

export interface AdoptionInput {
  /** The XML parsed with the current dfd.pages (existing links applied). */
  parse: Pick<
    ParseResult,
    "pages" | "elements" | "connections" | "occurrences"
  >;
  persistedPages?: readonly DFDPage[];
}

// ---------------------------------------------------------------------------

interface Member {
  info: RecordInfo;
  occurrences: ParsedOccurrence[];
  /** Carries a link already (copy or moved definition). */
  linked: boolean;
}

interface Merged {
  kind: Kind;
  type: string;
  displayId: string;
  members: Member[];
  occurrences: ParsedOccurrence[];
  conflictWith?: string[];
}

export function proposeAdoption(input: AdoptionInput): AdoptionProposal {
  const { parse } = input;
  const merged = mergeGroups(parse);

  const groupOf = new Map<string, Merged>();
  for (const g of merged) {
    for (const m of g.members)
      groupOf.set(recordKey(m.info.kind, m.info.tfId), g);
  }
  const lookup = (kind: Kind, tfId: string | undefined) =>
    tfId === undefined ? undefined : groupOf.get(recordKey(kind, tfId));

  const placement = placePages(input, merged, lookup);
  const docIndex = new Map(parse.pages.map((p) => [p.pageId, p.index]));

  // Definitions — and with them the tfId every merged group keeps — depend
  // on the page depths, so decomposition targets are named only now.
  const described = new Map<Merged, AdoptionGroup>();
  for (const g of merged) {
    described.set(g, describeGroup(g, placement.depth, docIndex));
  }
  const tfIdOf = (g: Merged) => described.get(g)!.tfId;

  const pages = placement.pages.map((p) => ({
    pageId: p.pageId,
    name: p.name,
    status: p.status,
    ...(p.decomposes !== undefined
      ? {
          decomposes:
            typeof p.decomposes === "string"
              ? p.decomposes
              : tfIdOf(p.decomposes),
        }
      : {}),
    candidates: p.candidates.map(tfIdOf),
  }));

  const groups = merged
    .filter((g) => g.occurrences.length > 1 || g.conflictWith)
    .map((g) => described.get(g)!);

  return { pages, groups };
}

/** Merge by tfId first (links), then by (displayId, type). */
function mergeGroups(parse: AdoptionInput["parse"]): Merged[] {
  const infos = recordInfos(parse);
  const members = new Map<string, Member>();
  for (const o of parse.occurrences) {
    const key = recordKey(o.kind, o.tfId);
    const info = infos.get(key);
    if (!info) continue;
    const m = members.get(key) ?? { info, occurrences: [], linked: false };
    m.occurrences.push(o);
    if (o.role === "ref" || o.tfId !== o.cellId) m.linked = true;
    members.set(key, m);
  }

  const buckets = new Map<string, Member[]>();
  const result: Merged[] = [];
  for (const m of members.values()) {
    const signature = signatureOf(m.info);
    if (signature === undefined) {
      result.push(single(m));
      continue;
    }
    buckets.set(signature, [...(buckets.get(signature) ?? []), m]);
  }

  for (const bucket of buckets.values()) {
    const linked = bucket.filter((m) => m.linked);
    if (linked.length >= 2) {
      const tfIds = linked.map((m) => m.info.tfId);
      for (const m of bucket) {
        result.push({
          ...single(m),
          conflictWith: tfIds.filter((id) => id !== m.info.tfId),
        });
      }
      continue;
    }
    const first = bucket[0].info;
    result.push({
      kind: first.kind,
      type: first.type,
      displayId: first.displayId,
      members: bucket,
      occurrences: bucket.flatMap((m) => m.occurrences),
    });
  }

  // Document order of the first occurrence keeps the proposal stable.
  const order = new Map(parse.occurrences.map((o, i) => [o, i]));
  for (const g of result)
    g.occurrences.sort((a, b) => order.get(a)! - order.get(b)!);
  return result.sort(
    (a, b) => order.get(a.occurrences[0])! - order.get(b.occurrences[0])!,
  );
}

function single(m: Member): Merged {
  return {
    kind: m.info.kind,
    type: m.info.type,
    displayId: m.info.displayId,
    members: [m],
    occurrences: [...m.occurrences],
  };
}

// ---------------------------------------------------------------------------

interface PagePlacement {
  pageId: string;
  name: string;
  status: PageStatus;
  /** tfId (pages already in dfd.pages) or the merged MP group (proposals). */
  decomposes?: string | Merged;
  candidates: Merged[];
}

function placePages(
  input: AdoptionInput,
  merged: Merged[],
  lookup: (kind: Kind, tfId: string | undefined) => Merged | undefined,
): { pages: PagePlacement[]; depth: Map<string, number> } {
  const { parse, persistedPages } = input;
  const groupOfOccurrence = (o: ParsedOccurrence) => lookup(o.kind, o.tfId)!;

  // Pages already in dfd.pages keep their place (tree built as usual).
  const tree = buildPageTree({
    parsedPages: parse.pages,
    persistedPages,
    elements: parse.elements,
    occurrences: parse.occurrences,
    homePages: computeHomePages(parse.occurrences),
  });
  const depth = new Map(tree.depthOf);
  const decided = new Map<string, PagePlacement>();
  for (const p of tree.pages) {
    decided.set(p.pageId, {
      pageId: p.pageId,
      name: p.name,
      status: p.pageId === tree.rootPageId ? "root" : "existing",
      ...(p.decomposes ? { decomposes: p.decomposes } : {}),
      candidates: [],
    });
  }
  const decomposed = new Set<Merged>();
  for (const p of tree.pages) {
    const g = p.decomposes ? lookup("element", p.decomposes) : undefined;
    if (g) decomposed.add(g);
  }

  // Which merged groups occur on which page.
  const onPage = new Map<string, Set<Merged>>();
  for (const o of parse.occurrences) {
    const set = onPage.get(o.pageId) ?? new Set<Merged>();
    set.add(groupOfOccurrence(o));
    onPage.set(o.pageId, set);
  }
  // Flow neighbourhood of a multiprocess on a page: flows touching it and the
  // groups at their other end.
  const neighbours = (mp: Merged, pageId: string): Set<Merged> => {
    const result = new Set<Merged>();
    for (const o of parse.occurrences) {
      if (o.kind !== "connection" || o.pageId !== pageId) continue;
      const source = lookup("element", o.sourceTfId);
      const target = lookup("element", o.targetTfId);
      if (source !== mp && target !== mp) continue;
      result.add(groupOfOccurrence(o));
      for (const end of [source, target])
        if (end && end !== mp) result.add(end);
    }
    return result;
  };

  const unresolved = new Map<string, PagePlacement>();
  let progress = true;
  while (progress) {
    progress = false;
    for (const page of parse.pages) {
      if (decided.has(page.pageId)) continue;
      const here = onPage.get(page.pageId) ?? new Set<Merged>();

      const scores = new Map<Merged, { score: number; depth: number }>();
      for (const [placedId, placedDepth] of depth) {
        for (const g of onPage.get(placedId) ?? []) {
          if (g.type !== "Multiprocess" || here.has(g) || decomposed.has(g))
            continue;
          let score = 0;
          for (const n of neighbours(g, placedId)) if (here.has(n)) score++;
          if (score === 0) continue;
          const best = scores.get(g);
          if (
            !best ||
            score > best.score ||
            (score === best.score && placedDepth < best.depth)
          ) {
            scores.set(g, { score, depth: placedDepth });
          }
        }
      }

      const ranked = [...scores.entries()].sort(
        (a, b) => b[1].score - a[1].score || a[1].depth - b[1].depth,
      );
      const candidates = ranked.map(([g]) => g);
      if (ranked.length === 0) {
        unresolved.set(page.pageId, placement(page, "unplaced", undefined, []));
        continue;
      }
      if (ranked.length > 1 && ranked[0][1].score === ranked[1][1].score) {
        unresolved.set(
          page.pageId,
          placement(page, "ambiguous", undefined, candidates),
        );
        continue;
      }
      const [winner, { depth: parentDepth }] = ranked[0];
      decided.set(page.pageId, placement(page, "proposed", winner, candidates));
      unresolved.delete(page.pageId);
      decomposed.add(winner);
      depth.set(page.pageId, parentDepth + 1);
      progress = true;
    }
  }

  const pages = parse.pages.map(
    (p) =>
      decided.get(p.pageId) ??
      unresolved.get(p.pageId) ??
      placement(p, "unplaced", undefined, []),
  );
  return { pages, depth };
}

function placement(
  page: { pageId: string; name: string },
  status: PageStatus,
  decomposes: Merged | undefined,
  candidates: Merged[],
): PagePlacement {
  return {
    pageId: page.pageId,
    name: page.name,
    status,
    ...(decomposes ? { decomposes } : {}),
    candidates,
  };
}

// ---------------------------------------------------------------------------

function describeGroup(
  g: Merged,
  depth: Map<string, number>,
  docIndex: Map<string, number>,
): AdoptionGroup {
  const linked = g.members.find((m) => m.linked);
  const existing = linked?.occurrences.find((o) => o.role === "definition");

  let definition: ParsedOccurrence;
  let reason: DefinitionReason;
  if (existing) {
    definition = existing;
    reason = "existing";
  } else {
    const rank = (o: ParsedOccurrence) => depth.get(o.pageId) ?? Infinity;
    const sorted = [...g.occurrences].sort(
      (a, b) =>
        rank(a) - rank(b) ||
        (docIndex.get(a.pageId) ?? 0) - (docIndex.get(b.pageId) ?? 0) ||
        a.cellId.localeCompare(b.cellId),
    );
    definition = sorted[0];
    const top = rank(definition);
    reason =
      top === 0
        ? "root"
        : sorted.filter((o) => rank(o) === top).length > 1
          ? "tie-break"
          : "highest";
  }

  const tfId = linked ? linked.info.tfId : definition.cellId;
  const names = new Set(g.members.map((m) => m.info.name));

  return {
    key: `${g.kind}:${tfId}`,
    kind: g.kind,
    type: g.type,
    displayId: g.displayId,
    tfId,
    definition: { pageId: definition.pageId, cellId: definition.cellId },
    definitionReason: reason,
    copies: g.occurrences
      .filter((o) => o !== definition)
      .map((o) => ({ pageId: o.pageId, cellId: o.cellId })),
    labelDivergence: names.size > 1,
    ...(g.conflictWith ? { conflictWith: g.conflictWith } : {}),
  };
}

// ==================== APPLY ====================

export interface AdoptionDecisions {
  /** Groups (by key) the analyst rejected: their cells stay as they are. */
  reject?: readonly string[];
  /** Per group key: a different member cell as definition. */
  definition?: Readonly<Record<string, CellRef>>;
  /** Per page: decomposed MP tfId, or null for "no decomposition / root". */
  decomposes?: Readonly<Record<string, string | null>>;
}

export type AdoptionApplyResult =
  | { ok: true; pages: DFDPage[] }
  | { ok: false; reason: "INVALID_DEFINITION"; groupKey: string };

/**
 * Write the confirmed proposal into dfd.pages: one entry per XML page (in
 * document order), decomposition per page, `ref` links for the copies and
 * a `definition` link only where the definition's cell id differs from the
 * tfId. Links of cells outside the confirmed groups are kept as they are.
 */
export function applyAdoption(
  proposal: AdoptionProposal,
  persistedPages: readonly DFDPage[] | undefined,
  decisions: AdoptionDecisions = {},
): AdoptionApplyResult {
  const rejected = new Set(decisions.reject ?? []);
  const persisted = new Map((persistedPages ?? []).map((p) => [p.pageId, p]));
  const links = new Map<string, Map<string, DFDCellLink>>();
  for (const p of proposal.pages) {
    links.set(
      p.pageId,
      new Map((persisted.get(p.pageId)?.links ?? []).map((l) => [l.cellId, l])),
    );
  }

  for (const group of proposal.groups) {
    if (rejected.has(group.key) || group.conflictWith) continue;
    const members = [group.definition, ...group.copies];
    const chosen = decisions.definition?.[group.key] ?? group.definition;
    if (!members.some((m) => sameCell(m, chosen))) {
      return { ok: false, reason: "INVALID_DEFINITION", groupKey: group.key };
    }
    for (const cell of members) {
      const pageLinks = links.get(cell.pageId);
      if (!pageLinks) continue;
      if (sameCell(cell, chosen)) {
        if (cell.cellId === group.tfId) pageLinks.delete(cell.cellId);
        else
          pageLinks.set(cell.cellId, {
            cellId: cell.cellId,
            tfId: group.tfId,
            role: "definition",
          });
      } else {
        pageLinks.set(cell.cellId, {
          cellId: cell.cellId,
          tfId: group.tfId,
          role: "ref",
        });
      }
    }
  }

  const pages: DFDPage[] = proposal.pages.map((p, index) => {
    const before = persisted.get(p.pageId);
    const override = decisions.decomposes?.[p.pageId];
    const decomposes =
      override === null ? undefined : (override ?? p.decomposes);
    const pageLinks = [...(links.get(p.pageId)?.values() ?? [])];
    return {
      pageId: p.pageId,
      name: p.name,
      ...(decomposes ? { decomposes } : {}),
      order: before?.order ?? index,
      ...(pageLinks.length > 0 ? { links: pageLinks } : {}),
    };
  });
  return { ok: true, pages };
}

function sameCell(a: CellRef, b: CellRef): boolean {
  return a.pageId === b.pageId && a.cellId === b.cellId;
}
