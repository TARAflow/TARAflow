// src/tests/component/asset-dialog-criteria.test.tsx
//
// Manual test 2026-11-08: the assets of an imported component came without
// impact ratings (the machine rates their impact, multi-project TARA E5)
// and the asset dialog showed no criterion to rate. The dialog now shows a
// row for every configured criterion; missing ones are unrated.
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AssetDialog, withAllCriteria } from "features/assets/components/asset-dialog";
import { DEFAULT_ASSET_CONFIGURATION, type Asset } from "features/assets/models/asset-types";
import { IMPACT_CRITERION_KEY_PREFIX } from "features/assets/models/asset-impact-types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, o?: Record<string, unknown> & { defaultValue?: string }) =>
      (o?.defaultValue ?? key).replace(/\{\{(\w+)\}\}/g, (_m, n: string) => String(o?.[n] ?? "")),
  }),
}));

const criteria = DEFAULT_ASSET_CONFIGURATION.impactCriteria;

describe("withAllCriteria", () => {
  it("one row per configured criterion; own values kept, missing ones unrated, others kept at the end", () => {
    const rows = withAllCriteria([{ criterionId: criteria[1].id, value: 3 }, { criterionId: "gone", value: 2 }], DEFAULT_ASSET_CONFIGURATION);
    expect(rows.map((r) => r.criterionId)).toEqual([...criteria.map((c) => c.id), "gone"]);
    expect(rows[1].value).toBe(3);
    expect(rows[0].value).toBeNull();
    expect(withAllCriteria(undefined, DEFAULT_ASSET_CONFIGURATION)).toHaveLength(criteria.length);
  });
});

describe("AssetDialog with an asset without ratings (imported component)", () => {
  it("shows every configured criterion to rate", () => {
    const asset = {
      id: "cmp1", displayId: "SDC1:DA-001", name: "smoke meas data", assetGroup: "data", properties: {},
      impactRatings: [], importedFrom: "SDC1 · Smoke Detector Case", linkedDFDElements: [],
      securityGoals: ["C", "I", "A", "N", "AuthZ", "AuthN", "Acc"].map((type) => ({ type, level: "none", formalDescription: "" })),
    } as unknown as Asset;
    render(<AssetDialog open asset={asset} configuration={DEFAULT_ASSET_CONFIGURATION} onSave={() => {}} onClose={() => {}} />);
    expect(criteria.length).toBeGreaterThan(0);
    // a rating card per criterion (its name is the i18n key under this mock)
    for (const c of criteria) expect(screen.queryAllByText(`${IMPACT_CRITERION_KEY_PREFIX}.${c.id}.name`).length, c.id).toBeGreaterThan(0);
  });
});
