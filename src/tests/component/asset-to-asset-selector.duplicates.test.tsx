// src/tests/component/asset-to-asset-selector.duplicates.test.tsx
//
// The A2A dialog follows the D1 duplicate rule: another relation type to an
// already related target is allowed, an exact duplicate is not. Before, a
// target disappeared from the dialog as soon as any relation to it existed.

import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AssetToAssetSelector } from "features/dfd/components/forms/asset-to-asset-selector";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      (o?.defaultValue as string | undefined) ?? k,
  }),
}));

afterEach(cleanup);

const fn: any = { id: "f1", displayId: "FU-001", name: "E-Stop", assetGroup: "function" };
const rel = (relationType: string) => ({
  sourceGroup: "data",
  targetGroup: "function",
  targetAssetId: "f1",
  relationType,
});

function openDialog(existing: unknown[]) {
  const data: any = {
    id: "d1",
    displayId: "DA-002",
    name: "Measure Data",
    assetGroup: "data",
    assetRelations: existing,
  };
  render(<AssetToAssetSelector asset={data} allAssets={[data, fn]} onAdd={() => {}} onRemove={() => {}} />);
  fireEvent.click(screen.getByText("Add Relation"));
  return screen.getByRole("dialog");
}

describe("AssetToAssetSelector — duplicate rule", () => {
  it("offers a related target again with only the unused types", () => {
    const dialog = openDialog([rel("required_by")]);
    fireEvent.click(within(dialog).getByRole("tab", { name: /function/i }));
    fireEvent.click(within(dialog).getByText("E-Stop"));
    fireEvent.mouseDown(within(dialog).getByRole("combobox"));
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "configures",
    ]);
  });

  it("hides a target once every allowed type to it is used", () => {
    const dialog = openDialog([rel("required_by"), rel("configures")]);
    expect(within(dialog).queryByText("E-Stop")).toBeNull();
  });
});

describe("AssetToAssetSelector — mirror hint", () => {
  function openFromEStop(eStopRelations: unknown[], dataRelations: unknown[]) {
    const data: any = {
      id: "d1",
      displayId: "DA-002",
      name: "Measure Data",
      assetGroup: "data",
      assetRelations: dataRelations,
    };
    const estop: any = { ...fn, assetRelations: eStopRelations };
    render(<AssetToAssetSelector asset={estop} allAssets={[data, estop]} onAdd={() => {}} onRemove={() => {}} />);
    fireEvent.click(screen.getByText("Add Relation"));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("tab", { name: /data/i }));
    fireEvent.click(within(dialog).getByText("Measure Data"));
    fireEvent.mouseDown(within(dialog).getByRole("combobox"));
    return dialog;
  }

  it("warns when the counterpart already exists", () => {
    const dialog = openFromEStop([], [rel("required_by")]);
    fireEvent.click(screen.getByRole("option", { name: "reads" }));
    expect(within(dialog).getByTestId("a2a-mirror-exists")).toBeTruthy();
  });

  it("names the preferred side when choosing the non-preferred type", () => {
    const dialog = openFromEStop([], []);
    fireEvent.click(screen.getByRole("option", { name: "reads" }));
    expect(within(dialog).getByTestId("a2a-mirror-preferred")).toBeTruthy();
  });

  it("no hint for a type without a mirror", () => {
    const dialog = openFromEStop([], [rel("required_by")]);
    fireEvent.click(screen.getByRole("option", { name: "modifies" }));
    expect(within(dialog).queryByTestId("a2a-mirror-exists")).toBeNull();
    expect(within(dialog).queryByTestId("a2a-mirror-preferred")).toBeNull();
  });
});

describe("AssetToAssetSelector — relation no longer allowed", () => {
  it("marks an entry whose type the rules no longer allow", () => {
    const human: any = {
      id: "d1",
      displayId: "HU-001",
      name: "Was data",
      assetGroup: "human",
      assetRelations: [{ id: "r1", ...rel("required_by") }],
    };
    render(<AssetToAssetSelector asset={human} allAssets={[human, fn]} onAdd={() => {}} onRemove={() => {}} />);
    expect(screen.getByTestId("a2a-not-allowed")).toBeTruthy();
  });

  it("no mark for an allowed entry", () => {
    const data: any = {
      id: "d1",
      displayId: "DA-002",
      name: "Measure Data",
      assetGroup: "data",
      assetRelations: [{ id: "r1", ...rel("required_by") }],
    };
    render(<AssetToAssetSelector asset={data} allAssets={[data, fn]} onAdd={() => {}} onRemove={() => {}} />);
    expect(screen.queryByTestId("a2a-not-allowed")).toBeNull();
  });
});
