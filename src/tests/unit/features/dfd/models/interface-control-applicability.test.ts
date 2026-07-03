// src/tests/unit/features/dfd/models/interface-control-applicability.test.ts
//
// A2 (getApplicableControls view-model) + A3 (buildInterfaceControlClearPatch
// clear-rule). Both are façades over isControlApplicable — these tests pin the
// two-state applicability derivation (applicable / not-applicable) and the
// "clear to undefined, never n/a" behaviour.

import { describe, it, expect } from "vitest";
import {
  getApplicableControls,
  buildInterfaceControlClearPatch,
} from "features/dfd/models/interface-control-applicability";
import type {
  InterfaceProperties,
  InterfaceType,
} from "features/dfd/models/element-properties";
import {
  INTERFACE_CONTROL_KEYS,
  isControlApplicable,
} from "features/dfd/models/interface-type-registry";

type ImplementedControls = NonNullable<
  InterfaceProperties["implementedControls"]
>;

describe("getApplicableControls — A2 applicability view-model (2 states)", () => {
  it("wifi: only linkAuthentication applicable; physical/signal/debug not-applicable", () => {
    const v = getApplicableControls("wifi");
    expect(v.byKey.linkAuthentication).toBe("applicable");
    expect(v.byKey.physicalAccessProtection).toBe("not-applicable");
    expect(v.byKey.signalProtection).toBe("not-applicable");
    expect(v.byKey.debugProtection).toBe("not-applicable");
    expect(v.applicable).toContain("linkAuthentication");
    expect(v.notApplicable).toEqual(
      expect.arrayContaining([
        "physicalAccessProtection",
        "signalProtection",
        "debugProtection",
      ]),
    );
  });

  it("touchscreen: physicalAccessProtection applicable; signal/debug/link not-applicable", () => {
    const v = getApplicableControls("touchscreen");
    expect(v.byKey.physicalAccessProtection).toBe("applicable");
    expect(v.byKey.signalProtection).toBe("not-applicable");
    expect(v.byKey.debugProtection).toBe("not-applicable");
    expect(v.byKey.linkAuthentication).toBe("not-applicable");
    expect(v.applicable).toContain("physicalAccessProtection");
  });

  it("ethernet: physical + signal applicable (value-independent — applicability is a type function)", () => {
    // The stored value plays NO role in applicability. undefined and "none" are
    // both worst case and neither changes whether the field is applicable.
    const v = getApplicableControls("ethernet");
    expect(v.byKey.physicalAccessProtection).toBe("applicable");
    expect(v.byKey.signalProtection).toBe("applicable");
  });

  it("partitions the full key set into applicable ∪ not-applicable (no overlap)", () => {
    const v = getApplicableControls("uart");
    expect(v.applicable.length + v.notApplicable.length).toBe(
      INTERFACE_CONTROL_KEYS.length,
    );
    for (const k of v.applicable) expect(v.notApplicable).not.toContain(k);
    for (const k of v.notApplicable) expect(v.applicable).not.toContain(k);
  });

  it("every key has exactly one of the two states in byKey", () => {
    const v = getApplicableControls("jtag");
    for (const key of INTERFACE_CONTROL_KEYS) {
      expect(["applicable", "not-applicable"]).toContain(v.byKey[key]);
    }
  });
});

describe("buildInterfaceControlClearPatch — A3 clear-rule", () => {
  it("clears a value that becomes n/a after the type change (wifi PSK → ethernet)", () => {
    // wifi had linkAuthentication set; ethernet has hasLinkAuth=false → clear it.
    const patch = buildInterfaceControlClearPatch("ethernet", {
      linkAuthentication: "pre_shared_key",
    });
    expect(patch).toHaveProperty("linkAuthentication", undefined);
    expect("linkAuthentication" in patch).toBe(true); // explicitly present as undefined
  });

  it("does NOT clear a value that stays applicable (ethernet → uart, signalProtection)", () => {
    // both ethernet and uart are cabled → signalProtection stays applicable.
    const patch = buildInterfaceControlClearPatch("uart", {
      signalProtection: "shielded",
    });
    expect("signalProtection" in patch).toBe(false);
  });

  it("clears signalProtection when switching cabled → wireless (ethernet → wifi)", () => {
    const patch = buildInterfaceControlClearPatch("wifi", {
      signalProtection: "shielded",
      physicalAccessProtection: "locked_panel",
    });
    expect("signalProtection" in patch).toBe(true);
    expect("physicalAccessProtection" in patch).toBe(true);
    expect(patch.signalProtection).toBeUndefined();
    expect(patch.physicalAccessProtection).toBeUndefined();
  });

  it("only clears keys that actually held a value (no patch for already-unset keys)", () => {
    const patch = buildInterfaceControlClearPatch("wifi", {
      // signalProtection not set → nothing to clear even though it's n/a on wifi
      linkAuthentication: "pre_shared_key", // stays applicable on wifi → keep
    });
    expect("signalProtection" in patch).toBe(false);
    expect("linkAuthentication" in patch).toBe(false);
  });

  it("returns an empty patch when implementedControls is undefined", () => {
    expect(buildInterfaceControlClearPatch("wifi", undefined)).toEqual({});
    expect(buildInterfaceControlClearPatch("wifi", null)).toEqual({});
  });

  it("NEVER produces an 'n/a' string — cleared values are strictly undefined", () => {
    const patch = buildInterfaceControlClearPatch("wifi", {
      signalProtection: "shielded",
      debugProtection: "fused_off",
    });
    for (const v of Object.values(patch)) {
      expect(v).toBeUndefined();
      expect(v).not.toBe("n/a");
    }
  });

  it("round-trip: clear on A→B, then B→A leaves the field undefined (analyst re-sets)", () => {
    // ethernet(signalProtection set) → wifi clears it → back to ethernet:
    // the clear-rule does not restore it; it stays undefined (== none == worst
    // case). The field is still applicable on ethernet, so the form shows it
    // (empty) for the analyst.
    const toWifi = buildInterfaceControlClearPatch("wifi", {
      signalProtection: "shielded",
    });
    const cleared: Partial<ImplementedControls> = {
      signalProtection: "shielded",
      ...toWifi,
    };
    expect(cleared.signalProtection).toBeUndefined();
    const backToEth = buildInterfaceControlClearPatch("ethernet", cleared);
    // nothing to clear (value already undefined); signalProtection is still
    // applicable on ethernet (applicability is a type function, value-independent)
    expect(backToEth).toEqual({});
    expect(getApplicableControls("ethernet").byKey.signalProtection).toBe(
      "applicable",
    );
  });
});

describe("consistency — the module adds no applicability logic of its own", () => {
  it("getApplicableControls agrees with isControlApplicable for every type/key", () => {
    const types: InterfaceType[] = [
      "wifi",
      "ethernet",
      "uart",
      "touchscreen",
      "jtag",
      "custom",
    ];
    for (const type of types) {
      const v = getApplicableControls(type);
      for (const key of INTERFACE_CONTROL_KEYS) {
        const applicable = isControlApplicable(type, key);
        expect(v.byKey[key] === "not-applicable").toBe(!applicable);
      }
    }
  });
});