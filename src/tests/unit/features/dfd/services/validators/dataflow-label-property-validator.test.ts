// tests/unit/features/dfd/services/validators/dataflow-label-property-validator.test.ts
//
// B — endpoint gate: read/pull vs the store's effective accessModel (LP-6/7/8).
//
// ⚠ WIRING: deep import specifiers; adjust if a barrel exists.

import { describe, it, expect } from "vitest";
import { validateDataflowLabelProperties } from "features/dfd/services/validators/dataflow-label-property-validator";
import { ValidationMessages } from "features/dfd/services/validators/validator-utils";
import type { DFDElement, ValidationFinding } from "features/dfd/models/dfd-types";
import { conn, dataStore, el } from "./dfd-factory";

const ACTOR = el({ id: "P-1", type: "Process" });

function run(name: string, store: DFDElement, fromId = store.id, toId = ACTOR.id) {
  const errors: ValidationFinding[] = [];
  const warnings: ValidationFinding[] = [];
  const elements = [store, ACTOR].concat(
    fromId !== store.id && fromId !== ACTOR.id
      ? [el({ id: fromId, type: "Process" })]
      : [],
  );
  validateDataflowLabelProperties(
    [conn({ id: "DF-1", from: fromId, to: toId, name })],
    elements,
    errors,
    warnings,
  );
  return {
    errorKeys: errors.map((f) => f.key),
    warningKeys: warnings.map((f) => f.key),
    allKeys: [...errors, ...warnings].map((f) => f.key),
  };
}

describe("dataflow-label-property-validator — read accessModel gate", () => {
  it("read from a direct_access store produces no accessModel finding", () => {
    const store = dataStore("DS-1", {
      technology: "shared_memory",
      accessModel: "direct_access",
    });
    const { allKeys } = run("read fft result", store);
    expect(allKeys).not.toContain(
      ValidationMessages.DF_LP_READ_ON_COMMUNICATION_STORE,
    );
    expect(allKeys).not.toContain(
      ValidationMessages.DF_LP_READ_STORE_UNCLASSIFIED,
    );
    expect(allKeys).not.toContain(
      ValidationMessages.DF_LP_READ_SOURCE_NOT_DATASTORE,
    );
  });

  it("read from a communication store is an error (use pull)", () => {
    const store = dataStore("DS-1", {
      technology: "database",
      accessModel: "communication",
    });
    const { errorKeys } = run("read user profile", store);
    expect(errorKeys).toContain(
      ValidationMessages.DF_LP_READ_ON_COMMUNICATION_STORE,
    );
  });

  it("read from an unclassified store is a warning (classify first)", () => {
    const store = dataStore("DS-1", {}); // no technology, no accessModel
    const { warningKeys } = run("read blob", store);
    expect(warningKeys).toContain(
      ValidationMessages.DF_LP_READ_STORE_UNCLASSIFIED,
    );
  });

  it("read whose source is not a DataStore is an error", () => {
    // from = a Process, not a store
    const { errorKeys } = run("read x", ACTOR, "P-2");
    expect(errorKeys).toContain(
      ValidationMessages.DF_LP_READ_SOURCE_NOT_DATASTORE,
    );
  });

  it("pull touching a direct_access store warns (suggest read)", () => {
    const store = dataStore("DS-1", {
      technology: "flash",
      accessModel: "direct_access",
    });
    const { warningKeys } = run("pull config [req]", store);
    expect(warningKeys).toContain(
      ValidationMessages.DF_LP_PULL_ON_DIRECT_ACCESS_STORE,
    );
  });

  it("resolves accessModel from technology when unset (flash → direct_access, no error)", () => {
    const store = dataStore("DS-1", { technology: "flash" }); // accessModel omitted
    const { allKeys } = run("read calibration block", store);
    expect(allKeys).not.toContain(
      ValidationMessages.DF_LP_READ_ON_COMMUNICATION_STORE,
    );
    expect(allKeys).not.toContain(
      ValidationMessages.DF_LP_READ_STORE_UNCLASSIFIED,
    );
  });
});
