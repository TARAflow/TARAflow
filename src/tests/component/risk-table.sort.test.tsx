// src/tests/component/risk-table.sort.test.tsx
//
// Manual test 2026-11-15: a risk that came back (its threat set relevant
// again) was appended at the end of its table. The rows follow the threat
// ids, naturally; the dialog browses the group in the same order.
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RiskTable, sortRisksByThreatId } from "features/risks/components/shared/risk-table";
import { DEFAULT_CONFIGURATION } from "features/risks/models/risk-config-types";
import type { Risk } from "features/risks/models/risk-assessment-types";
import type { RiskColumn } from "features/risks/components/shared/risk-columns";

afterEach(cleanup);

const risk = (id: string, threatDisplayId: string) =>
  ({ id, threatDisplayId, calculatedRiskBeforeMitigation: 0 }) as unknown as Risk;
// stored order: the one that came back last
const STORED = [risk("r10", "SDC1:DF10-T-1"), risk("r2", "SDC1:DF8-T-1"), risk("r1", "P-1-T-1"), risk("r7", "SDC1:DF7-T-1")];
const COLUMNS: RiskColumn[] = [{ id: "id", header: "T-ID", renderCell: (r) => <span data-testid="row-id">{r.threatDisplayId}</span> }];

describe("risk table order", () => {
  it("sorts by threat id, naturally (DF7 < DF8 < DF10)", () => {
    expect(sortRisksByThreatId(STORED).map((r) => r.threatDisplayId)).toEqual([
      "P-1-T-1",
      "SDC1:DF7-T-1",
      "SDC1:DF8-T-1",
      "SDC1:DF10-T-1",
    ]);
  });

  it("the table shows that order whatever the stored order is", () => {
    render(<RiskTable risks={STORED} columns={COLUMNS} configuration={DEFAULT_CONFIGURATION} />);
    expect(screen.getAllByTestId("row-id").map((e) => e.textContent)).toEqual([
      "P-1-T-1",
      "SDC1:DF7-T-1",
      "SDC1:DF8-T-1",
      "SDC1:DF10-T-1",
    ]);
  });

  it("the dialog browses the group in the same order", () => {
    const onEdit = vi.fn();
    render(<RiskTable risks={STORED} columns={COLUMNS} configuration={DEFAULT_CONFIGURATION} onEdit={onEdit} groupRisks={STORED} />);
    fireEvent.click(screen.getByText("SDC1:DF8-T-1"));
    const [clicked, group] = onEdit.mock.calls[0] as [Risk, Risk[]];
    expect(clicked.id).toBe("r2");
    expect(group.map((r) => r.id)).toEqual(["r1", "r7", "r2", "r10"]);
  });
});
