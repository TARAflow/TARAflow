// ==================== UPDATE — SELECT LATEST RELEASE ====================
// Pure selection: given the releases GitHub returned, pick the one that
// represents "the latest version" under the user's prerelease preference.

import { gt, valid } from "semver";
import { normalizeVersion } from "./version-compare";
import type { GithubRelease } from "./release-source";

/** Choose the highest-version release:
 *  - drafts are never candidates;
 *  - pre-releases only when `includePrereleases` (authoritative GitHub flag);
 *  - selection is by SemVer order, NOT GitHub's array order;
 *  - tags that don't parse as SemVer are skipped, not crashed on.
 *  Returns null when nothing qualifies. */
export function selectLatestRelease(
  releases: GithubRelease[],
  includePrereleases: boolean,
): GithubRelease | null {
  const candidates = releases.filter((r) => {
    if (r.draft) return false;
    if (r.prerelease && !includePrereleases) return false;
    return valid(normalizeVersion(r.tagName)) !== null;
  });

  if (candidates.length === 0) return null;

  return candidates.reduce((best, r) =>
    gt(normalizeVersion(r.tagName), normalizeVersion(best.tagName)) ? r : best,
  );
}
