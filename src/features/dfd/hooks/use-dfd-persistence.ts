// ==================== USE DFD PERSISTENCE HOOK ====================
// Single Responsibility: Orchestrate save operations and dirty state tracking

import { useState, useCallback, useRef, useEffect } from "react";
import type { DFDProjectData, DFDUpdateResult, DFDData } from "../models/dfd-types";
import type { ValidationResult } from "../services/dfd-validator";
import { createDFDStorageAdapter } from "../services/dfd-storage-adapter";
import dfdService from "../services/dfd-service";

/**
 * Pick the freshest of two candidate DFDData snapshots by `lastModified`.
 *
 * The DFD tab is not the only writer of `project.dfd`: the Assets tab,
 * Hazards, and load-time backfill all write it directly via updateProject,
 * bypassing this hook — so `lastCommittedDfdRef` (which only tracks writes
 * that went THROUGH this hook) can be older than the `project` prop. The old
 * `lastCommittedDfdRef.current ?? projectRef.current.dfd` chain always
 * preferred the ref whenever it was non-null, silently shadowing a fresher
 * foreign write and dropping whatever that write added (e.g. an asset created
 * in the Assets tab, then referenced by an is_an relation added in the DFD
 * tab — the relation persisted while the asset object vanished). Comparing
 * `lastModified` picks the genuinely newest snapshot instead.
 *
 * `a` (the last dfd this hook committed) wins ties and unparseable
 * timestamps, preserving prior behavior when the two are equally fresh.
 */
function freshestOf(
  a: DFDData | undefined,
  b: DFDData | null | undefined,
): DFDData | undefined {
  if (!a) return b ?? undefined;
  if (!b) return a;
  const at = Date.parse(a.lastModified ?? "");
  const bt = Date.parse(b.lastModified ?? "");
  if (Number.isNaN(bt)) return a;
  if (Number.isNaN(at)) return b;
  return bt > at ? b : a;
}

// ==================== TYPES ====================

export interface UseDFDPersistenceOptions {
  onUpdate?: (result: DFDUpdateResult) => void;
  onDirtyChange?: (isDirty: boolean) => void;
  debounceDelay?: number; // Delay in ms for description edit saves (0 = disabled)
  drawioAutosaveDelay?: number; // Delay in ms for DrawIO autosave (default: 1500ms)
  /** Called after a successful DrawIO autosave — used to generate thumbnail */
  onAfterDrawioSave?: (result: DFDUpdateResult) => void;
}

export interface UseDFDPersistenceReturn {
  // State
  isDirty: boolean;

  // Actions
  save: (thumbnailData?: string) => Promise<DFDUpdateResult | null>;
  /**
   * Schedule a debounced save. `updater` receives the freshest known base —
   * the still-pending (not yet flushed) DFDData if one exists, otherwise the
   * current project.dfd — and must return the full DFDUpdateResult to save.
   *
   * Building from `base` (not from a closed-over `dfd` value) is what
   * prevents a second scheduleSave call, arriving before the first one's
   * debounce fires, from silently discarding the first edit: without this,
   * both calls would compute their DFDData from the same stale project.dfd,
   * and the second call's wholesale replacement of pendingSaveRef.current
   * would win completely, losing the first caller's change.
   */
  scheduleSave: (updater: (base: DFDData) => DFDUpdateResult) => void;
  scheduleDrawioSave: (xml: string) => void; // Debounced autosave triggered by DrawIO changes
  flush: () => void;
  markDirty: () => void;
  markClean: () => void;
}

// ==================== HOOK ====================

export function useDFDPersistence(
  project: DFDProjectData,
  options: UseDFDPersistenceOptions = {},
): UseDFDPersistenceReturn {
  const {
    onUpdate,
    onDirtyChange,
    debounceDelay = 500,
    drawioAutosaveDelay = 1500,
    onAfterDrawioSave,
  } = options;

  // ==================== STATE ====================

  const [isDirty, setIsDirty] = useState(false);

  // ==================== REFS ====================

  const pendingSaveRef = useRef<DFDUpdateResult | null>(null);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const drawioSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Always-current project ref — prevents stale closure in scheduleDrawioSave.
  // Without this, scheduleDrawioSave uses the project object from the render
  // when it was created, missing properties set via updateConnectionDescription
  // (which arrives via scheduleSave/onUpdate AFTER the drawio save fires).
  const projectRef = useRef<DFDProjectData>(project);
  projectRef.current = project;

  // The freshest dfd this hook has ever handed to onUpdate — set at the
  // moment of every onUpdate call (save, scheduleSave flush, scheduleSave
  // immediate, scheduleDrawioSave), NOT only while an edit is still
  // pending. `pendingSaveRef` alone is not enough: it is cleared back to
  // null by scheduleSave's OWN timer the instant it flushes, which (with
  // the default 500ms/1500ms delays) always happens BEFORE
  // scheduleDrawioSave's timer fires when both start around the same
  // time. By then there is nothing "pending" to read anymore, yet
  // `project` (the prop) has not necessarily re-rendered with the flushed
  // value yet — projectRef.current is stale in exactly that gap. This ref
  // survives across that gap. See schedule-drawio-save-lost-update.test.ts.
  const lastCommittedDfdRef = useRef<DFDData | undefined>(
    project.dfd ?? undefined,
  );

  const pendingXmlRef = useRef<string | null>(null);

  // ==================== DIRTY STATE ====================

  const markDirty = useCallback(() => {
    setIsDirty(true);
    onDirtyChange?.(true);
  }, [onDirtyChange]);

  const markClean = useCallback(() => {
    setIsDirty(false);
    onDirtyChange?.(false);
  }, [onDirtyChange]);

  // ==================== SAVE OPERATIONS ====================

  /**
   * Immediate save (no debounce)
   * Used by Save button
   */
  const save = useCallback(
    async (thumbnailData?: string): Promise<DFDUpdateResult | null> => {
      console.log("[useDFDPersistence] Executing immediate save...");

      try {
        // Sync from legacy storage (draw.io writes there)
        // Use projectRef.current to include any pending property updates
        const currentProject = projectRef.current;
        const adapter = createDFDStorageAdapter(currentProject.id);
        adapter.syncFromLegacy();

        // Save via service
        const result = dfdService.saveDFD(currentProject);

        if (!result.success) {
          console.error("[useDFDPersistence] Save failed:", result.error);
          return null;
        }

        // Add thumbnail if provided
        if (thumbnailData) {
          result.dfd.thumbnail = thumbnailData;
        }

        // Build update result
        const updateResult: DFDUpdateResult = {
          dfd: result.dfd,
          phaseStatus: result.phaseStatus,
          lastModified: result.lastModified,
        };

        // Notify parent
        lastCommittedDfdRef.current = updateResult.dfd;
        onUpdate?.(updateResult);

        // Mark as clean
        markClean();

        console.log("[useDFDPersistence] Save successful");
        return updateResult;
      } catch (error) {
        console.error("[useDFDPersistence] Save error:", error);
        return null;
      }
    },
    [project, onUpdate, markClean],
  );

  /**
   * Schedule a debounced save.
   * Used for auto-save during description editing.
   *
   * See UseDFDPersistenceReturn.scheduleSave for why this takes an updater
   * function rather than a precomputed DFDUpdateResult.
   */
  const scheduleSave = useCallback(
    (updater: (base: DFDData) => DFDUpdateResult) => {
      // The freshest known state: a still-pending (not yet flushed) edit
      // wins, then the fresher of {last dfd we handed to onUpdate, current
      // project.dfd} — see freshestOf(): a foreign channel may have written
      // project.dfd more recently than our last commit, and must not be
      // shadowed by a stale lastCommittedDfdRef.
      const base =
        pendingSaveRef.current?.dfd ??
        freshestOf(lastCommittedDfdRef.current, projectRef.current.dfd);
      if (!base) {
        console.warn(
          "[useDFDPersistence] scheduleSave called with no dfd available (neither pending, last-committed, nor project.dfd) — ignoring",
        );
        return;
      }

      const result = updater(base);

      if (debounceDelay <= 0) {
        // Debouncing disabled, save immediately
        lastCommittedDfdRef.current = result.dfd;
        onUpdate?.(result);
        markClean();
        return;
      }

      // Store pending save
      pendingSaveRef.current = result;
      markDirty();

      // Clear existing timer
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      // Schedule new save
      saveTimerRef.current = setTimeout(() => {
        console.log("[useDFDPersistence] Executing debounced save...");

        if (pendingSaveRef.current) {
          lastCommittedDfdRef.current = pendingSaveRef.current.dfd;
          onUpdate?.(pendingSaveRef.current);
          pendingSaveRef.current = null;
          markClean();
        }

        saveTimerRef.current = null;
      }, debounceDelay);

      console.log(`[useDFDPersistence] Save scheduled in ${debounceDelay}ms`);
    },
    [debounceDelay, onUpdate, markDirty, markClean],
  );

  /**
   * Schedule a debounced save triggered by DrawIO autosave event.
   * Does NOT require a pre-built DFDUpdateResult — reads XML from localStorage
   * via dfdService.saveDFD() directly.
   * Separate timer from scheduleSave to avoid interfering with description edits.
   */
  const scheduleDrawioSave = useCallback(
    (xml: string) => {
      markDirty();
      pendingXmlRef.current = xml; // immer neuestes XML merken

      if (drawioSaveTimerRef.current) {
        clearTimeout(drawioSaveTimerRef.current);
      }

      drawioSaveTimerRef.current = setTimeout(async () => {
        const currentXml = pendingXmlRef.current;
        if (!currentXml) return;

        try {
          // Freshest known dfd — same fallback chain as scheduleSave's
          // `base`. Using ONLY pendingSaveRef here is not enough:
          // scheduleSave's own timer clears it to null the instant it
          // flushes, which (with default delays) happens before this
          // timer fires whenever both were scheduled around the same
          // time — leaving nothing "pending" to read, while `project`
          // (the prop) may not have re-rendered with the flushed value
          // yet. lastCommittedDfdRef survives exactly that gap. Without
          // this, saveDFDFromXml's mergeAssetProperties merges against a
          // stale base and silently reverts a just-saved description —
          // the confirmed root cause of asset/element/connection
          // descriptions vanishing shortly after being saved whenever a
          // DrawIO autosave event fired in the same window — see
          // schedule-drawio-save-lost-update.test.ts.
          const base =
            pendingSaveRef.current?.dfd ??
            freshestOf(lastCommittedDfdRef.current, projectRef.current.dfd);
          const currentProject = { ...projectRef.current, dfd: base ?? null };

          // XML direkt verarbeiten — kein localStorage-Read mehr
          const result = dfdService.saveDFDFromXml(currentProject, currentXml);

          if (!result.success) {
            console.error(
              "[useDFDPersistence] DrawIO autosave failed:",
              result.error,
            );
            return;
          }

          const updateResult: DFDUpdateResult = {
            dfd: result.dfd,
            phaseStatus: result.phaseStatus,
            lastModified: result.lastModified,
          };

          lastCommittedDfdRef.current = updateResult.dfd;
          onUpdate?.(updateResult);

          // The pending scheduleSave edit (if any) is now folded into this
          // result. Clear it and cancel its timer so it doesn't fire again
          // afterwards with a now-outdated base and overwrite what we just
          // saved — the second half of the same race.
          if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current);
            saveTimerRef.current = null;
          }
          pendingSaveRef.current = null;

          markClean();
          onAfterDrawioSave?.(updateResult);

          console.log("[useDFDPersistence] DrawIO autosave successful");
        } catch (error) {
          console.error("[useDFDPersistence] DrawIO autosave error:", error);
        }

        pendingXmlRef.current = null;
        drawioSaveTimerRef.current = null;
      }, drawioAutosaveDelay);
    },
    [markDirty, markClean, onUpdate, onAfterDrawioSave, drawioAutosaveDelay],
  );

  /**
   * Flush any pending debounced save immediately
   * Used when switching tabs/views or unmounting
   */
  const flush = useCallback(() => {
    // Clear both timers
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (drawioSaveTimerRef.current) {
      clearTimeout(drawioSaveTimerRef.current);
      drawioSaveTimerRef.current = null;
    }

    // Execute pending description-edit save
    if (pendingSaveRef.current) {
      console.log("[useDFDPersistence] Flushing pending save...");
      lastCommittedDfdRef.current = pendingSaveRef.current.dfd;
      onUpdate?.(pendingSaveRef.current);
      pendingSaveRef.current = null;
      markClean();
    }
  }, [onUpdate, markClean]);

  // ==================== CLEANUP ====================

  useEffect(() => {
    return () => {
      // Flush on unmount
      flush();
    };
  }, [flush]);

  // ==================== RETURN ====================

  return {
    isDirty,
    save,
    scheduleSave,
    scheduleDrawioSave,
    flush,
    markDirty,
    markClean,
  };
}

export default useDFDPersistence;