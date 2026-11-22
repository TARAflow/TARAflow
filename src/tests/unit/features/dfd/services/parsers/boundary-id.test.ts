// The id bracket of a boundary's label: "Case [CASE]". An imported component
// instance puts its prefix in front (0.20 item 17), one per import level
// (review 2026-11-22: "Case [C1:SD1:CASE]" for a component that brings its
// own imports) — the parser and the missing-id check read all of them.
import { describe, expect, it } from "vitest";
import { extractTrustBoundaryId } from "features/dfd/services/parsers/parser-utils";
import { validateTrustBoundaryId } from "features/dfd/services/validators/validator-utils";

describe("boundary id in the label", () => {
  it.each([
    ["Case [CASE]", "CASE"],
    ["Case [SD1:CASE]", "SD1:CASE"],
    ["Case [C1:SD1:CASE]", "C1:SD1:CASE"],
    ["Zone [Z-1]", "Z-1"],
  ])("%s → %s", (label, id) => {
    expect(extractTrustBoundaryId(label)).toBe(id);
    expect(validateTrustBoundaryId(label)).toEqual({ isValid: true, id });
  });

  it("no id, or a malformed prefix: none", () => {
    for (const label of ["Case", "Case []", "Case [:CASE]", "Case [SD1:]", "Case [SD1::CASE]"]) {
      expect(extractTrustBoundaryId(label), label).toBeUndefined();
      expect(validateTrustBoundaryId(label).isValid, label).toBe(false);
    }
  });
});
