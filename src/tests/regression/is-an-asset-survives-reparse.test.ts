// src/tests/regression/is-an-asset-survives-reparse.test.ts
//
// Regression coverage for: an asset created in the DFD and linked to an
// element via an `is_an` asset-relation vanished from BOTH the DFD and the
// Asset tab, "regularly" — re-creating it brought it back until the next
// reparse.
//
// Root cause: asset "markers" (Type="Asset" shapes on the canvas) were a
// legacy relic. The parser still derived an asset list from those markers
// (asset-parser.ts → parseAssets), and that XML-derived list was merged
// against the project's real assets. Assets are in fact pure references
// living in dfd.assets[], linked to elements via element.assetRelations —
// they have NO marker on the canvas. Every DrawIO autosave reparsed the XML
// (which never contained the markerless asset), and the marker-merge path
// could drop it.
//
// Fix: the marker concept is removed entirely. The parser no longer derives
// assets from XML (parse().assets === []); dfd-service.mergeAssetProperties
// simply carries the project's assets through untouched and relinks them
// from element.assetRelations. This test drives the real dfdService through
// the exact DrawIO-autosave entry point (saveDFDFromXml) with XML that
// contains only the sensor element — no asset marker — and asserts the
// is_an asset and its relation survive.

import { describe, it, expect } from "vitest";
import { dfdService } from "features/dfd/services/dfd-service";
import { dfdParser } from "features/dfd/services/dfd-parser";
import type {
  DFDProjectData,
  DFDData,
  DFDElement,
} from "features/dfd/models/dfd-types";
import type { DFDAsset } from "features/dfd/models/dfd-asset-types";

// A Sensor element on the canvas — no asset marker anywhere in the XML.
const XML = `<mxGraphModel><root>
  <mxCell id="0"/>
  <mxCell id="1" parent="0"/>
  <object label="Pressure Sensor [S-1]" type="Sensor" id="sensor-1">
    <mxCell style="whiteSpace=wrap;html=1;" vertex="1" parent="1">
      <mxGeometry x="120" y="120" width="60" height="60" as="geometry"/>
    </mxCell>
  </object>
</root></mxGraphModel>`;

// The sensor carries the is_an relation to a Physical asset. This is the
// ONLY place the asset↔element link is recorded — there is no marker.
const sensorElement = {
  id: "sensor-1",
  type: "Sensor",
  name: "Pressure Sensor",
  displayId: "S-1",
  position: { x: 120, y: 120 },
  size: { width: 60, height: 60 },
  properties: {},
  assetRelations: [
    { assetId: "PH-001", assetGroup: "physical", relationType: "is_an" },
  ],
} as unknown as DFDElement;

const physicalAsset = {
  id: "PH-001",
  displayId: "PH-001",
  name: "Pressure sensor device",
  description: "",
  assetGroup: "physical",
  protectionNeed: undefined,
  linkedElements: [],
  properties: {},
} as unknown as DFDAsset;

function makeProject(): DFDProjectData {
  const dfd = {
    xml: XML,
    elements: [sensorElement],
    connections: [],
    assets: [physicalAsset],
  } as unknown as DFDData;

  return {
    id: "proj-is-an",
    name: "is_an regression",
    dfd,
    phaseStatus: {} as never,
    settings: { autoSave: true, autoSaveInterval: 2 },
    lastModified: new Date().toISOString(),
  };
}

describe("is_an asset survives a DrawIO autosave reparse (no marker)", () => {
  it("keeps the markerless is_an asset in dfd.assets after saveDFDFromXml", () => {
    const project = makeProject();

    const result = dfdService.saveDFDFromXml(project, XML);

    expect(result.success).toBe(true);

    // THE BUG: the asset used to vanish here because the XML has no marker.
    const ids = result.dfd.assets.map((a) => a.id);
    expect(ids).toContain("PH-001");
  });

  it("relinks the surviving asset from the element's is_an relation", () => {
    const project = makeProject();

    const result = dfdService.saveDFDFromXml(project, XML);

    const asset = result.dfd.assets.find((a) => a.id === "PH-001");
    expect(asset).toBeDefined();

    // linkedElements is recomputed from element.assetRelations, not markers.
    const link = (asset!.linkedElements ?? []).find(
      (l) => l.elementId === "sensor-1",
    );
    expect(link).toBeDefined();
    expect(link!.relationType).toBe("is_an");
  });

  it("preserves the is_an relation on the sensor element across the reparse", () => {
    const project = makeProject();

    const result = dfdService.saveDFDFromXml(project, XML);

    const sensor = result.dfd.elements.find((e) => e.id === "sensor-1");
    expect(sensor).toBeDefined();
    const rel = (sensor!.assetRelations ?? []).find(
      (r) => r.assetId === "PH-001",
    );
    expect(rel).toBeDefined();
    expect(rel!.relationType).toBe("is_an");
  });

  it("the parser itself derives no assets from XML (markers are gone)", () => {
    const parsed = dfdParser.parse(XML);
    expect(parsed.assets).toEqual([]);
  });
});