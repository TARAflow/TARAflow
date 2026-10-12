// tests/unit/features/dfd/asset-graph/asset-graph-link-form.test.ts
//
// FR-E6: what saving the link card changes, and when it may not be saved.

import { describe, it, expect } from "vitest";
import { draftOf, linkDraftResult } from "features/dfd/asset-graph/asset-graph-link-form";
import type { A2ARelation } from "shared";

const base = {
  id: "r1",
  sourceAssetId: "p1",
  targetAssetId: "f1",
  relationType: "invokes",
  stepOrder: 2,
  rationale: "why",
} as A2ARelation;

describe("linkDraftResult", () => {
  it("unchanged draft: nothing to save", () => {
    expect(linkDraftResult(base, draftOf(base))).toEqual({ attributes: {}, changed: false });
  });

  it("changed and cleared fields; trimmed text; cleared = undefined", () => {
    const r = linkDraftResult(base, { ...draftOf(base), stepOrder: "3", rationale: "  ", notes: " n " });
    expect(r).toEqual({
      attributes: { stepOrder: 3, rationale: undefined, notes: "n" },
      changed: true,
    });
  });

  it("a step that is not a whole number cannot be saved", () => {
    expect(linkDraftResult(base, { ...draftOf(base), stepOrder: "1.5" }).error).toBe("stepOrder");
  });

  it("depends_on: degraded mode needs a description (same rule as the dialog)", () => {
    const dep = { ...base, relationType: "depends_on" } as A2ARelation;
    const on = linkDraftResult(dep, { ...draftOf(dep), degradationMode: true });
    expect(on.error).toBe("degradationDescription");
    const ok = linkDraftResult(dep, { ...draftOf(dep), degradationMode: true, degradationDescription: " manual " });
    expect(ok).toMatchObject({
      attributes: { degradationMode: true, degradationDescription: "manual" },
      changed: true,
    });
    expect(ok.error).toBeUndefined();
  });

  it("other types never get degradation fields", () => {
    expect(linkDraftResult(base, { ...draftOf(base), degradationMode: true }).changed).toBe(false);
  });
});
