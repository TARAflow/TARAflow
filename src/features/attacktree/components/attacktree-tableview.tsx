// ==================== ATTACK TREE TABLE VIEW ====================
// Tabular view of attack paths with risk scores

import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Typography,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  TableSortLabel,
  Tooltip,
  Link,
} from "@mui/material";

import {
  PathAnalysis,
  AttackPath,
  EvaluationMethod,
  MitigationReference,
  MITIGATION_VERIFICATION_DISPLAY,
  calculateRiskLevel,
  getRiskScoreEmoji,
} from "../models/attacktree-types";

// ==================== TYPES ====================

interface AttackTreeTableViewProps {
  pathAnalysis: PathAnalysis;
  evaluationMethod: EvaluationMethod;
  /**
   * Lookup of mitigation id → reference (status/ticket/text), mirrored from
   * the Risk tab. Optional: when absent, mitigations render as plain id chips
   * exactly as before. Keyed by UPPERCASE id for case-insensitive matching.
   */
  mitigationLookup?: Map<string, MitigationReference>;
}

type SortField = "path" | "risk" | "mitigations";
type SortOrder = "asc" | "desc";

// ==================== COMPONENT ====================

export const AttackTreeTableView: React.FC<AttackTreeTableViewProps> = ({
  pathAnalysis,
  evaluationMethod,
  mitigationLookup,
}) => {
  const { t, i18n } = useTranslation();
  const isGerman = i18n.language === "de";

  // Render a single mitigation as a chip, enriched with verification status
  // (icon/color) and ticket link when the Risk tab provides them.
  const renderMitigationChip = (mid: string): React.ReactNode => {
    const ref = mitigationLookup?.get(mid.toUpperCase());
    const display = ref?.status
      ? MITIGATION_VERIFICATION_DISPLAY[ref.status]
      : undefined;

    const statusLabel = display
      ? isGerman
        ? display.labelDE
        : display.label
      : isGerman
        ? "Nicht erfasst"
        : "Not tracked";

    const tooltip = (
      <Box sx={{ whiteSpace: "pre-line" }}>
        {ref?.description ? `${mid}: ${ref.description}\n` : `${mid}\n`}
        {isGerman ? "Verifikation: " : "Verification: "}
        {statusLabel}
        {ref?.ticketId ? `\nTicket: ${ref.ticketId}` : ""}
      </Box>
    );

    return (
      <Tooltip key={mid} title={tooltip} placement="top">
        <Chip
          label={
            <Box
              component="span"
              sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}
            >
              {display && <span>{display.icon}</span>}
              <span>{mid}</span>
              {ref?.ticketId && ref?.ticketUrl && (
                <Link
                  href={ref.ticketUrl}
                  target="_blank"
                  rel="noopener"
                  underline="hover"
                  onClick={(e) => e.stopPropagation()}
                  sx={{
                    fontFamily: "monospace",
                    fontSize: "0.65rem",
                    ml: 0.25,
                  }}
                >
                  {ref.ticketId}
                </Link>
              )}
              {ref?.ticketId && !ref?.ticketUrl && (
                <Box
                  component="span"
                  sx={{
                    fontFamily: "monospace",
                    fontSize: "0.65rem",
                    ml: 0.25,
                    color: "text.secondary",
                  }}
                >
                  {ref.ticketId}
                </Box>
              )}
            </Box>
          }
          size="small"
          variant="outlined"
          sx={
            display
              ? { borderColor: display.color, color: display.color }
              : undefined
          }
        />
      </Tooltip>
    );
  };

  const [searchTerm, setSearchTerm] = useState("");
  const [filterLevel, setFilterLevel] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("risk");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // Filter and sort paths
  const filteredPaths = useMemo(() => {
    let filtered = [...pathAnalysis.paths];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter((path) =>
        path.path.some((node) =>
          node.toLowerCase().includes(searchTerm.toLowerCase()),
        ),
      );
    }

    // Level filter
    if (filterLevel !== "all") {
      filtered = filtered.filter((path) => {
        const level = calculateRiskLevel(
          path.riskScore,
          evaluationMethod,
        ).level;
        return level === filterLevel;
      });
    }

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "path":
          comparison = a.path.join(" > ").localeCompare(b.path.join(" > "));
          break;
        case "risk":
          comparison = a.riskScore - b.riskScore;
          break;
        case "mitigations":
          comparison = a.mitigations.length - b.mitigations.length;
          break;
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [
    pathAnalysis.paths,
    searchTerm,
    filterLevel,
    sortField,
    sortOrder,
    evaluationMethod,
  ]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const getRiskChip = (score: number) => {
    const result = calculateRiskLevel(score, evaluationMethod);
    return (
      <Chip
        label={`${result.score.toFixed(1)} ${getRiskScoreEmoji(result.level)}`}
        size="small"
        sx={{
          backgroundColor: result.color,
          color: "white",
          fontWeight: "bold",
        }}
      />
    );
  };

  if (pathAnalysis.paths.length === 0) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100%",
          p: 4,
        }}
      >
        <Typography color="text.secondary">
          {isGerman ? "Keine Angriffspfade gefunden" : "No attack paths found"}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Filters */}
      <Box
        sx={{
          display: "flex",
          gap: 2,
          p: 2,
          backgroundColor: "grey.50",
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <TextField
          size="small"
          placeholder={isGerman ? "Suchen..." : "Search..."}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ flexGrow: 1 }}
        />

        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>{isGerman ? "Risiko-Niveau" : "Risk Level"}</InputLabel>
          <Select
            value={filterLevel}
            label={isGerman ? "Risiko-Niveau" : "Risk Level"}
            onChange={(e) => setFilterLevel(e.target.value)}
          >
            <MenuItem value="all">{isGerman ? "Alle" : "All"}</MenuItem>
            <MenuItem value="critical">
              {isGerman ? "Kritisch" : "Critical"}
            </MenuItem>
            <MenuItem value="high">{isGerman ? "Hoch" : "High"}</MenuItem>
            <MenuItem value="medium">{isGerman ? "Mittel" : "Medium"}</MenuItem>
            <MenuItem value="low">{isGerman ? "Niedrig" : "Low"}</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Statistics */}
      <Box
        sx={{
          display: "flex",
          gap: 2,
          p: 2,
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Chip
          label={`${pathAnalysis.totalPaths} ${isGerman ? "Pfade" : "Paths"}`}
          size="small"
          variant="outlined"
        />
        <Chip
          label={`${pathAnalysis.criticalPaths.length} ${isGerman ? "Kritisch" : "Critical"}`}
          size="small"
          color="error"
        />
        <Chip
          label={`${isGerman ? "Durchschnitt" : "Average"}: ${pathAnalysis.averageRiskScore.toFixed(1)}`}
          size="small"
          variant="outlined"
        />
        <Chip
          label={`${isGerman ? "Maximum" : "Max"}: ${pathAnalysis.maxRiskScore.toFixed(1)}`}
          size="small"
          color="warning"
        />
      </Box>

      {/* Table */}
      <TableContainer component={Paper} sx={{ flexGrow: 1, overflow: "auto" }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell>
                <TableSortLabel
                  active={sortField === "path"}
                  direction={sortField === "path" ? sortOrder : "asc"}
                  onClick={() => handleSort("path")}
                >
                  {isGerman ? "Angriffspfad" : "Attack Path"}
                </TableSortLabel>
              </TableCell>
              <TableCell align="center">
                <TableSortLabel
                  active={sortField === "risk"}
                  direction={sortField === "risk" ? sortOrder : "asc"}
                  onClick={() => handleSort("risk")}
                >
                  {isGerman ? "Risiko-Score" : "Risk Score"}
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortField === "mitigations"}
                  direction={sortField === "mitigations" ? sortOrder : "asc"}
                  onClick={() => handleSort("mitigations")}
                >
                  {isGerman ? "Maßnahmen" : "Mitigations"}
                </TableSortLabel>
              </TableCell>
              <TableCell align="center">
                {isGerman ? "Status" : "Status"}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredPaths.map((path) => (
              <TableRow
                key={path.id}
                sx={{
                  backgroundColor: path.isCritical ? "error.light" : "inherit",
                  "&:hover": {
                    backgroundColor: path.isCritical
                      ? "error.main"
                      : "action.hover",
                  },
                }}
              >
                <TableCell>
                  <Box
                    sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}
                  >
                    {path.path.map((node, idx) => (
                      <Box
                        key={idx}
                        sx={{
                          pl: idx * 2,
                          fontSize: "0.875rem",
                          color: idx === 0 ? "primary.main" : "text.primary",
                          fontWeight: idx === 0 ? "bold" : "normal",
                        }}
                      >
                        {idx > 0 && "└─ "}
                        {node}
                      </Box>
                    ))}
                  </Box>
                </TableCell>
                <TableCell align="center">
                  {getRiskChip(path.riskScore)}
                </TableCell>
                <TableCell>
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                    {path.mitigations.length > 0 ? (
                      path.mitigations.map((mid) => renderMitigationChip(mid))
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        {isGerman ? "Keine" : "None"}
                      </Typography>
                    )}
                  </Box>
                </TableCell>
                <TableCell align="center">
                  {path.isCritical && (
                    <Chip
                      label={isGerman ? "Kritisch" : "Critical"}
                      size="small"
                      color="error"
                    />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* No Results */}
      {filteredPaths.length === 0 && (
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            p: 4,
          }}
        >
          <Typography color="text.secondary">
            {isGerman ? "Keine Pfade gefunden" : "No paths match your filters"}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default AttackTreeTableView;