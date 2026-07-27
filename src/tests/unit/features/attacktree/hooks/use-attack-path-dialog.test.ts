import { computePathProgress, applyPathSave, nextOpenKey } from "features/attacktree/hooks/use-attack-path-dialog";
import type { AttackPath, AttackPathAssessment } from "features/attacktree/models/attacktree-types";
import type { StrideCategory } from "shared";

const stridesTD = (): StrideCategory[] => ["T", "D"];
const stridesT = (): StrideCategory[] => ["T"];
const p = (pathKey: string): AttackPath => ({ pathKey } as AttackPath);


describe("nextOpenKey", () => {
  const paths = [p("a"), p("b"), p("c")];
  it("moves forward/back", () => {
    expect(nextOpenKey(paths, "a", 1)).toBe("b");
    expect(nextOpenKey(paths, "b", -1)).toBe("a");
  });
  it("clamps at both ends (no wrap)", () => {
    expect(nextOpenKey(paths, "a", -1)).toBe("a");
    expect(nextOpenKey(paths, "c", 1)).toBe("c");
  });
  it("null stays null", () => expect(nextOpenKey(paths, null, 1)).toBeNull());
});

describe("applyPathSave", () => {
  it("writes each supplied stride and leaves others untouched", () => {
    const out = applyPathSave([], "pk", {
      T: { relevance: "relevant", mitigationIds: ["M-T-001"], verificationIds: ["V-T-001"] },
      D: { relevance: "not_relevant", mitigationIds: [], verificationIds: [] },
    }, "note");
    expect(out).toHaveLength(2);
    expect(out.find((a) => a.strideCategory === "T")).toMatchObject({
      relevance: "relevant", mitigationIds: ["M-T-001"], verificationIds: ["V-T-001"], evalNote: "note",
    });
    expect(out.find((a) => a.strideCategory === "D")).toMatchObject({ relevance: "not_relevant" });
  });
  it("shared evalNote lands on every stride entry", () => {
    const out = applyPathSave([], "pk", {
      T: { relevance: "relevant", mitigationIds: ["M-T-001"], verificationIds: ["V-T-001"] },
      D: { relevance: "relevant", mitigationIds: ["M-D-001"], verificationIds: ["V-D-001"] },
    }, "shared");
    expect(out.every((a) => a.evalNote === "shared")).toBe(true);
  });
});

describe("computePathProgress", () => {
  const a = (pathKey: string, s: string, extra: Partial<AttackPathAssessment> = {}): AttackPathAssessment =>
    ({ pathKey, strideCategory: s as never, relevance: "relevant",
       mitigationIds: ["M"], verificationIds: ["V"], lastModified: "", ...extra });

  it("counts a single-STRIDE path as complete only when fully assessed", () => {
    expect(computePathProgress([p("x")], [a("x", "T")], stridesT).complete).toBe(1);
    expect(computePathProgress([p("x")], [a("x", "T", { verificationIds: [] })], stridesT).complete).toBe(0);
  });
  it("a T+D path needs BOTH strides complete", () => {
    expect(computePathProgress([p("x")], [a("x", "T"), a("x", "D")], stridesTD).complete).toBe(1);
    expect(computePathProgress([p("x")], [a("x", "T")], stridesTD).complete).toBe(0); // D missing
  });
  it("reports total as path count", () => {
    expect(computePathProgress([p("x"), p("y")], [], stridesT).total).toBe(2);
  });
});