// src/tests/unit/features/risks/services/risk-findings.test.ts
//
// FX-4: the Risk-tab validation as codes with parameters — the toolbar and
// the phase indicators show it in the UI language; the file keeps exactly
// the English sentences it held before (schema 13 unchanged).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import i18next from "i18next";
import { describe, expect, it } from "vitest";
import { riskService } from "features/risks/services/risk-service";
import {
  RISK_FINDING_TEXT,
  riskFindingLines,
  riskFindings,
  type RiskFindingCode,
} from "features/risks/services/risk-findings";
import { DEFAULT_CONFIGURATION } from "features/risks/models/risk-config-types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
const risk = (id: string, extra: Any = {}): Any => ({
  id,
  threatDisplayId: id,
  treatment: "reduce",
  treatmentJustification: "because",
  moscowPriority: "must",
  wontJustification: "",
  calculatedRiskBeforeMitigation: 8,
  calculatedRiskAfterMitigation: 4,
  selectedMitigations: [{ id: "M-1", status: "open" }],
  ...extra,
});

// Every finding at least once; seven unmitigated risks for the "…" list.
const DATA: Any = {
  configuration: DEFAULT_CONFIGURATION,
  risks: [
    risk("U-1", { calculatedRiskBeforeMitigation: 0, calculatedRiskAfterMitigation: 0 }),
    risk("W-1", { moscowPriority: "wont" }),
    risk("A-1", { treatment: "accept", treatmentJustification: " " }),
    ...[1, 2, 3, 4, 5, 6, 7].map((n) => risk(`R-${n}`, { selectedMitigations: [] })),
    risk("RES-1", { calculatedRiskAfterMitigation: 0 }),
    risk("UNC-1", { threatRelevance: "uncertain" }),
  ],
};

const locale = (lang: string) =>
  JSON.parse(readFileSync(join(__dirname, `../../../../../i18n/locales/${lang}/risks.json`), "utf8"));

describe("risk findings (FX-4)", () => {
  it("the stored sentences are word for word those of before", () => {
    const v = riskService.validate(DATA);
    expect(v.errors).toEqual([
      '1 "Won\'t" risk(s) missing justification',
      "1 risk(s) with accept/transfer/share treatment require a justification",
    ]);
    expect(v.warnings).toEqual([
      "1 risk(s) have not been rated",
      "7 risk(s) to reduce have no mitigation (R-1, R-2, R-3, R-4, R-5, …)",
      "1 risk(s) to reduce have no residual risk rating (RES-1)",
      "1 risk(s) based on uncertain threats — confirm relevance in Threat Eval",
    ]);
    expect(v.isComplete).toBe(false);
  });

  it("ISO/SAE 21434: transfer to review; no residual finding", () => {
    const iso = riskService.validate({
      configuration: { ...DEFAULT_CONFIGURATION, likelihoodMethod: "iso-21434" },
      risks: [risk("T-1", { treatment: "transfer" }), risk("RES-2", { calculatedRiskAfterMitigation: 0 })],
    } as Any);
    expect(iso.warnings).toContain(
      '1 risk(s) with treatment "transfer" — ISO/SAE 21434 offers no transfer option; confirm as share',
    );
    expect(iso.warnings.join(" ")).not.toContain("residual");
  });

  it("findings carry code, severity, count and the named ids", () => {
    const unmitigated = riskFindings(DATA).find((f) => f.code === "reduceUnmitigated")!;
    expect(unmitigated.severity).toBe("warning");
    expect(unmitigated.count).toBe(7);
    expect(unmitigated.ids).toHaveLength(7);
  });

  it("with a tracker: a mitigation done by hand needs a ticket or evidence (user 2026-11-10)", () => {
    const data: Any = {
      configuration: DEFAULT_CONFIGURATION,
      risks: [
        risk("D-1", { selectedMitigations: [{ id: "M-1", status: "implemented" }] }),
        risk("D-2", { selectedMitigations: [{ id: "M-1", status: "verified", ticketId: "SCRUM-1" }] }),
        risk("D-3", { selectedMitigations: [{ id: "M-1", status: "implemented", evidenceNote: "Test report TR-7" }] }),
        risk("D-4", { selectedMitigations: [{ id: "M-1", status: "in_review", evidenceRef: "PR 42" }] }),
        risk("D-5", { selectedMitigations: [{ id: "M-1", status: "in_progress" }, { id: "M-2", status: "in_review", evidenceNote: " " }] }),
      ],
    };
    // offline (no tracker): nothing required, as before
    expect(riskFindings(data).find((f) => f.code === "doneWithoutEvidence")).toBeUndefined();
    const f = riskFindings(data, { trackerConnected: true }).find((x) => x.code === "doneWithoutEvidence")!;
    expect(f).toMatchObject({ severity: "warning", count: 2, ids: ["D-1", "D-5"] });
    // the stored validation (file form) does not depend on the tracker
    expect(riskService.validate(data).warnings.join(" ")).not.toContain("without ticket");
  });

  it("every code has a singular and a plural text in English and German", () => {
    for (const lang of ["en", "de"]) {
      const texts = locale(lang).tabs.risks.findings;
      for (const code of Object.keys(RISK_FINDING_TEXT) as RiskFindingCode[]) {
        expect(texts[`${code}_one`], `${lang} ${code}_one`).toBeTruthy();
        expect(texts[`${code}_other`], `${lang} ${code}_other`).toBeTruthy();
      }
    }
  });

  it("in the German UI the lines are German, with plurals and the id list", async () => {
    const i18n = i18next.createInstance();
    await i18n.init({
      lng: "de",
      fallbackLng: "en",
      interpolation: { escapeValue: false },
      resources: { de: { translation: locale("de") }, en: { translation: locale("en") } },
    });
    const lines = riskFindingLines(riskFindings(DATA), i18n.t.bind(i18n) as Any);
    expect(lines.errors).toEqual([
      "1 „Won't“-Risiko ohne Begründung",
      "1 Risiko mit Behandlung Akzeptieren/Transferieren/Teilen braucht eine Begründung",
    ]);
    expect(lines.warnings).toContain("7 zu reduzierende Risiken haben keine Massnahme (R-1, R-2, R-3, R-4, R-5, …)");
    expect(lines.warnings).toContain("1 Risiko ist nicht bewertet");
  });
});
