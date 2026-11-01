import { describe, it, expect, beforeAll } from "vitest";

import { getElementPropertiesGrouped } from "../../../../features/documentation/utils/generators/property-doc-mappers";
import { initI18nNode } from "../../../../../taraflow-reporter/cli/i18n-node";
import type { DFDElement } from "../../../../features/dfd/models/dfd-types";

// Further physical controls on a physical boundary: free text, shown in the
// report's property table next to the structured physical controls.

beforeAll(async () => {
  await initI18nNode("en");
});

describe("getElementPropertiesGrouped — further physical controls", () => {
  it("shows the free text with the label of the form, verbatim", () => {
    const element = {
      id: "cab",
      type: "PhysicalBoundary",
      name: "Cabinet [CAB]",
      displayId: "CAB",
      position: { x: 0, y: 0 },
      size: { width: 1, height: 1 },
      properties: { boundaryType: "cabinet", customPhysicalControls: "cctv" },
    } as unknown as DFDElement;
    const entry = getElementPropertiesGrouped(element, "en")
      .flatMap((g) => g.properties)
      .find((p) => p.label === "Further Physical Controls");
    expect(entry?.value).toBe("cctv"); // a single word stays as typed, no option lookup
  });
});
