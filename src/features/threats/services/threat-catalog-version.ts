// ==================== THREAT CATALOGUE VERSION ====================
//
// Catalogue divergence design (doc/Open/Threat/TARAflow-threat-catalog-
// divergence.md), phase A. Threats are stored in the project file, the rules
// that generate them are code. When the rules change, the drift detection
// (threat-generation-drift.ts) sees threats that appear or disappear — but a
// threat whose KEY stays and whose CONTENT changes (text, actor, proposed
// mitigations, the debug-interface case) is invisible to it. The stamp makes
// that visible: each full (re)generation of a method records the catalogue
// version it ran with; a stored version below the current one means "the
// threats were generated with older rules — re-evaluate".
//
// THREAT_CATALOG_VERSION is bumped by hand with every change of what the
// generators produce (templates, their texts, matching, STRIDE rules). The
// guard test (threat-catalog-version.golden.test.ts) hashes a fresh
// generation of the fixtures and fails until the version is bumped and the
// hash updated — a catalogue change cannot slip through unstamped.
//
// Stamped only by a full (re)generation of a method — not by the incremental
// DFD sync (it generates for new elements only), not on load, never by a
// migration. Pure: no React, no project state.

import {
  storedCatalogVersion,
  type StrideMethod,
  type ThreatCatalogStamp,
} from "shared";
import type { ThreatData } from "../models/threat-types";

/**
 * Version of the threat catalogue and generation rules.
 *   1 — the catalogue of 0.19 (stamp introduced in 0.20)
 */
export const THREAT_CATALOG_VERSION = 1;

/** True when the method's stored threats were generated with an older catalogue. */
export function isCatalogOutdated(
  threats: Pick<ThreatData, "catalogStamp"> | null | undefined,
  method: StrideMethod,
): boolean {
  return storedCatalogVersion(threats, method) < THREAT_CATALOG_VERSION;
}

/** The stamp after a full (re)generation of `method` with the current catalogue. */
export function stampCatalog(
  stamp: ThreatCatalogStamp | undefined,
  method: StrideMethod,
): ThreatCatalogStamp {
  return { ...stamp, [method]: THREAT_CATALOG_VERSION };
}

/**
 * The oldest catalogue version among the methods whose stored GENERATED
 * threats are outdated — for surfaces outside the Threats tab (the phase
 * tooltip). Null when every method with generated threats is current.
 * Manual threats alone are nothing to re-evaluate.
 */
export function outdatedCatalog(
  threats: Pick<ThreatData, "catalogStamp" | "perElementTables" | "perInteractionTables"> | null | undefined,
): { stored: number; current: number } | null {
  if (!threats) return null;
  const tables = { "per-element": threats.perElementTables, "per-interaction": threats.perInteractionTables } as const;
  let oldest: number | null = null;
  for (const method of ["per-element", "per-interaction"] as const) {
    const generated = (tables[method] ?? []).some((t) => t.threats.some((x) => x.source !== "manual"));
    if (!generated || !isCatalogOutdated(threats, method)) continue;
    const stored = storedCatalogVersion(threats, method);
    oldest = oldest === null ? stored : Math.min(oldest, stored);
  }
  return oldest === null ? null : { stored: oldest, current: THREAT_CATALOG_VERSION };
}
