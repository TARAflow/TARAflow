// src/tests/component/dfd-asset-panel.follow-selection.test.tsx
//
// The asset tree follows a selection made elsewhere (a finding, the graph):
// it opens the asset's group, marks the row and scrolls it into view.

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssetPanel } from "features/dfd/components/dfd-asset-panel";
import { A2AOpsProvider } from "features/dfd/contexts/a2a-ops-context";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => (o?.defaultValue as string | undefined) ?? k,
    i18n: { language: "en", exists: () => false },
  }),
}));

const scrolled: string[] = [];
beforeEach(() => {
  scrolled.length = 0;
  // jsdom has no layout; record which row was asked to come into view.
  (Element.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = function (this: HTMLElement) {
    scrolled.push(this.dataset.assetTreeId ?? "");
  };
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
    cb(0);
    return 0;
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const asset = (id: string, displayId: string, group: string) =>
  ({ id, displayId, name: displayId, assetGroup: group, linkedElements: [], properties: {} }) as never;

describe("AssetPanel — tree follows the selection", () => {
  it("a focus request opens the group, marks the row and scrolls it into view", () => {
    const assets = [asset("d1", "DA-001", "data"), asset("s1", "SY-001", "system")];
    render(
      <A2AOpsProvider commit={() => {}}>
        <AssetPanel
          assets={assets}
          elements={[]}
          connections={[]}
          visibility={{} as never}
          onVisibilityChange={() => {}}
          onAssetChange={() => {}}
          focusAssetRequest={{ assetId: "s1" }}
        />
      </A2AOpsProvider>,
    );
    const row = document.querySelector('[data-asset-tree-id="s1"]') as HTMLElement;
    expect(row).not.toBeNull();
    expect(row.className).toContain("Mui-selected");
    expect(scrolled).toContain("s1");
    expect(screen.getAllByText(/SY-001/).length).toBeGreaterThan(0);
  });
});
