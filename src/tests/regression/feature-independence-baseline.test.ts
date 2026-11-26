// Feature independence (roadmap-to-1.0.md rule 3.4): CI runs the depcruise
// rule no-feature-to-feature (utils/depcruise-features.cjs) with the
// violations of 0.20 as a generated baseline. The baseline must only shrink:
// regenerating it after adding a new feature → feature import would swallow
// the new violation — this test pins its size.
//
// After removing violations: `npm run depcruise:features:baseline`, then
// lower MAX_KNOWN_VIOLATIONS to the new count in the same commit.
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/** Violations of 0.20 (80, patch 05). Lower it, never raise it. */
const MAX_KNOWN_VIOLATIONS = 80;

interface KnownViolation {
  from: string;
  to: string;
  rule: { name: string };
}

const baseline = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "utils/depcruise-features-baseline.json"), "utf-8"),
) as KnownViolation[];

const featureOf = (file: string) => /^src\/features\/([^/]+)\//.exec(file)?.[1];

describe("no-feature-to-feature baseline", () => {
  it("does not grow beyond the violations of 0.20", () => {
    expect(baseline.length).toBeLessThanOrEqual(MAX_KNOWN_VIOLATIONS);
  });

  it("holds only no-feature-to-feature edges between two different features", () => {
    for (const v of baseline) {
      expect(v.rule.name).toBe("no-feature-to-feature");
      expect(featureOf(v.from), v.from).toBeDefined();
      expect(featureOf(v.to), v.to).toBeDefined();
      expect(featureOf(v.from), `${v.from} → ${v.to}`).not.toBe(featureOf(v.to));
    }
  });

  it("names only files that still exist (a removed file leaves the baseline with it)", () => {
    const gone = baseline.flatMap((v) => [v.from, v.to]).filter((f) => !fs.existsSync(path.join(process.cwd(), f)));
    expect([...new Set(gone)]).toEqual([]);
  });
});
