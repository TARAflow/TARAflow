import { describe, it, expect, beforeAll } from "vitest";

import { getElementPropertiesGrouped } from "../../../../features/documentation/utils/generators/property-doc-mappers";
import { initI18nNode } from "../../../../../taraflow-reporter/cli/i18n-node";
import type { DFDElement } from "../../../../features/dfd/models/dfd-types";

// Regression coverage for two doc-mapper fixes:
//  1. Interface security controls live under properties.implementedControls.*,
//     not at the top level — the mapper must resolve them there (they used to
//     render as N/A). The stale field name "logicalAccessControl" was also
//     realigned to the real field "linkAuthentication".
//  2. Free-text fields (owner) must be shown verbatim, never resolved against
//     the DFD options catalogue (a single-letter owner "d" used to trigger a
//     spurious missing-key lookup).

beforeAll(async () => {
  await initI18nNode("en");
});

function findEntry(
  groups: ReturnType<typeof getElementPropertiesGrouped>,
  label: string,
) {
  return groups.flatMap((g) => g.properties).find((p) => p.label === label);
}

describe("getElementPropertiesGrouped — interface implementedControls", () => {
  const iface = {
    id: "if-1",
    type: "Interface",
    name: "BLE Link",
    description: "",
    properties: {
      type: "bluetooth",
      owner: "d", // free text — a single letter an analyst typed
      implementedControls: {
        linkAuthentication: "certificate_based",
        serviceAccessPolicy: "allowlist",
      },
    },
  } as unknown as DFDElement;

  it("resolves linkAuthentication from implementedControls with its real label and value", () => {
    const groups = getElementPropertiesGrouped(iface, "en");
    const entry = findEntry(groups, "Link Authentication");
    expect(entry).toBeDefined();
    expect(entry?.value).toBe("Certificate-based"); // resolved option, not N/A
  });

  it("shows a free-text owner verbatim instead of an options lookup", () => {
    // owner is a process/datastore field (not interface); a single-letter value
    // must render verbatim, not trigger an options lookup.
    const proc = {
      id: "p-1",
      type: "Process",
      name: "Auth Service",
      description: "",
      properties: { owner: "d" },
    } as unknown as DFDElement;
    const groups = getElementPropertiesGrouped(proc, "en");
    const entry = findEntry(groups, "Owner");
    expect(entry?.value).toBe("d");
  });

  it("no longer references the stale logicalAccessControl field", () => {
    const groups = getElementPropertiesGrouped(iface, "en");
    const labels = groups.flatMap((g) => g.properties).map((p) => p.label);
    expect(labels).not.toContain("logicalAccessControl");
  });
});
