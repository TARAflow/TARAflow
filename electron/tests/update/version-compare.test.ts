// electron/tests/update/version-compare.test.ts
import { describe, it, expect } from "vitest";
// Consume the update feature only through its public barrel (encapsulation).
import { isNewer, normalizeVersion } from "services/update";

describe("normalizeVersion", () => {
  it("strips a single leading v and trims", () => {
    expect(normalizeVersion("v0.8.3-alpha")).toBe("0.8.3-alpha");
    expect(normalizeVersion("0.8.3")).toBe("0.8.3");
    expect(normalizeVersion("  v1.0.0 ")).toBe("1.0.0");
  });
});

describe("isNewer", () => {
  it("detects a newer version numerically, not lexically", () => {
    expect(isNewer("0.9.0", "v0.10.0")).toBe(true);
  });

  it("treats a stable release as newer than its own prerelease", () => {
    expect(isNewer("0.8.3-alpha", "v0.8.3")).toBe(true);
  });

  it("is false for an equal version", () => {
    expect(isNewer("0.8.3-alpha", "v0.8.3-alpha")).toBe(false);
  });

  it("is false for an older candidate", () => {
    expect(isNewer("0.8.3", "v0.7.0")).toBe(false);
  });

  it("never offers an unparseable candidate", () => {
    expect(isNewer("0.8.3", "not-a-version")).toBe(false);
  });

  it("offers any valid release when the running version is unparseable", () => {
    expect(isNewer("dev-build", "v0.8.3-alpha")).toBe(true);
  });
});
