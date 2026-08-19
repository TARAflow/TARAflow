// src/shared/models/update-types.ts
// ==================== UPDATE — SHARED CONTRACT TYPES ====================
// The contract between the update PRODUCER (electron main) and the
// CONSUMER (renderer). PURE TYPES ONLY — no runtime code — so importing
// this from electron is `import type` and erases to nothing at runtime
// (no esbuild bundle step needed, unlike the audit engine).

/** A newer release than the running app is available. */
export interface UpdateAvailable {
  status: "update-available";
  /** Running app version, normalized (no leading "v"). */
  currentVersion: string;
  /** Latest published version, normalized (no leading "v"). */
  latestVersion: string;
  /** GitHub release "name", or the tag when the release has no name. */
  releaseName: string;
  /** Release notes as raw Markdown (GitHub "body"); "" when none. */
  releaseNotes: string;
  /** GitHub release page URL (html_url) — for "Open release page". */
  releaseUrl: string;
  /** ISO timestamp the release was published, or null. */
  publishedAt: string | null;
}

/** The running app is the newest — or newer than anything published. */
export interface UpToDate {
  status: "up-to-date";
  currentVersion: string;
}

/** The check could not complete (network, rate limit, parse, …). */
export interface UpdateError {
  status: "error";
  message: string;
}

export type UpdateCheckResult = UpdateAvailable | UpToDate | UpdateError;

/** Options the renderer passes into every `update:check` IPC call. */
export interface UpdateCheckOptions {
  /** Include GitHub pre-releases (alpha/beta) as update candidates. */
  includePrereleases: boolean;
  /** Manual checks may bypass the main-process cache. */
  force?: boolean;
}
