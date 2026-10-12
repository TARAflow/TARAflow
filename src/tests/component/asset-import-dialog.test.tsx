// src/tests/component/asset-import-dialog.test.tsx
//
// B14: the import adds assets; for assets already in the project the dialog
// asks per asset — keep (default) or replace. There is no "replace all
// assets of the project" mode any more.

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AssetExportImportDialog } from "features/assets/components/asset-export-import-dialog";
import { createDefaultAssetData, createEmptyAsset } from "features/assets/services/asset-factory";
import type { Asset, AssetExportData } from "features/assets/models/asset-types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      ((o?.defaultValue as string | undefined) ?? k).replace(/\{\{(\w+)\}\}/g, (_, n) => String(o?.[n] ?? "")),
    i18n: { language: "en", exists: () => false },
  }),
}));

afterEach(cleanup);

const data = createDefaultAssetData();
const asset = (id: string, displayId: string, name: string, group: Asset["assetGroup"]): Asset => ({
  ...createEmptyAsset(id, data.configuration, group, displayId),
  name,
  displayId,
});
const project = { ...data, assets: [asset("p", "DA-001", "Pump Data", "data"), asset("c", "SY-001", "Controller", "system")] };

async function loadFile(file: AssetExportData) {
  const onImport = vi.fn();
  render(<AssetExportImportDialog open mode="import" assetData={project} onImport={onImport} onClose={() => {}} />);
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [new File([JSON.stringify(file)], "a.json", { type: "application/json" })] } });
  await waitFor(() => expect(screen.getByTestId("asset-import-summary")).toBeInTheDocument());
  return onImport;
}

const file: AssetExportData = {
  version: "1.0.0",
  exportedAt: "2026-10-12T00:00:00Z",
  assets: [asset("c", "SY-004", "Controller v2", "system"), asset("x1", "DA-001", "pump data", "data"), asset("x2", "DA-002", "Log", "data")],
};

describe("AssetExportImportDialog — import adds, conflicts are decided (B14)", () => {
  it("summarises new and existing assets and lists the existing ones; no replace-all mode", async () => {
    await loadFile(file);
    expect(screen.getByTestId("asset-import-summary")).toHaveTextContent("1 new assets will be added · 2 already in the project");
    expect(screen.getByTestId("asset-import-conflict-c")).toHaveTextContent("same asset (same ID)");
    expect(screen.getByTestId("asset-import-conflict-x1")).toHaveTextContent("DA-001 Pump Data");
    expect(screen.getByTestId("asset-import-conflict-x1")).toHaveTextContent("same name and group as DA-001 pump data in the file");
    expect(screen.queryByText(/Delete existing/)).toBeNull();
  });

  it("keep is the default; replace is chosen per asset or for all", async () => {
    const onImport = await loadFile(file);
    expect(screen.getByTestId("asset-import-keep-c")).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByTestId("asset-import-replace-x1"));
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    expect(onImport).toHaveBeenCalledWith(
      expect.objectContaining({ assets: file.assets }),
      expect.objectContaining({ importAssets: true, decisions: { x1: "replace" } }),
    );
  });

  it("“Replace all” and “Keep all” set every conflict", async () => {
    const onImport = await loadFile(file);
    fireEvent.click(screen.getByTestId("asset-import-replace-all"));
    expect(within(screen.getByTestId("asset-import-conflict-c")).getByTestId("asset-import-replace-c")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    expect(onImport.mock.calls[0][1].decisions).toEqual({ c: "replace", x1: "replace" });
  });

  it("without conflicts there is no list", async () => {
    await loadFile({ ...file, assets: [asset("x2", "DA-002", "Log", "data")] });
    expect(screen.queryByTestId("asset-import-conflicts")).toBeNull();
  });
});
