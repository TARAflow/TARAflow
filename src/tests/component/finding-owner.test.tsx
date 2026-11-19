// Multi-project TARA phase 4a (design §8.1): findings on an imported
// component's cells carry the component's chip; a property suggestion there
// offers no Apply (the cell is read-only in the machine).
import React from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DFDNotificationsPanel } from "features/dfd/components/dfd-notification-panel";
import { AssetNotificationPanel } from "features/assets/components/asset-notification-panel";
import { deriveControlInstances } from "app/hooks/use-control-instance-derivation";
import { getAllMitigations } from "features/threats/services/threat-catalog-service";
import type { ValidationResult } from "features/dfd/services/dfd-validator";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, o?: { defaultValue?: string } & Record<string, unknown>) =>
      (o?.defaultValue ?? key).replace(/\{\{(\w+)\}\}/g, (_m, n: string) => String(o?.[n] ?? "")),
    i18n: { language: "en" },
  }),
}));
afterEach(cleanup);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
const owner = { label: "Component SD1", tooltip: "Belongs to SD1 · Smoke Detector" };
const ownerOf = (id: string) => (id.startsWith("sd1_") ? owner : undefined);

describe("DFD notification panel — owner chip", () => {
  it("a finding on a component cell carries the chip; the machine's own does not", () => {
    const validation: ValidationResult = {
      isValid: false,
      isComplete: false,
      scenario: null,
      errors: [
        { key: "k.component", elementId: "sd1_p1" },
        { key: "k.machine", elementId: "m_p1" },
      ],
      warnings: [],
      infos: [],
    };
    render(<DFDNotificationsPanel validation={validation} ownerOf={ownerOf} />);
    const chips = screen.getAllByTestId("finding-owner");
    expect(chips).toHaveLength(1);
    expect(chips[0].textContent).toBe("Component SD1");
    expect(screen.getByText("k.component").parentElement!.textContent).toContain("Component SD1");
  });

  it("a property suggestion on a component cell: chip, no Apply", () => {
    // M-T-FSAFE-001 marked implemented, the DFD lacks it → Apply offered on the machine's own cell only
    const element = (id: string): Any => ({ id, displayId: id.toUpperCase(), name: id, type: "Process", properties: { failSafeOutputState: "not_defined" } });
    const elements = [element("sd1_p1"), element("m_p1")];
    const threats: Any = {
      perElementTables: [{ threats: elements.map((e) => ({ id: `t-${e.id}`, linkedElement: { elementId: e.id, elementType: "Process" } })) }],
      perInteractionTables: [],
    };
    const risks: Any = {
      risks: elements.map((e) => ({ id: `r-${e.id}`, threatId: `t-${e.id}`, treatment: "reduce", selectedMitigations: [{ id: "M-T-FSAFE-001", status: "implemented" }] })),
    };
    const instances = deriveControlInstances(threats, risks, { elements, connections: [] } as Any, getAllMitigations());
    render(<DFDNotificationsPanel controlInstances={instances} elements={elements} connections={[]} onApply={() => {}} ownerOf={ownerOf} />);
    expect(screen.getAllByText("Apply")).toHaveLength(1);
    expect(screen.getAllByTestId("finding-owner")).toHaveLength(1);
  });
});

describe("asset notification panel — owner chip", () => {
  it("name / DFD links of an imported asset: the component's chip; impact: none", () => {
    render(
      <AssetNotificationPanel
        findings={[
          { severity: "error", key: "tabs.assets.validation.noName", assetId: "a1", assetLabel: "SD1:DA-001" },
          { severity: "warning", key: "tabs.assets.validation.unratedImpact", assetId: "a1", assetLabel: "SD1:DA-001" },
        ] as Any}
        onOpen={() => {}}
        assets={[{ id: "a1", importedFrom: "SD1 · Smoke Detector" }]}
      />,
    );
    const rows = screen.getAllByTestId("asset-notification-row");
    const owned = rows.filter((r) => within(r).queryByTestId("asset-notification-owner"));
    expect(owned).toHaveLength(1);
    expect(owned[0].textContent).toContain("Component SD1");
  });
});
