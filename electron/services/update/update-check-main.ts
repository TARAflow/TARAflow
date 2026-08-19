// electron/services/update/update-check-main.ts
// ==================== UPDATE — MAIN PROCESS ENTRY ====================
// The thin electron-facing glue the IPC handler calls. Everything testable
// lives in the pure modules (checkForUpdate / caching-release-source /
// run-update-check); this file only wires the real GitHub source, a
// process-lifetime cache, and the running app version. NOT re-exported from
// the feature barrel — it imports `electron`, which the pure tests must not
// pull in.

import { app } from "electron";
import type {
  UpdateCheckOptions,
  UpdateCheckResult,
} from "shared/models/update-types";
import { GitHubReleaseSource } from "./release-source";
import { CachingReleaseSource } from "./caching-release-source";
import { runUpdateCheck } from "./run-update-check";

// Where TARAflow publishes releases.
const REPO_OWNER = "TARAflow";
const REPO_NAME = "TARAflow";

// One network hit per 30-minute window; startup + manual clicks reuse it.
const CACHE_TTL_MS = 30 * 60 * 1000;

// Process-lifetime singleton so the cache actually persists across calls.
const releaseSource = new CachingReleaseSource(
  new GitHubReleaseSource({ owner: REPO_OWNER, repo: REPO_NAME }),
  CACHE_TTL_MS,
);

/** IPC entry (main process). Reads the running version from Electron and
 *  runs the check against the cached GitHub source. */
export function handleUpdateCheck(
  opts: UpdateCheckOptions,
): Promise<UpdateCheckResult> {
  return runUpdateCheck(releaseSource, app.getVersion(), opts);
}
