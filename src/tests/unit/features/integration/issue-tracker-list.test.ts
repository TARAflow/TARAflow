import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ISSUE_TRACKERS } from "shared/models/issue-trackers";

// A tracker not available yet must not promise a release that is already
// out: Polarion was still listed "from 0.19" when 0.19 was about to ship.
const minor = (v: string) => {
  const [major, min] = v.split(/[.-]/).map(Number);
  return major * 1000 + min;
};

describe("issue tracker list", () => {
  it("promises no release that is out already", () => {
    const current = minor(JSON.parse(readFileSync("package.json", "utf8")).version);
    const stale = ISSUE_TRACKERS.filter((t) => !t.available && t.availableFrom && minor(t.availableFrom) <= current);
    expect(stale.map((t) => t.id)).toEqual([]);
  });

  it("lists Polarion as planned, without a release", () => {
    const polarion = ISSUE_TRACKERS.find((t) => t.id === "polarion");
    expect(polarion).toMatchObject({ available: false });
    expect(polarion?.availableFrom).toBeUndefined();
  });
});
