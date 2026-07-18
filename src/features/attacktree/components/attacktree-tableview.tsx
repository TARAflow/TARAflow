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
  const { t } = useTranslation();

  // Render a single mitigation as a chip, enriched with verification status
  // (icon/color) and ticket link when the Risk tab provides them.
  const renderMitigationChip = (mid: string): React.ReactNode => {
    const ref = mitigationLookup?.get(mid.toUpperCase());
    const display = ref?.status
      ? MITIGATION_VERIFICATION_DISPLAY[ref.status]
      : undefined;

    const statusLabel = ref?.status
      ? t(`attacktree:tabs.attacktree.mitigationStatus.${ref.status}`)
      : t("attacktree:tabs.attacktree.mitigationStatus.notTracked");

    const tooltip = (
      <Box sx={{ whiteSpace: "pre-line" }}>
        {ref?.description ? `${mid}: ${ref.description}\n` : `${mid}\n`}
        {t("attacktree:tabs.attacktree.tableview.verificationLabel")}
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
          {t("attacktree:tabs.attacktree.tableview.noAttackPathsFound")}
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
          placeholder={t("attacktree:tabs.attacktree.tableview.search")}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ flexGrow: 1 }}
        />

        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>
            {t("attacktree:tabs.attacktree.tableview.riskLevel")}
          </InputLabel>
          <Select
            value={filterLevel}
            label={t("attacktree:tabs.attacktree.tableview.riskLevel")}
            onChange={(e) => setFilterLevel(e.target.value)}
          >
            <MenuItem value="all">
              {t("attacktree:tabs.attacktree.tableview.all")}
            </MenuItem>
            <MenuItem value="critical">
              {t("attacktree:tabs.attacktree.tableview.critical3")}
            </MenuItem>
            <MenuItem value="high">
              {t("attacktree:tabs.attacktree.tableview.high")}
            </MenuItem>
            <MenuItem value="medium">
              {t("attacktree:tabs.attacktree.tableview.medium")}
            </MenuItem>
            <MenuItem value="low">
              {t("attacktree:tabs.attacktree.tableview.low")}
            </MenuItem>
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
          label={`${pathAnalysis.totalPaths} ${t("attacktree:tabs.attacktree.tableview.paths")}`}
          size="small"
          variant="outlined"
        />
        <Chip
          label={`${pathAnalysis.criticalPaths.length} ${t("attacktree:tabs.attacktree.tableview.critical3")}`}
          size="small"
          color="error"
        />
        <Chip
          label={`${t("attacktree:tabs.attacktree.tableview.average")}: ${pathAnalysis.averageRiskScore.toFixed(1)}`}
          size="small"
          variant="outlined"
        />
        <Chip
          label={`${t("attacktree:tabs.attacktree.tableview.max")}: ${pathAnalysis.maxRiskScore.toFixed(1)}`}
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
                  {t("attacktree:tabs.attacktree.tableview.attackPath")}
                </TableSortLabel>
              </TableCell>
              <TableCell align="center">
                <TableSortLabel
                  active={sortField === "risk"}
                  direction={sortField === "risk" ? sortOrder : "asc"}
                  onClick={() => handleSort("risk")}
                >
                  {t("attacktree:tabs.attacktree.tableview.riskScore")}
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortField === "mitigations"}
                  direction={sortField === "mitigations" ? sortOrder : "asc"}
                  onClick={() => handleSort("mitigations")}
                >
                  {t("attacktree:tabs.attacktree.tableview.mitigations")}
                </TableSortLabel>
              </TableCell>
              <TableCell align="center">
                {t("attacktree:tabs.attacktree.tableview.status")}
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
                        {t("attacktree:tabs.attacktree.tableview.none")}
                      </Typography>
                    )}
                  </Box>
                </TableCell>
                <TableCell align="center">
                  {path.isCritical && (
                    <Chip
                      label={t(
                        "attacktree:tabs.attacktree.tableview.critical3",
                      )}
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
            {t("attacktree:tabs.attacktree.tableview.noPathsMatchYourFilters")}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default AttackTreeTableView;