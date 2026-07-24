// ==================== DATA TABLE ====================
// The table the Risk, Threat and Attack Tree tabs share.
//
// Extracted from features/risks/components/shared/risk-table.tsx, which was
// generic in everything but one detail: the row background came from
// `calculatedRiskBeforeMitigation` via RISK_SCALES. Injected as a function,
// that coupling disappears and the same component serves any row type.
//
// This has to live in shared rather than be imported across features:
// features/attacktree may not import from features/risks (dependency rule).
//
// What stays with the caller: the column definitions. Those are where the
// domain lives — STRIDE colours and MoSCoW in the Risk tab, path chains and
// feasibility in the Attack Tree tab.

import React from "react";
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Box,
} from "@mui/material";

// ==================== COLUMN CONTRACT ====================

export interface DataColumn<T> {
  id: string;
  header: string;
  /** Fixed width in px. Ignored when `flex` is set. */
  width?: number;
  minWidth?: number;
  /** Takes the remaining space; content is ellipsised. */
  flex?: number;
  align?: "left" | "center" | "right";
  renderCell: (row: T) => React.ReactNode;
  /** Stops row-click propagation on this cell. */
  stopRowClick?: boolean;
  /** Called on cell click instead of the row handler. */
  onCellClick?: (row: T) => void;
}

// ==================== CELL STYLES ====================

const headerCellSx = {
  bgcolor: "grey.50",
  fontWeight: 600,
  fontSize: "0.72rem",
  color: "text.secondary",
  py: 0.75,
  px: 1,
  whiteSpace: "nowrap" as const,
};

const bodyCellSx = {
  py: 0.75,
  px: 1,
  fontSize: "0.8rem",
};

// ==================== COMPONENT ====================

export interface DataTableProps<T> {
  rows: T[];
  columns: DataColumn<T>[];
  getRowId: (row: T) => string;
  /**
   * Row background colour. The one thing the table cannot derive itself —
   * it depends entirely on what the rows mean.
   */
  rowBackground?: (row: T) => string;
  /**
   * Row click. Receives the row and the group it belongs to, so a dialog
   * opened from here can page through its siblings.
   */
  onRowClick?: (row: T, group: T[]) => void;
  /** The surrounding group when it is wider than `rows`. Defaults to `rows`. */
  group?: T[];
  /** Minimum table width in px before horizontal scrolling kicks in. */
  minWidth?: number;
  /**
   * Column id whose cell should receive the row-click handler when it renders
   * a single element (the "actions" column pattern). Optional.
   */
  bindClickToColumnId?: string;
}

export function DataTable<T>({
  rows,
  columns,
  getRowId,
  rowBackground,
  onRowClick,
  group,
  minWidth = 700,
  bindClickToColumnId = "actions",
}: DataTableProps<T>): React.ReactElement | null {
  const effectiveGroup = group ?? rows;

  // The actions column renders a control that should trigger the row handler.
  // Cloning it here keeps the column definition free of click plumbing.
  const boundColumns = React.useMemo(() => {
    if (!onRowClick) return columns;
    return columns.map((col) =>
      col.id === bindClickToColumnId
        ? {
            ...col,
            renderCell: (row: T) => {
              const original = col.renderCell(row);
              if (!React.isValidElement(original)) return original;
              return React.cloneElement(
                original as React.ReactElement<Record<string, unknown>>,
                { onClick: () => onRowClick(row, effectiveGroup) },
              );
            },
          }
        : col,
    );
  }, [columns, onRowClick, effectiveGroup, bindClickToColumnId]);

  if (!rows.length) return null;

  const totalFixed = columns.reduce((sum, col) => sum + (col.width ?? 0), 0);
  const hasFlex = columns.some((col) => col.flex);
  const tableMinWidth = totalFixed + (hasFlex ? 200 : 0);

  return (
    <Box sx={{ overflowX: "auto", width: "100%" }}>
      <Table
        size="small"
        sx={{
          tableLayout: "fixed",
          minWidth: Math.max(tableMinWidth, minWidth),
          width: "100%",
        }}
      >
        {/* colgroup carries the widths — tableLayout: fixed honours them */}
        <colgroup>
          {columns.map((col) => (
            <col
              key={col.id}
              style={{
                width: col.flex
                  ? undefined // flex columns take what is left
                  : `${col.width ?? col.minWidth ?? 80}px`,
              }}
            />
          ))}
        </colgroup>

        <TableHead>
          <TableRow>
            {boundColumns.map((col) => (
              <TableCell
                key={col.id}
                align={col.align ?? "left"}
                sx={headerCellSx}
              >
                {col.header}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>

        <TableBody>
          {rows.map((row, rowIdx) => {
            const bg = rowBackground?.(row) ?? "transparent";
            return (
              <TableRow
                key={`${getRowId(row)}-${rowIdx}`}
                hover
                onClick={
                  onRowClick ? () => onRowClick(row, effectiveGroup) : undefined
                }
                sx={{
                  bgcolor: bg,
                  cursor: onRowClick ? "pointer" : "default",
                  "&:hover": {
                    bgcolor: `${bg} !important`,
                    filter: "brightness(0.97)",
                  },
                  "&:last-child td": { borderBottom: 0 },
                }}
              >
                {boundColumns.map((col) => (
                  <TableCell
                    key={col.id}
                    align={col.align ?? "left"}
                    onClick={
                      col.stopRowClick
                        ? (e) => {
                            e.stopPropagation();
                            col.onCellClick?.(row);
                          }
                        : undefined
                    }
                    sx={{
                      ...bodyCellSx,
                      overflow: "hidden",
                      ...(col.flex
                        ? {
                            whiteSpace: "nowrap",
                            textOverflow: "ellipsis",
                            maxWidth: 0,
                          }
                        : {}),
                    }}
                  >
                    {col.renderCell(row)}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Box>
  );
}

export default DataTable;
