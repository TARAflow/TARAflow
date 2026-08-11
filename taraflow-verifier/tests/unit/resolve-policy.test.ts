// taraflow-verifier/tests/unit/resolve-policy.test.ts
import { describe, it, expect } from "vitest";
import { resolvePolicy } from "../../cli/resolve-policy";

describe("resolvePolicy", () => {
  it("lets flags win over the file, and fills the rest from the file", () => {
    const p = resolvePolicy(
      { anchor: "FLAGANCHOR", strict: true },
      {
        bootstrapAnchor: "FILEANCHOR",
        ref: "audit",
        mandateFourEyes: true,
        protectedBranches: ["main", "audit"],
      },
    );
    expect(p.bootstrapAnchor).toBe("FLAGANCHOR"); // flag wins
    expect(p.ref).toBe("audit"); // from file
    expect(p.strict).toBe(true); // flag
    expect(p.mandateFourEyes).toBe(true); // from file
    expect(p.protectedBranches).toEqual(["main", "audit"]); // from file
  });

  it("applies defaults when neither flag nor file sets a field", () => {
    const p = resolvePolicy({ anchor: "A" });
    expect(p.ref).toBe("audit"); // DEFAULT_REF
    expect(p.strict).toBe(false);
    expect(p.mandateFourEyes).toBe(false);
    expect(p.protectedBranches).toEqual([]);
  });

  it("takes the anchor from the file when no flag is given", () => {
    const p = resolvePolicy({}, { bootstrapAnchor: "FILEANCHOR", ref: "main" });
    expect(p.bootstrapAnchor).toBe("FILEANCHOR");
    expect(p.ref).toBe("main");
  });

  it("uses the file's flags when the CLI flag is absent", () => {
    const p = resolvePolicy({ anchor: "A" }, { strict: true, mandateFourEyes: true });
    expect(p.strict).toBe(true);
    expect(p.mandateFourEyes).toBe(true);
  });

  it("throws when no anchor is resolved from flag or file", () => {
    expect(() => resolvePolicy({})).toThrow();
    expect(() => resolvePolicy({}, { ref: "audit" })).toThrow();
  });
});
