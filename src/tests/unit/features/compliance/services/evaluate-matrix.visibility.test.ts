// R-4 in the evaluator (model-coverage-implementation-plan.md §3, K-7): a
// registered model field that its driver hides reads as unset — the row
// becomes unknown instead of met — and counts again when the driver shows it.
// A test registry stands in for the stage-1 fields: inputValidation (CR 3.5)
// shown only when errorHandling is "sanitized".
import { describe, it, expect, vi } from "vitest";

vi.mock("shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("shared")>();
  return {
    ...actual,
    MODEL_FIELDS: [
      {
        property: "inputValidation",
        elementTypes: ["Process"],
        values: ["not_specified", "none", "basic", "strict", "schema"],
        shownWhen: (c: { element: { properties?: Record<string, unknown> } }) => c.element.properties?.errorHandling === "sanitized",
      },
    ],
  };
});

const { evaluateMatrix, EDITION_PRAA_2026 } = await import("features/compliance");

const edition = { ...EDITION_PRAA_2026, rows: EDITION_PRAA_2026.rows.filter((r) => r.label === "CR 3.5") };
const statusOf = (properties: Record<string, unknown>) =>
  evaluateMatrix({
    edition,
    view: { elements: [{ id: "p1", type: "Process", properties }], flows: [] },
    scope: new Set(["p1"]),
    run: "achieved",
  }).rows[0].status;

describe("evaluator reads model fields through the predicate", () => {
  it("shown: the stored value counts", () => {
    expect(statusOf({ inputValidation: "strict", errorHandling: "sanitized" })).toBe("met");
  });

  it("hidden: the stored value is ignored — unknown, never met", () => {
    expect(statusOf({ inputValidation: "strict", errorHandling: "verbose" })).toBe("unknown");
  });
});
