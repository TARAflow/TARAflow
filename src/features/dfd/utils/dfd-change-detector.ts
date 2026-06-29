// ==================== DFD CHANGE DETECTOR ====================
// Detects topology changes between two DFD states using a three-level cascade.
//
// Level 1 — Count Check      O(1)  : elements/connections added or removed
// Level 2 — Connectivity Check O(n) : dataflow endpoints changed (rehang)
// Level 3 — Geometry Check    O(n)  : elements moved or resized
//
// A full graph rebuild is required for Level 1–3 changes.
// If none of these changed, only deriveExposureLevels() needs to re-run.

import type { DFDElement, DFDConnection } from "../models/dfd-types";

// ==================== TYPES ====================

export type ChangeLevel =
  | "none" // Only property changes — no rebuild needed
  | "geometry" // Level 3: position/size changed
  | "connectivity" // Level 2: connection endpoints changed
  | "identity" // Level 1b: element/connection name, displayId or type changed
  | "structural"; // Level 1: elements/connections added or removed

export interface TopologyChangeResult {
  level: ChangeLevel;
  requiresRebuild: boolean;
  /** Human-readable reason — useful for debug logging */
  reason: string;
}

// ==================== DETECTOR ====================

export class DFDChangeDetector {

  /**
   * Detect the highest-impact topology change between two DFD states.
   * Cascade: Level 1 → Level 2 → Level 3 → none
   */
  detect(
    prevElements: DFDElement[],
    prevConnections: DFDConnection[],
    nextElements: DFDElement[],
    nextConnections: DFDConnection[],
  ): TopologyChangeResult {

    // ── Level 1: Count ──────────────────────────────────────────────────────
    if (
      prevElements.length !== nextElements.length ||
      prevConnections.length !== nextConnections.length
    ) {
      return {
        level: "structural",
        requiresRebuild: true,
        reason: `Element count changed (${prevElements.length}→${nextElements.length}), ` +
                `connection count changed (${prevConnections.length}→${nextConnections.length})`,
      };
    }

    // ── Level 1b: Identity (name / displayId / type) ────────────────────────
    // The threat layer mirrors element identity: threat ids encode the
    // displayId and linkedElement mirrors the name/type. A rename or renumber
    // keeps the topology but MUST rebuild the graph so toGraphReference()
    // exposes the new values — otherwise saveDFDFromXml reuses the old graph,
    // its elementsById keeps stale names/numbers, and the threat sync (and the
    // sync banner) never see the change until an unrelated structural edit.
    const prevElemIdentity = new Map(prevElements.map((e) => [e.id, e]));
    for (const next of nextElements) {
      const prev = prevElemIdentity.get(next.id);
      if (!prev) continue; // add/remove already handled by the count check
      if (
        prev.name !== next.name ||
        prev.displayId !== next.displayId ||
        prev.type !== next.type
      ) {
        return {
          level: "identity",
          requiresRebuild: true,
          reason: `Element ${next.id} identity changed ` +
                  `(name/displayId/type): "${prev.displayId}/${prev.name}" → ` +
                  `"${next.displayId}/${next.name}"`,
        };
      }
    }

    const prevConnIdentity = new Map(prevConnections.map((c) => [c.id, c]));
    for (const next of nextConnections) {
      const prev = prevConnIdentity.get(next.id);
      if (!prev) continue;
      if (
        (prev.name ?? "") !== (next.name ?? "") ||
        prev.displayId !== next.displayId
      ) {
        return {
          level: "identity",
          requiresRebuild: true,
          reason: `Connection ${next.id} identity changed (label/name/displayId)`,
        };
      }
    }

    // ── Level 2: Connectivity ───────────────────────────────────────────────
    // Build prev connection map for O(1) lookup
    const prevConnMap = new Map(prevConnections.map((c) => [c.id, c]));

    for (const next of nextConnections) {
      const prev = prevConnMap.get(next.id);

      // New connection ID (not in prev) → structural change
      if (!prev) {
        return {
          level: "structural",
          requiresRebuild: true,
          reason: `New connection id: ${next.id}`,
        };
      }

      // Endpoints changed → connectivity change
      if (prev.from !== next.from || prev.to !== next.to) {
        return {
          level: "connectivity",
          requiresRebuild: true,
          reason: `Connection ${next.id} rehung: ${prev.from}→${prev.to} became ${next.from}→${next.to}`,
        };
      }
    }

    // ── Level 3: Geometry ───────────────────────────────────────────────────
    // Only check elements that can affect TB membership:
    //   - TrustBoundary  (its own bounds define the zone)
    //   - Process, DataStore, Interface, Multiprocess (can move in/out of TB)
    // ExternalEntity is excluded — never a TB member.
    const GEOMETRY_RELEVANT_TYPES = new Set([
      "TrustBoundary",
      "Process",
      "DataStore",
      "Interface",
      "Multiprocess",
      "ChipBoundary",
      "PhysicalBoundary", // PB bounds define the physical zone — movement triggers rebuild
    ]);

    const prevElemMap = new Map(prevElements.map((e) => [e.id, e]));

    for (const next of nextElements) {
      if (!GEOMETRY_RELEVANT_TYPES.has(next.type)) continue;

      const prev = prevElemMap.get(next.id);

      // New element ID (not in prev) → already caught by count check,
      // but guard here in case of ID replacement with same count.
      if (!prev) {
        return {
          level: "structural",
          requiresRebuild: true,
          reason: `New element id: ${next.id}`,
        };
      }

      if (
        prev.position.x !== next.position.x ||
        prev.position.y !== next.position.y ||
        prev.size.width !== next.size.width ||
        prev.size.height !== next.size.height
      ) {
        return {
          level: "geometry",
          requiresRebuild: true,
          reason: `Element ${next.id} (${next.type}) geometry changed`,
        };
      }
    }

    // ── No topology change ──────────────────────────────────────────────────
    return {
      level: "none",
      requiresRebuild: false,
      reason: "Only property changes detected",
    };
  }

  /**
   * Convenience: returns true if a full graph rebuild is required.
   */
  requiresRebuild(
    prevElements: DFDElement[],
    prevConnections: DFDConnection[],
    nextElements: DFDElement[],
    nextConnections: DFDConnection[],
  ): boolean {
    return this.detect(prevElements, prevConnections, nextElements, nextConnections)
      .requiresRebuild;
  }
}

// Export singleton instance
export const dfdChangeDetector = new DFDChangeDetector();
export default dfdChangeDetector;