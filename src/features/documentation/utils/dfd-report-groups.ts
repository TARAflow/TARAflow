// ==================== DFD REPORT GROUPS ====================
// Leveled-DFD Phase 7d (leveled-dfd-multi-diagram-design.md Phase 6/7, D20):
// the threat and risk tables of the report grouped like the app's
// accordions — "Top level", one group per top-level decomposed
// multiprocess, "Not in the DFD" last. Every item lies in exactly one group
// (the app's table groups decide; a per-interaction threat of a flow between
// multiprocesses goes to the side it attacks). Undefined for a classic DFD and a leveled
// DFD without a decomposed multiprocess — the tables stay flat.

import type { DFDConnection, DFDElement, DFDPage } from "../../dfd/models/dfd-types";
import type { DocLanguage } from "../models/doc-types";
// Deep imports: the barrels pull UI components; these modules are pure.
import { isLeveled } from "../../dfd/services/build-dfd-graph";
import { analyseLeveled } from "../../dfd/services/leveled/leveled-analysis";
import { multiprocessGroupsFrom } from "../../dfd/services/leveled/table-groups";
import {
  TOP_LEVEL_GROUP,
  groupsOfDfdItem,
  type DfdItemRef,
} from "../../../shared/models/dfd-table-groups";

export interface ReportGroup<T> {
  title: string;
  items: T[];
}

export type { DfdItemRef };

const TITLE = {
  en: { top: "Top level", notInDfd: "Not in the DFD" },
  de: { top: "Oberste Ebene", notInDfd: "Nicht im DFD" },
} as const;

const NOT_IN_DFD = "__not_in_dfd__";

export function reportGroupsOf<T>(
  dfd:
    | {
        xml?: string;
        pages?: readonly DFDPage[];
        elements?: readonly DFDElement[];
        connections?: readonly DFDConnection[];
      }
    | null
    | undefined,
  lang: DocLanguage,
  items: readonly T[],
  refOf: (item: T) => DfdItemRef | undefined,
): ReportGroup<T>[] | undefined {
  if (!dfd?.pages || dfd.pages.length < 2 || !isLeveled(dfd.xml)) return undefined;
  let groups;
  try {
    groups = multiprocessGroupsFrom(
      analyseLeveled({
        xml: dfd.xml,
        pages: dfd.pages,
        elements: dfd.elements ?? [],
        connections: dfd.connections ?? [],
      }),
    );
  } catch {
    return undefined; // unreadable XML: flat tables
  }
  if (!groups) return undefined;

  const byKey = new Map<string, T[]>();
  for (const item of items) {
    const ref = refOf(item);
    const key = (ref && groupsOfDfdItem(groups, ref)[0]) || NOT_IN_DFD;
    byKey.set(key, [...(byKey.get(key) ?? []), item]);
  }
  const titles = TITLE[lang];
  return [
    ...groups.groups.map((g) => ({ key: g.key, title: g.key === TOP_LEVEL_GROUP ? titles.top : g.label })),
    { key: NOT_IN_DFD, title: titles.notInDfd },
  ]
    .map((g) => ({ title: g.title, items: byKey.get(g.key) ?? [] }))
    .filter((g) => g.items.length > 0);
}
