// src/tests/unit/features/threats/utils/stride-modifier.interface.test.ts
//
// A4 — interface threat-gen suppression. Guards that modifyInterfaceStride
// removes STRIDE categories whose interface control is n/a for the element's
// type, driven by the SHARED capability registry
// (src/shared/models/interface-capability-registry.ts). "n/a" (not applicable)
// must never produce a control-gap threat — distinct from "none" (applicable
// but unset → gap → threat).
//
// Scope note: only T (physicalAccessProtection) and I (signalProtection) are
// suppressed at the category level. D and E are NOT — those categories bundle
// mitigations of mixed type-applicability inside one template, so a
// category-level skip would be too coarse. D's type-specific reduction is
// handled by the D-006/D-009 template split instead (see the catalog test).

import { describe, it, expect } from "vitest";
import {
  modifyInterfaceStride,
  type InterfaceModifierProps,
} from "features/threats/utils/stride-modifier";
import type { StrideCategory } from "shared";

const FULL: StrideCategory[] = ["S", "T", "R", "I", "D", "E"];

function run(type?: string, extra: Partial<InterfaceModifierProps> = {}) {
  return modifyInterfaceStride(FULL, { type, ...extra });
}

describe("modifyInterfaceStride — T suppression (physicalAccessProtection)", () => {
  it.each(["wifi", "bluetooth", "nfc"])(
    "removes T for %s (requiresPhysicalAccess=false)",
    (type) => {
      expect(run(type)).not.toContain("T");
    },
  );

  it.each(["uart", "ethernet", "usb", "jtag", "touchscreen", "custom"])(
    "keeps T for %s (requiresPhysicalAccess=true)",
    (type) => {
      expect(run(type)).toContain("T");
    },
  );
});

describe("modifyInterfaceStride — I suppression (signalProtection)", () => {
  it.each(["wifi", "bluetooth", "nfc", "touchscreen"])(
    "removes I for %s (cabled=false)",
    (type) => {
      expect(run(type)).not.toContain("I");
    },
  );

  it.each(["uart", "ethernet", "usb", "jtag", "can", "custom"])(
    "keeps I for %s (cabled=true)",
    (type) => {
      expect(run(type)).toContain("I");
    },
  );
});

describe("modifyInterfaceStride — categories that must never be touched here", () => {
  it.each(["wifi", "touchscreen", "uart", "bluetooth", "custom"])(
    "keeps S, R, D, E for %s regardless of type",
    (type) => {
      expect(run(type)).toEqual(expect.arrayContaining(["S", "R", "D", "E"]));
    },
  );
});

describe("modifyInterfaceStride — no type", () => {
  it("is a pure no-op when type is undefined", () => {
    expect(run(undefined)).toEqual(FULL);
  });

  it("does not mutate the input array", () => {
    const input: StrideCategory[] = ["S", "T", "R", "I", "D", "E"];
    modifyInterfaceStride(input, { type: "wifi" });
    expect(input).toEqual(["S", "T", "R", "I", "D", "E"]);
  });
});

describe("modifyInterfaceStride — combined cases", () => {
  it("wifi loses both T and I, keeps S/R/D/E (4 categories)", () => {
    const r = run("wifi");
    expect(r).toEqual(expect.arrayContaining(["S", "R", "D", "E"]));
    expect(r).not.toContain("T");
    expect(r).not.toContain("I");
    expect(r).toHaveLength(4);
  });

  it("touchscreen loses only I (cabled=false) but keeps T (requiresPhysicalAccess=true)", () => {
    const r = run("touchscreen");
    expect(r).toContain("T");
    expect(r).not.toContain("I");
    expect(r).toHaveLength(5);
  });

  it("uart keeps the full base set (both axes applicable)", () => {
    expect(run("uart")).toEqual(FULL);
  });
});
