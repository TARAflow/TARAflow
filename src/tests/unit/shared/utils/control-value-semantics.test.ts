// tests/unit/shared/utils/control-value-semantics.test.ts
//
// Closed-loop review CL-1: one answer to "does the DFD value meet the
// control?" for derivation, drift, coverage and panel; nested Interface
// controls; Apply writes into properties.

import { describe, it, expect } from "vitest";
import {
  controlValuePatch,
  controlValueState,
  meetsExpected,
  readControlValue,
} from "shared/utils/control-value-semantics";
import { applyControlSuggestionUpdate } from "features/dfd/services/apply-control-suggestion";

describe("controlValueState", () => {
  it("exact value, stronger value, empty words, other values", () => {
    expect(controlValueState("integrityProtection", "hmac", "hmac")).toBe("met");
    expect(controlValueState("integrityProtection", "aead", "hmac")).toBe("met");
    expect(controlValueState("integrityProtection", "signature", "hmac")).toBe("met");
    // aead does not give non-repudiation
    expect(controlValueState("integrityProtection", "aead", "signature")).toBe("other");
    expect(controlValueState("integrityProtection", "crc", "hmac")).toBe("other");
    expect(controlValueState("failSafeOutputState", "not_defined", "fixed_value")).toBe("empty");
    expect(controlValueState("cryptoStandard", "not_assessed", "nist_approved")).toBe("empty");
    expect(controlValueState("failSafeOutputState", "unpowered", "fixed_value")).toBe("met");
    expect(controlValueState("failSafeOutputState", "dynamic", "fixed_value")).toBe("other");
  });

  it("an empty word can itself be expected (finding 4); false meets false", () => {
    expect(meetsExpected("serviceAccessPolicy", "none", "none")).toBe(true);
    expect(meetsExpected("debugInterfaceAccessible", false, false)).toBe(true);
    expect(controlValueState("debugInterfaceAccessible", true, false)).toBe("other");
  });

  it("nested Interface controls are judged by their leaf", () => {
    expect(meetsExpected("implementedControls.debugProtection", "fused_off", "auth_required")).toBe(true);
  });
});

describe("nested properties (finding 8)", () => {
  const props = { implementedControls: { linkAuthentication: "none", signalProtection: "shielded" }, inputValidation: "basic" };

  it("reads a dotted path, a plain key, a legacy flat key", () => {
    expect(readControlValue(props, "implementedControls.signalProtection")).toBe("shielded");
    expect(readControlValue(props, "inputValidation")).toBe("basic");
    expect(readControlValue({ "implementedControls.debugProtection": "fused_off" }, "implementedControls.debugProtection")).toBe("fused_off");
    expect(readControlValue(undefined, "inputValidation")).toBeUndefined();
  });

  it("writes a dotted path and keeps the siblings", () => {
    expect(controlValuePatch(props, "implementedControls.linkAuthentication", "certificate_based")).toEqual({
      implementedControls: { linkAuthentication: "certificate_based", signalProtection: "shielded" },
    });
    expect(controlValuePatch(undefined, "implementedControls.debugProtection", "fused_off")).toEqual({
      implementedControls: { debugProtection: "fused_off" },
    });
    expect(controlValuePatch(props, "inputValidation", "strict")).toEqual({ inputValidation: "strict" });
  });
});

describe("Apply (finding 9)", () => {
  it("writes into properties, nested, and records WAS replacing an older record of the property", () => {
    const update = applyControlSuggestionUpdate(
      {
        name: "kept",
        implementedControls: { signalProtection: "shielded" },
        securityControlOwnership: [
          { property: "implementedControls.debugProtection", value: "auth_required", setBy: "analyst", setAt: "old" },
          { property: "inputValidation", value: "strict", setBy: "analyst", setAt: "old" },
        ],
      },
      "implementedControls.debugProtection",
      "fused_off",
      { mitigationId: "M-IF-DBG-003", riskId: "r1", at: "2026-10-29T12:00:00.000Z" },
    );
    expect(update).toEqual({
      properties: {
        name: "kept",
        implementedControls: { signalProtection: "shielded", debugProtection: "fused_off" },
        securityControlOwnership: [
          { property: "inputValidation", value: "strict", setBy: "analyst", setAt: "old" },
          {
            property: "implementedControls.debugProtection",
            value: "fused_off",
            setBy: "apply_suggestion",
            setAt: "2026-10-29T12:00:00.000Z",
            mitigationId: "M-IF-DBG-003",
            riskId: "r1",
          },
        ],
      },
    });
    expect(readControlValue(update.properties, "implementedControls.debugProtection")).toBe("fused_off");
  });
});
