// ==================== ATTACK TREE TABLE VIEW ====================
// Tabular view of attack paths — now on the shared DataTable, so it looks and
// behaves like the Risk and Threat tables instead of merely resembling them.
//
// The bespoke <Table> that used to live here is gone; what remains is what is
// genuinely this view's own: the filter bar, the summary chips, and the
// filtering/sorting of paths. Column definitions live in
// attacktree-path-columns.tsx, the table itself in shared.
//
// This is the deciding surface of the tab (see attacktree-ui-rework-design.md):
// where relevance props are supplied, each path can be confirmed or dismissed
// here. Structure and leaf ratings stay in the DSL — a leaf lies on several
// paths, so editing a rating "on a path" has no single meaning.

import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  Chip,
  Typography,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
} from "@mui/material";
import { DataTable } from "shared";
import {
  PathAnalysis,
  AttackPath,
  EvaluationMethod,
  MitigationReference,
  AttackPathAssessment,
  calculateRiskLevel,
} from "../models/attacktree-types";
import type { LikelihoodModel } from "../models/attacktree-feasibility-types";
import { useAttackTreePathColumns } from "./attacktree-path-columns";
import { FEASIBILITY_RANK } from "../models/attacktree-feasibility-types";

// ==================== TYPES ====================

interface AttackTreeTableViewProps {
  pathAnalysis: PathAnalysis;
  evaluationMethod: EvaluationMethod;
  /**
   * Lookup of mitigation id → reference (status/ticket/text), mirrored from
   * the Risk tab. Optional: when absent, mitigations render as plain id chips.
   * Keyed by UPPERCASE id for case-insensitive matching.
   */
  mitigationLookup?: Map<string, MitigationReference>;
  /**
   * Project likelihood model. "feasibility-only" (ISO) hides the path risk
   * score — there the number belongs to the risk, not the path.
   */
  likelihoodModel?: LikelihoodModel;

  /**
   * Relevance editing. Supplied together or not at all; without them the table
   * is read-only and the relevance column does not appear.
   */
  treeId?: string;
  assessments?: AttackPathAssessment[];
  onAssessmentsChange?: (next: AttackPathAssessment[]) => void;
}

type SortField = "feasibility" | "path" | "risk" | "mitigations";
type SortOrder = "asc" | "desc";

// ==================== COMPONENT ====================

export const AttackTreeTableView: React.FC<AttackTreeTableViewProps> = ({
  pathAnalysis,
  evaluationMethod,
  mitigationLookup,
  likelihoodModel,
  treeId,
  assessments,
  onAssessmentsChange,
}) => {
  const { t } = useTranslation();

  const [searchTerm, setSearchTerm] = useState("");
  const [filterLevel, setFilterLevel] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("feasibility");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const columns = useAttackTreePathColumns({
    evaluationMethod,
    mitigationLookup,
    likelihoodModel,
    treeId,
    assessments,
    onAssessmentsChange,
  });

  const filteredPaths = useMemo(() => {
    let filtered = [...pathAnalysis.paths];

    if (searchTerm) {
      filtered = filtered.filter((path) =>
        path.path.some((node) =>
          node.toLowerCase().includes(searchTerm.toLowerCase()),
        ),
      );
    }

    if (filterLevel !== "all") {
      filtered = filtered.filter(
        (path) =>
          calculateRiskLevel(path.riskScore, evaluationMethod).level ===
          filterLevel,
      );
    }

    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "feasibility": {
          // Most feasible first — the row order now carries what the colour
          // used to. Unrated paths (no level) sort to the bottom.
          const ra =
            a.feasibilityLevel !== undefined
              ? FEASIBILITY_RANK[a.feasibilityLevel]
              : -1;
          const rb =
            b.feasibilityLevel !== undefined
              ? FEASIBILITY_RANK[b.feasibilityLevel]
              : -1;
          comparison = ra - rb;
          break;
        }
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

        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>
            {t("attacktree:tabs.attacktree.tableview.sortBy", {
              defaultValue: "Sort by",
            })}
          </InputLabel>
          <Select
            value={`${sortField}:${sortOrder}`}
            label={t("attacktree:tabs.attacktree.tableview.sortBy", {
              defaultValue: "Sort by",
            })}
            onChange={(e) => {
              const [field, order] = e.target.value.split(":");
              setSortField(field as SortField);
              setSortOrder(order as SortOrder);
            }}
          >
            <MenuItem value="feasibility:desc">
              {t("attacktree:tabs.attacktree.tableview.feasibility", {
                defaultValue: "Feasibility",
              })}{" "}
              ↓
            </MenuItem>
            <MenuItem value="feasibility:asc">
              {t("attacktree:tabs.attacktree.tableview.feasibility", {
                defaultValue: "Feasibility",
              })}{" "}
              ↑
            </MenuItem>
            <MenuItem value="risk:desc">
              {t("attacktree:tabs.attacktree.tableview.riskScore")} ↓
            </MenuItem>
            <MenuItem value="risk:asc">
              {t("attacktree:tabs.attacktree.tableview.riskScore")} ↑
            </MenuItem>
            <MenuItem value="path:asc">
              {t("attacktree:tabs.attacktree.tableview.attackPath")} A–Z
            </MenuItem>
            <MenuItem value="mitigations:desc">
              {t("attacktree:tabs.attacktree.tableview.mitigations")} ↓
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
      <Box sx={{ flexGrow: 1, overflow: "auto" }}>
        <DataTable<AttackPath>
          rows={filteredPaths}
          columns={columns}
          getRowId={(path) => path.pathKey}
        />
      </Box>

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