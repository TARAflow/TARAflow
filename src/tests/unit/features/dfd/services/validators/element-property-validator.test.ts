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
import { el, dataStore } from "./dfd-factory";

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

  function runChip(props: Record<string, unknown>) {
    const warnings: ValidationFinding[] = [];
    validateElementProperties(
      [
        el({
          id: "CB-1",
          type: "ChipBoundary",
          name: "ESP32 [CB]",
          properties: props as never,
        }),
      ],
      warnings,
    );
    return warnings.map((f) => f.params?.field ?? f.key);
  }

  describe("element-property-validator — ChipBoundary debug interface", () => {
    // chipType/defaultExposureLevel set throughout to isolate the debug findings.
    const baseChip = { chipType: "mcu", defaultExposureLevel: "EL1" };

    it("warns when debugInterfacePresent is not assessed", () => {
      const fields = runChip({ ...baseChip });
      expect(fields).toContain("debugInterfacePresent");
    });

    it("warns when a debug interface is present but its lock state is unassessed", () => {
      const fields = runChip({ ...baseChip, debugInterfacePresent: "jtag" });
      expect(fields).toContain("debugInterfaceLocked");
    });

    it("does not warn on lock when the present interface is explicitly locked", () => {
      const fields = runChip({
        ...baseChip,
        debugInterfacePresent: "jtag",
        debugInterfaceLocked: true,
      });
      expect(fields).not.toContain("debugInterfaceLocked");
    });

    it("does not warn on lock when no debug interface is present", () => {
      const fields = runChip({ ...baseChip, debugInterfacePresent: "none" });
      expect(fields).not.toContain("debugInterfaceLocked");
    });
  });
});
