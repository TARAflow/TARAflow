// ==================== COPY ASSIGNMENT ====================
// Leveled-DFD Phase 1.5 (leveled-dfd-multi-diagram-design.md §5.2 lifecycle,
// §11.2.1 step 6).
//
// draw.io copy/paste gives a cell a new id and no identity link, so a pasted
// copy of MP-2 is a new element with a duplicate displayId. After a save,
// TARAflow proposes for every such NEW plain cell whose (displayId, type)
// matches exactly one existing element/flow: "context copy of X" or "new
// element". Default: context copy if the cell is on another page than X's
// definition, new element on the same page (a copy on its own page makes no
// sense). Nothing is linked until the analyst confirms (non-blocking hint +
// dialog, Phase 5); until then the cell is analysed as its own element.

import type { DFDPage } from "../../models/dfd-types";
import type { ParseResult, ParsedOccurrence } from "../dfd-parser";
import {
  linkAsContextCopy,
  type CellRef,
  type LinkEditRefusal,
} from "./identity-links";
import { recordInfos, recordKey, signatureOf } from "./signatures";

export interface CopyAssignment {
  cell: CellRef;
  kind: ParsedOccurrence["kind"];
  type: string;
  displayId: string;
  /** tfId of the existing element / flow the cell looks like a copy of. */
  targetTfId: string;
  /** Page of the target's definition. */
  definitionPageId: string;
  /** Proposed choice. */
  proposal: "copy" | "new";
}

/**
 * @param parse     the current XML parsed with the current dfd.pages
 * @param previous  occurrences of the last saved state: only cells not in it
 *                  are "new"; only definitions in it are targets
 */
export function proposeCopyAssignments(
  parse: Pick<ParseResult, "elements" | "connections" | "occurrences">,
  previous: readonly ParsedOccurrence[],
): CopyAssignment[] {
  const infos = recordInfos(parse);
  const cellKey = (o: { pageId: string; cellId: string }) =>
    `${o.pageId}\u0000${o.cellId}`;
  const existed = new Set(previous.map(cellKey));

  // Targets: existing definitions by signature. A signature with several
  // existing tfIds is already ambiguous — never proposed.
  const targets = new Map<string, ParsedOccurrence | null>();
  for (const o of parse.occurrences) {
    if (o.role !== "definition" || !existed.has(cellKey(o))) continue;
    const info = infos.get(recordKey(o.kind, o.tfId));
    const signature = info && signatureOf(info);
    if (!signature) continue;
    const known = targets.get(signature);
    if (known === undefined) targets.set(signature, o);
    else if (known && known.tfId !== o.tfId) targets.set(signature, null);
  }

  const result: CopyAssignment[] = [];
  for (const o of parse.occurrences) {
    const plain = o.role === "definition" && o.tfId === o.cellId;
    if (!plain || existed.has(cellKey(o))) continue;
    const info = infos.get(recordKey(o.kind, o.tfId))!;
    const signature = signatureOf(info);
    const target = signature ? targets.get(signature) : undefined;
    if (!target || target.tfId === o.tfId) continue;

    result.push({
      cell: { pageId: o.pageId, cellId: o.cellId },
      kind: o.kind,
      type: info.type,
      displayId: info.displayId,
      targetTfId: target.tfId,
      definitionPageId: target.pageId,
      proposal: target.pageId === o.pageId ? "new" : "copy",
    });
  }
  return result;
}

export type CopyAssignmentResult =
  | { ok: true; pages: DFDPage[] }
  | { ok: false; cell: CellRef; reason: LinkEditRefusal };

/**
 * Apply the confirmed choices: every assignment chosen as "copy" becomes a
 * context copy of its target. All-or-nothing — the first refusal returns
 * without a partial result.
 */
export function applyCopyAssignments(
  pages: readonly DFDPage[],
  parse: Pick<ParseResult, "elements" | "connections" | "occurrences">,
  chosen: readonly Pick<CopyAssignment, "cell" | "targetTfId">[],
): CopyAssignmentResult {
  const types = recordInfos(parse);
  let current: readonly DFDPage[] = pages;
  for (const assignment of chosen) {
    const result = linkAsContextCopy(
      current,
      parse.occurrences,
      types,
      assignment.cell,
      assignment.targetTfId,
    );
    if (!result.ok) {
      return { ok: false, cell: assignment.cell, reason: result.reason };
    }
    current = result.pages;
  }
  return { ok: true, pages: [...current] };
}
