// src/tests/component/risk-table.column-widths.test.tsx
//
// Manual test 2026-11-27: in the risk table the treatment column grew (a flex
// column takes as much room as the description), while "Risiko (Vorher)" /
// "Risiko (Nachher)" ran into the next column at 80 px — a header does not
// wrap. A fixed column is now at least as wide as its header, the treatment
// column as wide as its longest label.
import React from "react";
import { cleanup, render, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DataTable, type DataColumn } from "shared";
import { fixedColumnWidth } from "shared/components/data-table";
import { textWidth } from "shared/utils/text-width";
import { useRiskColumns } from "features/risks/components/shared/risk-columns";
import { DEFAULT_CONFIGURATION } from "features/risks/models/risk-config-types";

// German labels: the longer ones
const DE: Record<string, string> = {
  "tabs.risks.columns.riskBefore": "Risiko (Vorher)",
  "tabs.risks.columns.riskAfter": "Risiko (Nachher)",
  "tabs.risks.columns.treatment": "Behandlung",
  "risks.treatment.accept.label": "Akzeptieren",
  "risks.treatment.transfer.label": "Übertragen",
};
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => DE[k] ?? String((o?.defaultValue as string | undefined) ?? k),
    i18n: { language: "de" },
  }),
}));
afterEach(cleanup);

type Row = { id: string };
const widthOf = (container: HTMLElement) =>
  [...container.querySelectorAll("col")].map((c) => (c as HTMLElement).style.width);

describe("DataTable — a fixed column is at least as wide as its header", () => {
  it("a long header widens its column, a short one keeps the width; a flex column has none", () => {
    const columns: DataColumn<Row>[] = [
      { id: "a", header: "Risiko (Nachher)", width: 80, renderCell: (r) => r.id },
      { id: "b", header: "ID", width: 80, renderCell: (r) => r.id },
      { id: "c", header: "Beschreibung", flex: 1, renderCell: (r) => r.id },
    ];
    const { container } = render(<DataTable rows={[{ id: "1" }]} columns={columns} getRowId={(r) => r.id} />);
    const [a, b, c] = widthOf(container);
    expect(parseInt(a, 10)).toBeGreaterThan(80);
    expect(parseInt(a, 10)).toBeGreaterThanOrEqual(textWidth("Risiko (Nachher)", 0.72 * 16, 600));
    expect(b).toBe("80px");
    expect(c).toBe("");
  });

  it("fixedColumnWidth: the own width when the header fits", () => {
    expect(fixedColumnWidth({ header: "ID", width: 120 })).toBe(120);
    expect(fixedColumnWidth({ header: "ID" })).toBe(80);
  });
});

describe("risk table columns", () => {
  const { result } = renderHook(() =>
    useRiskColumns({ configuration: DEFAULT_CONFIGURATION, onEdit: vi.fn(), onPriorityChange: vi.fn(), onTreatmentChange: vi.fn() }),
  );
  const col = (id: string) => result.current.find((c) => c.id === id)!;

  it("the treatment column is no flex column; wide enough for its longest label", () => {
    const treatment = col("treatment");
    expect(treatment.flex).toBeUndefined();
    expect(treatment.width!).toBeGreaterThanOrEqual(textWidth("Akzeptieren", 0.65 * 16) + 16);
  });

  it("Risk (before) and Risk (after): the columns take their German headers", () => {
    for (const id of ["riskBefore", "riskAfter"]) {
      const c = col(id);
      expect(fixedColumnWidth(c)).toBeGreaterThanOrEqual(textWidth(c.header, 0.72 * 16, 600) + 16);
    }
  });
});
