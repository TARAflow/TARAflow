// tests/unit/app/utils/phase-indicators.test.ts
//
// Review 2026-10-30 (SmokeDetector): the Overview showed the DFD's error
// under Hazard — it indexed its validation info by hand with the pre-v2
// phase number — and DFD "incomplete" from a validation stored in the file.
// The indicators are keyed by PhaseId; the DFD part comes from the current
// validation.

import { describe, it, expect } from "vitest";
import { phaseIndicators } from "app/utils/phase-indicators";
import { PhaseId } from "app/models/phase-types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const info = { name: "Smoke Detector", description: "d", version: "1", responsible: "r", tags: { domain: [], platform: [], regulation: ["ISO 21434"], custom: [] } as Any };
const stored: Any = { [PhaseId.General]: "complete", [PhaseId.Hazard]: "complete", [PhaseId.DFD]: "incomplete" };

describe("phase indicators", () => {
  it("DFD findings count on the DFD phase, never on Hazard", () => {
    const { counts } = phaseIndicators({ phaseStatus: stored, info, dfdValidation: { errors: [{}], warnings: [{}, {}] } });
    expect(counts[PhaseId.DFD]).toEqual({ errors: 1, warnings: 2 });
    expect(counts[PhaseId.Hazard]).toBeUndefined();
  });

  it("the DFD status follows the current validation; the other phases keep theirs", () => {
    const { status, counts } = phaseIndicators({
      phaseStatus: stored,
      info,
      dfdValidation: { errors: [], warnings: [] },
      dfdStatus: "complete",
    });
    expect(status[PhaseId.DFD]).toBe("complete");
    expect(status[PhaseId.Hazard]).toBe("complete");
    expect(counts[PhaseId.DFD]).toEqual({ errors: 0, warnings: 0 });
  });

  it("no diagram: the stored DFD status stays; General counts missing fields; threats count drift", () => {
    const { status, counts } = phaseIndicators({
      phaseStatus: stored,
      info: { ...info, version: "" },
      dfdValidation: null,
      threatDrift: { obsolete: 2, added: 1 },
    });
    expect(status[PhaseId.DFD]).toBe("incomplete");
    expect(counts[PhaseId.DFD]).toBeUndefined();
    expect(counts[PhaseId.General]).toEqual({ errors: 0, warnings: 1 });
    expect(counts[PhaseId.Threats]).toEqual({ errors: 0, warnings: 3 });
  });
});
