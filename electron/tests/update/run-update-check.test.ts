// electron/tests/update/run-update-check.test.ts
import { describe, it, expect, vi } from "vitest";
import { runUpdateCheck } from "services/update";
import type { GithubRelease, InvalidatableSource } from "services/update";

const rel = (tagName: string, prerelease = false): GithubRelease => ({
  tagName,
  name: null,
  body: null,
  htmlUrl: "https://example/x",
  publishedAt: null,
  draft: false,
  prerelease,
});

const source = (releases: GithubRelease[]): InvalidatableSource => ({
  listReleases: async () => releases,
  invalidate: () => {},
});

describe("runUpdateCheck", () => {
  it("returns an available update from the source", async () => {
    const res = await runUpdateCheck(source([rel("v0.9.0")]), "0.8.0", {
      includePrereleases: true,
    });
    expect(res).toMatchObject({
      status: "update-available",
      latestVersion: "0.9.0",
    });
  });

  it("invalidates the cache first when force is set", async () => {
    const invalidate = vi.fn();
    const src: InvalidatableSource = {
      listReleases: async () => [rel("v0.8.0")],
      invalidate,
    };
    await runUpdateCheck(src, "0.8.0", {
      includePrereleases: true,
      force: true,
    });
    expect(invalidate).toHaveBeenCalledOnce();
  });

  it("does not invalidate when force is not set", async () => {
    const invalidate = vi.fn();
    const src: InvalidatableSource = {
      listReleases: async () => [rel("v0.8.0")],
      invalidate,
    };
    await runUpdateCheck(src, "0.8.0", { includePrereleases: true });
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("passes includePrereleases through (false ignores a newer prerelease)", async () => {
    const res = await runUpdateCheck(
      source([rel("v0.9.0-alpha", true)]),
      "0.8.0",
      { includePrereleases: false },
    );
    expect(res.status).toBe("up-to-date");
  });

  it("maps an unexpected throw to an error result (never rejects)", async () => {
    const src: InvalidatableSource = {
      listReleases: async () => [rel("v0.9.0")],
      invalidate: () => {
        throw new Error("cache blew up");
      },
    };
    const res = await runUpdateCheck(src, "0.8.0", {
      includePrereleases: true,
      force: true,
    });
    expect(res).toEqual({ status: "error", message: "cache blew up" });
  });
});
