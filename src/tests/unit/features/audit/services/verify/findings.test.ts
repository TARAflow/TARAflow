// ==================== AUDIT VERIFICATION — FINDINGS TESTS ====================
// If you use Jest with globals, delete the next import line.
import { describe, it, expect } from "vitest";
import {
  AVE_VERSION,
  ALL_FINDING_IDS,
  DEFAULT_SEVERITY,
  DEFAULT_MESSAGE,
  makeFinding,
  applyStrict,
  summarize,
  hasErrors,
  toResult,
  serializeFindings,
  type Finding,
} from "features/audit/services/verify/findings";

describe("registry completeness", () => {
  it("gives every rule code a severity and a non-empty message", () => {
    expect(ALL_FINDING_IDS.length).toBeGreaterThan(0);
    for (const id of ALL_FINDING_IDS) {
      expect(["error", "warning", "info"]).toContain(DEFAULT_SEVERITY[id]);
      expect(DEFAULT_MESSAGE[id]).toBeTruthy();
      expect(DEFAULT_MESSAGE[id].length).toBeGreaterThan(0);
    }
  });

  it("has matching key sets for severity and message registries", () => {
    expect(Object.keys(DEFAULT_MESSAGE).sort()).toEqual(
      Object.keys(DEFAULT_SEVERITY).sort(),
    );
  });
});

describe("makeFinding", () => {
  it("defaults severity and message from the registries", () => {
    const f = makeFinding("SIG_UNSIGNED");
    expect(f.severity).toBe("error");
    expect(f.message).toBe(DEFAULT_MESSAGE.SIG_UNSIGNED);
    expect(f.commit).toBeUndefined();
    expect(f.context).toBeUndefined();
  });

  it("attaches commit and context only when provided", () => {
    const f = makeFinding("SIGNER_NOT_AUTHORIZED", {
      commit: "abc123",
      context: { principal: "me@example.com" },
    });
    expect(f.commit).toBe("abc123");
    expect(f.context).toEqual({ principal: "me@example.com" });
    // no empty keys leaked
    expect(Object.keys(f).sort()).toEqual(
      ["commit", "context", "id", "message", "severity"].sort(),
    );
  });

  it("honours a per-finding severity override", () => {
    const f = makeFinding("MSG_SCHEMA", { severity: "error" });
    expect(f.severity).toBe("error"); // default is "warning"
  });

  it("honours a context-aware message override", () => {
    const f = makeFinding("ANCHOR_MISMATCH", {
      message: "root deadbeef ≠ pinned cafef00d",
    });
    expect(f.message).toBe("root deadbeef ≠ pinned cafef00d");
  });
});

describe("applyStrict", () => {
  it("promotes warnings to errors, leaves error and info untouched", () => {
    const input: Finding[] = [
      makeFinding("SIG_UNSIGNED"), // error
      makeFinding("REPO_DIRTY"), // warning
      makeFinding("PRE_ANCHOR_COMMITS"), // info
    ];
    const out = applyStrict(input);
    expect(out.map((f) => f.severity)).toEqual(["error", "error", "info"]);
  });

  it("does not mutate the input array or its findings", () => {
    const input: Finding[] = [makeFinding("REPO_DIRTY")];
    const out = applyStrict(input);
    expect(input[0].severity).toBe("warning");
    expect(out[0]).not.toBe(input[0]);
  });
});

describe("summarize", () => {
  it("counts by severity", () => {
    const findings: Finding[] = [
      makeFinding("SIG_UNSIGNED"),
      makeFinding("SIG_BAD"),
      makeFinding("REPO_DIRTY"),
      makeFinding("PRE_ANCHOR_COMMITS"),
    ];
    expect(summarize(findings)).toEqual({ error: 2, warning: 1, info: 1 });
  });

  it("counts an empty list as all zero", () => {
    expect(summarize([])).toEqual({ error: 0, warning: 0, info: 0 });
  });
});

describe("hasErrors", () => {
  it("is true with an error, false without", () => {
    expect(hasErrors([makeFinding("SIG_BAD")])).toBe(true);
    expect(hasErrors([makeFinding("REPO_DIRTY")])).toBe(false);
    expect(hasErrors([])).toBe(false);
  });
});

describe("toResult", () => {
  it("passes an empty run", () => {
    const r = toResult([]);
    expect(r.result).toBe("pass");
    expect(r.aveVersion).toBe(AVE_VERSION);
    expect(r.strict).toBe(false);
    expect(r.summary).toEqual({ error: 0, warning: 0, info: 0 });
  });

  it("fails when any error is present", () => {
    const r = toResult([makeFinding("SIGNER_NOT_AUTHORIZED")]);
    expect(r.result).toBe("fail");
  });

  it("passes with warnings/infos only (non-strict)", () => {
    const r = toResult([makeFinding("REPO_DIRTY"), makeFinding("PRE_ANCHOR_COMMITS")]);
    expect(r.result).toBe("pass");
    expect(r.summary).toEqual({ error: 0, warning: 1, info: 1 });
  });

  it("fails a warning-only run under strict, and reports promoted severities", () => {
    const r = toResult([makeFinding("REPO_DIRTY")], true);
    expect(r.result).toBe("fail");
    expect(r.strict).toBe(true);
    expect(r.summary).toEqual({ error: 1, warning: 0, info: 0 });
    expect(r.findings[0].severity).toBe("error");
  });

  it("leaves an info-only run passing even under strict", () => {
    const r = toResult([makeFinding("PRE_ANCHOR_COMMITS")], true);
    expect(r.result).toBe("pass");
    expect(r.summary).toEqual({ error: 0, warning: 0, info: 1 });
  });

  it("preserves finding order", () => {
    const r = toResult([
      makeFinding("ANCHOR_MISMATCH", { commit: "1" }),
      makeFinding("SIG_UNSIGNED", { commit: "2" }),
      makeFinding("SIG_UNSIGNED", { commit: "3" }),
    ]);
    expect(r.findings.map((f) => f.commit)).toEqual(["1", "2", "3"]);
    // same id repeats across commits — that is intended
    expect(r.findings.filter((f) => f.id === "SIG_UNSIGNED")).toHaveLength(2);
  });
});

describe("serializeFindings", () => {
  it("emits valid JSON that round-trips and ends with a newline", () => {
    const r = toResult([makeFinding("SIG_BAD", { commit: "abc" })]);
    const s = serializeFindings(r);
    expect(s.endsWith("\n")).toBe(true);
    expect(JSON.parse(s)).toEqual(r);
  });

  it("is deterministic for the same input", () => {
    const r = toResult([makeFinding("REPO_DIRTY")]);
    expect(serializeFindings(r)).toBe(serializeFindings(r));
  });
});
