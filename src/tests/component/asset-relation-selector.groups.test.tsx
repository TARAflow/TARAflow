// src/tests/component/asset-relation-selector.groups.test.tsx
//
// B15: the relation dialog stores the ASSET's group (service "uses" and
// physical "accesses" were stored as system / infrastructure) and offers the
// qualifiers of that group. A qualifier from another group counts as missing.

import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AssetRelationSelector, {
  qualifierOptionsFor,
  type AvailableAsset,
} from "features/dfd/components/forms/asset-relation-selector";
import type { AssetRelation } from "features/dfd/models/asset-relation-types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      ((o?.defaultValue as string | undefined) ?? k).replace(/\{\{(\w+)\}\}/g, (_, n) => String(o?.[n] ?? "")),
    i18n: { language: "en", exists: () => false },
  }),
}));

afterEach(cleanup);

const assets: AvailableAsset[] = [
  { id: "sv", displayId: "SV-001", name: "Cloud API", assetGroup: "service" },
  { id: "ph", displayId: "PH-001", name: "Door", assetGroup: "physical" },
];

function renderSelector(relations: AssetRelation[] = []) {
  const onChange = vi.fn();
  render(
    <AssetRelationSelector assetRelations={relations} elementType="Process" availableAssets={assets} onChange={onChange} />,
  );
  return onChange;
}

const pickQualifier = (dialog: HTMLElement, value: string) => {
  fireEvent.mouseDown(within(dialog).getByRole("combobox"));
  fireEvent.click(within(screen.getByRole("listbox")).getByText(value));
};

describe("AssetRelationSelector — group and qualifier from the asset (B15)", () => {
  it("qualifier choices follow the group", () => {
    expect(qualifierOptionsFor("uses", "service").map((o) => o.value)).toEqual(["api", "sdk", "webhook", "managed"]);
    expect(qualifierOptionsFor("uses", "system").map((o) => o.value)).toContain("network");
    expect(qualifierOptionsFor("accesses", "physical").map((o) => o.value)).toEqual(["direct", "indirect", "remote"]);
    expect(qualifierOptionsFor("accesses", "infrastructure").map((o) => o.value)).toContain("on-site");
  });

  it("a service 'uses' is stored with group service and a service qualifier", () => {
    const onChange = renderSelector();
    fireEvent.click(screen.getByLabelText("Add asset relation"));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("tab", { name: /Service Asset/ }));
    fireEvent.click(within(dialog).getByText("Cloud API"));
    fireEvent.click(within(dialog).getByText("uses"));
    pickQualifier(dialog, "sdk");
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ assetId: "sv", assetGroup: "service", relationType: "uses", qualifier: "sdk" }),
    ]);
  });

  it("a physical 'accesses' stored as infrastructure is saved with group physical", () => {
    const onChange = renderSelector([
      { assetId: "ph", assetGroup: "infrastructure", relationType: "accesses", qualifier: "direct" } as unknown as AssetRelation,
    ]);
    fireEvent.click(screen.getByText("[PH-001] Door"));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ assetId: "ph", assetGroup: "physical", relationType: "accesses", qualifier: "direct" }),
    ]);
  });

  it("a qualifier from the wrong group counts as missing until a valid one is chosen", () => {
    const onChange = renderSelector([
      { assetId: "sv", assetGroup: "system", relationType: "uses", qualifier: "network" } as unknown as AssetRelation,
    ]);
    fireEvent.click(screen.getByText("[SV-001] Cloud API"));
    const dialog = screen.getByRole("dialog");
    const save = within(dialog).getByRole("button", { name: "Save" });
    expect(save).toBeDisabled();
    fireEvent.click(within(dialog).getAllByText("uses").at(-1)!); // expand the card
    pickQualifier(dialog, "api");
    expect(save).toBeEnabled();
    fireEvent.click(save);
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ assetGroup: "service", qualifier: "api" }),
    ]);
  });
});
