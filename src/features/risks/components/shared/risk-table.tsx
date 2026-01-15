import { DataGrid, GridColDef } from "@mui/x-data-grid";
import React from "react";
import { Risk } from "../../models/risk-types";

interface Props {
  risks: Risk[];
  columns: GridColDef<Risk>[];
}

export const RiskTable: React.FC<Props> = ({ risks, columns }) => {
  return (
    <DataGrid
      rows={risks}
      columns={columns}
      hideFooter
      autoHeight
      density="compact"
      disableRowSelectionOnClick
      getRowId={(r) => r.id}
      sx={{ border: "none" }}
    />
  );
};
