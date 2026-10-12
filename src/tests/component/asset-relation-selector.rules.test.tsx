// src/tests/component/asset-relation-selector.rules.test.tsx
//
// B15: the side panel's element → asset relation dialog follows the element
// rules (getAllowedRelations) — the same rules the validator checks. It no
// longer offers types by asset group alone, and a stored relation the rules
// do not allow is marked and must be removed before saving.

import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AssetRelationSelector, {
  groupsAllowedFor,
  relationTypesFor,
  type AvailableAsset,
} from "features/dfd/components/forms/asset-relation-selector";
import { getAllowedRelations } from "features/dfd/models/asset-constants";
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
  { id: "d1", displayId: "DA-001", name: "Measure Data", assetGroup: "data" },
  { id: "f1", displayId: "FU-001", name: "E-Stop", assetGroup: "function" },
  { id: "i1", displayId: "IN-001", name: "Cabinet", assetGroup: "infrastructure" },
];

function renderSelector(elementType: string, relations: AssetRelation[] = []) {
  const onChange = vi.fn();
  render(
    <AssetRelationSelector
      assetRelations={relations}
      elementType={elementType}
      availableAssets={assets}
      onChange={onChange}
    />,
  );
  return onChange;
}

const openAdd = () => fireEvent.click(screen.getByLabelText("Add asset relation"));
const typeChips = (dialog: HTMLElement) =>
  ["is_an", "creates", "reads", "modifies", "deletes", "stores", "transports", "invokes", "executes", "implements"].filter(
    (type) => within(dialog).queryByText(type) !== null,
  );

describe("AssetRelationSelector — element rules (B15)", () => {
  it("helpers follow getAllowedRelations; without element type the old group list", () => {
    expect(relationTypesFor("Process", "data")).toEqual(getAllowedRelations("Process", "data"));
    expect(relationTypesFor(undefined, "data")).toContain("transports");
    expect(groupsAllowedFor("TrustBoundary")).toEqual([]);
    expect(groupsAllowedFor("ChipBoundary")).not.toContain("infrastructure");
  });

  it("Process → data: only the allowed types (no stores, no transports)", () => {
    renderSelector("Process");
    openAdd();
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByText("Measure Data"));
    expect(typeChips(dialog)).toEqual(["is_an", "creates", "reads", "modifies", "deletes"]);
  });

  it("DataFlow → function: invokes is offered (before only transports/is_an)", () => {
    renderSelector("DataFlow");
    openAdd();
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("tab", { name: /Function Asset/ }));
    fireEvent.click(within(dialog).getByText("E-Stop"));
    expect(typeChips(dialog)).toEqual(["invokes"]);
  });

  it("add mode offers only groups the element may relate to", () => {
    renderSelector("ChipBoundary"); // data and function yes, infrastructure no
    openAdd();
    const tabs = within(screen.getByRole("dialog")).getAllByRole("tab").map((t) => t.textContent);
    expect(tabs.some((t) => t?.startsWith("Data Asset"))).toBe(true);
    expect(tabs.some((t) => t?.startsWith("Infrastructure Asset"))).toBe(false);
  });

  it("a stored relation the rules do not allow is marked and blocks saving until removed", () => {
    const stored = [{ assetId: "d1", assetGroup: "data", relationType: "stores" }] as AssetRelation[];
    const onChange = renderSelector("Process", stored);
    const chip = screen.getByTestId("asset-relation-not-allowed-d1-stores");
    fireEvent.click(chip);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByTestId("asset-relation-not-allowed")).toHaveTextContent("stores");
    const save = within(dialog).getByRole("button", { name: "Save" });
    expect(save).toBeDisabled();

    // Replace it by an allowed type: add "reads", remove "stores".
    fireEvent.click(within(dialog).getByText("reads"));
    expect(save).toBeDisabled();
    const storesCard = within(dialog).getAllByText("stores").at(-1)!.closest(".MuiPaper-root") as HTMLElement;
    fireEvent.click(within(storesCard).getByLabelText("Deselect"));
    expect(within(dialog).queryByTestId("asset-relation-not-allowed")).toBeNull();
    expect(save).toBeEnabled();
    fireEvent.click(save);
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ assetId: "d1", relationType: "reads" })]);
  });

  it("an element type without any allowed group says so and offers no add", () => {
    renderSelector("TrustBoundary");
    expect(screen.getByTestId("asset-relation-none-allowed")).toBeInTheDocument();
    expect(screen.queryByLabelText("Add asset relation")).toBeNull();
  });
});
