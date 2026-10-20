// ==================== USE LOST DEFINITIONS ====================
// Leveled-DFD Phase 5k (leveled-dfd-multi-diagram-design.md §5.2): notice
// after a save that a linked definition cell was deleted or drawn again
// and its element is gone, keep the lost record, and let the analyst
// re-attach the old identity to the new cell or accept the deletion.
//
// The candidates are recomputed with every change against the state before
// the loss — the new cell is usually drawn after the deletion was saved.
// An undo that brings the cell back (same id) or a context copy that keeps
// the element ends the question by itself.

import { useCallback, useEffect, useRef, useState } from "react";
import type { DFDPage, DFDProjectData, DFDUpdateResult } from "../models/dfd-types";
import { parseDfd } from "../services/leveled/leveled-analysis";
import {
  findLostDefinitions,
  reattachDefinition,
  type DfdState,
  type LostDefinition,
} from "../services/leveled";

interface Entry {
  lost: LostDefinition;
  /** The state before the loss — candidates are new relative to it. */
  before: DfdState;
  /**
   * "Later": hidden until more candidates exist than when it was put off
   * (the analyst draws the new cell — the modal dialog must not block it).
   */
  postponedAt?: number;
}

export interface UseLostDefinitionsOptions {
  savePages: (pages: DFDPage[]) => Promise<DFDUpdateResult | null>;
  /** Write the lost record's properties and asset relations back (by tfId). */
  restoreRecord: (lost: LostDefinition) => void;
}

export interface UseLostDefinitionsReturn {
  /** Lost elements / flows waiting for a decision (the first one is asked). */
  lost: LostDefinition[];
  reattach: (tfId: string, cellId: string) => Promise<string | null>;
  acceptDeletion: (tfId: string) => void;
  /** Ask again once a new candidate cell appears. */
  postpone: (tfId: string) => void;
}

export function useLostDefinitions(
  project: DFDProjectData,
  options: UseLostDefinitionsOptions,
): UseLostDefinitionsReturn {
  const { savePages, restoreRecord } = options;
  const dfd = project.dfd;
  const previousRef = useRef<DfdState | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    if (!dfd) return;
    const current: DfdState = {
      xml: dfd.xml,
      pages: dfd.pages,
      elements: dfd.elements ?? [],
      connections: dfd.connections ?? [],
    };
    const previous = previousRef.current;
    previousRef.current = current;
    if (!previous) return;
    if (previous.xml === current.xml && previous.pages === current.pages) return;
    if (!current.pages?.length && !previous.pages?.length) return; // classic DFD

    const parse = parseDfd(current.xml ?? "", current.pages);
    setEntries((open) => {
      // Open questions: still lost? Fresh candidates.
      const kept = open
        .map((e): Entry | undefined => {
          const again = findLostDefinitions(e.before, current, parse).find(
            (l) => l.tfId === e.lost.tfId,
          );
          if (!again) return undefined;
          // A new candidate brings a postponed question back.
          const postponedAt =
            e.postponedAt !== undefined && again.candidates.length > e.postponedAt
              ? undefined
              : e.postponedAt;
          return { ...e, lost: again, postponedAt };
        })
        .filter((e): e is Entry => !!e);
      const known = new Set(kept.map((e) => e.lost.tfId));
      const fresh = findLostDefinitions(previous, current, parse)
        .filter((l) => !known.has(l.tfId))
        .map((lost) => ({ lost, before: previous }));
      const next = [...kept, ...fresh];
      const key = (list: Entry[]) => JSON.stringify(list.map((e) => [e.lost, e.postponedAt]));
      return key(next) === key(open) ? open : next;
    });
  }, [dfd]);

  const pages = dfd?.pages;
  const reattach = useCallback(
    async (tfId: string, cellId: string): Promise<string | null> => {
      const entry = entries.find((e) => e.lost.tfId === tfId);
      if (!entry || !pages) return "not available";
      const saved = await savePages(reattachDefinition(pages, entry.lost, cellId));
      if (!saved) return "SAVE_FAILED";
      restoreRecord(entry.lost);
      setEntries((open) => open.filter((e) => e.lost.tfId !== tfId));
      return null;
    },
    [entries, pages, savePages, restoreRecord],
  );

  const acceptDeletion = useCallback((tfId: string) => {
    setEntries((open) => open.filter((e) => e.lost.tfId !== tfId));
  }, []);

  const postpone = useCallback((tfId: string) => {
    setEntries((open) =>
      open.map((e) =>
        e.lost.tfId === tfId ? { ...e, postponedAt: e.lost.candidates.length } : e,
      ),
    );
  }, []);

  return {
    lost: entries.filter((e) => e.postponedAt === undefined).map((e) => e.lost),
    reattach,
    acceptDeletion,
    postpone,
  };
}
