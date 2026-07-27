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
  IconButton,
  Tooltip,
} from "@mui/material";
import type { StrideCategory } from "shared";
import { FilterList as FilterListIcon } from "@mui/icons-material";
import { DataTable } from "shared";
import {
  PathAnalysis,
  AttackPath,
  EvaluationMethod,
  MitigationReference,
  AttackPathAssessment,
  calculateRiskLevel,
} from "../models/attacktree-types";
import type {
  LikelihoodModel,
  FeasibilityLevel,
} from "../models/attacktree-feasibility-types";
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
  mitigationCatalog?: readonly { id: string; text: string }[];
  verificationCatalog?: readonly { id: string; text: string }[];

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

  /**
   * Threat-anchored trees only — see AttackTree.primaryPathKey. Pass
   * anchorStrideCategory + primaryPathKey to show which path is primary;
   * add onSetPrimaryPath to make the control interactive (kept separate from
   * onAssessmentsChange so the Overview can show the choice without letting
   * the card become an editor, same split as relevance).
   */
  anchorStrideCategory?: StrideCategory;
  primaryPathKey?: string;
  onSetPrimaryPath?: (pathKey: string) => void;
  suggestedPrimaryPathKey?: string;
  /** Opens the per-path assessment dialog (row click, except the star cell). */
  onOpenPath?: (pathKey: string) => void;

  /**
   * Filter-bar visibility, controlled by the caller. Pass BOTH props to
   * control it (e.g. the Overview card toggles it from its own action row,
   * next to Delete); omit both and the component manages it internally
   * (the Table view's default — see filterTogglePlacement).
   */
  showFilters?: boolean;
  onToggleFilters?: () => void;
  /**
   * Where the filter-toggle button renders.
   * "inline" (default): first control in the filter row, before the level
   * dropdown — for the Table view, where this is the only per-tree chrome
   * on screen.
   * "external": no toggle rendered here at all — the caller places
   * <AttackTreeFilterToggle> itself, e.g. in the Overview card's icon row.
   */
  filterTogglePlacement?: "inline" | "external";
}

/** Standalone toggle button, so a caller (e.g. the Overview card) can place
 * it wherever fits instead of inside this component's own filter row. */
export const AttackTreeFilterToggle: React.FC<{
  showFilters: boolean;
  onToggle: () => void;
}> = ({ showFilters, onToggle }) => {
  const { t } = useTranslation();
  return (
    <Tooltip
      title={
        showFilters
          ? t("attacktree:tabs.attacktree.tableview.hideFilters", {
              defaultValue: "Hide filters",
            })
          : t("attacktree:tabs.attacktree.tableview.showFilters", {
              defaultValue: "Show filters",
            })
      }
    >
      <IconButton size="small" onClick={onToggle}>
        <FilterListIcon
          fontSize="small"
          color={showFilters ? "primary" : "inherit"}
        />
      </IconButton>
    </Tooltip>
  );
};

type SortField = "feasibility" | "path" | "risk" | "mitigations";
type SortOrder = "asc" | "desc";

// ==================== COMPONENT ====================

export const AttackTreeTableView: React.FC<AttackTreeTableViewProps> = ({
  pathAnalysis,
  evaluationMethod,
  mitigationLookup,
  mitigationCatalog,
  verificationCatalog,
  likelihoodModel,
  treeId,
  assessments,
  onAssessmentsChange,
  anchorStrideCategory,
  primaryPathKey,
  onSetPrimaryPath,
  suggestedPrimaryPathKey,
  onOpenPath,
  showFilters: showFiltersProp,
  onToggleFilters,
  filterTogglePlacement = "inline",
}) => {
  const { t } = useTranslation();

  const [searchTerm, setSearchTerm] = useState("");
  const [filterLevel, setFilterLevel] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("feasibility");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // Controlled when the caller supplies both props (Overview card, toggling
  // from its own icon row); otherwise this manages its own visibility, which
  // is what the Table view relies on today.
  const [internalShowFilters, setInternalShowFilters] = useState(true);
  const isControlled = showFiltersProp !== undefined && !!onToggleFilters;
  const showFilters = isControlled ? showFiltersProp! : internalShowFilters;
  const toggleFilters = isControlled
    ? onToggleFilters!
    : () => setInternalShowFilters((v) => !v);

  // ISO (feasibility-only): the tree carries no risk score of its own — that
  // number belongs to the risk (feasibility × impact, Cl. 3.1.29), computed
  // downstream from the damage scenario. path.riskScore is therefore 0/unset
  // here, so filtering or averaging on it silently degenerates (every path
  // reads as "low", average/max both show 0.0). Filter and summarise on
  // feasibilityLevel instead in this mode; the risk-score filter and the
  // average/max chips only make sense in IEC 62443 / classic mode.
  const isFeasibilityMode = likelihoodModel !== "feasibility-x-motivation";

  // Feasibility levels for the filter dropdown, most feasible first — same
  // ordering as the default sort, derived from FEASIBILITY_RANK rather than
  // hardcoded so it can't drift from the actual level set.
  const feasibilityLevelOptions = useMemo(
    () =>
      (Object.keys(FEASIBILITY_RANK) as FeasibilityLevel[]).sort(
        (a, b) => FEASIBILITY_RANK[b] - FEASIBILITY_RANK[a],
      ),
    [],
  );

  const columns = useAttackTreePathColumns({
    evaluationMethod,
    mitigationLookup,
    mitigationCatalog,
    verificationCatalog,
    likelihoodModel,
    treeId,
    assessments,
    onAssessmentsChange,
    anchorStrideCategory,
    primaryPathKey,
    onSetPrimaryPath,
    suggestedPrimaryPathKey,
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
      filtered = isFeasibilityMode
        ? filtered.filter((path) => path.feasibilityLevel === filterLevel)
        : filtered.filter(
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
    isFeasibilityMode,
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
      {/* One line, no wrap — narrow viewports scroll horizontally instead of
          breaking into a second row. Level filter and average/max only make
          sense where the tree carries its own risk score (IEC 62443 /
          classic); in ISO/feasibility-only mode they are swapped for the
          feasibility level, which IS computed here — see isFeasibilityMode
          above. */}
      <Box
        sx={{
          display: "flex",
          flexWrap: "nowrap",
          alignItems: "center",
          gap: 1.5,
          p: 1.5,
          backgroundColor: "grey.50",
          borderBottom: "1px solid",
          borderColor: "divider",
          overflowX: "auto",
        }}
      >
        {filterTogglePlacement === "inline" && (
          <Box sx={{ flexShrink: 0 }}>
            <AttackTreeFilterToggle
              showFilters={showFilters}
              onToggle={toggleFilters}
            />
          </Box>
        )}

        {showFilters && (
          <>
            <TextField
              size="small"
              placeholder={t("attacktree:tabs.attacktree.tableview.search")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{ minWidth: 160, flexShrink: 0 }}
            />

            <FormControl size="small" sx={{ minWidth: 140, flexShrink: 0 }}>
              <InputLabel>
                {isFeasibilityMode
                  ? t("attacktree:tabs.attacktree.tableview.feasibility", {
                      defaultValue: "Feasibility",
                    })
                  : t("attacktree:tabs.attacktree.tableview.riskLevel")}
              </InputLabel>
              <Select
                value={filterLevel}
                label={
                  isFeasibilityMode
                    ? t("attacktree:tabs.attacktree.tableview.feasibility", {
                        defaultValue: "Feasibility",
                      })
                    : t("attacktree:tabs.attacktree.tableview.riskLevel")
                }
                onChange={(e) => setFilterLevel(e.target.value)}
              >
                <MenuItem value="all">
                  {t("attacktree:tabs.attacktree.tableview.all")}
                </MenuItem>
                {isFeasibilityMode
                  ? feasibilityLevelOptions.map((level) => (
                      <MenuItem key={level} value={level}>
                        {t(
                          `attacktree:tabs.attacktree.feasibility.level.${level}`,
                        )}
                      </MenuItem>
                    ))
                  : [
                      <MenuItem key="critical" value="critical">
                        {t("attacktree:tabs.attacktree.tableview.critical3")}
                      </MenuItem>,
                      <MenuItem key="high" value="high">
                        {t("attacktree:tabs.attacktree.tableview.high")}
                      </MenuItem>,
                      <MenuItem key="medium" value="medium">
                        {t("attacktree:tabs.attacktree.tableview.medium")}
                      </MenuItem>,
                      <MenuItem key="low" value="low">
                        {t("attacktree:tabs.attacktree.tableview.low")}
                      </MenuItem>,
                    ]}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 140, flexShrink: 0 }}>
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
          </>
        )}

        <Box
          sx={{
            display: "flex",
            flexWrap: "nowrap",
            gap: 1,
            flexShrink: 0,
            ml: "auto",
            pl: 1.5,
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
          {!isFeasibilityMode && (
            <>
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
            </>
          )}
        </Box>
      </Box>

      {/* Table */}
      <Box sx={{ flexGrow: 1, overflow: "auto" }}>
        <DataTable<AttackPath>
          rows={filteredPaths}
          columns={columns}
          getRowId={(path) => path.pathKey}
          onRowClick={
            onOpenPath ? (path) => onOpenPath(path.pathKey) : undefined
          }
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