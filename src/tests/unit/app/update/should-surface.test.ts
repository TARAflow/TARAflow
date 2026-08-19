// src/tests/unit/app/update/should-surface.test.ts
import { describe, it, expect } from "vitest";
import { shouldSurface } from "app/update/should-surface";
import type { UpdateCheckResult } from "shared/models/update-types";

const available: UpdateCheckResult = {
  status: "update-available",
  currentVersion: "0.8.0",
  latestVersion: "0.9.0",
  releaseName: "0.9.0",
  releaseNotes: "notes",
  releaseUrl: "https://example/x",
  publishedAt: null,
};
const upToDate: UpdateCheckResult = {
  status: "up-to-date",
  currentVersion: "0.8.0",
};
const errored: UpdateCheckResult = {
  status: "error",
  message: "boom",
};

describe("shouldSurface", () => {
  it("startup surfaces only a real update", () => {
    expect(shouldSurface(available, "startup")).toBe(true);
    expect(shouldSurface(upToDate, "startup")).toBe(false);
    expect(shouldSurface(errored, "startup")).toBe(false);
  });

  it("manual surfaces every outcome", () => {
    expect(shouldSurface(available, "manual")).toBe(true);
    expect(shouldSurface(upToDate, "manual")).toBe(true);
    expect(shouldSurface(errored, "manual")).toBe(true);
  });
});
