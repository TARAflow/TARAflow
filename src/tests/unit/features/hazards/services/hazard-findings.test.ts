// src/tests/unit/features/hazards/services/hazard-findings.test.ts
//
// FX-1: the hazard validation as coded findings — the panel, the toolbar
// and the phase indicators translate them; errors / warnings keep the
// English sentences word for word (the test passes against the old
// validator too).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import i18next from "i18next";
import { describe, expect, it } from "vitest";
import {
  HAZARD_FINDING_TEXT,
  hazardFindingLines,
  hazardValidator,
  type HazardFindingCode,
} from "features/hazards";
import type { HazardData } from "features/hazards";
import type { AssetReference } from "shared";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

// Every rule fires once: H1 is bare; H2 has edges with every edge error.
const DATA: HazardData = {
  hazards: [
    { id: "H1", label: "Fire not detected", combinationType: "ALL", source: "manual" },
    {
      id: "H2",
      label: "Tank rupture",
      combinationType: "ANY",
      source: "manual",
      hazardType: "mechanical",
      description: "d",
      rationale: "r",
    },
  ],
  relations: [
    { type: "contributes_to", from: "HUM-1", to: "H2", relevance: "direct", hazardDistance: -1 },
    { type: "endangers", from: "H2", to: "SYS-1", impact: { target: "human", severity: "fatal" } },
    { type: "contributes_to", from: "SYS-1", to: "GONE-1", relevance: "direct", hazardDistance: 1 },
    { type: "endangers", from: "GONE-2", to: "HUM-1", impact: { target: "human", severity: "fatal" } },
  ],
  configuration: { defaultCombinationType: "ANY", maxHops: 1, requireHazardType: false },
  lastModified: "",
} as Any;

const ASSETS: AssetReference[] = [
  { id: "SYS-1", name: "PLC", assetGroup: "system", hasSafetyAnnotation: false },
  { id: "HUM-1", name: "Operator", assetGroup: "human", hasSafetyAnnotation: false },
];

const locale = (lang: string) =>
  JSON.parse(readFileSync(join(__dirname, `../../../../../i18n/locales/${lang}/hazards.json`), "utf8"));

describe("hazard findings (FX-1)", () => {
  it("errors and warnings: the English sentences of before, word for word", () => {
    const v = hazardValidator.validate(DATA, ASSETS);
    expect(v.errors).toEqual([
      'Dangling contributes_to edge -> unknown hazard "GONE-1".',
      'Dangling endangers edge from unknown hazard "GONE-2".',
      'Hazard "Fire not detected" has no contributes_to input.',
      'Hazard "Fire not detected" endangers no protection target.',
      "contributes_to: hazardDistance must be >= 0 (got -1)",
      'contributes_to: asset group "human" is not an allowed hazard source',
      'endangers: asset group "system" is not a valid protection target',
    ]);
    expect(v.warnings).toEqual([
      'Hazard "Fire not detected" has no ISO 12100 hazard type.',
      'Hazard "Fire not detected" has no description.',
      'Hazard "Fire not detected" has no rationale.',
      'Hazard "Fire not detected" uses combinationType "ALL" with a single input — combinatorics has no effect here.',
    ]);
  });

  it("findings carry code, severity and the hazard to open", () => {
    const { findings } = hazardValidator.validate(DATA, ASSETS) as Any;
    expect(findings.find((f: Any) => f.code === "negativeDistance")).toMatchObject({
      severity: "error",
      hazardId: "H2",
      params: { hazard: "Tank rupture", distance: -1 },
    });
    expect(findings.find((f: Any) => f.code === "danglingEndangers").hazardId).toBeUndefined();
  });

  it("target mismatch names target and group", () => {
    const d = {
      ...DATA,
      relations: [{ type: "endangers", from: "H2", to: "HUM-1", impact: { target: "environment", severity: "high" } }],
    } as Any;
    expect(hazardValidator.validate(d, ASSETS).errors).toContain(
      'endangers: impact.target "environment" does not match target asset group "human"',
    );
  });

  it("every code has an English and a German text", () => {
    for (const lang of ["en", "de"]) {
      const texts = locale(lang).tabs.hazards.findings;
      for (const code of Object.keys(HAZARD_FINDING_TEXT) as HazardFindingCode[]) {
        expect(texts[code], `${lang} ${code}`).toBeTruthy();
      }
    }
  });

  it("in the German UI the lines are German", async () => {
    const i18n = i18next.createInstance();
    await i18n.init({
      lng: "de",
      fallbackLng: "en",
      interpolation: { escapeValue: false },
      resources: { de: { translation: locale("de") }, en: { translation: locale("en") } },
    });
    const { findings } = hazardValidator.validate(DATA, ASSETS) as Any;
    const lines = hazardFindingLines(findings, i18n.t.bind(i18n) as Any);
    expect(lines.errors).toContain("Gefährdung „Fire not detected“ gefährdet kein Schutzziel.");
    expect(lines.errors).toContain("Gefährdung „Tank rupture“: eine Ursache hat eine negative Gefährdungsdistanz (-1).");
    expect(lines.warnings).toContain("Gefährdung „Fire not detected“ hat keinen ISO-12100-Gefährdungstyp.");
  });
});
