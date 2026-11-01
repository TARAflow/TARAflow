import { describe, it, expect, beforeAll } from "vitest";

import { getElementPropertiesGrouped } from "../../../../features/documentation/utils/generators/property-doc-mappers";
import { initI18nNode } from "../../../../../taraflow-reporter/cli/i18n-node";
import type { DFDElement } from "../../../../features/dfd/models/dfd-types";

// Update mechanism and session control on Process and Multiprocess
// (iec-62443-4-2-cra-coverage.md P-2): the nested sessionControl renders one
// row per setting instead of N/A, with the labels of the forms.

beforeAll(async () => {
  await initI18nNode("en");
});

const entries = (element: DFDElement) =>
  Object.fromEntries(getElementPropertiesGrouped(element, "en").flatMap((g) => g.properties).map((p) => [p.label, p.value]));

const element = (type: string, properties: Record<string, unknown>) =>
  ({ id: "x", type, name: "X", displayId: "X", position: { x: 0, y: 0 }, size: { width: 1, height: 1 }, properties }) as unknown as DFDElement;

describe("getElementPropertiesGrouped — update mechanism and session control (P-2)", () => {
  const sessions = { sessionLockEnabled: true, remoteTerminationEnabled: false, maxConcurrentSessions: 2 };

  it("Process: update mechanism and the three session settings", () => {
    const e = entries(element("Process", { updateMechanism: "signed_ota", sessionControl: sessions }));
    expect(e["Update Mechanism"]).toBe("Signed OTA");
    expect(e["Session Lock after Inactivity"]).toBe("Yes");
    expect(e["Remote Session Termination"]).toBe("No");
    expect(e["Max. Concurrent Sessions (0 = unlimited)"]).toBe("2");
  });

  it("Multiprocess: the session settings; unset ones are N/A", () => {
    const e = entries(element("Multiprocess", { sessionControl: { sessionLockEnabled: true } }));
    expect(e["Session Lock after Inactivity"]).toBe("Yes");
    expect(e["Remote Session Termination"]).toBe("N/A");
  });
});
