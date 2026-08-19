// electron/tests/update/caching-release-source.test.ts
import { describe, it, expect } from "vitest";
import { CachingReleaseSource } from "services/update";
import type { GithubRelease, ReleaseSource } from "services/update";

const rel = (tagName: string): GithubRelease => ({
  tagName,
  name: null,
  body: null,
  htmlUrl: "https://example/x",
  publishedAt: null,
  draft: false,
  prerelease: false,
});

class CountingSource implements ReleaseSource {
  calls = 0;
  constructor(private readonly releases: GithubRelease[]) {}
  async listReleases(): Promise<GithubRelease[]> {
    this.calls++;
    return this.releases;
  }
}

describe("CachingReleaseSource", () => {
  it("fetches on first call and serves the cache within the TTL", async () => {
    const inner = new CountingSource([rel("v1.0.0")]);
    let now = 1000;
    const src = new CachingReleaseSource(inner, 60_000, () => now);

    expect((await src.listReleases())[0].tagName).toBe("v1.0.0");
    now = 1000 + 59_999;
    await src.listReleases();
    expect(inner.calls).toBe(1); // still within TTL → cached
  });

  it("refetches once the TTL has elapsed", async () => {
    const inner = new CountingSource([rel("v1.0.0")]);
    let now = 0;
    const src = new CachingReleaseSource(inner, 60_000, () => now);

    await src.listReleases();
    now = 60_000; // exactly at the boundary counts as expired (strict <)
    await src.listReleases();
    expect(inner.calls).toBe(2);
  });

  it("invalidate() forces a refetch", async () => {
    const inner = new CountingSource([rel("v1.0.0")]);
    const src = new CachingReleaseSource(inner, 60_000, () => 0);

    await src.listReleases();
    src.invalidate();
    await src.listReleases();
    expect(inner.calls).toBe(2);
  });

  it("does not cache a failed fetch (the next call retries)", async () => {
    let calls = 0;
    const flaky: ReleaseSource = {
      listReleases: async () => {
        calls++;
        if (calls === 1) throw new Error("boom");
        return [rel("v1.0.0")];
      },
    };
    const src = new CachingReleaseSource(flaky, 60_000, () => 0);

    await expect(src.listReleases()).rejects.toThrow("boom");
    expect((await src.listReleases())[0].tagName).toBe("v1.0.0");
    expect(calls).toBe(2);
  });
});
