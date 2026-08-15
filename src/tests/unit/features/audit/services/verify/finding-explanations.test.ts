// Mirror of src/features/audit/services/verify/finding-explanations.ts
// Place at: src/tests/unit/features/audit/services/verify/finding-explanations.test.ts

import { describe, it, expect } from "vitest";
import { ALL_FINDING_IDS } from "features/audit/services/verify/findings";
import {
  FINDING_EXPLANATIONS,
  explainFinding,
  findingExplanationKey,
} from "features/audit/services/verify/finding-explanations";

describe("finding explanations", () => {
  it("covers every FindingId with a non-empty title", () => {
    for (const id of ALL_FINDING_IDS) {
      const e = FINDING_EXPLANATIONS[id];
      expect(e, `missing explanation for ${id}`).toBeDefined();
      expect(e.title.trim().length, `empty title for ${id}`).toBeGreaterThan(0);
    }
  });

  it("has no stray explanations beyond the known rule codes", () => {
    const known = new Set(ALL_FINDING_IDS as string[]);
    for (const id of Object.keys(FINDING_EXPLANATIONS)) {
      expect(known.has(id), `stray explanation ${id}`).toBe(true);
    }
  });

  it("explainFinding falls back to the English default when i18n misses", () => {
    // A translate that always misses (returns the fallback) yields the defaults.
    const passthrough = (_k: string, fallback: string) => fallback;
    const e = explainFinding("SIG_UNSIGNED", passthrough);
    expect(e.title).toBe(FINDING_EXPLANATIONS.SIG_UNSIGNED.title);
    expect(e.hint).toBe(FINDING_EXPLANATIONS.SIG_UNSIGNED.hint);
  });

  it("explainFinding uses the localized value when i18n provides one", () => {
    const translate = (key: string, fallback: string) =>
      key === findingExplanationKey("SIG_UNSIGNED", "title")
        ? "Ein Commit ist nicht signiert"
        : fallback;
    expect(explainFinding("SIG_UNSIGNED", translate).title).toBe(
      "Ein Commit ist nicht signiert",
    );
  });

  it("builds stable i18n keys", () => {
    expect(findingExplanationKey("SIG_UNSIGNED", "title")).toBe(
      "audit.verify.finding.SIG_UNSIGNED.title",
    );
    expect(findingExplanationKey("SIG_UNSIGNED", "hint")).toBe(
      "audit.verify.finding.SIG_UNSIGNED.hint",
    );
  });
});
