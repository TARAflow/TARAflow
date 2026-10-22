// ==================== RECENT REMOVALS ====================
// What a DFD save removed, kept for the session so that an undo / redo in
// draw.io brings it back complete (leveled-dfd-multi-diagram-design.md
// §5.2 "stale links"). Every save drops the identity links of cells that
// are gone, and the records rebuilt from the XML keep properties, asset
// relations and description only from the last saved state — an undone
// deletion came back as a new element (a context copy as its own
// definition), without what the analyst had entered.
//
// draw.io gives a drawn or pasted cell a new id; only undo / redo brings a
// cell id back. Memory only, per project, never written to disk.

import type { DFDConnection, DFDElement, DFDPage } from "../models/dfd-types";
import { cellTypesByPage, pruneStaleLinks, restoreLinks, type RestorableLink } from "./leveled";

/** Removals kept per project and kind (the oldest go first). */
const LIMIT = 200;

interface Memory {
  links: RestorableLink[];
  elements: Map<string, DFDElement>;
  connections: Map<string, DFDConnection>;
}

interface Records {
  elements: readonly DFDElement[];
  connections: readonly DFDConnection[];
}

const linkKey = (l: { pageId: string; link: { cellId: string } }) => `${l.pageId}|${l.link.cellId}`;

function capped<T>(map: Map<string, T>): Map<string, T> {
  const extra = map.size - LIMIT;
  if (extra > 0) [...map.keys()].slice(0, extra).forEach((k) => map.delete(k));
  return map;
}

export class RecentRemovals {
  private memory = new Map<string, Memory>();

  private of(projectId: string): Memory {
    let m = this.memory.get(projectId);
    if (!m) {
      m = { links: [], elements: new Map(), connections: new Map() };
      this.memory.set(projectId, m);
    }
    return m;
  }

  /**
   * dfd.pages for a save of `xml`: a cell that is back gets its link again,
   * the links of cells that are gone are pruned and remembered (with the
   * cell's type from `previousXml`, the last saved state).
   */
  linksForSave(
    projectId: string,
    pages: readonly DFDPage[] | undefined,
    previousXml: string | undefined,
    xml: string,
  ): DFDPage[] | undefined {
    const m = this.of(projectId);
    const back = restoreLinks(pages, xml, m.links);
    const { pages: pruned, removed } = pruneStaleLinks(back.pages, xml);
    const types = removed.length > 0 ? cellTypesByPage(previousXml ?? "") : undefined;
    const gone = removed.map((r) => ({
      pageId: r.pageId,
      link: r.link,
      cellType: types?.get(r.pageId)?.get(r.cellId) ?? "",
    }));
    const changed = new Set([...back.restored, ...gone].map(linkKey));
    m.links = [...m.links.filter((l) => !changed.has(linkKey(l))), ...gone].slice(-LIMIT);
    return pruned;
  }

  /** The last saved records plus those a save removed before. */
  recordsFor(projectId: string, saved: Records): { elements: DFDElement[]; connections: DFDConnection[] } {
    const m = this.of(projectId);
    const withRemoved = <T extends { id: string }>(records: readonly T[], removed: Map<string, T>) => {
      const ids = new Set(records.map((r) => r.id));
      return [...records, ...[...removed.values()].filter((r) => !ids.has(r.id))];
    };
    return {
      elements: withRemoved(saved.elements, m.elements),
      connections: withRemoved(saved.connections, m.connections),
    };
  }

  /** Remember the records `previous` had and `saved` has not; forget those that are back. */
  remember(projectId: string, previous: Records, saved: Records): void {
    const m = this.of(projectId);
    const update = <T extends { id: string }>(before: readonly T[], after: readonly T[], removed: Map<string, T>) => {
      const ids = new Set(after.map((r) => r.id));
      ids.forEach((id) => removed.delete(id));
      for (const r of before) {
        if (!ids.has(r.id)) {
          removed.delete(r.id);
          removed.set(r.id, r);
        }
      }
      capped(removed);
    };
    update(previous.elements, saved.elements, m.elements);
    update(previous.connections, saved.connections, m.connections);
  }

  clear(projectId: string): void {
    this.memory.delete(projectId);
  }
}
