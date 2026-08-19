import { describe, it, expect } from "vitest";
import { checkForUpdate } from "services/update";
import type { GithubRelease, ReleaseSource } from "services/update";

const rel = (over: Partial<GithubRelease>): GithubRelease => ({
  tagName: "v0.1.0",
  name: null,
  body: null,
  htmlUrl: "https://example/x",
  publishedAt: null,
  draft: false,
  prerelease: false,
  ...over,
});

const sourceOf = (releases: GithubRelease[]): ReleaseSource => ({
  listReleases: async () => releases,
});

const throwingSource: ReleaseSource = {
  listReleases: async () => {
    throw new Error("GitHub API request failed with status 403");
  },
};

describe("checkForUpdate", () => {
  it("reports an available update and maps every field", async () => {
    const result = await checkForUpdate(
      {
        source: sourceOf([
          rel({
            tagName: "v0.9.0",
            name: "0.9.0 — big release",
            body: "## Fixed\n- things",
            htmlUrl:
              "https://github.com/TARAflow/TARAflow/releases/tag/v0.9.0",
            publishedAt: "2026-08-18T00:00:00Z",
          }),
        ]),
        currentVersion: "0.8.3-alpha",
      },
      { includePrereleases: true },
    );

    expect(result).toEqual({
      status: "update-available",
      currentVersion: "0.8.3-alpha",
      latestVersion: "0.9.0",
      releaseName: "0.9.0 — big release",
      releaseNotes: "## Fixed\n- things",
      releaseUrl: "https://github.com/TARAflow/TARAflow/releases/tag/v0.9.0",
      publishedAt: "2026-08-18T00:00:00Z",
    });
  });

  it("falls back to the tag as name and to empty notes when absent", async () => {
    const result = await checkForUpdate(
      {
        source: sourceOf([rel({ tagName: "v0.9.0" })]),
        currentVersion: "0.8.0",
      },
      { includePrereleases: true },
    );
    expect(result).toMatchObject({
      status: "update-available",
      releaseName: "v0.9.0",
      releaseNotes: "",
    });
  });

  it("is up-to-date when the running version equals the latest", async () => {
    const result = await checkForUpdate(
      {
        source: sourceOf([rel({ tagName: "v0.8.3-alpha", prerelease: true })]),
        currentVersion: "0.8.3-alpha",
      },
      { includePrereleases: true },
    );
    expect(result).toEqual({
      status: "up-to-date",
      currentVersion: "0.8.3-alpha",
    });
  });

  it("is up-to-date when the running version is ahead", async () => {
    const result = await checkForUpdate(
      {
        source: sourceOf([rel({ tagName: "v0.7.0" })]),
        currentVersion: "0.8.0",
      },
      { includePrereleases: true },
    );
    expect(result.status).toBe("up-to-date");
  });

  it("is up-to-date when there are no releases at all", async () => {
    const result = await checkForUpdate(
      { source: sourceOf([]), currentVersion: "0.8.0" },
      { includePrereleases: true },
    );
    expect(result.status).toBe("up-to-date");
  });

  it("honours includePrereleases=false (a newer prerelease is ignored)", async () => {
    const result = await checkForUpdate(
      {
        source: sourceOf([rel({ tagName: "v0.9.0-alpha", prerelease: true })]),
        currentVersion: "0.8.0",
      },
      { includePrereleases: false },
    );
    expect(result.status).toBe("up-to-date");
  });

  it("maps a source failure to an error result instead of throwing", async () => {
    const result = await checkForUpdate(
      { source: throwingSource, currentVersion: "0.8.0" },
      { includePrereleases: true },
    );
    expect(result).toEqual({
      status: "error",
      message: "GitHub API request failed with status 403",
    });
  });
});
