// src/tests/component/risk-dialog.element-info.test.tsx
//
// 0.20 manual test, 2026-11-25: the risk dialog shows the threat's element or
// flow with its DFD info right after the name, as the threat dialog does
// ("IF-2-T-1 IF-2 Service port ⓘ Tamper", "DF-3 Operator → Controller ⓘ").
// An attack-path risk has no element: no name, no button.
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RiskDialog } from "features/risks/components/risk-dialog";
import { DEFAULT_CONFIGURATION } from "features/risks/models/risk-config-types";
import type { Risk } from "features/risks/models/risk-assessment-types";
import { ElementInfoProvider } from "shared/components/element-info-context";
import type { DFDGraphReference, ThreatReference } from "shared";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      ((o?.defaultValue as string | undefined) ?? k).replace(/\{\{(\w+)\}\}/g, (_, n) => String(o?.[n] ?? "")),
    i18n: { language: "en", exists: () => false },
  }),
}));
Element.prototype.scrollIntoView = () => {};
afterEach(cleanup);

const empty = () => new Map();
const graph = {
  elementsById: new Map([
    ["if2", { id: "if2", type: "Interface", name: "Service port", displayId: "IF-2", properties: {} }],
    ["ee1", { id: "ee1", type: "ExternalEntity", name: "Operator", displayId: "EE-1", properties: {} }],
    ["p1", { id: "p1", type: "Process", name: "Controller", displayId: "P-1", properties: {} }],
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

const risk = (threatId: string, threatDisplayId: string, method = "per-element") =>
  ({
    id: `r-${threatId}`, threatId, threatDisplayId, sourceStrideMethod: method, threatDescription: "Tamper", strideCategory: "T",
    threatRelevance: "relevant", linkedAssetIds: [], treatment: "reduce", moscowPriority: "must", selectedMitigations: [], selectedVerifications: [],
    proposedMitigations: [], proposedVerifications: [], factorRatings: [], mitigatedFactorRatings: [],
    calculatedRiskBeforeMitigation: 0, calculatedRiskAfterMitigation: 0,
  }) as unknown as Risk;
const threat = (id: string, more: object) =>
  ({
    id, displayId: id, strideCategory: "T", threatDescription: "Tamper", attackDescription: "", relevance: "relevant",
    proposedMitigations: [], proposedVerifications: [], trustBoundaryId: null, trustBoundaryName: null, ...more,
  }) as unknown as ThreatReference;

const THREATS = [
  threat("IF2-T-1", { sourceStrideMethod: "per-element", linkedElement: { elementId: "if2", elementType: "Interface", elementName: "Service port", displayId: "IF-2" } }),
  threat("DF3-T-IN-1", {
    sourceStrideMethod: "per-interaction",
    interactionContext: { victimRole: "target" },
    dataFlow: { connectionId: "c3", dataFlowId: "DF-3", dataFlowName: "command", sourceId: "ee1", sourceName: "Operator", sourceType: "ExternalEntity", targetId: "p1", targetName: "Controller", targetType: "Process" },
  }),
  threat("AT-1.1", { sourceStrideMethod: "attack-path" }),
];

const open = (r: Risk) =>
  render(
    <ElementInfoProvider graph={graph}>
      <RiskDialog open risks={[r]} initialIndex={0} configuration={DEFAULT_CONFIGURATION} threats={THREATS} onSave={() => {}} onClose={() => {}} />
    </ElementInfoProvider>,
  );

/** The name the info button directly follows; it takes only its own width, the free space comes later. */
function infoAfter(id: string): HTMLElement {
  const wrapper = screen.getByRole("button", { name: `Show DFD info of ${id}` }).closest("div")!;
  const label = wrapper.previousElementSibling as HTMLElement;
  expect(getComputedStyle(label).flexGrow).not.toBe("1");
  return label;
}

describe("RiskDialog — DFD info of the threat's element or flow", () => {
  it("per element: 'IF-2 Service port ⓘ'", () => {
    open(risk("IF2-T-1", "IF2-T-1"));
    expect(infoAfter("IF-2").textContent).toBe("IF-2 Service port");
  });

  it("per interaction: 'DF-3 Operator → Controller ⓘ'", () => {
    open(risk("DF3-T-IN-1", "DF3-T-IN-1", "per-interaction"));
    expect(infoAfter("DF-3").textContent).toBe("DF-3 Operator → Controller");
  });

  it("attack path: no element, no button", () => {
    open(risk("AT-1.1", "AT-1.1", "attack-path"));
    expect(screen.queryByRole("button", { name: /Show DFD info/ })).toBeNull();
  });
});
