// electron/services/update/index.ts
// ==================== UPDATE — FEATURE BARREL ====================
// Public API of the update feature. Consumers (main.ts IPC glue, tests)
// import from here, never from the internal modules directly.
//
// NOTE: update-check-main.ts is intentionally NOT re-exported — it imports
// `electron` and must stay out of the pure test graph. main.ts imports it
// directly from "./services/update/update-check-main".

export { checkForUpdate } from "./check-for-update";
export type { CheckDeps, CheckParams } from "./check-for-update";

export { GitHubReleaseSource } from "./release-source";
export type {
  ReleaseSource,
  GithubRelease,
  FetchLike,
  GitHubReleaseSourceOptions,
} from "./release-source";

export { selectLatestRelease } from "./select-release";
export { isNewer, normalizeVersion } from "./version-compare";

export { CachingReleaseSource } from "./caching-release-source";

export { runUpdateCheck } from "./run-update-check";
export type { InvalidatableSource } from "./run-update-check";
