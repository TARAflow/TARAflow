// @vitest-environment node
//
// Review 2026-10-30 (Smoke Detector): the report read a risk value
// R = I × L (up to 16 on the 4-level scale) as if it were a level 1–4 —
// "Critical risks: 188" of 199, every risk from 4.0 up labelled Critical in
// the app's report, the bare value in the CLI's. Levels now follow the risk
// scale's thresholds, the same rule as the risk tab, and both show
// "5.3 – Medium".

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { createCliGenerator } from "../../../src/features/documentation/utils/generators/cli-generators";
import { PdfMakeConverter } from "../../../src/features/documentation/utils/generators/pdfmake-converter";
import { toDocProjectData } from "../../cli/to-doc-project-data";
import { parseAndRepair } from "../../../src/app/services/migration-service";
import { isCriticalRiskScore, riskScoreFill, riskScoreText } from "../../../src/features/documentation/utils/risk-score-text";
import { getRiskLabel } from "../../../src/features/risks/services/risk-calculation-service";
import { DEFAULT_DOC_CONFIGURATION } from "../../../src/features/documentation/models/doc-types";
import type { Project } from "../../../src/app/models/project-types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const stubT = (key: string, defaultValue?: string): string => defaultValue ?? key;

describe("risk score text", () => {
  const cfg = { scale: "4-level" as const };
  it("levels by the thresholds — the risk tab's label", () => {
    expect(riskScoreText(5.3, cfg, "en")).toBe("5.3 – Medium");
    expect(riskScoreText(6.4, cfg, "de")).toBe("6.4 – Hoch");
    expect(riskScoreText(0, cfg, "en")).toBe("-");
    for (const v of [1, 3, 3.1, 6, 6.1, 11, 11.1, 16]) {
      expect(riskScoreText(v, cfg, "en").split(" – ")[1]).toBe(getRiskLabel(v, "4-level"));
    }
    expect(isCriticalRiskScore(11, cfg)).toBe(false);
    expect(isCriticalRiskScore(11.2, cfg)).toBe(true);
    expect(riskScoreFill(5.3, cfg)).toBe("#fef08a");
    expect(riskScoreText(5.3, { scale: "4-level", severityThresholds: { 1: 3, 2: 5, 3: 8, 4: 16 } }, "en")).toBe("5.3 – High");
  });
});

describe("report of a project with R = I × L (Simple Test Project: 6.6 and 4.x)", () => {
  const project = parseAndRepair(
    JSON.parse(readFileSync(path.join(__dirname, "../../../src/tests/fixtures/Simple_Test_Project.tara.json"), "utf-8")),
  ) as Project;
  const doc = toDocProjectData(project, "en");
  const risks = project.risks!.risks.filter((r) => r.moscowPriority !== "wont");
  const critical = risks.filter((r) => r.calculatedRiskBeforeMitigation > 11).length;

  it("counts as critical what the risk tab calls Critical; risk tables show value and level", () => {
    const md = createCliGenerator(doc, { ...DEFAULT_DOC_CONFIGURATION, format: "markdown" }, stubT).generate().content;
    expect(md).toContain(`| **Critical Risks** | ${critical} |`);
    // the old rule (>= 3.5) counted the rated risks as critical
    expect(critical).toBe(0);
    expect(risks.filter((r) => r.calculatedRiskBeforeMitigation >= 3.5).length).toBeGreaterThan(0);
    const r = risks.find((x) => x.calculatedRiskBeforeMitigation > 0)!;
    expect(md).toContain(riskScoreText(r.calculatedRiskBeforeMitigation, project.risks!.configuration, "en"));
  });

  it("the PDF shows the same text", () => {
    const def = new PdfMakeConverter(doc, { ...DEFAULT_DOC_CONFIGURATION, format: "pdf" }, stubT).createDocumentDefinition({});
    const r = risks.find((x) => x.calculatedRiskBeforeMitigation > 0)!;
    expect(JSON.stringify(def)).toContain(riskScoreText(r.calculatedRiskBeforeMitigation, project.risks!.configuration, "en"));
  });
});
