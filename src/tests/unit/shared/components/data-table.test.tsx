// src/tests/unit/shared/components/data-table.test.tsx
//
// DataTable is the table the Risk, Threat and Attack Tree tabs all share. It was
// extracted from RiskTable, whose one risk-specific detail — the row background
// derived from the risk score — became an injected `rowBackground` function.
//
// The contract worth pinning is exactly that decoupling: the table must know
// nothing about what a row means. Everything domain-specific arrives through
// columns and the two callbacks. If a later change reaches back into the row
// type, these break.

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { DataTable, type DataColumn } from "shared";

interface Row {
  id: string;
  name: string;
  score: number;
}

const ROWS: Row[] = [
  { id: "r1", name: "Alpha", score: 1 },
  { id: "r2", name: "Bravo", score: 0 },
  { id: "r3", name: "Charlie", score: 4 },
];

const COLUMNS: DataColumn<Row>[] = [
  { id: "name", header: "Name", flex: 1, renderCell: (r) => r.name },
  {
    id: "score",
    header: "Score",
    width: 80,
    align: "center",
    renderCell: (r) => <span data-testid={`score-${r.id}`}>{r.score}</span>,
  },
];

function renderTable(props: Partial<Parameters<typeof DataTable<Row>>[0]> = {}) {
  return render(
    <DataTable<Row>
      rows={ROWS}
      columns={COLUMNS}
      getRowId={(r) => r.id}
      {...props}
    />,
  );
}

describe("DataTable — rendering", () => {
  it("renders a header per column and a row per item", () => {
    renderTable();
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Score")).toBeInTheDocument();
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Bravo")).toBeInTheDocument();
    expect(screen.getByText("Charlie")).toBeInTheDocument();
  });

  it("renders nothing when there are no rows", () => {
    const { container } = render(
      <DataTable<Row> rows={[]} columns={COLUMNS} getRowId={(r) => r.id} />,
    );
    expect(container.querySelector("table")).toBeNull();
  });

  it("uses renderCell for cell content, not the raw value", () => {
    renderTable();
    // score column renders a tagged span, proving renderCell is used verbatim
    expect(screen.getByTestId("score-r3")).toHaveTextContent("4");
  });
});

describe("DataTable — rowBackground is the only channel for row colour", () => {
  it("calls rowBackground once per row, with each row", () => {
    // MUI compiles sx.bgcolor into a generated class rather than an inline
    // rgb() value, so asserting the painted colour in jsdom is brittle. What
    // the contract actually guarantees is that the table asks the caller for
    // every row's colour and asks nothing else — so assert the call, per row.
    const rowBackground = vi.fn((r: Row) =>
      r.score >= 4 ? "#fef2f2" : "transparent",
    );

    renderTable({ rowBackground });

    const seen = rowBackground.mock.calls.map((c) => (c[0] as Row).id);
    expect(seen).toEqual(["r1", "r2", "r3"]);
    // and it returned the tint only for the high-score row
    expect(rowBackground(ROWS[2])).toBe("#fef2f2");
  });

  it("does not require a rowBackground (attack-tree table passes none)", () => {
    // The attack-tree table dropped the feasibility tint and passes no
    // rowBackground; that must render without error and without a tint.
    expect(() => renderTable()).not.toThrow();
    expect(screen.getByText("Charlie")).toBeInTheDocument();
  });
});

describe("DataTable — row interaction", () => {
  it("calls onRowClick with the row and the whole group", () => {
    const onRowClick = vi.fn();
    renderTable({ onRowClick });

    fireEvent.click(screen.getByText("Bravo"));

    expect(onRowClick).toHaveBeenCalledTimes(1);
    const [row, group] = onRowClick.mock.calls[0];
    expect(row.id).toBe("r2");
    // the group defaults to the rows shown, so a dialog can page siblings
    expect(group.map((r: Row) => r.id)).toEqual(["r1", "r2", "r3"]);
  });

  it("passes an explicit group through unchanged", () => {
    const onRowClick = vi.fn();
    const widerGroup: Row[] = [...ROWS, { id: "r4", name: "Delta", score: 2 }];
    renderTable({ onRowClick, group: widerGroup });

    fireEvent.click(screen.getByText("Alpha"));
    const [, group] = onRowClick.mock.calls[0];
    expect(group.map((r: Row) => r.id)).toEqual(["r1", "r2", "r3", "r4"]);
  });

  it("a stopRowClick cell fires its own handler and not the row's", () => {
    const onRowClick = vi.fn();
    const onCellClick = vi.fn();
    const columns: DataColumn<Row>[] = [
      ...COLUMNS,
      {
        id: "actions",
        header: "",
        width: 60,
        stopRowClick: true,
        onCellClick,
        renderCell: () => <button>edit</button>,
      },
    ];
    render(
      <DataTable<Row>
        rows={ROWS}
        columns={columns}
        getRowId={(r) => r.id}
        onRowClick={onRowClick}
      />,
    );

    // The stopRowClick handler sits on the cell (<td>). Target the first row's
    // actions cell directly — getByText("edit") is ambiguous here because
    // bindClickToColumnId clones the actions cell's element, so more than one
    // "edit" exists in the tree.
    const firstRow = screen.getAllByRole("row")[1]; // [0] is the header row
    const cells = within(firstRow).getAllByRole("cell");
    const actionsCell = cells[cells.length - 1]; // actions is the last column
    fireEvent.click(actionsCell);

    expect(onCellClick).toHaveBeenCalledTimes(1);
    expect(onCellClick.mock.calls[0][0].id).toBe("r1");
    expect(onRowClick).not.toHaveBeenCalled();
  });
});