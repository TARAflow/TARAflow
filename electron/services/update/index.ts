// ==================== UPDATE — FEATURE BARREL ====================

export { checkForUpdate } from "./check-for-update";
export type { CheckDeps, CheckParams } from "./check-for-update";
export {
  GitHubReleaseSource,
  type ReleaseSource,
  type GithubRelease,
  type FetchLike,
  type GitHubReleaseSourceOptions,
} from "./release-source";
export { selectLatestRelease } from "./select-release";
export { isNewer, normalizeVersion } from "./version-compare";
