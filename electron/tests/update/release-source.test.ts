// electron/tests/update/release-source.test.ts
import { describe, it, expect } from "vitest";
import { GitHubReleaseSource } from "services/update";
import type { FetchLike } from "services/update";

const okJson = (data: unknown): ReturnType<FetchLike> =>
  Promise.resolve({ ok: true, status: 200, json: async () => data });

describe("GitHubReleaseSource", () => {
  it("maps the GitHub snake_case payload to GithubRelease", async () => {
    const source = new GitHubReleaseSource({
      owner: "TARAflow",
      repo: "TARAflow",
      fetchImpl: () =>
        okJson([
          {
            tag_name: "v0.9.0",
            name: "0.9.0",
            body: "notes",
            html_url:
              "https://github.com/TARAflow/TARAflow/releases/tag/v0.9.0",
            published_at: "2026-08-18T00:00:00Z",
            draft: false,
            prerelease: false,
          },
        ]),
    });

    const [r] = await source.listReleases();
    expect(r).toEqual({
      tagName: "v0.9.0",
      name: "0.9.0",
      body: "notes",
      htmlUrl: "https://github.com/TARAflow/TARAflow/releases/tag/v0.9.0",
      publishedAt: "2026-08-18T00:00:00Z",
      draft: false,
      prerelease: false,
    });
  });

  it("coerces missing/odd fields to safe defaults", async () => {
    const source = new GitHubReleaseSource({
      owner: "o",
      repo: "r",
      fetchImpl: () => okJson([{ tag_name: "v1.0.0" }]),
    });
    const [r] = await source.listReleases();
    expect(r).toEqual({
      tagName: "v1.0.0",
      name: null,
      body: null,
      htmlUrl: "",
      publishedAt: null,
      draft: false,
      prerelease: false,
    });
  });

  it("sends the required GitHub headers", async () => {
    let seen: Record<string, string> | undefined;
    const source = new GitHubReleaseSource({
      owner: "o",
      repo: "r",
      fetchImpl: (_url, init) => {
        seen = init?.headers;
        return okJson([]);
      },
    });
    await source.listReleases();
    expect(seen).toMatchObject({
      Accept: "application/vnd.github+json",
      "User-Agent": "TARAflow",
    });
  });

  it("requests the /releases endpoint (not /releases/latest)", async () => {
    let calledUrl = "";
    const source = new GitHubReleaseSource({
      owner: "TARAflow",
      repo: "TARAflow",
      fetchImpl: (url) => {
        calledUrl = url;
        return okJson([]);
      },
    });
    await source.listReleases();
    expect(calledUrl).toContain("/repos/TARAflow/TARAflow/releases?per_page=30");
    expect(calledUrl).not.toContain("/releases/latest");
  });

  it("throws on a non-OK response (e.g. rate limit)", async () => {
    const source = new GitHubReleaseSource({
      owner: "o",
      repo: "r",
      fetchImpl: () =>
        Promise.resolve({ ok: false, status: 403, json: async () => ({}) }),
    });
    await expect(source.listReleases()).rejects.toThrow(/403/);
  });

  it("throws when the body is not an array", async () => {
    const source = new GitHubReleaseSource({
      owner: "o",
      repo: "r",
      fetchImpl: () => okJson({ message: "Not Found" }),
    });
    await expect(source.listReleases()).rejects.toThrow(/expected an array/);
  });
});
