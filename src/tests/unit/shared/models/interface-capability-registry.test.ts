// src/tests/unit/shared/models/interface-capability-registry.test.ts
//
// A0 exhaustiveness + consistency guard for the interface capability model.
//
// Two registries encode interface metadata:
//   - src/shared/models/interface-capability-registry.ts  (INTERFACE_CAPABILITY):
//     the security-relevant axes, shared between features/dfd and features/threats.
//   - src/features/dfd/models/interface-type-registry.ts  (INTERFACE_TYPE_META):
//     UI metadata, which spreads the axis values in from the shared registry.
//
// The InterfaceType union is structurally (not nominally) duplicated between
// the shared registry and features/dfd/models/element-properties.ts, so TS
// alone will NOT catch a type added to one but not the other. These tests are
// the safety net for that drift, plus the internal coherence of
// isControlApplicable against the raw axis values.

import { describe, it, expect } from "vitest";
import {
  INTERFACE_CAPABILITY,
  isControlApplicable,
  type InterfaceControlKey,
} from "shared/models/interface-capability-registry";
import type { InterfaceType } from "features/dfd/models/element-properties";
import { INTERFACE_TYPE_META } from "features/dfd/models/interface-type-registry";

const ALL_TYPES = Object.keys(INTERFACE_CAPABILITY) as InterfaceType[];

const SHARED_CONTROL_KEYS: InterfaceControlKey[] = [
  "physicalAccessProtection",
  "signalProtection",
  "debugProtection",
  "linkAuthentication",
];

describe("INTERFACE_CAPABILITY — exhaustiveness", () => {
  it("has at least the known baseline set of interface types", () => {
    // Not asserting an exact list (new types may be added), but the count must
    // never silently shrink below the types that existed at A0.
    expect(ALL_TYPES.length).toBeGreaterThanOrEqual(20);
  });

  it("every capability row has the required (non-optional) axes defined", () => {
    for (const type of ALL_TYPES) {
      const cap = INTERFACE_CAPABILITY[type];
      // cabled and hasLinkAuth are non-optional in the InterfaceCapability type.
      expect(typeof cap.cabled).toBe("boolean");
      expect(typeof cap.hasLinkAuth).toBe("boolean");
    }
  });

  it("optional axes, when present, are booleans (never null/string)", () => {
    for (const type of ALL_TYPES) {
      // InterfaceCapability is a precise interface (no index signature), so a
      // direct cast to Record<string, unknown> is rejected — route through
      // unknown, as TS suggests.
      const cap = INTERFACE_CAPABILITY[type] as unknown as Record<
        string,
        unknown
      >;
      for (const axis of [
        "requiresPhysicalAccess",
        "isDebug",
        "debugCapable",
      ]) {
        if (axis in cap && cap[axis] !== undefined) {
          expect(typeof cap[axis]).toBe("boolean");
        }
      }
    }
  });
});

describe("INTERFACE_CAPABILITY <-> INTERFACE_TYPE_META — no drift", () => {
  it("both registries cover exactly the same set of interface types", () => {
    const metaKeys = Object.keys(INTERFACE_TYPE_META).sort();
    const capKeys = [...ALL_TYPES].sort();
    expect(metaKeys).toEqual(capKeys);
  });

  it("META spreads the SAME axis values as the shared registry (no override)", () => {
    for (const type of ALL_TYPES) {
      const cap = INTERFACE_CAPABILITY[type];
      const meta = INTERFACE_TYPE_META[type];
      expect(meta.cabled).toBe(cap.cabled);
      expect(meta.hasLinkAuth).toBe(cap.hasLinkAuth);
      expect(meta.requiresPhysicalAccess).toBe(cap.requiresPhysicalAccess);
      expect(meta.isDebug).toBe(cap.isDebug);
      expect(meta.debugCapable).toBe(cap.debugCapable);
    }
  });
});

describe("isControlApplicable — coherence with raw axes", () => {
  it("physicalAccessProtection applicable iff requiresPhysicalAccess === true", () => {
    for (const type of ALL_TYPES) {
      expect(isControlApplicable(type, "physicalAccessProtection")).toBe(
        INTERFACE_CAPABILITY[type].requiresPhysicalAccess === true,
      );
    }
  });

  it("signalProtection applicable iff cabled === true", () => {
    for (const type of ALL_TYPES) {
      expect(isControlApplicable(type, "signalProtection")).toBe(
        INTERFACE_CAPABILITY[type].cabled === true,
      );
    }
  });

  it("debugProtection applicable iff debugCapable === true", () => {
    for (const type of ALL_TYPES) {
      expect(isControlApplicable(type, "debugProtection")).toBe(
        INTERFACE_CAPABILITY[type].debugCapable === true,
      );
    }
  });

  it("linkAuthentication applicable iff hasLinkAuth === true", () => {
    for (const type of ALL_TYPES) {
      expect(isControlApplicable(type, "linkAuthentication")).toBe(
        INTERFACE_CAPABILITY[type].hasLinkAuth === true,
      );
    }
  });

  it("returns a boolean for every (type, key) pair — total function", () => {
    for (const type of ALL_TYPES) {
      for (const key of SHARED_CONTROL_KEYS) {
        expect(typeof isControlApplicable(type, key)).toBe("boolean");
      }
    }
  });
});

describe("isControlApplicable — semantic invariants", () => {
  it("every isDebug type is also debugCapable (isDebug is the narrower axis)", () => {
    for (const type of ALL_TYPES) {
      const cap = INTERFACE_CAPABILITY[type];
      if (cap.isDebug === true) {
        expect(cap.debugCapable).toBe(true);
      }
    }
  });

  it("wireless types (no cable) are never signalProtection-applicable", () => {
    for (const type of ["wifi", "bluetooth", "nfc"] as InterfaceType[]) {
      expect(isControlApplicable(type, "signalProtection")).toBe(false);
    }
  });

  it("link-layer auth only on wireless types (hasLinkAuth), never on wired buses", () => {
    for (const type of ["uart", "ethernet", "can", "spi", "i2c"] as InterfaceType[]) {
      // Some of these may not exist in every build; guard the lookup.
      if (type in INTERFACE_CAPABILITY) {
        expect(isControlApplicable(type, "linkAuthentication")).toBe(false);
      }
    }
  });
});