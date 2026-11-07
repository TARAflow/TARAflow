// src/tests/unit/features/dfd/utils/with-external-findings.test.ts
// Multi-project TARA (design §8.1): findings of imported components are
// shown with the DFD's own; an external error makes the DFD invalid.
import { describe, expect, it } from "vitest";
import { withExternalFindings } from "features/dfd/utils/with-external-findings";

const own = { isValid: true, isComplete: true, errors: [], warnings: [{ key: "w" }], infos: [], scenario: "A" as const };
const f = (key: string) => ({ key });

describe("withExternalFindings", () => {
  it("no external findings: the DFD's own validation unchanged", () => {
    expect(withExternalFindings(own, undefined)).toBe(own);
    expect(withExternalFindings(own, { errors: [], warnings: [], infos: [] })).toBe(own);
  });

  it("appends them; an external error makes the DFD invalid, the scenario stays", () => {
    const r = withExternalFindings(own, { errors: [f("e")], warnings: [f("w2")], infos: [f("i")] })!;
    expect(r.errors.map((x) => x.key)).toEqual(["e"]);
    expect(r.warnings.map((x) => x.key)).toEqual(["w", "w2"]);
    expect(r.infos!.map((x) => x.key)).toEqual(["i"]);
    expect(r.isValid).toBe(false);
    expect(r.scenario).toBe("A");
  });

  it("works before the DFD has validated", () => {
    const r = withExternalFindings(null, { errors: [], warnings: [f("w")], infos: [] })!;
    expect(r.warnings.map((x) => x.key)).toEqual(["w"]);
    expect(r.isValid).toBe(true);
  });
});
