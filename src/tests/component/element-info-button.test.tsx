// src/tests/component/element-info-button.test.tsx
//
// ⓘ in the Threats tab (manual test 2026-11-24): opens the DFD info of the
// element, with the DFD form's labels and option texts; does not toggle the
// accordion it sits in.

import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi, beforeAll } from "vitest";
import { I18nextProvider } from "react-i18next";
import appI18n from "i18n/services/i18n";
import { ElementInfoButton } from "features/threats/components/shared/element-info-button";
import { ElementInfoProvider } from "features/threats/components/shared/element-info-context";
import type { DFDGraphReference } from "shared";

const empty = () => new Map();
const graph = {
  elementsById: new Map([
    ["p1", { id: "p1", type: "Process", name: "Controller", displayId: "P-1", properties: {} }],
    ["ds3", { id: "ds3", type: "DataStore", name: "Config Store", displayId: "DS-3", properties: { encryptionAtRest: "none", backupEnabled: true, internalFlag: "x" } }],
  ]),
  connectionsById: new Map([["c1", { id: "c1", from: "p1", to: "ds3", displayId: "DF-3", name: "write config", properties: {} }]]),
  assetsById: empty(),
  outgoingConnections: empty(),
  incomingConnections: empty(),
  elementTrustBoundaries: empty(),
  trustBoundaryElements: empty(),
  elementChipBoundaries: empty(),
  chipBoundaryElements: empty(),
  elementPhysicalBoundaries: empty(),
  physicalBoundaryElements: empty(),
  dataFlowAnalysis: empty(),
  trustBoundaryHierarchy: empty(),
  effectiveElementTrustBoundary: empty(),
} as unknown as DFDGraphReference;

const renderIn = (ui: React.ReactElement, g: DFDGraphReference | null = graph) =>
  render(
    <I18nextProvider i18n={appI18n}>
      <ElementInfoProvider graph={g}>{ui}</ElementInfoProvider>
    </I18nextProvider>,
  );

describe("ElementInfoButton", () => {
  beforeAll(async () => {
    await appI18n.changeLanguage("en");
  });

  it("opens the element's DFD info with the form's labels; the click stays in the button", () => {
    const parentClick = vi.fn();
    renderIn(
      <div onClick={parentClick}>
        <ElementInfoButton target={{ elementId: "ds3" }} />
      </div>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Show DFD info of DS-3" }));
    expect(parentClick).not.toHaveBeenCalled();
    const panel = screen.getByTestId("element-info-panel");
    expect(within(panel).getByText("Config Store")).toBeTruthy();
    const encryptionLabel = appI18n.t("tabs.dfd.element_description.datastore.fields.encryptionAtRest.label");
    expect(within(panel).getByText(encryptionLabel)).toBeTruthy();
    expect(within(panel).getByText(appI18n.t("tabs.dfd.element_description.datastore.fields.encryptionAtRest.options.none"))).toBeTruthy();
    expect(within(panel).getByText("Yes")).toBeTruthy();
    // a field the DFD form does not show stays hidden
    expect(within(panel).queryByText("x")).toBeNull();
    // clicks inside the panel do not reach the accordion header either
    fireEvent.click(panel);
    expect(parentClick).not.toHaveBeenCalled();
  });

  it("for a data flow, expands the target to its own properties", () => {
    renderIn(<ElementInfoButton target={{ connectionId: "c1" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Show DFD info of DF-3" }));
    expect(screen.queryByTestId("endpoint-details-target")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Details of DS-3" }));
    const details = screen.getByTestId("endpoint-details-target");
    expect(
      within(details).getByText(appI18n.t("tabs.dfd.element_description.datastore.fields.encryptionAtRest.label")),
    ).toBeTruthy();
  });

  it("renders nothing without a graph or for an unknown element", () => {
    const { container } = renderIn(<ElementInfoButton target={{ elementId: "gone" }} />);
    expect(container.querySelector("button")).toBeNull();
    const { container: c2 } = renderIn(<ElementInfoButton target={{ elementId: "ds3" }} />, null);
    expect(c2.querySelector("button")).toBeNull();
  });
});
