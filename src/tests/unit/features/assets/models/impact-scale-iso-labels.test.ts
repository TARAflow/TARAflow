// tests/unit/features/assets/models/impact-scale-iso-labels.test.ts
//
// ISO/SAE 21434 conformance plan 0b2: under iso-21434 the 4-level impact
// scale carries the RQ-15-05 names negligible / moderate / major / severe —
// display only (values and colours unchanged); other scales and other
// presets keep their labels.

import { describe, it, expect } from "vitest";

import {
  IMPACT_SCALES,
  impactScaleFor,
  type ImpactScaleType,
} from "features/assets/models/asset-impact-types";
import { transformProjectToDocData } from "app/services/doc-transform";
import type { Project } from "app/models/project-types";
import en from "../../../../../i18n/locales/en/assets.json";
import de from "../../../../../i18n/locales/de/assets.json";

describe("impactScaleFor", () => {
  it("default vocabulary returns the scale unchanged", () => {
    for (const s of ["3-level", "4-level", "5-level"] as ImpactScaleType[])
      expect(impactScaleFor(s)).toBe(IMPACT_SCALES[s]);
  });

  it("ISO names on the 4-level scale; values and colours unchanged", () => {
    const iso = impactScaleFor("4-level", "iso-21434");
    const base = IMPACT_SCALES["4-level"];
    expect(iso.levels.map((l) => l.value)).toEqual(base.levels.map((l) => l.value));
    expect(iso.levels.map((l) => l.color)).toEqual(base.levels.map((l) => l.color));
    expect(iso.levels.map((l) => l.labelKey)).toEqual([1, 2, 3, 4].map(
      (v) => `tabs.assets.impactScaleIso.${v}.label`,
    ));
    expect(impactScaleFor("4-level", "iso-21434")).toBe(iso); // stable for memo deps
  });

  it("an ISO project on another scale keeps that scale's labels", () => {
    expect(impactScaleFor("3-level", "iso-21434")).toBe(IMPACT_SCALES["3-level"]);
    expect(impactScaleFor("5-level", "iso-21434")).toBe(IMPACT_SCALES["5-level"]);
  });

  it("en / de labels", () => {
    type Locale = { tabs: { assets: { impactScaleIso: Record<string, { label: string }> } } };
    const label = (d: Locale, v: string) => d.tabs.assets.impactScaleIso[v].label;
    expect(["1", "2", "3", "4"].map((v) => label(en, v))).toEqual([
      "Negligible",
      "Moderate",
      "Major",
      "Severe",
    ]);
    expect(["1", "2", "3", "4"].map((v) => label(de, v))).toEqual([
      "Vernachlässigbar",
      "Moderat",
      "Erheblich",
      "Schwerwiegend",
    ]);
  });
});

describe("report impact labels", () => {
  const project = (regulation: string[], scale: ImpactScaleType): Project =>
    ({
      id: "p",
      info: {
        name: "P",
        lastModified: "",
        tags: { domain: [], platform: [], regulation, custom: [] },
      },
      assets: {
        configuration: { impactScale: scale },
        assets: [
          { id: "A", overallImpact: 4 },
          { id: "B", overallImpact: 2 },
        ],
      },
      risks: null,
    }) as unknown as Project;

  const labels = (p: Project, lang: "en" | "de") => {
    const m = transformProjectToDocData(p, lang).computed.impactLabels;
    return [m.get("A"), m.get("B")];
  };

  it("ISO project on 4-level: ISO names", () => {
    expect(labels(project(["ISO 21434"], "4-level"), "en")).toEqual(["Severe", "Moderate"]);
    expect(labels(project(["ISO 21434"], "4-level"), "de")).toEqual(["Schwerwiegend", "Moderat"]);
  });

  it("other presets, or ISO on another scale: unchanged", () => {
    expect(labels(project([], "4-level"), "en")).toEqual(["Critical", "Medium"]);
    expect(labels(project(["ISO 21434"], "5-level"), "en")).toEqual(["Very High", "Medium"]);
  });
});
