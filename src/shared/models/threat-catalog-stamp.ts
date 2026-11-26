// ==================== THREAT CATALOGUE STAMP ====================
// Catalogue divergence design, phase A: the threat catalogue version each
// STRIDE method's generated threats were last fully (re)generated with
// (ThreatData.catalogStamp). Lives in shared because the threats feature
// writes it and the audit diff reads it; the current version and the stamping
// stay in features/threats (threat-catalog-version.ts).

import type { StrideMethod } from "./common-types";

/** Catalogue version per STRIDE method. */
export type ThreatCatalogStamp = Partial<Record<StrideMethod, number>>;

/** A file without a stamp (before 0.20) counts as version 1 (user 2026-11-20). */
export const UNSTAMPED_CATALOG_VERSION = 1;

/** The catalogue version the stored threats of `method` were generated with. */
export function storedCatalogVersion(
  threats: { catalogStamp?: ThreatCatalogStamp } | null | undefined,
  method: StrideMethod,
): number {
  return threats?.catalogStamp?.[method] ?? UNSTAMPED_CATALOG_VERSION;
}
