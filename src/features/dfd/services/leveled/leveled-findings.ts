// ==================== LEVELED FINDINGS ====================
// Leveled-DFD Phase 4a (leveled-dfd-multi-diagram-design.md §7, D10).
//
// Turns what the leveled analysis already knows — page tree issues,
// effective-model findings, the occurrences — into validation findings for
// the DFD validator. Pure and derived; nothing here changes the model.
//
// Error policy (D10): findings never block editing, saving or threat
// generation. "error" only marks the DFD phase incomplete; incomplete or
// ambiguous modelling is analysed conservatively (fallback to the parent),
// never excluded.
//
// Not here: BAL_REFINES_* / BAL_ABSTRACT_WITHOUT_REFINEMENT (Phase 4b, need
// `refines` / `abstract`), BAL_ASSET_NOT_REALISED (Phase 6),
// BAL_DUPLICATE_DISPLAY_ID (covered by the existing duplicate-id check).

import type {
  DFDConnection,
  DFDElement,
  DFDPage,
  ValidationFinding,
} from "../../models/dfd-types";
import type { ParseResult } from "../dfd-parser";
import type { HomePages } from "./home-pages";
import type { PageTree, PageTreeIssue } from "./page-tree";
import type { EffectiveFinding, EffectiveModel } from "./effective-model";

export type LeveledSeverity = "error" | "warning" | "info";

export interface LeveledFindings {
  errors: ValidationFinding[];
  warnings: ValidationFinding[];
  infos: ValidationFinding[];
}

export interface LeveledFindingsInput {
  parse: Pick<ParseResult, "pages" | "pageCells" | "occurrences">;
  persistedPages?: readonly DFDPage[];
  tree: PageTree;
  homePages: HomePages;
  model: EffectiveModel;
  records: {
    elements: ReadonlyMap<string, DFDElement>;
    connections: ReadonlyMap<string, DFDConnection>;
  };
}

const KEY = (code: string) => `dfdValidation.leveled.${code}`;

export const LEVELED_SEVERITY: Record<string, LeveledSeverity> = {
  PAGE_UNASSIGNED: "warning",
  PAGE_MISSING: "warning",
  PAGE_NO_ROOT: "error",
  PAGE_MULTIPLE_ROOTS: "error",
  PAGE_DECOMPOSES_UNKNOWN: "warning",
  PAGE_DECOMPOSES_NOT_MULTIPROCESS: "error",
  PAGE_DECOMPOSED_TWICE: "error",
  PAGE_PARENT_UNRESOLVED: "warning",
  PAGE_CYCLE: "error",
  BAL_DECOMPOSED_ON_OWN_PAGE: "error",
  BAL_AMBIGUOUS_ENDPOINT: "error",
  BAL_UNRESOLVED_ENDPOINT: "info",
  BAL_DUPLICATE_OCCURRENCE: "error",
  BAL_DANGLING_REF: "error",
  DFD_EE_TO_EE_FLOW: "info",
  BAL_INTERFACE_UNATTRIBUTED: "warning",
  BAL_HOME_NOT_HIGHEST: "info",
  BAL_LABEL_DIVERGENCE: "warning",
  BAL_MISSING_PARENT_FLOW: "warning",
  ID_PASTE_REASSIGNED: "info",
};

export function emptyLeveledFindings(): LeveledFindings {
  return { errors: [], warnings: [], infos: [] };
}

/** Findings of a leveled DFD (§7), sorted into the three severities. */
export function collectLeveledFindings(
  input: LeveledFindingsInput,
): LeveledFindings {
  const out = emptyLeveledFindings();
  const names = new Names(input);
  const push = (code: string, finding: Omit<ValidationFinding, "key">) => {
    const severity = LEVELED_SEVERITY[code];
    const list =
      severity === "error"
        ? out.errors
        : severity === "warning"
          ? out.warnings
          : out.infos;
    list.push({ key: KEY(code), ...finding });
  };

  for (const issue of input.tree.issues) pageIssue(issue, names, push);
  for (const finding of input.model.findings) {
    effectiveFinding(finding, names, push);
  }
  homeNotHighest(input, names, push);
  labelDivergence(input, names, push);
  missingParentFlows(input, names, push);
  pasteReassigned(input, names, push);
  return out;
}

// ---------------------------------------------------------------------------

type Push = (code: string, finding: Omit<ValidationFinding, "key">) => void;

function pageIssue(issue: PageTreeIssue, names: Names, push: Push): void {
  switch (issue.code) {
    case "PAGE_UNASSIGNED":
    case "PAGE_MISSING":
      push(issue.code, { params: { page: names.page(issue.pageId) } });
      return;
    case "PAGE_NO_ROOT":
      push(issue.code, {});
      return;
    case "PAGE_MULTIPLE_ROOTS":
    case "PAGE_CYCLE":
      push(issue.code, { params: { pages: names.pages(issue.pageIds) } });
      return;
    case "PAGE_DECOMPOSES_UNKNOWN":
      push(issue.code, {
        params: { page: names.page(issue.pageId), element: issue.tfId },
      });
      return;
    case "PAGE_DECOMPOSES_NOT_MULTIPROCESS":
    case "PAGE_PARENT_UNRESOLVED":
    case "BAL_DECOMPOSED_ON_OWN_PAGE":
      push(issue.code, {
        elementId: issue.tfId,
        displayId: names.displayId("element", issue.tfId),
        params: {
          page: names.page(issue.pageId),
          element: names.element(issue.tfId),
        },
      });
      return;
    case "PAGE_DECOMPOSED_TWICE":
      push(issue.code, {
        elementId: issue.tfId,
        displayId: names.displayId("element", issue.tfId),
        params: {
          element: names.element(issue.tfId),
          pages: names.pages(issue.pageIds),
        },
      });
      return;
  }
}

function effectiveFinding(
  finding: EffectiveFinding,
  names: Names,
  push: Push,
): void {
  const flow = (tfId: string) => ({
    elementId: tfId,
    displayId: names.displayId("connection", tfId),
  });
  switch (finding.code) {
    case "BAL_AMBIGUOUS_ENDPOINT":
      push(finding.code, {
        ...flow(finding.tfId),
        params: {
          flow: names.flow(finding.tfId),
          candidates: finding.candidates
            .map((c) => names.element(c))
            .join(", "),
        },
      });
      return;
    case "BAL_UNRESOLVED_ENDPOINT":
      push(finding.code, {
        ...flow(finding.tfId),
        params: {
          flow: names.flow(finding.tfId),
          element: names.element(finding.element),
        },
      });
      return;
    case "BAL_DUPLICATE_OCCURRENCE":
      push(finding.code, {
        ...flow(finding.tfId),
        params: {
          flow: names.flow(finding.tfId),
          page: names.page(finding.pageId),
          count: finding.cellIds.length,
        },
      });
      return;
    case "BAL_DANGLING_REF":
      push(finding.code, {
        elementId: finding.tfId,
        displayId: names.displayId(finding.kind, finding.tfId),
        params: {
          element:
            finding.kind === "element"
              ? names.element(finding.tfId)
              : names.flow(finding.tfId),
        },
      });
      return;
    case "DFD_EE_TO_EE_FLOW":
      push(finding.code, {
        ...flow(finding.tfId),
        params: { flow: names.flow(finding.tfId) },
      });
      return;
    case "BAL_INTERFACE_UNATTRIBUTED":
      push(finding.code, {
        ...flow(finding.tfId),
        params: {
          flow: names.flow(finding.tfId),
          interface: names.element(finding.interface),
          page: names.page(finding.pageId),
        },
      });
      return;
  }
}

/** BAL_HOME_NOT_HIGHEST (D5): the definition is below a page it occurs on. */
function homeNotHighest(
  input: LeveledFindingsInput,
  names: Names,
  push: Push,
): void {
  const { depthOf } = input.tree;
  const highest = new Map<string, string>();
  for (const o of input.parse.occurrences) {
    if (o.kind !== "element" || !depthOf.has(o.pageId)) continue;
    const best = highest.get(o.tfId);
    if (best === undefined || depthOf.get(o.pageId)! < depthOf.get(best)!) {
      highest.set(o.tfId, o.pageId);
    }
  }
  for (const [tfId, home] of input.homePages.elements) {
    const top = highest.get(tfId);
    if (!top || !depthOf.has(home)) continue;
    if (depthOf.get(top)! < depthOf.get(home)!) {
      push("BAL_HOME_NOT_HIGHEST", {
        elementId: tfId,
        displayId: names.displayId("element", tfId),
        params: {
          element: names.element(tfId),
          page: names.page(home),
          highest: names.page(top),
        },
      });
    }
  }
}

/** BAL_LABEL_DIVERGENCE: the occurrences of one record carry other labels. */
function labelDivergence(
  input: LeveledFindingsInput,
  names: Names,
  push: Push,
): void {
  const labels = new Map<string, Set<string>>();
  const cellLabel = new Map<string, string>();
  for (const page of input.parse.pageCells) {
    for (const cell of [...page.elements, ...page.connections]) {
      cellLabel.set(`${page.pageId}\u0000${cell.id}`, normalise(cell.name));
    }
  }
  for (const o of input.parse.occurrences) {
    const label = cellLabel.get(`${o.pageId}\u0000${o.cellId}`);
    if (label === undefined) continue;
    const key = `${o.kind}\u0000${o.tfId}`;
    labels.set(key, new Set([...(labels.get(key) ?? []), label]));
  }
  for (const [key, set] of labels) {
    if (set.size < 2) continue;
    const [kind, tfId] = key.split("\u0000") as [
      "element" | "connection",
      string,
    ];
    push("BAL_LABEL_DIVERGENCE", {
      elementId: tfId,
      displayId: names.displayId(kind, tfId),
      params: {
        element: kind === "element" ? names.element(tfId) : names.flow(tfId),
        labels: [...set].map((l) => `"${l}"`).join(", "),
      },
    });
  }
}

/**
 * BAL_MISSING_PARENT_FLOW: a flow defined on the child page of M crosses
 * M's border (one drawn end inside M, the other outside) but has no
 * occurrence on M's page. (`refines` as a substitute comes in Phase 4b.)
 */
function missingParentFlows(
  input: LeveledFindingsInput,
  names: Names,
  push: Push,
): void {
  const { tree, model } = input;
  const decomposedBy = new Map(
    [...tree.childPageOf].map(([mp, pageId]) => [pageId, mp]),
  );
  const inside = (tfId: string | undefined, mp: string) => {
    for (let x = tfId; x !== undefined; x = model.containmentParent.get(x)) {
      if (model.containmentParent.get(x) === mp) return true;
    }
    return false;
  };
  const pagesOf = new Map<string, Set<string>>();
  for (const o of input.parse.occurrences) {
    if (o.kind !== "connection") continue;
    pagesOf.set(o.tfId, new Set([...(pagesOf.get(o.tfId) ?? []), o.pageId]));
  }

  for (const o of input.parse.occurrences) {
    if (o.kind !== "connection" || o.role !== "definition") continue;
    if (input.homePages.connections.get(o.tfId) !== o.pageId) continue;
    const mp = decomposedBy.get(o.pageId);
    const parentPage = tree.parentOf.get(o.pageId);
    if (!mp || !parentPage) continue;
    if (inside(o.sourceTfId, mp) === inside(o.targetTfId, mp)) continue;
    if (pagesOf.get(o.tfId)?.has(parentPage)) continue;
    push("BAL_MISSING_PARENT_FLOW", {
      elementId: o.tfId,
      displayId: names.displayId("connection", o.tfId),
      params: {
        flow: names.flow(o.tfId),
        element: names.element(mp),
        page: names.page(parentPage),
      },
    });
  }
}

/**
 * ID_PASTE_REASSIGNED (§5.2, Phase 3.3): a cell that a save gave a fresh
 * identity (definition link `<pageId>:<cellId>`, see giveFreshIdentities)
 * still shows the displayId of another element — derived from the state,
 * so it shows in every validation and disappears with the next renumber.
 */
function pasteReassigned(
  input: LeveledFindingsInput,
  names: Names,
  push: Push,
): void {
  const byDisplayId = new Map<string, Set<string>>();
  const note = (kind: string, tfId: string, displayId?: string) => {
    if (!displayId) return;
    const key = `${kind}\u0000${displayId.toUpperCase()}`;
    byDisplayId.set(key, new Set([...(byDisplayId.get(key) ?? []), tfId]));
  };
  for (const [tfId, r] of input.records.elements)
    note("element", tfId, r.displayId);
  for (const [tfId, r] of input.records.connections) {
    note("connection", tfId, r.displayId);
  }

  for (const page of input.persistedPages ?? []) {
    for (const link of page.links ?? []) {
      if (link.role !== "definition") continue;
      const fresh = `${page.pageId}:${link.cellId}`;
      if (link.tfId !== fresh && !link.tfId.startsWith(`${fresh}#`)) continue;
      const kind = input.records.elements.has(link.tfId)
        ? "element"
        : input.records.connections.has(link.tfId)
          ? "connection"
          : undefined;
      if (!kind) continue;
      const displayId = names.displayId(kind, link.tfId);
      if (!displayId) continue;
      const sharing = byDisplayId.get(
        `${kind}\u0000${displayId.toUpperCase()}`,
      );
      if (!sharing || sharing.size < 2) continue;
      push("ID_PASTE_REASSIGNED", {
        elementId: link.tfId,
        displayId,
        params: {
          element:
            kind === "element"
              ? names.element(link.tfId)
              : names.flow(link.tfId),
          page: names.page(page.pageId),
        },
      });
    }
  }
}

function normalise(label: string | undefined): string {
  return (label ?? "").replace(/\s+/g, " ").trim();
}

/** Human-readable names for the message parameters. */
class Names {
  private readonly pageNames = new Map<string, string>();

  constructor(
    private readonly input: Pick<
      LeveledFindingsInput,
      "parse" | "persistedPages" | "records"
    >,
  ) {
    for (const page of input.persistedPages ?? []) {
      this.pageNames.set(page.pageId, page.name);
    }
    for (const page of input.parse.pages) {
      if (page.name) this.pageNames.set(page.pageId, page.name);
    }
  }

  page(pageId: string): string {
    return this.pageNames.get(pageId) || pageId;
  }

  pages(pageIds: readonly string[]): string {
    return pageIds.map((id) => this.page(id)).join(", ");
  }

  displayId(kind: "element" | "connection", tfId: string): string | undefined {
    const record =
      kind === "element"
        ? this.input.records.elements.get(tfId)
        : this.input.records.connections.get(tfId);
    return record?.displayId || undefined;
  }

  element(tfId: string): string {
    return this.label(this.input.records.elements.get(tfId), tfId);
  }

  flow(tfId: string): string {
    return this.label(this.input.records.connections.get(tfId), tfId);
  }

  private label(
    record: { displayId?: string; name?: string } | undefined,
    fallback: string,
  ): string {
    if (!record) return fallback;
    const { displayId, name } = record;
    if (displayId && name && name !== displayId) return `${displayId} ${name}`;
    return displayId || name || fallback;
  }
}
