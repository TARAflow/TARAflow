// src/tests/unit/features/risks/services/risk-sync-service.mitigation-compare.test.ts
//
// The project file is written with sorted keys; the threat references the app
// builds list a mitigation as { id, text, notes, isCustom }. Compared with
// JSON.stringify, every risk counted as "mitigations changed" after the
// project was opened again (and after a change of the UI language, which
// changes the text). Only id, note and the custom marker count.

import { describe, it, expect } from "vitest";
import { checkRiskSyncStatus, sameDrafts } from "features/risks/services/risk-sync-service";
import { createDefaultRiskData, createEmptyRisk } from "features/risks/models/risk-assessment-types";
import type { ThreatReference } from "shared";

const threat = (proposedMitigations: ThreatReference["proposedMitigations"]): ThreatReference => ({
  id: "t-1",
  displayId: "P1-T-1",
  strideCategory: "T",
  threatDescription: "Tampering",
  attackDescription: "",
  sourceStrideMethod: "per-element",
  relevance: "relevant",
  proposedMitigations,
  proposedVerifications: [],
  trustBoundaryId: null,
  trustBoundaryName: null,
  linkedAssetIds: [],
});

describe("sameDrafts", () => {
  it("ignores key order and the display text", () => {
    expect(
      sameDrafts(
        [{ id: "M-T-001", text: "Implement integrity controls", isCustom: false }],
        [JSON.parse('{"id":"M-T-001","isCustom":false,"text":"Integritätskontrollen umsetzen"}')],
      ),
    ).toBe(true);
  });

  it("sees another mitigation, another note, another order and a custom entry", () => {
    const a = [{ id: "M-T-001" }, { id: "M-T-002" }];
    expect(sameDrafts(a, [{ id: "M-T-001" }])).toBe(false);
    expect(sameDrafts(a, [{ id: "M-T-002" }, { id: "M-T-001" }])).toBe(false);
    expect(sameDrafts([{ id: "M-T-001", notes: "x" }], [{ id: "M-T-001" }])).toBe(false);
    expect(sameDrafts([{ notes: "own measure" }], [{ notes: "own measure", isCustom: true, text: "" }])).toBe(true);
  });
});

describe("checkRiskSyncStatus after reopening the project", () => {
  it("does not report the mitigations of a risk as changed when only key order and text differ", () => {
    const fresh = threat([{ id: "M-T-001", text: "Implement integrity controls", isCustom: false }]);
    const data = createDefaultRiskData();
    const risk = createEmptyRisk(fresh, data.configuration);
    // As read back from the file: sorted keys, text in another language.
    const reopened = {
      ...data,
      risks: [{ ...risk, proposedMitigations: [JSON.parse('{"id":"M-T-001","isCustom":false,"text":"Integrität"}')] }],
    };
    expect(checkRiskSyncStatus(reopened, [fresh]).changedMitigations).toBe(0);
  });
});
