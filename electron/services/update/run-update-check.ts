// electron/services/update/run-update-check.ts
// ==================== UPDATE — RUN (MAIN-SIDE ORCHESTRATION) ====================
// Composed over a (usually caching) source. Honours `force` by invalidating
// the cache first, delegates to the pure checkForUpdate, and GUARANTEES it
// never rejects: any unexpected throw becomes an `error` result, so the IPC
// boundary always resolves with an UpdateCheckResult. Pure and testable —
// the electron wiring (real source + app.getVersion) lives in
// update-check-main.ts.

import type {
  UpdateCheckOptions,
  UpdateCheckResult,
} from "shared/models/update-types";
import type { ReleaseSource } from "./release-source";
import { checkForUpdate } from "./check-for-update";

/** A ReleaseSource that can additionally drop its cache. */
export interface InvalidatableSource extends ReleaseSource {
  invalidate(): void;
}

export async function runUpdateCheck(
  source: InvalidatableSource,
  currentVersion: string,
  opts: UpdateCheckOptions,
): Promise<UpdateCheckResult> {
  try {
    if (opts.force) source.invalidate();
    return await checkForUpdate(
      { source, currentVersion },
      { includePrereleases: opts.includePrereleases },
    );
  } catch (e) {
    return {
      status: "error",
      message: e instanceof Error ? e.message : "Update check failed",
    };
  }
}
