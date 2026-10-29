// src/tests/component/dfd-notification-panel.closed-loop.test.tsx
//
// Closed-loop review CL-2 (decision 1): an unmet SHOULD of a mitigation that is
// only planned is information, not a warning; marked done and the DFD
// disagrees → warning (missing) or error (other value); applied then reverted
// → drift. One row per SHOULD (the security + conflict duplicate is gone).
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "i18n/services/i18n";
import { DFDNotificationsPanel } from "features/dfd/components/dfd-notification-panel";
import { deriveControlInstances } from "app/hooks/use-control-instance-derivation";
import { computeSecurityDrifts } from "app/hooks/use-security-drift";
import { getAllMitigations } from "features/threats/services/threat-catalog-service";

vi.mock("react-i18next", () => ({
  initReactI18next: { type: "3rdParty", init: () => {} },
  useTranslation: () => ({
    t: (key: string, o?: { defaultValue?: string } & Record<string, unknown>) =>
      (o?.defaultValue ?? key).replace(/\{\{(\w+)\}\}/g, (_m, n: string) => String(o?.[n] ?? "")),
    i18n: { language: "en" },
  }),
}));

afterEach(cleanup);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

// M-T-FSAFE-001: Process failSafeOutputState = fixed_value
const element = (id: string, failSafeOutputState: string, extra: Any = {}) => ({
  id,
  displayId: id.toUpperCase(),
  name: `Process ${id}`,
  type: "Process",
  properties: { failSafeOutputState, ...extra },
});
const elements: Any[] = [
  element("p1", "not_defined"), // planned
  element("p2", "not_defined"), // marked implemented, missing
  element("p3", "dynamic"), // marked implemented, other value
  element("p4", "dynamic", {
    // applied, then reverted
    securityControlOwnership: [{ property: "failSafeOutputState", value: "fixed_value", setBy: "apply_suggestion", setAt: "x" }],
  }),
];
const threats: Any = {
  perElementTables: [{ threats: elements.map((e) => ({ id: `t-${e.id}`, linkedElement: { elementId: e.id, elementType: "Process" } })) }],
  perInteractionTables: [],
};
const status = { p1: "open", p2: "implemented", p3: "verified", p4: "in_progress" } as Record<string, string>;
const risks: Any = {
  risks: elements.map((e) => ({
    id: `r-${e.id}`,
    threatId: `t-${e.id}`,
    treatment: "reduce",
    selectedMitigations: [{ id: "M-T-FSAFE-001", status: status[e.id] }],
  })),
};
const dfd: Any = { elements, connections: [] };

const renderPanel = () => {
  const instances = deriveControlInstances(threats, risks, dfd, getAllMitigations());
  render(
    <DFDNotificationsPanel
      controlInstances={instances}
      securityDrifts={computeSecurityDrifts(instances, dfd)}
      elements={elements}
      connections={[]}
      onApply={() => {}}
    />,
  );
  return instances;
};

describe("DFD notification panel — closed loop by mitigation status", () => {
  it("planned is not a warning: All shows done-but-missing, conflict and drift, one row each", () => {
    const instances = renderPanel();
    expect(instances.map((i) => [i.elementId, i.planned])).toEqual([
      ["p1", true],
      ["p2", false],
      ["p3", false],
      ["p4", true],
    ]);
    expect(screen.getByText("3 notification(s)")).toBeTruthy();
    expect(screen.queryByText("P1")).toBeNull();
    for (const id of ["P2", "P3", "P4"]) expect(screen.getAllByText(id)).toHaveLength(1);
    expect(screen.getByText("1 planned")).toBeTruthy();
  });

  it("the planned chip shows the planned SHOULD, with Apply", () => {
    renderPanel();
    fireEvent.click(screen.getByTestId("dfd-notification-planned-toggle"));
    expect(screen.getAllByText("P1")).toHaveLength(1);
    expect(screen.getByText("planned")).toBeTruthy();
    expect(screen.queryByText("P2")).toBeNull();
    expect(screen.getAllByText("Apply").length).toBeGreaterThan(0);
  });
});
