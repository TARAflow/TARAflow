// The General phase status (before: never derived, "not started" for good).
// Same rule as the warnings on the General tab.
import { describe, it, expect } from "vitest";
import { generalPhaseStatus, missingGeneralFields } from "features/overview/services/general-completeness";

const TAGS = { custom: [], domain: ["Automotive"], platform: [], regulation: [] };
const FULL = { name: "Headlamp", description: "TARA", version: "1.0", responsible: "JPM", tags: TAGS };

describe("General completeness", () => {
  it("complete when every required field is filled", () => {
    expect(missingGeneralFields(FULL)).toEqual([]);
    expect(generalPhaseStatus(FULL)).toBe("complete");
  });

  it("in progress with fields missing; a name needs three characters", () => {
    expect(missingGeneralFields({ ...FULL, name: "HL", version: " " })).toEqual(["name", "version"]);
    expect(generalPhaseStatus({ ...FULL, version: "" })).toBe("in-progress");
  });

  it("not started when nothing is filled", () => {
    const empty = { name: "", description: "", version: "", responsible: "", tags: { ...TAGS, domain: [] } };
    expect(generalPhaseStatus(empty)).toBe("not-started");
  });
});
