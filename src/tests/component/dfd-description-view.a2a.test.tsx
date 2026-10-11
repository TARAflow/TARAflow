// src/tests/component/dfd-description-view.a2a.test.tsx
//
// Asset-to-asset relations in the DFD description view (accordion list):
//   B10 the view passed no allAssets to the form, so the relation dialog
//       had no targets (failed before the fix)
//   guard: an added relation must show in the open accordion. The memo
//       comparator ignored assetRelations; only the inline onToggle prop
//       kept this working, so the test pins it.

import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import DFDDescriptionView from "features/dfd/components/dfd-description-view";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      (o?.defaultValue as string | undefined) ?? k,
    i18n: { language: "en" },
  }),
}));

afterEach(cleanup);

const data: any = {
  id: "d1",
  displayId: "DA-002",
  name: "Measure Data",
  assetGroup: "data",
  linkedElements: [],
  assetRelations: [],
};
const fn: any = {
  id: "f1",
  displayId: "FU-001",
  name: "E-Stop",
  assetGroup: "function",
  linkedElements: [],
  assetRelations: [],
};

function view(assets: any[]) {
  return (
    <DFDDescriptionView
      elements={[]}
      connections={[]}
      assets={assets}
      onElementUpdate={() => {}}
      onAssetUpdate={() => {}}
      onConnectionUpdate={() => {}}
      expandedGroups={["assets"]}
      onToggleGroup={() => {}}
      expandedElements={["d1"]}
      onToggleElement={() => {}}
    />
  );
}

function openRelationsTab() {
  const tab = screen
    .getAllByRole("tab")
    .find((t) => /relation/i.test(t.textContent ?? ""));
  if (!tab) throw new Error("relations tab not found");
  fireEvent.click(tab);
}

describe("DFD description view — asset-to-asset relations", () => {
  it("shows a relation added after the first render", () => {
    const { rerender } = render(view([data, fn]));
    openRelationsTab();
    expect(screen.queryByText("required_by")).toBeNull();

    const withRelation = {
      ...data,
      assetRelations: [
        {
          sourceGroup: "data",
          targetGroup: "function",
          targetAssetId: "f1",
          relationType: "required_by",
        },
      ],
    };
    rerender(view([withRelation, fn]));
    expect(screen.getAllByText("required_by").length).toBeGreaterThan(0);
  });

  it("offers the other assets as targets in the relation dialog (B10)", () => {
    render(view([data, fn]));
    openRelationsTab();
    const add = screen
      .getAllByRole("button")
      .find((b) => /add/i.test(b.textContent ?? ""));
    fireEvent.click(add!);
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("tab", { name: /function/i }));
    expect(within(dialog).getByText("E-Stop")).toBeTruthy();
  });
});
