// tests/unit/app/utils/phase-indicators.test.ts
//
// Review 2026-10-30 (SmokeDetector): the Overview showed the DFD's error
// under Hazard — it indexed its validation info by hand with the pre-v2
// phase number — and DFD "incomplete" from a validation stored in the file.
// The indicators are keyed by PhaseId; the DFD part comes from the current
// validation; the details say what is behind a status (tooltips).

import { describe, it, expect } from "vitest";
import { MAX_DETAILS, phaseIndicators } from "app/utils/phase-indicators";
import { PhaseId } from "app/models/phase-types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const t = (key: string, o?: Record<string, unknown>) =>
  String(o?.defaultValue ?? key).replace(/\{\{(\w+)\}\}/g, (_m, n: string) => String(o?.[n] ?? ""));
const info = {
  name: "Smoke Detector",
  description: "d",
  version: "1",
  responsible: "r",
  tags: { domain: [], platform: [], regulation: ["ISO 21434"], custom: [] } as Any,
};
const stored: Any = { [PhaseId.General]: "complete", [PhaseId.Hazard]: "complete", [PhaseId.DFD]: "incomplete" };
const finding = (key: string) => ({ key });

describe("phase indicators", () => {
  it("DFD findings count on the DFD phase, never on Hazard; their text is the detail", () => {
    const { counts, details } = phaseIndicators({
      phaseStatus: stored,
      info,
      dfdValidation: { errors: [finding("E1")], warnings: [finding("W1"), finding("W2")] },
      t,
    });
    expect(counts[PhaseId.DFD]).toEqual({ errors: 1, warnings: 2 });
    expect(counts[PhaseId.Hazard]).toBeUndefined();
    expect(details[PhaseId.DFD]).toEqual(["E1", "W1", "W2"]);
    expect(details[PhaseId.Hazard]).toBeUndefined();
  });

  it("the DFD status follows the current validation; the other phases keep theirs", () => {
    const { status, counts, details } = phaseIndicators({
      phaseStatus: stored,
      info,
      dfdValidation: { errors: [], warnings: [] },
      dfdStatus: "complete",
      t,
    });
    expect(status[PhaseId.DFD]).toBe("complete");
    expect(status[PhaseId.Hazard]).toBe("complete");
    expect(counts[PhaseId.DFD]).toEqual({ errors: 0, warnings: 0 });
    expect(details[PhaseId.DFD]).toBeUndefined();
  });

  it("no diagram: the stored DFD status stays; General names the missing fields; threats name the drift", () => {
    const { status, counts, details } = phaseIndicators({
      phaseStatus: stored,
      info: { ...info, version: "", responsible: "" },
      dfdValidation: null,
      threatDrift: { obsolete: 2, added: 1 },
      t,
    });
    expect(status[PhaseId.DFD]).toBe("incomplete");
    expect(counts[PhaseId.DFD]).toBeUndefined();
    expect(counts[PhaseId.General]).toEqual({ errors: 0, warnings: 2 });
    expect(details[PhaseId.General]).toEqual(["Missing: Version, Responsible"]);
    expect(counts[PhaseId.Threats]).toEqual({ errors: 0, warnings: 3 });
    expect(details[PhaseId.Threats]).toEqual([
      "2 stored threats would no longer be generated",
      "1 threats would be added",
    ]);
  });

  it("Hazard: the Hazard tab's messages; long lists are capped", () => {
    const errors = Array.from({ length: MAX_DETAILS + 2 }, (_, i) => `Hazard "H${i}" endangers no protection target.`);
    const { counts, details } = phaseIndicators({
      phaseStatus: stored,
      info,
      dfdValidation: null,
      hazardValidation: { errors, warnings: [] },
      t,
    });
    expect(counts[PhaseId.Hazard]).toEqual({ errors: MAX_DETAILS + 2, warnings: 0 });
    expect(details[PhaseId.Hazard]).toHaveLength(MAX_DETAILS + 1);
    expect(details[PhaseId.Hazard].at(-1)).toBe("… 2 more");
  });

  it("ISO/SAE 21434: the TARA verification counts on the General phase — open a warning, failed an error, verified nothing (user 2026-10-30)", () => {
    const base = { phaseStatus: stored, info, dfdValidation: null, t };
    const open = phaseIndicators({ ...base, verification: { kind: "none", text: "Not verified yet — record the verification in the Audit tab." } });
    expect(open.counts[PhaseId.General]).toEqual({ errors: 0, warnings: 1 });
    expect(open.details[PhaseId.General]).toEqual(["Not verified yet — record the verification in the Audit tab."]);
    expect(open.status[PhaseId.General]).toBe("complete"); // the phase status stays the project information's
    expect(phaseIndicators({ ...base, verification: { kind: "failed", text: "did not pass" } }).counts[PhaseId.General]).toEqual({ errors: 1, warnings: 0 });
    const ok = phaseIndicators({ ...base, verification: { kind: "verified", text: "Verified" } });
    expect(ok.counts[PhaseId.General]).toEqual({ errors: 0, warnings: 0 });
    expect(ok.details[PhaseId.General]).toBeUndefined();
  });

  it("Risk: the Risk tab's validation, counted and listed (user 2026-10-30)", () => {
    const { counts, details } = phaseIndicators({
      phaseStatus: stored,
      info,
      dfdValidation: null,
      riskValidation: { errors: [], warnings: ["1 risk(s) to reduce have no mitigation (SHE-T-1)"] },
      t,
    });
    expect(counts[PhaseId.Risk]).toEqual({ errors: 0, warnings: 1 });
    expect(details[PhaseId.Risk]).toEqual(["1 risk(s) to reduce have no mitigation (SHE-T-1)"]);
  });
});
