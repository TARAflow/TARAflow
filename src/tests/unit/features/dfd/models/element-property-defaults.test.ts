// tests/unit/features/dfd/models/element-property-defaults.test.ts
//
// A — pure functions: DataStore accessModel derivation.
// No fixtures needed.
//
// ⚠ WIRING: deep import specifiers; adjust if a barrel exists.

import { describe, it, expect } from "vitest";
import {
  DATASTORE_TECH_DEFAULTS,
  resolveDataStoreAccessModel,
} from "features/dfd/models/element-property-defaults";
import type { DataStoreProperties } from "features/dfd/models/element-properties";

describe("DATASTORE_TECH_DEFAULTS — accessModel per technology", () => {
  const expected: Record<string, "direct_access" | "communication"> = {
    // passive memory / storage → direct_access
    flash: "direct_access",
    eeprom: "direct_access",
    nvram: "direct_access",
    shared_memory: "direct_access",
    mmio_register: "direct_access",
    filesystem: "direct_access",
    cache: "direct_access",
    // active services → communication
    database: "communication",
    cloud: "communication",
    queue: "communication",
    blockchain: "communication",
  };

  for (const [tech, accessModel] of Object.entries(expected)) {
    it(`${tech} → ${accessModel}`, () => {
      expect(
        DATASTORE_TECH_DEFAULTS[tech as keyof typeof DATASTORE_TECH_DEFAULTS]
          ?.accessModel,
      ).toBe(accessModel);
    });
  }
});

describe("resolveDataStoreAccessModel", () => {
  it("explicit accessModel wins over the technology default", () => {
    const props = {
      accessModel: "communication",
      technology: "flash",
    } as DataStoreProperties;
    expect(resolveDataStoreAccessModel(props)).toBe("communication");
  });

  it("falls back to the technology default when accessModel is unset", () => {
    expect(
      resolveDataStoreAccessModel({
        technology: "shared_memory",
      } as DataStoreProperties),
    ).toBe("direct_access");
    expect(
      resolveDataStoreAccessModel({
        technology: "database",
      } as DataStoreProperties),
    ).toBe("communication");
  });

  it("returns undefined when neither accessModel nor technology is set", () => {
    expect(resolveDataStoreAccessModel({} as DataStoreProperties)).toBeUndefined();
    expect(resolveDataStoreAccessModel(undefined)).toBeUndefined();
  });
});
