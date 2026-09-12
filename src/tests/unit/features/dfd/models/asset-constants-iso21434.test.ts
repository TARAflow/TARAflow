import { describe, it, expect } from "vitest";
import { getAllowedRelations } from "features/dfd/models/asset-constants";

// ISO/SAE 21434 headlamp (Annex H) relations that were rejected before:
// a sensor invokes a function, an actuator executes it, an embedded ECU
// (Multiprocess) stores its firmware (a data asset). See asset-constants.ts.
describe("getAllowedRelations — ISO 21434 headlamp relations", () => {
  it("Sensor may invoke a function (headlamp switch → on/off function)", () => {
    expect(getAllowedRelations("Sensor", "function")).toContain("invokes");
  });

  it("Actuator may execute a function (power switch → on/off function)", () => {
    expect(getAllowedRelations("Actuator", "function")).toContain("executes");
  });

  it("Multiprocess may store a data asset (ECU firmware)", () => {
    expect(getAllowedRelations("Multiprocess", "data")).toContain("stores");
  });

  it("keeps the existing allowances intact", () => {
    // transports for dataflows, the canonical DataStore 'stores', etc.
    expect(getAllowedRelations("DataFlow", "data")).toEqual(["transports"]);
    expect(getAllowedRelations("DataStore", "data")).toContain("stores");
    expect(getAllowedRelations("Sensor", "function")).toContain("monitors");
    expect(getAllowedRelations("Multiprocess", "data")).toContain("reads");
  });

  it("does not over-loosen: a sensor still cannot execute, an actuator still cannot invoke", () => {
    expect(getAllowedRelations("Sensor", "function")).not.toContain("executes");
    expect(getAllowedRelations("Actuator", "function")).not.toContain("invokes");
  });

  it("ExternalEntity may store data (a foreign system can persist data), Process may not", () => {
    expect(getAllowedRelations("ExternalEntity", "data")).toContain("stores");
    expect(getAllowedRelations("Process", "data")).not.toContain("stores");
  });
});
