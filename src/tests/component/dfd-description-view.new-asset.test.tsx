// src/tests/component/dfd-description-view.new-asset.test.tsx
//
// User 2026-11-06: the Assets accordion of the description view is always
// shown, with "+" to create an asset (name and category) — not tied to an
// element yet; the new asset opens to be described.

import React, { useState } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import DFDDescriptionView from "features/dfd/components/dfd-description-view";
import { A2AOpsProvider } from "features/dfd/contexts/a2a-ops-context";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => (o?.defaultValue as string | undefined) ?? k,
    i18n: { language: "en" },
  }),
}));

afterEach(cleanup);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

function Harness({ onCreate }: { onCreate: (name: string, group: string) => void }) {
  const [assets, setAssets] = useState<Any[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [open, setOpen] = useState<string[]>([]);
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  return (
    <A2AOpsProvider commit={() => {}}>
      <DFDDescriptionView
        elements={[]}
        connections={[]}
        assets={assets}
        onElementUpdate={() => {}}
        onAssetUpdate={() => {}}
        onConnectionUpdate={() => {}}
        onCreateAsset={(name, assetGroup) => {
          onCreate(name, assetGroup);
          const asset = { id: `a${assets.length + 1}`, displayId: "DA-001", name, assetGroup, linkedElements: [], assetRelations: [] };
          setAssets((a) => [...a, asset]);
          return { id: asset.id, displayId: asset.displayId, name, assetGroup };
        }}
        expandedGroups={groups}
        onToggleGroup={(g) => setGroups((x) => toggle(x, g))}
        expandedElements={open}
        onToggleElement={(id) => setOpen((x) => toggle(x, id))}
      />
    </A2AOpsProvider>
  );
}

describe("DFD description view — new asset", () => {
  it("the Assets accordion is there without any asset, saying how to add one", () => {
    render(<Harness onCreate={vi.fn()} />);
    expect(screen.getByTestId("description-assets")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("description-new-asset"));
    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.getByTestId("description-no-assets")).toBeInTheDocument();
  });

  it("'+' opens the accordion and the form; Create makes the asset and opens it", () => {
    const onCreate = vi.fn();
    render(<Harness onCreate={onCreate} />);
    fireEvent.click(screen.getByTestId("description-new-asset"));
    const form = screen.getByTestId("new-asset-inline");
    expect(within(form).getByTestId("new-asset-create")).toBeDisabled();
    fireEvent.change(within(form).getByTestId("new-asset-name"), { target: { value: "Calibration data" } });
    fireEvent.click(within(form).getByTestId("new-asset-create"));
    expect(onCreate).toHaveBeenCalledWith("Calibration data", "data");
    expect(screen.queryByTestId("new-asset-inline")).toBeNull();
    expect(screen.getAllByText(/Calibration data/).length).toBeGreaterThan(0);
  });

  it("Enter creates, the chosen category is used", () => {
    const onCreate = vi.fn();
    render(<Harness onCreate={onCreate} />);
    fireEvent.click(screen.getByTestId("description-new-asset"));
    fireEvent.mouseDown(within(screen.getByTestId("new-asset-inline")).getAllByRole("combobox")[0]);
    fireEvent.click(screen.getByRole("option", { name: "People" }));
    const name = screen.getByTestId("new-asset-name");
    fireEvent.change(name, { target: { value: "Operator" } });
    fireEvent.keyDown(name, { key: "Enter" });
    expect(onCreate).toHaveBeenCalledWith("Operator", "human");
  });
});
