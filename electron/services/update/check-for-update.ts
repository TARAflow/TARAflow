// ==================== UPDATE — CHECK ORCHESTRATOR ====================
// The one function the IPC handler calls. Pure except for the injected
// ReleaseSource — no electron, no DOM, no network of its own. It owns the
// mapping to the UpdateCheckResult union, including swallowing source
// failures into an `error` result so the caller never try/catches.

import type { UpdateCheckResult } from "shared/models/update-types";
import type { ReleaseSource } from "./release-source";
import { selectLatestRelease } from "./select-release";
import { isNewer, normalizeVersion } from "./version-compare";

export interface CheckDeps {
  source: ReleaseSource;
  /** Running app version, e.g. `app.getVersion()` → "0.8.3-alpha". */
  currentVersion: string;
}

export interface CheckParams {
  includePrereleases: boolean;
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Update check failed";
}

export async function checkForUpdate(
  deps: CheckDeps,
  params: CheckParams,
): Promise<UpdateCheckResult> {
  const current = normalizeVersion(deps.currentVersion);

  let releases;
  try {
    releases = await deps.source.listReleases();
  } catch (e) {
    return { status: "error", message: errorMessage(e) };
  }

  const latest = selectLatestRelease(releases, params.includePrereleases);
  if (!latest || !isNewer(deps.currentVersion, latest.tagName)) {
    return { status: "up-to-date", currentVersion: current };
  }

  return {
    status: "update-available",
    currentVersion: current,
    latestVersion: normalizeVersion(latest.tagName),
    releaseName: latest.name?.trim() || latest.tagName,
    releaseNotes: latest.body ?? "",
    releaseUrl: latest.htmlUrl,
    publishedAt: latest.publishedAt,
  };
}
