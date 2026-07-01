import { describe, it, expect } from "vitest";
import {
  INTERFACE_TYPE_META,
  INTERFACE_CONTROL_KEYS,
  isControlApplicable,
} from "../../../../../features/dfd/models/interface-type-registry";
import type { InterfaceType } from "../../../../../features/dfd/models/element-properties";

const ALL_TYPES = Object.keys(INTERFACE_TYPE_META) as InterfaceType[];

describe("interface capability registry (A0)", () => {
  it("defines all four capability axes for every interface type", () => {
    for (const type of ALL_TYPES) {
      const meta = INTERFACE_TYPE_META[type];
      // cabled and hasLinkAuth are required (non-optional) — must be boolean.
      expect(typeof meta.cabled, `${type}.cabled`).toBe("boolean");
      expect(typeof meta.hasLinkAuth, `${type}.hasLinkAuth`).toBe("boolean");
      // requiresPhysicalAccess / isDebug are optional; if present, boolean.
      if (meta.requiresPhysicalAccess !== undefined) {
        expect(typeof meta.requiresPhysicalAccess).toBe("boolean");
      }
      if (meta.isDebug !== undefined) {
        expect(typeof meta.isDebug).toBe("boolean");
      }
    }
  });

  it("returns a defined boolean for every (type, controlKey) pair", () => {
    for (const type of ALL_TYPES) {
      for (const key of INTERFACE_CONTROL_KEYS) {
        expect(typeof isControlApplicable(type, key), `${type}/${key}`).toBe(
          "boolean",
        );
      }
    }
  });

  it("touchscreen: only physicalAccessProtection applies (lockable housing)", () => {
    expect(isControlApplicable("touchscreen", "physicalAccessProtection")).toBe(
      true,
    );
    expect(isControlApplicable("touchscreen", "signalProtection")).toBe(false);
    expect(isControlApplicable("touchscreen", "debugProtection")).toBe(false);
    expect(isControlApplicable("touchscreen", "linkAuthentication")).toBe(false);
  });

  it("wifi: only linkAuthentication applies (no physical connector, no cable)", () => {
    expect(isControlApplicable("wifi", "linkAuthentication")).toBe(true);
    expect(isControlApplicable("wifi", "physicalAccessProtection")).toBe(false);
    expect(isControlApplicable("wifi", "signalProtection")).toBe(false);
    expect(isControlApplicable("wifi", "debugProtection")).toBe(false);
  });

  it("rs485: physical + signal apply, no link auth, no debug", () => {
    expect(isControlApplicable("rs485", "physicalAccessProtection")).toBe(true);
    expect(isControlApplicable("rs485", "signalProtection")).toBe(true);
    expect(isControlApplicable("rs485", "linkAuthentication")).toBe(false);
    expect(isControlApplicable("rs485", "debugProtection")).toBe(false);
  });

  it("jtag: debug applies (plus physical + signal), no link auth", () => {
    expect(isControlApplicable("jtag", "debugProtection")).toBe(true);
    expect(isControlApplicable("jtag", "physicalAccessProtection")).toBe(true);
    expect(isControlApplicable("jtag", "signalProtection")).toBe(true);
    expect(isControlApplicable("jtag", "linkAuthentication")).toBe(false);
  });

  it("link auth is exactly the wireless/proximity set", () => {
    const withLinkAuth = ALL_TYPES.filter(
      (t) => INTERFACE_TYPE_META[t].hasLinkAuth,
    ).sort();
    // custom is permissive; wifi/bluetooth/nfc are the real link-auth types.
    expect(withLinkAuth).toEqual(
      ["bluetooth", "custom", "nfc", "wifi"].sort(),
    );
  });
});
