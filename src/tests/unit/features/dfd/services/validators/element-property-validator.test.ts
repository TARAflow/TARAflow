// tests/unit/features/dfd/services/validators/element-property-validator.test.ts
//
// B — DataStore accessModel consistency (override rationale, mpu conflict).
//
// ⚠ WIRING: deep import specifiers; adjust if a barrel exists.

import { describe, it, expect } from "vitest";
import { validateElementProperties } from "features/dfd/services/validators/element-property-validator";
import { ValidationMessages } from "features/dfd/services/validators/validator-utils";
import type { DataStoreProperties } from "features/dfd/models/element-properties";
import type { ValidationFinding } from "features/dfd/models/dfd-types";
import { dataStore } from "./dfd-factory";

function run(props: Partial<DataStoreProperties>) {
  const warnings: ValidationFinding[] = [];
  validateElementProperties([dataStore("DS-1", props)], warnings);
  return warnings.map((f) => f.key);
}

describe("element-property-validator — DataStore accessModel", () => {
  it("warns when accessModel deviates from the technology default without a rationale", () => {
    // flash defaults to direct_access; overriding to communication needs a rationale
    const keys = run({ technology: "flash", accessModel: "communication" });
    expect(keys).toContain(
      ValidationMessages.DS_ACCESSMODEL_OVERRIDE_NO_RATIONALE,
    );
  });

  it("does not warn when the deviation carries a rationale", () => {
    const keys = run({
      technology: "flash",
      accessModel: "communication",
      accessModelRationale: "fronted by a bus controller service",
    });
    expect(keys).not.toContain(
      ValidationMessages.DS_ACCESSMODEL_OVERRIDE_NO_RATIONALE,
    );
  });

  it("does not warn when accessModel matches the technology default", () => {
    const keys = run({ technology: "flash", accessModel: "direct_access" });
    expect(keys).not.toContain(
      ValidationMessages.DS_ACCESSMODEL_OVERRIDE_NO_RATIONALE,
    );
  });

  it("warns on mpu_protected + communication without a rationale", () => {
    const keys = run({
      technology: "shared_memory",
      accessControlMechanism: "mpu_protected",
      accessModel: "communication",
    });
    expect(keys).toContain(
      ValidationMessages.DS_ACCESSMODEL_MPU_COMMUNICATION_CONFLICT,
    );
  });

  it("does not warn on mpu_protected + direct_access", () => {
    const keys = run({
      technology: "shared_memory",
      accessControlMechanism: "mpu_protected",
      accessModel: "direct_access",
    });
    expect(keys).not.toContain(
      ValidationMessages.DS_ACCESSMODEL_MPU_COMMUNICATION_CONFLICT,
    );
  });
});
