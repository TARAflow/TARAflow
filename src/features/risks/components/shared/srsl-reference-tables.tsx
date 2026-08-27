import { useTranslation } from "react-i18next";
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Paper,
} from "@mui/material";
import {
  AP_BAND_TABLE,
  SRSL_LOOKUP,
  type AttackPotentialBand,
  type Severity,
  type Srsl,
} from "../../models/en50742-approach-a-core";

const SRSL_COLORS: Record<Srsl, string> = {
  SRSL0: "#22c55e",
  SRSL1: "#eab308",
  SRSL2: "#f97316",
  SRSL3: "#ef4444",
};

const SEVERITY_ORDER: readonly Severity[] = [
  "reversible",
  "non_reversible",
  "fatal",
];

export interface SrslReferenceTablesProps {
  /** Currently resolved AP score (for Table B.5 row highlighting) — null/undefined if not yet determined. */
  currentApScore?: number | null;
  /** Currently resolved AP band (for Table B.6 column highlighting) — null/undefined if not yet determined. */
  currentApBand?: AttackPotentialBand | null;
  /** Currently resolved severity (for Table B.6 row highlighting) — undefined if not yet determined. */
  currentSeverity?: Severity | null;
}

/**
 * Static norm reference — prEN 50742:2025 (E) Annex B, Table B.5 (score →
 * band) and Table B.6 (band × severity → SRSL, incl. the confirmed `fatal`
 * extension row). Both tables are driven by the same exported data the
 * calculation itself uses (AP_BAND_TABLE / SRSL_LOOKUP) — never a
 * hand-copied duplicate that could drift from the actual computation.
 */
export const SrslReferenceTables = ({
  currentApScore,
  currentApBand,
  currentSeverity,
}: SrslReferenceTablesProps) => {
  const { t } = useTranslation();

  return (
    <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mt: 1 }}>
      {/* Table B.5 — score → band */}
      <TableContainer component={Paper} variant="outlined" sx={{ flex: "1 1 260px" }}>
        <Typography variant="caption" sx={{ display: "block", p: 1, fontWeight: "medium" }}>
          {t("tabs.risks.dialog.tableB5Title", {
            defaultValue: "Table B.5 — AP Score → Band",
          })}
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t("tabs.risks.dialog.tableScoreRange", { defaultValue: "Score" })}</TableCell>
              <TableCell>{t("tabs.risks.dialog.tableBand", { defaultValue: "Band" })}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {AP_BAND_TABLE.map((row, i) => {
              const prevMax = i > 0 ? AP_BAND_TABLE[i - 1].maxScore : 0;
              const rangeLabel =
                row.maxScore === null
                  ? `> ${prevMax}`
                  : i === 0
                    ? `0 – ${row.maxScore}`
                    : `${prevMax}.1 – ${row.maxScore}`;
              const isCurrent =
                currentApScore != null && currentApBand === row.band;
              return (
                <TableRow
                  key={row.band}
                  sx={isCurrent ? { bgcolor: "action.selected" } : undefined}
                >
                  <TableCell sx={{ fontWeight: isCurrent ? "bold" : "normal" }}>
                    {rangeLabel}
                  </TableCell>
                  <TableCell sx={{ fontWeight: isCurrent ? "bold" : "normal" }}>
                    {row.band}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Table B.6 — severity × band → SRSL */}
      <TableContainer component={Paper} variant="outlined" sx={{ flex: "2 1 380px" }}>
        <Typography variant="caption" sx={{ display: "block", p: 1, fontWeight: "medium" }}>
          {t("tabs.risks.dialog.tableB6Title", {
            defaultValue: "Table B.6 — Severity × Band → SRSL",
          })}
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t("tabs.risks.dialog.severity", { defaultValue: "Severity" })}</TableCell>
              {AP_BAND_TABLE.map((row) => (
                <TableCell
                  key={row.band}
                  align="center"
                  sx={{
                    fontWeight: currentApBand === row.band ? "bold" : "normal",
                  }}
                >
                  {row.band}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {SEVERITY_ORDER.map((severity) => {
              const isSeverityRow = currentSeverity === severity;
              return (
                <TableRow key={severity}>
                  <TableCell
                    sx={{ fontWeight: isSeverityRow ? "bold" : "normal" }}
                  >
                    {t(`risks.severity.${severity}`, {
                      defaultValue: severity.replace(/_/g, " "),
                    })}
                  </TableCell>
                  {AP_BAND_TABLE.map((row) => {
                    const srsl = SRSL_LOOKUP[severity][row.band];
                    const isCurrentCell =
                      isSeverityRow && currentApBand === row.band;
                    return (
                      <TableCell
                        key={row.band}
                        align="center"
                        sx={{
                          bgcolor: isCurrentCell ? SRSL_COLORS[srsl] : undefined,
                          color: isCurrentCell ? "white" : undefined,
                          fontWeight: isCurrentCell ? "bold" : "normal",
                        }}
                      >
                        {srsl}
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};
