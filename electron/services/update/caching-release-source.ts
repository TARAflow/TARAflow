// electron/services/update/caching-release-source.ts
// ==================== UPDATE — CACHING RELEASE SOURCE ====================
// A ReleaseSource decorator that serves a cached release list for `ttlMs`.
// So a startup check plus manual clicks (and both prerelease settings) hit
// GitHub at most once per window — comfortably under the 60 req/h
// unauthenticated limit. `invalidate()` drops the cache to honour a forced
// re-check. A FAILED inner call is never cached (transient errors retry).

import type { GithubRelease, ReleaseSource } from "./release-source";

export class CachingReleaseSource implements ReleaseSource {
  private cached: { releases: GithubRelease[]; at: number } | null = null;

  constructor(
    private readonly inner: ReleaseSource,
    private readonly ttlMs: number,
    private readonly now: () => number = () => Date.now(),
  ) {}

  async listReleases(): Promise<GithubRelease[]> {
    const at = this.now();
    if (this.cached && at - this.cached.at < this.ttlMs) {
      return this.cached.releases;
    }
    const releases = await this.inner.listReleases();
    this.cached = { releases, at };
    return releases;
  }

  invalidate(): void {
    this.cached = null;
  }
}
