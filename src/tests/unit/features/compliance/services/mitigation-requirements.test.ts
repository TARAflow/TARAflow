// Mitigation → requirements (iec-62443-4-2-cra-coverage.md D-29): referenced
// ids from the catalog, derived ones from affectsProperties (bound to the
// effect's element type), suggestions filtered to the open element types.
import { describe, it, expect } from "vitest";
import { mitigationRequirements, requirementsMetBy, suggestMitigations } from "features/compliance";

describe("requirementsMetBy", () => {
  it("an effect meets the A / B rules of its type whose check accepts the value", () => {
    expect(requirementsMetBy({ targetType: "DataFlow", property: "integrityProtection", expectedValue: "hmac" })).toEqual(
      expect.arrayContaining(["cr-3.1", "cr-3.1-re1"]),
    );
    expect(requirementsMetBy({ targetType: "Process", property: "malwareProtection", expectedValue: "code_signing" })).toEqual(
      expect.arrayContaining(["cr-3.2", "cr-3.2-re1"]),
    );
  });

  it("a value the check rejects or another element type meets nothing", () => {
    expect(requirementsMetBy({ targetType: "DataFlow", property: "integrityProtection", expectedValue: "crc" })).toEqual([]);
    expect(requirementsMetBy({ targetType: "DataStore", property: "malwareProtection", expectedValue: "code_signing" })).toEqual([]);
  });
});

describe("mitigationRequirements", () => {
  it("referenced ids for any element, derived ones bound to the effect's type, no id twice", () => {
    const reqs = mitigationRequirements({
      id: "M-X",
      iec62443: ["cr-3.1"],
      affectsProperties: [{ targetType: "DataFlow", property: "integrityProtection", expectedValue: "signature" }],
    });
    expect(reqs).toContainEqual({ requirementId: "cr-3.1" });
    expect(reqs).toContainEqual({ requirementId: "cr-3.1-re1", elementTypes: ["DataFlow"] });
    expect(reqs.filter((r) => r.requirementId === "cr-3.1")).toHaveLength(1);
  });

  it("unknown referenced ids are dropped", () => {
    expect(mitigationRequirements({ id: "M-X", iec62443: ["cr-99"] })).toEqual([]);
  });
});

describe("suggestMitigations", () => {
  const catalog = [
    { id: "M-FLOW", affectsProperties: [{ targetType: "DataFlow", property: "encryptionInTransit", expectedValue: "tls" }] },
    { id: "M-STORE", affectsProperties: [{ targetType: "DataStore", property: "encryptionAtRest", expectedValue: "aes256" }] },
    { id: "M-REF", iec62443: ["cr-4.3"] },
  ];

  it("filters to the types of the elements still open", () => {
    const flows = suggestMitigations(catalog, ["cr-4.1-transit", "cr-4.1-rest"], new Set(["DataFlow"]));
    expect(flows.map((m) => m.id)).toEqual(["M-FLOW"]);
  });

  it("without open elements every mitigation meeting the requirement", () => {
    expect(suggestMitigations(catalog, ["cr-4.1-transit", "cr-4.1-rest"]).map((m) => m.id)).toEqual(["M-FLOW", "M-STORE"]);
  });

  it("a referenced id without property effect is always suggested", () => {
    expect(suggestMitigations(catalog, ["cr-4.3"], new Set(["DataStore"])).map((m) => m.id)).toEqual(["M-REF"]);
  });
});
