// src/tests/component/asset-rollup-view.test.tsx
//
// Leveled DFD Phase 6d (leveled-dfd-multi-diagram-design.md §9): the "Asset"
// tab of a decomposed multiprocess shows the read-only roll-up of its parts
// with the holders, and the relations from before the decomposition as
// "not yet assigned to a part" (removable).
import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ElementFormShell } from "features/dfd/components/forms/element-form-shell";
import {
  AssetRollupContext,
  type AssetRollupContextValue,
} from "features/dfd/components/forms/asset-rollup-view";
import type { AssetRelation } from "features/dfd/models/asset-relation-types";
import type { DFDElement } from "features/dfd/models/dfd-types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, o?: Record<string, unknown> & { defaultValue?: string }) =>
      (o?.defaultValue ?? key).replace(/\{\{(\w+)\}\}/g, (_, name) => String(o?.[name] ?? "")),
    i18n: { language: "en" },
  }),
}));

afterEach(cleanup);

const rel = (assetId: string, relationType = "stores") =>
  ({ assetId, relationType, assetGroup: "data" }) as unknown as AssetRelation;

const MP = {
  id: "mp1",
  type: "Multiprocess",
  name: "Sensor Head",
  displayId: "MP-1",
  assetRelations: [rel("fw")],
} as unknown as DFDElement;

const ASSETS = [
  { id: "calib", displayId: "DA-002", name: "Calibration parameters", assetGroup: "data" as const },
  { id: "fw", displayId: "DA-005", name: "Sensor firmware", assetGroup: "data" as const },
];

const ROLLUP: AssetRollupContextValue = {
  elementId: "mp1",
  assets: {
    rollup: [{ assetId: "calib", relationType: "stores", relation: rel("calib"), via: ["ds1", "p2"] }],
    pending: [rel("fw")],
  },
  partLabel: (tfId) => ({ ds1: "DS-1.1", p2: "P-1.1" })[tfId] ?? tfId,
};

const renderShell = (value: AssetRollupContextValue | null, onChange = vi.fn()) =>
  render(
    <AssetRollupContext.Provider value={value}>
      <ElementFormShell
        element={MP}
        onChange={onChange}
        availableAssets={ASSETS}
        generalTab={<div />}
        activeTab={1}
      />
    </AssetRollupContext.Provider>,
  );

describe("Asset tab of a decomposed multiprocess", () => {
  it("shows the roll-up with its holders instead of the relation selector", () => {
    renderShell(ROLLUP);
    const view = screen.getByTestId("asset-rollup-view");
    const row = within(view).getByTestId("asset-rollup-calib-stores");
    expect(row.textContent).toContain("DA-002 Calibration parameters");
    expect(row.textContent).toContain("via DS-1.1, P-1.1");
  });

  it("lists relations from before the decomposition as not yet assigned; removing one updates the record", () => {
    const onChange = vi.fn();
    renderShell(ROLLUP, onChange);
    const pending = screen.getByTestId("asset-rollup-pending");
    expect(pending.textContent).toContain("DA-005 Sensor firmware");
    fireEvent.click(within(pending).getByLabelText("remove-pending"));
    expect(onChange).toHaveBeenCalledWith({ assetRelations: [] });
  });

  it("keeps the relation selector for any other element", () => {
    renderShell(null);
    expect(screen.queryByTestId("asset-rollup-view")).toBeNull();
  });
});
