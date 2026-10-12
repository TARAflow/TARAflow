// src/tests/component/asset-links.test.tsx
//
// "Asset Links": asset-to-asset relations shown read-only in the asset tab,
// direction-marked, next to the DFD Links.

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AssetTable } from "features/assets/components/asset-table";
import { AssetLinkChips } from "features/assets/components/asset-link-chips";
import { DEFAULT_ASSET_CONFIGURATION } from "features/assets/models/asset-types";
import type { Asset } from "features/assets/models/asset-types";
import { buildAssetLinks } from "features/assets/utils/asset-links";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: { defaultValue?: string }) => o?.defaultValue ?? k,
    i18n: { language: "en" },
  }),
}));

afterEach(cleanup);

const asset = (id: string, displayId: string, name: string, assetGroup: string): Asset =>
  ({
    id,
    displayId,
    name,
    assetGroup,
    properties: {},
    impactRatings: [],
    linkedDFDElements: [],
    securityGoals: [],
  }) as unknown as Asset;

const MD = asset("md", "DA-002", "Measure Data", "data");
const ES = asset("es", "FU-001", "E-Stop", "function");
const CFG = asset("cfg", "DA-001", "Config Data", "data");
const REL = [{ sourceAssetId: "md", targetAssetId: "es", relationType: "required_by" as const }];

describe("buildAssetLinks", () => {
  it("gives the source an outgoing and the target an incoming link", () => {
    const links = buildAssetLinks([MD, ES, CFG], REL);
    expect(links.get("md")).toEqual([
      expect.objectContaining({ direction: "out", otherDisplayId: "FU-001", relationType: "required_by" }),
    ]);
    expect(links.get("es")).toEqual([
      expect.objectContaining({ direction: "in", otherDisplayId: "DA-002", relationType: "required_by" }),
    ]);
    expect(links.get("cfg")).toEqual([]);
  });

  it("skips edges to unknown assets and sorts outgoing before incoming", () => {
    const links = buildAssetLinks(
      [MD, ES],
      [
        ...REL,
        { sourceAssetId: "es", targetAssetId: "md", relationType: "modifies" as const },
        { sourceAssetId: "md", targetAssetId: "gone", relationType: "configures" as const },
      ],
    );
    expect(links.get("md")!.map((l) => `${l.direction}:${l.relationType}`)).toEqual([
      "out:required_by",
      "in:modifies",
    ]);
  });
});

describe("AssetLinkChips", () => {
  it("labels direction, other asset and type", () => {
    const links = buildAssetLinks([MD, ES], REL);
    render(<AssetLinkChips links={links.get("es")!} />);
    expect(screen.getByText("← DA-002 · required_by")).toBeTruthy();
  });
});

describe("AssetTable — Asset Links column", () => {
  it("shows the column next to DFD Links with direction-marked chips", () => {
    render(
      <div style={{ width: 3000, height: 600 }}>
        <AssetTable
          assets={[MD, ES, CFG]}
          configuration={DEFAULT_ASSET_CONFIGURATION}
          assetLinkRelations={REL}
          onEdit={() => {}}
        />
      </div>,
    );
    expect(screen.getByText("Asset Links")).toBeTruthy();
    expect(screen.getByText("→ FU-001 · required_by")).toBeTruthy();
    expect(screen.getByText("← DA-002 · required_by")).toBeTruthy();
  });
});
