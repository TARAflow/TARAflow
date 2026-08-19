// electron/services/update/version-compare.ts
// ==================== UPDATE — VERSION COMPARISON ====================
// SemVer comparison, prerelease-aware. All version reasoning lives here so
// the rest of the feature never touches SemVer directly (SRP).

import { gt, valid } from "semver";

/** Strip a single leading "v"/"V". `app.getVersion()` carries none; git
 *  tags carry one ("v0.8.3-alpha"). We normalize explicitly rather than
 *  rely on semver's own leniency, so behaviour is deterministic. */
export function normalizeVersion(version: string): string {
  return version.trim().replace(/^v/i, "");
}

/** Is `candidate` STRICTLY newer than `current`?
 *  - both normalized first;
 *  - an unparseable candidate is never "newer" (don't offer garbage);
 *  - an unparseable current with a valid candidate counts as newer — any
 *    real release beats an unknown running build (e.g. "dev"). */
export function isNewer(current: string, candidate: string): boolean {
  const c = normalizeVersion(candidate);
  if (!valid(c)) return false;

  const cur = normalizeVersion(current);
  if (!valid(cur)) return true;

  return gt(c, cur);
}
