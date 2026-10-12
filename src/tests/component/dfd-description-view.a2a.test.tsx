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
import { A2AOpsProvider } from "features/dfd/contexts/a2a-ops-context";

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
    <A2AOpsProvider commit={() => {}}>
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
    </A2AOpsProvider>
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

describe("DFD description view — A2A edits go out as operations", () => {
  it("adding a relation emits one add operation, nothing is written locally", () => {
    const commit = vi.fn();
    render(
      <A2AOpsProvider commit={commit}>
        <DFDDescriptionView
          elements={[]}
          connections={[]}
          assets={[data, fn]}
          onElementUpdate={() => {}}
          onAssetUpdate={() => {}}
          onConnectionUpdate={() => {}}
          expandedGroups={["assets"]}
          onToggleGroup={() => {}}
          expandedElements={["d1"]}
          onToggleElement={() => {}}
        />
      </A2AOpsProvider>,
    );
    openRelationsTab();
    fireEvent.click(
      screen.getAllByRole("button").find((b) => /add/i.test(b.textContent ?? ""))!,
    );
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("tab", { name: /function/i }));
    fireEvent.click(within(dialog).getByText("E-Stop"));
    fireEvent.mouseDown(within(dialog).getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: "required_by" }));
    fireEvent.click(within(dialog).getByRole("button", { name: /^add$/i }));
    expect(commit).toHaveBeenCalledWith([
      {
        kind: "add",
        relation: { sourceAssetId: "d1", targetAssetId: "f1", relationType: "required_by" },
      },
    ]);
  });

  it("removing emits a remove operation with the canonical id", () => {
    const commit = vi.fn();
    const withRel = {
      ...data,
      assetRelations: [
        { id: "r1", sourceGroup: "data", targetGroup: "function", targetAssetId: "f1", relationType: "required_by" },
      ],
    };
    render(
      <A2AOpsProvider commit={commit}>
        <DFDDescriptionView
          elements={[]}
          connections={[]}
          assets={[withRel, fn]}
          onElementUpdate={() => {}}
          onAssetUpdate={() => {}}
          onConnectionUpdate={() => {}}
          expandedGroups={["assets"]}
          onToggleGroup={() => {}}
          expandedElements={["d1"]}
          onToggleElement={() => {}}
        />
      </A2AOpsProvider>,
    );
    openRelationsTab();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(commit).toHaveBeenCalledWith([{ kind: "remove", relationId: "r1" }]);
  });
});
