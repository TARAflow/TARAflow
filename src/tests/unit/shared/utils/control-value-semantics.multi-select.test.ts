// Multi-select control properties (iec-62443-4-2-cra-coverage.md P-1): the
// trust boundary's defaultDenyPolicy holds several policies since schema 12.
// A SHOULD value is met when the selection contains it, applying it adds it,
// and "allow_all" excludes the others.
import { describe, it, expect } from "vitest";
import { controlValuePatch, controlValueState, meetsExpected } from "shared/utils/control-value-semantics";
import { defaultDenyPoliciesOf, withDefaultDenyPolicy } from "features/dfd/models/element-properties";

describe("multi-select: met when the selection contains the value", () => {
  it("a selection with the value meets it; without it is other; empty is empty", () => {
    expect(meetsExpected("defaultDenyPolicy", ["deny_all_permit_exception", "island_mode"], "island_mode")).toBe(true);
    expect(controlValueState("defaultDenyPolicy", ["island_mode"], "deny_all_permit_exception")).toBe("other");
    expect(controlValueState("defaultDenyPolicy", [], "deny_all_permit_exception")).toBe("empty");
    expect(controlValueState("defaultDenyPolicy", undefined, "deny_all_permit_exception")).toBe("empty");
  });

  it("a single value of an older file counts as a selection of one", () => {
    expect(meetsExpected("defaultDenyPolicy", "deny_all_permit_exception", "deny_all_permit_exception")).toBe(true);
    expect(controlValueState("defaultDenyPolicy", "allow_all", "deny_all_permit_exception")).toBe("other");
  });

  it("island mode does not stand for default deny any more (separate capabilities)", () => {
    expect(meetsExpected("defaultDenyPolicy", "island_mode", "deny_all_permit_exception")).toBe(false);
  });
});

describe("multi-select: applying adds to the selection", () => {
  it("adds the value, keeps the others, never twice", () => {
    expect(controlValuePatch({ defaultDenyPolicy: ["island_mode"] }, "defaultDenyPolicy", "deny_all_permit_exception")).toEqual({
      defaultDenyPolicy: ["island_mode", "deny_all_permit_exception"],
    });
    expect(controlValuePatch({ defaultDenyPolicy: ["island_mode"] }, "defaultDenyPolicy", "island_mode")).toEqual({
      defaultDenyPolicy: ["island_mode"],
    });
  });

  it("a restricting policy removes allow_all; allow_all replaces the selection", () => {
    expect(controlValuePatch({ defaultDenyPolicy: ["allow_all"] }, "defaultDenyPolicy", "deny_all_permit_exception")).toEqual({
      defaultDenyPolicy: ["deny_all_permit_exception"],
    });
    expect(controlValuePatch({ defaultDenyPolicy: ["fail_close"] }, "defaultDenyPolicy", "allow_all")).toEqual({ defaultDenyPolicy: ["allow_all"] });
  });

  it("an older single value is extended, not replaced", () => {
    expect(controlValuePatch({ defaultDenyPolicy: "island_mode" }, "defaultDenyPolicy", "fail_close")).toEqual({
      defaultDenyPolicy: ["island_mode", "fail_close"],
    });
  });

  it("single-valued properties are still replaced", () => {
    expect(controlValuePatch({ encryptionInTransit: "none" }, "encryptionInTransit", "tls")).toEqual({ encryptionInTransit: "tls" });
  });
});

describe("the form's selection rules", () => {
  it("allow_all excludes the others, a restricting policy removes allow_all; option order kept", () => {
    expect(withDefaultDenyPolicy(["deny_all_permit_exception", "island_mode"], "allow_all")).toEqual(["allow_all"]);
    expect(withDefaultDenyPolicy(["allow_all"], "fail_close")).toEqual(["fail_close"]);
    expect(withDefaultDenyPolicy(["fail_close"], "deny_all_permit_exception")).toEqual(["deny_all_permit_exception", "fail_close"]);
  });

  it("reads a single stored value and drops unknown ones", () => {
    expect(defaultDenyPoliciesOf("island_mode")).toEqual(["island_mode"]);
    expect(defaultDenyPoliciesOf(["fail_close", "bogus"])).toEqual(["fail_close"]);
    expect(defaultDenyPoliciesOf(undefined)).toEqual([]);
  });
});

// MS-1 (release plan 0.18, schema 13): malware protection and physical path
// protection combine — the conflicting SHOULDs of the backlog after 0.16.
describe("multi-select: malwareProtection and physicalPathProtection (MS-1)", () => {
  it("two mitigations with different values both hold once both are applied", () => {
    let props: Record<string, unknown> = { physicalPathProtection: ["cable_duct"] };
    props = { ...props, ...controlValuePatch(props, "physicalPathProtection", "tamper_seal") };
    expect(props.physicalPathProtection).toEqual(["cable_duct", "tamper_seal"]);
    expect(meetsExpected("physicalPathProtection", props.physicalPathProtection, "cable_duct")).toBe(true);
    expect(meetsExpected("physicalPathProtection", props.physicalPathProtection, "tamper_seal")).toBe(true);
  });

  it("the order of strength still counts per entry; a single value counts as one", () => {
    expect(meetsExpected("physicalPathProtection", ["conduit"], "cable_duct")).toBe(true);
    expect(meetsExpected("malwareProtection", "code_signing", "code_signing")).toBe(true);
    expect(meetsExpected("malwareProtection", ["sandbox", "code_signing"], "code_signing")).toBe(true);
  });

  it("applying a measure removes none; none replaces the selection", () => {
    expect(controlValuePatch({ malwareProtection: ["none"] }, "malwareProtection", "code_signing")).toEqual({ malwareProtection: ["code_signing"] });
    expect(controlValuePatch({ malwareProtection: ["sandbox"] }, "malwareProtection", "none")).toEqual({ malwareProtection: ["none"] });
  });
});
