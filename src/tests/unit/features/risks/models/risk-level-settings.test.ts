// src/tests/unit/features/risks/models/risk-level-settings.test.ts
//
// MT-3: a risk value has one level everywhere — risk tab chips, tooltips,
// dialog, score panel, matrix cells and report — and the project's own
// severity thresholds count everywhere. The helpers take the risk
// configuration, never the scale alone.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import {
  generateRiskMatrix,
  getRiskColor,
  getRiskLabel,
  riskSeverityLevel,
} from "features/risks/models/risk-scale-types";

// 4-level defaults: Low ≤ 3, Medium ≤ 6, High ≤ 11, Critical ≤ 16.
const DEFAULT = { scale: "4-level" as const };
const SHIFTED = { scale: "4-level" as const, severityThresholds: { 1: 1, 2: 2, 3: 3 } };

describe("risk level helpers (MT-3)", () => {
  it("label and color follow the project's thresholds", () => {
    expect(getRiskLabel(4, DEFAULT)).toBe("Medium");
    expect(getRiskLabel(4, SHIFTED)).toBe("Critical");
    expect(getRiskColor(4, SHIFTED)).toBe(riskSeverityLevel(4, "4-level", SHIFTED.severityThresholds).color);
    expect(getRiskColor(4, SHIFTED)).not.toBe(getRiskColor(4, DEFAULT));
  });

  it("unrated stays neutral", () => {
    expect(getRiskLabel(0, SHIFTED)).toBe("-");
    expect(getRiskColor(0, SHIFTED)).toBe("#6b7280");
  });

  it.each(["3-level", "4-level", "5-level"] as const)(
    "%s matrix: every cell has the level of its risk value I × L",
    (scale) => {
      for (const settings of [{ scale }, { scale, severityThresholds: { 1: 1, 2: 2 } }]) {
        for (const cell of generateRiskMatrix(settings).flat()) {
          const value = cell.impact * cell.likelihood;
          expect(cell.label).toBe(getRiskLabel(value, settings));
          expect(cell.color).toBe(getRiskColor(value, settings));
        }
      }
    },
  );

  it("matrix cell I=2, L=2 on the 4-level scale reads Medium like its risk chip", () => {
    const cell = generateRiskMatrix(DEFAULT).flat().find((c) => c.impact === 2 && c.likelihood === 2)!;
    expect(cell.label).toBe("Medium");
  });
});

// ── Guard: no caller passes the scale alone ─────────────────────────────────

const SRC = join(__dirname, "../../../../..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "tests" ? [] : sourceFiles(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("guard: risk levels always see the configuration (MT-3)", () => {
  it("no call hands getRiskColor / getRiskLabel / generateRiskMatrix the scale alone", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(SRC)) {
      const text = readFileSync(file, "utf8");
      const calls = text.matchAll(/(getRiskColor|getRiskLabel|generateRiskMatrix)\(([^;]*?)\)/gs);
      for (const [call, , args] of calls) {
        if (/\.scale\b\s*(,|$)|\{\s*scale\b/.test(args)) offenders.push(`${relative(SRC, file)}: ${call}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
