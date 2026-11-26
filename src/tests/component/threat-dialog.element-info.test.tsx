// src/tests/component/threat-dialog.element-info.test.tsx
//
// 0.20 manual test, 2026-11-25: the DFD info button (patch 52) in the threat
// dialog's title sat at the far right, after the free space — it belongs
// right after the element's name ("P1-S-1 P-1 MyProcess ⓘ"), per element and
// per interaction alike. And a per-element threat on a data flow (its element
// is the flow) had no button at all.
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThreatEvalDialog } from "features/threats/components/shared/threat-dialog";
import { ElementInfoProvider } from "shared/components/element-info-context";
import { createEmptyThreat, type Threat } from "features/threats/models/threat-types";
import type { DFDGraphReference } from "shared";

vi.mock("react-i18next", () => ({
  initReactI18next: { type: "3rdParty", init: () => {} },
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string } & Record<string, unknown>) =>
      (options?.defaultValue ?? key).replace(/\{\{(\w+)\}\}/g, (_m, n: string) => String(options?.[n] ?? "")),
    i18n: { language: "en" },
  }),
}));
Element.prototype.scrollIntoView = vi.fn();
afterEach(cleanup);

const empty = () => new Map();
const graph = {
  elementsById: new Map([
    ["p1", { id: "p1", type: "Process", name: "MyProcess", displayId: "P-1", properties: {} }],
    ["ee1", { id: "ee1", type: "ExternalEntity", name: "Operator", displayId: "EE-1", properties: {} }],
  ]),
  connectionsById: new Map([["c3", { id: "c3", from: "ee1", to: "p1", displayId: "DF-3", name: "command", properties: {} }]]),
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

const base = (id: string, displayId: string): Threat => ({
  ...createEmptyThreat(id, "S", null, "Zone", "Z"),
  displayId,
  threatDescription: "text",
});
const onElement = { ...base("t1", "P1-S-1"), linkedElement: { elementId: "p1", displayId: "P-1", elementName: "MyProcess", elementType: "Process" } };
const onFlowPerElement = {
  ...base("t2", "DF3-S-1"),
  linkedElement: { elementId: "c3", displayId: "DF-3", elementName: "command", elementType: "DataFlow" },
};
const perInteraction = {
  ...base("t3", "DF3-S-IN-1"),
  interactionContext: { direction: "IN", victimRole: "target", attackedRole: "target", crossesTrustBoundary: true },
  dataFlow: { connectionId: "c3", dataFlowId: "DF-3", displayId: "DF-3", dataFlowName: "command", sourceId: "ee1", sourceName: "Operator", targetId: "p1", targetName: "MyProcess" },
} as unknown as Threat;

const open = (threat: Threat) =>
  render(
    <ElementInfoProvider graph={graph}>
      <ThreatEvalDialog open threats={[threat]} initialIndex={0} configuration={{} as never} onSave={vi.fn()} onClose={vi.fn()} />
    </ElementInfoProvider>,
  );

/**
 * The element of the title the info button directly follows — checked to
 * take only its own width, the free space coming after the button (it took
 * the free space before, which put the button at the far right).
 */
function infoAfter(name: string): HTMLElement {
  const wrapper = screen.getByRole("button", { name: `Show DFD info of ${name}` }).closest("div")!;
  const label = wrapper.previousElementSibling as HTMLElement;
  expect(getComputedStyle(label).flexGrow).not.toBe("1");
  expect(getComputedStyle(wrapper.nextElementSibling as HTMLElement).flexGrow).toBe("1");
  return label;
}

describe("threat dialog — DFD info right after the element's name", () => {
  it("per element: 'P-1 MyProcess ⓘ'", () => {
    open(onElement);
    expect(infoAfter("P-1").textContent).toBe("P-1 MyProcess");
  });

  it("per element on a data flow: the flow's info, after its name", () => {
    open(onFlowPerElement);
    expect(infoAfter("DF-3").textContent).toBe("DF-3 command");
  });

  it("per interaction: 'DF-3 Operator → MyProcess ⓘ'", () => {
    open(perInteraction);
    expect(infoAfter("DF-3").textContent).toBe("DF-3 Operator → MyProcess");
  });
});
