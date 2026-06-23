// tests/unit/features/threats/utils/stride-modifier.chipboundary.test.ts
//
// modifyChipBoundaryStride — debug interface lock polarity.
// Guards the `!== true` rule: an UNASSESSED lock state must escalate, and only
// an explicit debugInterfaceLocked === true earns the reduction. A regression
// to `=== false` turns these red.
//
// ⚠ WIRING: deep import specifier; adjust to your actual path / barrel.

import { describe, it, expect } from "vitest";
import {
  modifyChipBoundaryStride,
  type ChipBoundaryModifierProps,
} from "features/threats/utils/stride-modifier";
import type { StrideCategory } from "shared";

const BASE: StrideCategory[] = ["S", "T", "R", "I", "D"]; // no E — isolate the rule

function run(props: ChipBoundaryModifierProps): StrideCategory[] {
  return modifyChipBoundaryStride(BASE, props);
}

describe("modifyChipBoundaryStride — debug interface lock polarity", () => {
  it("escalates E + I when a present debug interface is explicitly NOT locked", () => {
    const out = run({ debugInterfacePresent: "jtag", debugInterfaceLocked: false });
    expect(out).toContain("E");
    expect(out).toContain("I");
  });

  it("escalates E + I when the lock state is UNASSESSED (undefined) — the forgotten-JTAG case", () => {
    // The core of the fix: undefined must NOT behave like locked.
    const out = run({ debugInterfacePresent: "jtag" }); // debugInterfaceLocked omitted
    expect(out).toContain("E");
    expect(out).toContain("I");
  });

  it("does NOT add E via this rule when the debug interface is explicitly locked", () => {
    // BASE has no E; an explicitly locked port must not introduce one here.
    const out = run({ debugInterfacePresent: "jtag", debugInterfaceLocked: true });
    expect(out).not.toContain("E");
  });

  it("does NOT escalate when no debug interface is present", () => {
    const out = run({ debugInterfacePresent: "none" });
    expect(out).not.toContain("E");
  });

  it("reduces (skips) E for SE/HSM with an explicitly locked debug interface", () => {
    // Reduction is earned only by === true — guards the SE/HSM rule we left intact.
    const withE: StrideCategory[] = ["S", "T", "E", "I"];
    const out = modifyChipBoundaryStride(withE, {
      chipType: "se",
      debugInterfacePresent: "jtag",
      debugInterfaceLocked: true,
    });
    expect(out).not.toContain("E");
  });

  it("does NOT reduce E for SE/HSM when the lock is unassessed", () => {
    // undefined must not earn the SE/HSM reduction either — symmetric to escalation.
    const withE: StrideCategory[] = ["S", "T", "E", "I"];
    const out = modifyChipBoundaryStride(withE, {
      chipType: "se",
      debugInterfacePresent: "jtag",
    });
    expect(out).toContain("E");
  });
});