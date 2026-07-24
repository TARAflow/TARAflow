// tests/unit/features/dfd/services/validators/dataflow-property-validator.test.ts
//
// B — verb ↔ DataFlowProperties consistency for `read`.
//
// ⚠ WIRING: deep import specifiers; adjust if a barrel exists.

import { describe, it, expect } from "vitest";
import { validateDataflowProperties } from "features/dfd/services/validators/dataflow-property-validator";
import { ValidationMessages } from "features/dfd/services/validators/validator-utils";
import type { ValidationFinding } from "features/dfd/models/dfd-types";
import { conn } from "./dfd-factory";

function run(name: string, properties: Record<string, unknown>) {
  const errors: ValidationFinding[] = [];
  const warnings: ValidationFinding[] = [];
  validateDataflowProperties(
    [conn({ id: "DF-1", from: "DS-1", to: "P-1", name, properties: properties as never })],
    errors,
    warnings,
  );
  return {
    errorKeys: errors.map((f) => f.key),
    warningKeys: warnings.map((f) => f.key),
  };
}

describe("dataflow-property-validator — read", () => {
  it("does not require a protocol for read (exempt, like write)", () => {
    const { warningKeys } = run("read fft result", {});
    expect(warningKeys).not.toContain(
      ValidationMessages.DF_PROP_PROTOCOL_MISSING,
    );
  });
});
