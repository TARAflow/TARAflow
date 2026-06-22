// tests/unit/features/dfd/services/validators/dataflow-label-validator.test.ts
//
// B — syntax validation of the `read` verb.
//
// ⚠ WIRING: deep import specifiers; adjust if a barrel exists.

import { describe, it, expect } from "vitest";
import { validateDataflowLabels } from "features/dfd/services/validators/dataflow-label-validator";
import { ValidationMessages } from "features/dfd/services/validators/validator-utils";
import type { ValidationFinding } from "features/dfd/models/dfd-types";
import { conn, el } from "./dfd-factory";

function run(label: string) {
  const errors: ValidationFinding[] = [];
  const warnings: ValidationFinding[] = [];
  const connections = [
    conn({ id: "DF-1", from: "DS-1", to: "P-1", name: label }),
  ];
  const elements = [
    el({ id: "DS-1", type: "DataStore" }),
    el({ id: "P-1", type: "Process" }),
  ];
  validateDataflowLabels(connections, elements, errors, warnings);
  return {
    errorKeys: errors.map((f) => f.key),
    warningKeys: warnings.map((f) => f.key),
    allKeys: [...errors, ...warnings].map((f) => f.key),
  };
}

describe("dataflow-label-validator — read verb", () => {
  it("accepts `read <object>` as a valid verb", () => {
    const { errorKeys } = run("read fft result");
    expect(errorKeys).not.toContain(ValidationMessages.DF_UNKNOWN_VERB);
    expect(errorKeys).not.toContain(ValidationMessages.DF_READ_REDUNDANT_FLOW_TYPE);
  });

  it("no longer flags read as a synonym verb", () => {
    const { allKeys } = run("read input buffer");
    expect(allKeys).not.toContain(ValidationMessages.DF_SYNONYM_VERB);
  });

  it("errors when read carries a flow-type tag", () => {
    const { errorKeys } = run("read fft result [req]");
    expect(errorKeys).toContain(ValidationMessages.DF_READ_REDUNDANT_FLOW_TYPE);
  });

  it("allows `buffer` as an object term (removed from forbidden terms)", () => {
    const { warningKeys } = run("read input buffer");
    expect(warningKeys).not.toContain(ValidationMessages.DF_OBJECT_FORBIDDEN_TERM);
  });
});
