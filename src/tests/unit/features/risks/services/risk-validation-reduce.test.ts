// User 2026-10-30 (Smoke Detector, SHE-T-1): all mitigations removed from a
// risk to reduce — no hint anywhere. The rule was "high risk without
// mitigation", which also flagged every accepted risk; and the validation
// was shown nowhere (now: Risk toolbar chip, Overview, phase bar).
import { describe, it, expect } from "vitest";
import { riskService } from "features/risks/services/risk-service";
import { DEFAULT_CONFIGURATION } from "features/risks/models/risk-config-types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
const risk = (id: string, treatment: string, statuses: string[], value = 8.8, extra: Any = {}): Any => ({
  id,
  threatDisplayId: id,
  treatment,
  treatmentJustification: "because",
  moscowPriority: "must",
  wontJustification: "",
  calculatedRiskBeforeMitigation: value,
  selectedMitigations: statuses.map((status, i) => ({ id: `M-${i}`, status })),
  ...extra,
});

describe("risk validation: a risk to reduce needs a mitigation", () => {
  it("reduce without (non-rejected) mitigation warns at any value; accept / share do not", () => {
    const v = riskService.validate({
      configuration: DEFAULT_CONFIGURATION,
      risks: [
        risk("SHE-T-1", "reduce", []),
        risk("LOW-1", "reduce", ["rejected"], 1.2),
        risk("OK-1", "reduce", ["open"]),
        risk("ACC-1", "accept", []),
        risk("SHR-1", "share", []),
        risk("WONT-1", "reduce", [], 8, { moscowPriority: "wont", wontJustification: "out of scope" }),
      ],
    } as Any);
    expect(v.warnings).toContain("2 risk(s) to reduce have no mitigation (SHE-T-1, LOW-1)");
    expect(v.warnings.join(" ")).not.toContain("high-risk");
  });
});
