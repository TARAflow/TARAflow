// electron/tests/update/select-release.test.ts
import { describe, it, expect } from "vitest";
import { selectLatestRelease } from "services/update";
import type { GithubRelease } from "services/update";

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

describe("selectLatestRelease", () => {
  it("returns null when there are no releases", () => {
    expect(selectLatestRelease([], true)).toBeNull();
  });

  it("ignores drafts", () => {
    const out = selectLatestRelease(
      [rel({ tagName: "v2.0.0", draft: true }), rel({ tagName: "v1.0.0" })],
      true,
    );
    expect(out?.tagName).toBe("v1.0.0");
  });

  it("excludes prereleases when includePrereleases is false", () => {
    const out = selectLatestRelease(
      [
        rel({ tagName: "v0.9.0-alpha", prerelease: true }),
        rel({ tagName: "v0.8.0" }),
      ],
      false,
    );
    expect(out?.tagName).toBe("v0.8.0");
  });

  it("includes prereleases when includePrereleases is true", () => {
    const out = selectLatestRelease(
      [
        rel({ tagName: "v0.9.0-alpha", prerelease: true }),
        rel({ tagName: "v0.8.0" }),
      ],
      true,
    );
    expect(out?.tagName).toBe("v0.9.0-alpha");
  });

  it("picks the highest by SemVer, not by array order", () => {
    const out = selectLatestRelease(
      [
        rel({ tagName: "v0.7.0" }),
        rel({ tagName: "v0.10.0" }),
        rel({ tagName: "v0.9.0" }),
      ],
      true,
    );
    expect(out?.tagName).toBe("v0.10.0");
  });

  it("skips tags that are not valid SemVer", () => {
    const out = selectLatestRelease(
      [rel({ tagName: "nightly" }), rel({ tagName: "v0.5.0" })],
      true,
    );
    expect(out?.tagName).toBe("v0.5.0");
  });

  it("returns null when everything is filtered out", () => {
    expect(
      selectLatestRelease([rel({ tagName: "v1.0.0", draft: true })], true),
    ).toBeNull();
  });
});
