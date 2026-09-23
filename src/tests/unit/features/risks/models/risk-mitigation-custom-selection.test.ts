// src/tests/unit/features/risks/models/risk-mitigation-custom-selection.test.ts
//
// Custom (non-catalog) mitigations are selected WITHOUT an id — only catalog
// entries carry one. The Risk dialog used to store the custom free text as
// `id`, so consumers treated the sentence as a catalog/i18n key (i18next
// "missingKey mitigations <sentence>.mitigation"). Seen in the Nussbaum
// DataTrack project (R-DS6-I-1).

import { describe, it, expect } from "vitest";
import {
  mitigationSelectionKey,
  toSelectedMitigation,
  repairCustomMitigationSelections,
} from "features/risks/models/risk-mitigation-types";
import { migrateRiskData } from "features/risks/models/risk-assessment-types";

const CUSTOM =
  "Store cached customer data exclusively within the application's private sandbox.";

describe("mitigation selection helpers", () => {
  it("keys catalog and custom entries so they can never collide", () => {
    expect(mitigationSelectionKey({ id: "M-I-003" })).toBe("M-I-003");
    expect(mitigationSelectionKey({ notes: CUSTOM })).toBe(`custom:${CUSTOM}`);
    // a custom text that happens to look like an id is still custom
    expect(mitigationSelectionKey({ notes: "M-I-003" })).toBe("custom:M-I-003");
  });

  it("selects a custom entry without an id", () => {
    expect(toSelectedMitigation({ notes: CUSTOM })).toEqual({
      notes: CUSTOM,
      status: "open",
    });
    expect(toSelectedMitigation({ id: "M-I-003", notes: "annotation" })).toEqual({
      id: "M-I-003",
      status: "open",
    });
  });
});

describe("repairCustomMitigationSelections", () => {
  const proposed = [{ id: "M-I-003" }, { notes: CUSTOM, isCustom: true }];

  it("moves custom text out of id into notes, keeping status and evidence", () => {
    const selected = [
      { id: "M-I-003", status: "open" as const },
      { id: CUSTOM, status: "implemented" as const, evidenceRef: "PR-12" },
    ];

    const out = repairCustomMitigationSelections(selected, proposed)!;

    expect(out[0]).toBe(selected[0]); // catalog entry untouched
    expect(out[1]).toEqual({
      notes: CUSTOM,
      status: "implemented",
      evidenceRef: "PR-12",
    });
  });

  it("repairs legacy string entries holding custom text", () => {
    const out = repairCustomMitigationSelections([CUSTOM], proposed)!;
    expect(out[0]).toEqual({ notes: CUSTOM, status: "open" });
  });

  it("never touches an id that is not the text of a custom draft of this risk", () => {
    const selected = [{ id: "M-X-999", status: "open" as const }];
    expect(repairCustomMitigationSelections(selected, proposed)).toBe(selected);
  });

  it("returns the same array when clean (idempotent)", () => {
    const selected = [{ notes: CUSTOM, status: "open" as const }];
    expect(repairCustomMitigationSelections(selected, proposed)).toBe(selected);
  });
});

describe("migrateRiskData repairs custom selections on load", () => {
  it("fixes a risk written by the old dialog", () => {
    const data: any = {
      configuration: { activeFactors: [] },
      risks: [
        {
          id: "R-x",
          threatId: "t",
          proposedMitigations: [{ notes: CUSTOM, isCustom: true }],
          selectedMitigations: [{ id: CUSTOM, status: "open" }],
          factorRatings: [],
          mitigatedFactorRatings: [],
        },
      ],
    };

    const out = migrateRiskData(data)!;

    expect(out.risks[0].selectedMitigations).toEqual([
      { notes: CUSTOM, status: "open" },
    ]);
  });
});
