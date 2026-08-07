// src/tests/unit/features/audit/services/audit-protection-check.test.ts
import { describe, it, expect } from "vitest";
import {
  checkProtection,
  type ProtectionCheckInput,
} from "features/audit/services/audit-protection-check";

const ANCHOR = "9456a26670931b4538b8c9c5e867fa899f0f35c1";

const base = (over: Partial<ProtectionCheckInput> = {}): ProtectionCheckInput => ({
  signatureLog: `aaa1 G\nbbb2 G`,
  mergeLog: "",
  anchorTagTarget: ANCHOR,
  expectedAnchor: ANCHOR,
  ...over,
});

describe("checkProtection", () => {
  it("passes when all signed, linear, and the tag points at the anchor", () => {
    const r = checkProtection(base());
    expect(r.allSigned.ok).toBe(true);
    expect(r.linearHistory.ok).toBe(true);
    expect(r.anchorTag).toBe("ok");
    expect(r.localOk).toBe(true);
  });

  it("passes on a fresh trail with only the anchor (empty range)", () => {
    const r = checkProtection(base({ signatureLog: "", mergeLog: "" }));
    expect(r.localOk).toBe(true);
    expect(r.allSigned.unsigned).toEqual([]);
  });

  it("flags every commit whose %G? is not G", () => {
    const r = checkProtection(
      base({ signatureLog: `aaa1 G\nbbb2 N\nccc3 U\nddd4 E` }),
    );
    expect(r.allSigned.ok).toBe(false);
    expect(r.allSigned.unsigned).toEqual(["bbb2", "ccc3", "ddd4"]);
    expect(r.localOk).toBe(false);
  });

  it("flags merge commits as a linear-history violation", () => {
    const r = checkProtection(base({ mergeLog: `mmm1\nmmm2` }));
    expect(r.linearHistory.ok).toBe(false);
    expect(r.linearHistory.merges).toEqual(["mmm1", "mmm2"]);
    expect(r.localOk).toBe(false);
  });

  it("reports the anchor tag as missing when absent", () => {
    const r = checkProtection(base({ anchorTagTarget: null }));
    expect(r.anchorTag).toBe("missing");
    expect(r.localOk).toBe(false);
  });

  it("reports the anchor tag as moved when it points elsewhere", () => {
    const r = checkProtection(base({ anchorTagTarget: "deadbeef" }));
    expect(r.anchorTag).toBe("moved");
    expect(r.localOk).toBe(false);
  });
});
