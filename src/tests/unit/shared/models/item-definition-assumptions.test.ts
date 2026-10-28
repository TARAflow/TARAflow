// tests/unit/shared/models/item-definition-assumptions.test.ts
//
// ISO/SAE 21434 conformance plan Phase 1 stage A, A-3: assumptions ASM-nn.

import { describe, it, expect } from "vitest";
import { newAssumption, nextAssumptionDisplayId, type Assumption } from "shared";

const asm = (displayId: string): Assumption => ({ id: displayId, displayId, text: "x", status: "open" });

describe("assumption ids", () => {
  it("ASM-01 first, then one more than the highest in use", () => {
    expect(nextAssumptionDisplayId([])).toBe("ASM-01");
    expect(nextAssumptionDisplayId([asm("ASM-01"), asm("ASM-07"), asm("other")])).toBe("ASM-08");
  });

  it("a new assumption is open, trimmed, with a unique id", () => {
    const a = newAssumption([asm("ASM-02")], "  Loop wiring is not accessible ");
    const b = newAssumption([asm("ASM-02")], "x");
    expect(a).toMatchObject({ displayId: "ASM-03", text: "Loop wiring is not accessible", status: "open" });
    expect(a.id).not.toBe(b.id);
  });
});
