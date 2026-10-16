// ==================== EFFECTIVE MODEL ====================
// Leveled-DFD Phase 2a (leveled-dfd-multi-diagram-design.md §6.1, §6.2, §6.5).
//
// What the threat generators will see: the leaves of the leveled DFD and,
// per logical flow, ONE resolved pair of endpoints stitched from all its
// occurrences on all pages. Derived on every load, never persisted.
//
//   containment  containmentParent(e) = the multiprocess decomposed by the
//                home page of e (§5.3.1); none for external entities,
//                boundaries and dangling elements
//   leaves       every element that is not a decomposed multiprocess (§6.1);
//                a decomposition counts once its page defines a part (D15)
//   stitching    per flow side: the drawn endpoints must lie on one
//                containment chain; the deepest wins. Otherwise the lowest
//                common ancestor (ambiguous), a decomposed MP nobody drew
//                below (unresolved) — never "pick one" (§6.2)
//   state        resolved | fallback (with reasons) | excluded (§6.5)
//
//   interfaces   (2b, with page geometry) per flow the interfaces its
//                occurrences cross, attributed to the source or target side
//                of each page's decomposition border, level = depth of the
//                interface's home page (§6.2.1, D11)
//   boundaries   (2b, with page geometry) per element: geometry on its home
//                page ∪ the effective boundaries of its containment parent;
//                interfaces inherit physical and chip boundaries only (§6.3,
//                D14); dangling elements: union over their copies (§5.2.1)
//
// The hand-over to the threat generators is Phase 2c. Pure; single-page
// projects come out unchanged (flows as drawn, interfaces side "none",
// boundaries = the page's geometry).

import type { DFDConnection, DFDElement } from "../../models/dfd-types";
import type { DFDElementType } from "../../models/dfd-element-types";
import type { ParsedOccurrence } from "../dfd-parser";
import { findDanglingReferences } from "./dangling";
import type { HomePages } from "./home-pages";
import type { PageGeometry } from "./page-geometry";
import type { PageTree } from "./page-tree";

export type FallbackReason = "ambiguous" | "dangling" | "unresolved";
export type FlowState = "resolved" | "fallback" | "excluded";
export type ExclusionReason = "ee-to-ee" | "excluded-by-property";

export interface EffectiveFlow {
  tfId: string;
  /** Resolved endpoint tfIds. */
  from: string;
  to: string;
  state: FlowState;
  /** Most severe reason, for display (ambiguous > dangling > unresolved). */
  fallbackReason?: FallbackReason;
  /** All collected reasons, for diagnosis. */
  fallbackReasons?: FallbackReason[];
  excludedReason?: ExclusionReason;
  /** Crossed interfaces, ordered by side, then level (outer → inner). 2b. */
  interfaces?: EffectiveInterface[];
}

export interface EffectiveInterface {
  tfId: string;
  /** Side of the decomposition border it belongs to; "none" on the root page. */
  side: "source" | "target" | "none";
  /** Depth of the interface's home page (root = 0). */
  level: number;
}

export interface EffectiveBoundaries {
  trust: string[];
  chip: string[];
  physical: string[];
}

export interface EffectiveElement {
  tfId: string;
  type: DFDElementType;
  /** Absent while dangling (§5.2.1). */
  homePageId?: string;
  provenance: "definition" | "dangling";
  /** The decomposed multiprocess this element is a part of (§5.3.1). */
  containmentParent?: string;
  /** Effective boundary tfIds (§6.3, D14). 2b. */
  boundaries?: EffectiveBoundaries;
  /** Geometry from the home page, or provisional from the copies. 2b. */
  boundaryProvenance?: "home-page" | "context-copies";
}

export type EffectiveFinding =
  | {
      code: "BAL_AMBIGUOUS_ENDPOINT";
      tfId: string;
      side: "source" | "target";
      candidates: string[];
    }
  | {
      code: "BAL_UNRESOLVED_ENDPOINT";
      tfId: string;
      side: "source" | "target";
      element: string;
    }
  | {
      code: "BAL_DUPLICATE_OCCURRENCE";
      tfId: string;
      pageId: string;
      cellIds: string[];
    }
  | { code: "BAL_DANGLING_REF"; kind: ParsedOccurrence["kind"]; tfId: string }
  | { code: "DFD_EE_TO_EE_FLOW"; tfId: string }
  | {
      code: "BAL_INTERFACE_UNATTRIBUTED";
      tfId: string;
      interface: string;
      pageId: string;
    };

export interface EffectiveModel {
  /** Leaves only: every element that is not a decomposed multiprocess. */
  elements: EffectiveElement[];
  flows: EffectiveFlow[];
  /** element tfId → decomposed multiprocess it belongs to */
  containmentParent: Map<string, string>;
  findings: EffectiveFinding[];
}

export interface EffectiveModelInput {
  /** Logical records (parsed, or merged with the persisted properties). */
  elements: readonly DFDElement[];
  connections: readonly DFDConnection[];
  occurrences: readonly ParsedOccurrence[];
  tree: PageTree;
  homePages: HomePages;
  /** analysePageGeometry(parse.pageCells); enables interfaces and boundaries. */
  pageGeometry?: ReadonlyMap<string, PageGeometry>;
}

const NO_CONTAINMENT = new Set<DFDElementType>([
  "ExternalEntity",
  "TrustBoundary",
  "ChipBoundary",
  "PhysicalBoundary",
]);
const SEVERITY: FallbackReason[] = ["ambiguous", "dangling", "unresolved"];

export function buildEffectiveModel(
  input: EffectiveModelInput,
): EffectiveModel {
  const { elements, connections, occurrences, tree, homePages, pageGeometry } =
    input;
  const findings: EffectiveFinding[] = [];
  const typeOf = new Map(elements.map((e) => [e.id, e.type]));

  // ---- containment (§5.3.1) -------------------------------------------------
  // A decomposition is effective only once its page defines at least one
  // part of its own (D15): an automatically created, still empty child page
  // — or one holding nothing but context copies — leaves the multiprocess a
  // leaf with its own threats instead of turning all its flows into
  // fallbacks.
  const pagesWithParts = new Set<string>();
  for (const o of occurrences) {
    if (o.kind !== "element" || o.role !== "definition") continue;
    const type = typeOf.get(o.tfId);
    if (type && !NO_CONTAINMENT.has(type)) pagesWithParts.add(o.pageId);
  }
  const decomposedBy = new Map<string, string>(); // pageId → MP tfId
  for (const page of tree.pages) {
    if (
      page.decomposes &&
      tree.childPageOf.get(page.decomposes) === page.pageId &&
      pagesWithParts.has(page.pageId)
    ) {
      decomposedBy.set(page.pageId, page.decomposes);
    }
  }
  const decomposed = new Set(decomposedBy.values());

  const containmentParent = new Map<string, string>();
  for (const e of elements) {
    if (NO_CONTAINMENT.has(e.type)) continue;
    const home = homePages.elements.get(e.id);
    const parent = home ? decomposedBy.get(home) : undefined;
    if (parent && parent !== e.id) containmentParent.set(e.id, parent);
  }

  const ancestors = (id: string): string[] => {
    const chain: string[] = [];
    const seen = new Set<string>([id]);
    let current = containmentParent.get(id);
    while (current !== undefined && !seen.has(current)) {
      chain.push(current);
      seen.add(current);
      current = containmentParent.get(current);
    }
    return chain;
  };
  const isAncestorOrSelf = (a: string, b: string) =>
    a === b || ancestors(b).includes(a);
  const depth = (id: string) => ancestors(id).length;

  // ---- elements (§6.1, §5.2.1) ----------------------------------------------
  const dangling = findDanglingReferences(occurrences);
  for (const d of dangling) {
    findings.push({ code: "BAL_DANGLING_REF", kind: d.kind, tfId: d.tfId });
  }
  const danglingElements = new Set(
    dangling.filter((d) => d.kind === "element").map((d) => d.tfId),
  );

  // page-local cell id → tfId, per page
  const tfIdOfCell = new Map<string, Map<string, string>>();
  for (const o of occurrences) {
    const cells = tfIdOfCell.get(o.pageId) ?? new Map<string, string>();
    cells.set(o.cellId, o.tfId);
    tfIdOfCell.set(o.pageId, cells);
  }
  const toTfId = (pageId: string, cellId: string) =>
    tfIdOfCell.get(pageId)?.get(cellId) ?? cellId;

  const boundariesOf = pageGeometry
    ? effectiveBoundaryResolver(
        occurrences,
        pageGeometry,
        homePages,
        containmentParent,
        typeOf,
        toTfId,
      )
    : undefined;

  const effectiveElements: EffectiveElement[] = elements
    .filter((e) => !decomposed.has(e.id))
    .map((e) => {
      const homePageId = homePages.elements.get(e.id);
      const parent = containmentParent.get(e.id);
      return {
        tfId: e.id,
        type: e.type,
        ...(homePageId ? { homePageId } : {}),
        provenance: danglingElements.has(e.id) ? "dangling" : "definition",
        ...(parent ? { containmentParent: parent } : {}),
        ...(boundariesOf
          ? {
              boundaries: boundariesOf(e.id),
              boundaryProvenance: homePageId ? "home-page" : "context-copies",
            }
          : {}),
      };
    });

  // ---- flows (§6.2, §6.5) ---------------------------------------------------
  const occurrencesOf = new Map<string, ParsedOccurrence[]>();
  for (const o of occurrences) {
    if (o.kind !== "connection") continue;
    occurrencesOf.set(o.tfId, [...(occurrencesOf.get(o.tfId) ?? []), o]);
  }

  // ---- interface chain (§6.2.1, D11) --------------------------------------
  const SIDE_ORDER = { source: 0, target: 1, none: 2 } as const;
  const interfaceChain = (
    flowTfId: string,
    flowOccurrences: readonly ParsedOccurrence[],
  ): EffectiveInterface[] => {
    const entries = new Map<string, EffectiveInterface>();
    for (const o of flowOccurrences) {
      const crossed = pageGeometry?.get(o.pageId)?.flowInterfaces.get(o.cellId);
      if (!crossed || crossed.length === 0) continue;
      const border = decomposedBy.get(o.pageId);
      const inside = (end: string | undefined) =>
        border !== undefined &&
        end !== undefined &&
        isAncestorOrSelf(border, end);
      const srcInside = inside(o.sourceTfId);
      const tgtInside = inside(o.targetTfId);

      for (const cellId of crossed) {
        const tfId = toTfId(o.pageId, cellId);
        let side: EffectiveInterface["side"] = "none";
        if (border !== undefined) {
          if (srcInside && !tgtInside) side = "source";
          else if (tgtInside && !srcInside) side = "target";
          else if (!srcInside && !tgtInside) {
            findings.push({
              code: "BAL_INTERFACE_UNATTRIBUTED",
              tfId: flowTfId,
              interface: tfId,
              pageId: o.pageId,
            });
          }
        }
        const home = homePages.elements.get(tfId);
        const level = (home !== undefined && tree.depthOf.get(home)) || 0;
        const key = `${tfId}\u0000${side}`;
        if (!entries.has(key)) entries.set(key, { tfId, side, level });
      }
    }
    return [...entries.values()].sort(
      (a, b) =>
        SIDE_ORDER[a.side] - SIDE_ORDER[b.side] ||
        a.level - b.level ||
        a.tfId.localeCompare(b.tfId),
    );
  };

  const flows: EffectiveFlow[] = [];
  for (const connection of connections) {
    const flowOccurrences = occurrencesOf.get(connection.id) ?? [];
    const reasons = new Set<FallbackReason>();

    // At most one occurrence per page; more are reported and all are used.
    const perPage = new Map<string, string[]>();
    for (const o of flowOccurrences) {
      perPage.set(o.pageId, [...(perPage.get(o.pageId) ?? []), o.cellId]);
    }
    for (const [pageId, cellIds] of perPage) {
      if (cellIds.length > 1) {
        findings.push({
          code: "BAL_DUPLICATE_OCCURRENCE",
          tfId: connection.id,
          pageId,
          cellIds,
        });
      }
    }

    const resolveSide = (side: "source" | "target"): string => {
      const drawn = new Set<string>();
      for (const o of flowOccurrences) {
        const end = side === "source" ? o.sourceTfId : o.targetTfId;
        if (end) drawn.add(end);
      }
      if (drawn.size === 0) {
        drawn.add(side === "source" ? connection.from : connection.to);
      }
      const candidates = [...drawn].sort();

      let resolved: string;
      let ambiguous = false;
      const onOneChain = candidates.every((a) =>
        candidates.every(
          (b) => isAncestorOrSelf(a, b) || isAncestorOrSelf(b, a),
        ),
      );
      if (!onOneChain) {
        findings.push({
          code: "BAL_AMBIGUOUS_ENDPOINT",
          tfId: connection.id,
          side,
          candidates,
        });
        reasons.add("ambiguous");
        ambiguous = true;
        resolved = lowestCommonAncestor(candidates, ancestors);
        // No common ancestor (e.g. an EE on one page, a process on another):
        // keep the endpoint the flow's definition draws — never pick by order.
        if (resolved === "") {
          resolved = side === "source" ? connection.from : connection.to;
        }
      } else {
        resolved = candidates.reduce((a, b) => (depth(b) > depth(a) ? b : a));
      }

      if (decomposed.has(resolved) && !ambiguous) {
        findings.push({
          code: "BAL_UNRESOLVED_ENDPOINT",
          tfId: connection.id,
          side,
          element: resolved,
        });
        reasons.add("unresolved");
      }
      if (danglingElements.has(resolved)) reasons.add("dangling");
      return resolved;
    };

    const from = resolveSide("source");
    const to = resolveSide("target");

    const flow: EffectiveFlow = {
      tfId: connection.id,
      from,
      to,
      state: "resolved",
    };
    if (pageGeometry) {
      flow.interfaces = interfaceChain(connection.id, flowOccurrences);
    }
    const eeToEe =
      typeOf.get(from) === "ExternalEntity" &&
      typeOf.get(to) === "ExternalEntity";
    const excludedByProperty =
      (connection.properties as Record<string, unknown> | undefined)?.[
        "excludeFromThreatGen"
      ] === true;

    if (eeToEe) {
      findings.push({ code: "DFD_EE_TO_EE_FLOW", tfId: connection.id });
      flow.state = "excluded";
      flow.excludedReason = "ee-to-ee";
    } else if (excludedByProperty) {
      flow.state = "excluded";
      flow.excludedReason = "excluded-by-property";
    } else if (reasons.size > 0) {
      const ordered = SEVERITY.filter((r) => reasons.has(r));
      flow.state = "fallback";
      flow.fallbackReason = ordered[0];
      flow.fallbackReasons = ordered;
    }
    flows.push(flow);
  }

  return { elements: effectiveElements, flows, containmentParent, findings };
}

/**
 * Lowest common ancestor of a set of elements in the containment tree
 * (ancestor-or-self); "" if they share none (e.g. two external entities).
 */
function lowestCommonAncestor(
  ids: readonly string[],
  ancestors: (id: string) => string[],
): string {
  const [first, ...rest] = ids;
  const chain = [first, ...ancestors(first)];
  for (const candidate of chain) {
    if (
      rest.every((id) => id === candidate || ancestors(id).includes(candidate))
    ) {
      return candidate;
    }
  }
  return "";
}

/**
 * Effective boundaries per element (§6.3, D14), memoised:
 *   geometry on the home page (dangling: union over the copies' pages)
 *   ∪ the effective boundaries of the containment parent, of which an
 *     interface inherits only the physical and chip boundaries.
 */
function effectiveBoundaryResolver(
  occurrences: readonly ParsedOccurrence[],
  pageGeometry: ReadonlyMap<string, PageGeometry>,
  homePages: HomePages,
  containmentParent: ReadonlyMap<string, string>,
  typeOf: ReadonlyMap<string, DFDElementType>,
  toTfId: (pageId: string, cellId: string) => string,
): (tfId: string) => EffectiveBoundaries {
  const cellsOf = new Map<string, ParsedOccurrence[]>();
  for (const o of occurrences) {
    if (o.kind !== "element") continue;
    cellsOf.set(o.tfId, [...(cellsOf.get(o.tfId) ?? []), o]);
  }

  const geometric = (tfId: string): EffectiveBoundaries => {
    const home = homePages.elements.get(tfId);
    const all = cellsOf.get(tfId) ?? [];
    const cells = home
      ? all
          .filter((o) => o.role === "definition" && o.pageId === home)
          .slice(0, 1)
      : all; // dangling: every copy counts (§5.2.1)
    const result: EffectiveBoundaries = { trust: [], chip: [], physical: [] };
    for (const o of cells) {
      const g = pageGeometry.get(o.pageId);
      if (!g) continue;
      for (const kind of ["trust", "chip", "physical"] as const) {
        for (const b of g[kind].get(o.cellId) ?? []) {
          result[kind].push(toTfId(o.pageId, b));
        }
      }
    }
    return result;
  };

  const memo = new Map<string, EffectiveBoundaries>();
  const resolve = (tfId: string): EffectiveBoundaries => {
    const known = memo.get(tfId);
    if (known) return known;
    memo.set(tfId, { trust: [], chip: [], physical: [] }); // cycle guard

    const own = geometric(tfId);
    const parent = containmentParent.get(tfId);
    const inherited = parent ? resolve(parent) : undefined;
    const isInterface = typeOf.get(tfId) === "Interface";
    const merge = (a: string[], b: string[] = []) =>
      [...new Set([...a, ...b])].filter((id) => id !== tfId).sort();

    const result: EffectiveBoundaries = {
      trust: merge(own.trust, isInterface ? [] : inherited?.trust),
      chip: merge(own.chip, inherited?.chip),
      physical: merge(own.physical, inherited?.physical),
    };
    memo.set(tfId, result);
    return result;
  };
  return resolve;
}
