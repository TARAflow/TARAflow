// src/features/attacktree/components/attacktree-detail-view.tsx
//
// The detail half of the Attack Tree tab: one tree, shown either as DSL +
// preview or as a path table, with the threat list underneath.
//
// Extracted from attacktree-tab2.tsx (where it was the inline
// AttackTreeEditorView) and restructured per attacktree-ui-rework-design.md §3:
//
//   - The TREE SELECTOR lives here, in the detail header, so it is available in
//     both views. It used to be a dropdown inside the editor and vanished in
//     the table — where switching trees is just as necessary.
//   - The THREAT LIST stays visible in both views. It is the gate between a
//     rated path and a risk (collectAllThreats drops unrated / not_relevant),
//     so hiding it behind one view is what made 5a look broken.
//   - Both dividers are draggable, and their positions are owned by the caller
//     (useAttackTreeUI persists them) rather than by the resize hook.
//
// Switching to the table forces a parse: handleDslChange debounces by 500 ms,
// so without it the table would show the analysis from before the last edit.

import React from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  FormControl,
  ListSubheader,
  MenuItem,
  Select,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  Code as EditorIcon,
  TableChart as TableIcon,
  CheckCircle as ValidIcon,
  Error as InvalidIcon,
} from "@mui/icons-material";
import { useSplitPercentResize } from "shared";
import type { MitigationReference } from "../models/attacktree-types";
import {
  AttackTree,
  AttackPathAssessment,
  getAnchorTypeIcon,
} from "../models/attacktree-types";
import type { LikelihoodModel } from "../models/attacktree-feasibility-types";
import { FEASIBILITY_RANK } from "../models/attacktree-feasibility-types";
import { AttackTreeEditor } from "./attacktree-editor";
import { AttackTreePreview } from "./attacktree-preview";
import { AttackTreeTableView } from "./attacktree-tableview";
import { AttackTreeThreatTable } from "./attacktree-threat-table";
import {
  generateThreatsFromAttackTree,
  strideCategoriesForPath,
} from "../services/attacktree-threat-generator";
import { applyAssessmentsToThreats } from "../services/attacktree-threat-sync";

export type DetailView = "editor" | "table";

const MIN_PANEL_WIDTH = 220;

// ==================== PROPS ====================

export interface AttackTreeDetailViewProps {
  selectedTree: AttackTree;
  /** All trees, for the selector. */
  trees: AttackTree[];
  onSelectTree: (treeId: string) => void;

  localDsl: string;
  handleDslChange: (dsl: string) => void;
  /** Forces the debounced parse — called before switching to the table. */
  parseImmediately: () => void;

  detailView: DetailView;
  onDetailViewChange: (view: DetailView) => void;

  editorCollapsed: boolean;
  toggleEditorCollapsed: () => void;

  /** Editor|preview divider, in percent. Owned and persisted by the caller. */
  editorWidthPercent: number;
  onEditorWidthPercentChange: (percent: number) => void;
  /** Content|threat-list divider, in percent of the detail height. */
  threatPanelPercent: number;
  onThreatPanelPercentChange: (percent: number) => void;

  mitigationLookup: Map<string, MitigationReference>;
  likelihoodModel: LikelihoodModel;

  /**
   * 5a workflow: persist the analyst's confirm/dismiss/uncertain decisions on
   * the emitted attack-path threats. The parent writes them onto the tree via
   * updateTree, which reaches disk through the existing auto-save path.
   */
  onAssessmentsChange: (next: AttackPathAssessment[]) => void;

  /**
   * Threat-anchored trees only — persists AttackTree.primaryPathKey (see its
   * doc comment). Same auto-save path as onAssessmentsChange. Undefined
   * anchor.strideCategory (asset-anchored trees) means the Table view never
   * shows the Primary column at all, so this is never called for them.
   */
  onSetPrimaryPath: (pathKey: string) => void;
}

// ==================== SELECTOR ====================

/** Group label for a tree — asset × security goal, the ISO ordering. */
function groupLabelFor(tree: AttackTree): string {
  if (tree.anchor.type === "asset") {
    return tree.anchor.assetName
      ? `${tree.anchor.assetName}${tree.anchor.securityGoal ? ` · ${tree.anchor.securityGoal}` : ""}`
      : "Asset";
  }
  if (tree.anchor.type === "threat") {
    return tree.anchor.threatId ?? "Threat";
  }
  return tree.anchor.type;
}

// ==================== COMPONENT ====================

export const AttackTreeDetailView = React.memo<AttackTreeDetailViewProps>(
  ({
    selectedTree,
    trees,
    onSelectTree,
    localDsl,
    handleDslChange,
    parseImmediately,
    detailView,
    onDetailViewChange,
    editorCollapsed,
    toggleEditorCollapsed,
    editorWidthPercent,
    onEditorWidthPercentChange,
    threatPanelPercent,
    onThreatPanelPercentChange,
    mitigationLookup,
    likelihoodModel,
    onAssessmentsChange,
    onSetPrimaryPath,
  }) => {
    const { t } = useTranslation();

    // Memoize validation errors to prevent a new array on every render
    const validationErrors = React.useMemo(
      () => selectedTree.validation?.errors || [],
      [selectedTree.validation?.errors],
    );

    // Emitted threats are DERIVED, never persisted: the generator is
    // deterministic (same tree → same threats, same ids), so we regenerate and
    // lay the stored decisions over them. Only the decision is state.
    const emittedThreats = React.useMemo(() => {
      if (selectedTree.anchor.type !== "asset") return [];
      const { threats } = generateThreatsFromAttackTree(selectedTree);
      return applyAssessmentsToThreats(
        selectedTree,
        threats,
        selectedTree.pathAssessments ?? [],
      );
    }, [
      selectedTree.id,
      selectedTree.anchor.type,
      selectedTree.pathAnalysis,
      selectedTree.pathAssessments,
    ]);

    const showThreatPanel = selectedTree.anchor.type === "asset";

    // Threat-anchored only. Suggestion, never persisted: the most feasible
    // path that actually reaches the anchor's own STRIDE effect, shown as a
    // hint (outlined, "suggested" tooltip) until the analyst clicks it — see
    // Juergen's ask to pre-highlight rather than auto-pick, so an existing
    // project never silently gains a primaryPathKey it never had.
    const suggestedPrimaryPathKey = React.useMemo(() => {
      if (selectedTree.primaryPathKey) return undefined; // already decided
      const stride = selectedTree.anchor.strideCategory;
      if (!stride || !selectedTree.pathAnalysis) return undefined;

      let best: { pathKey: string; rank: number } | undefined;
      for (const path of selectedTree.pathAnalysis.paths) {
        if (!path.feasibilityLevel) continue;
        if (!strideCategoriesForPath(path).includes(stride)) continue;
        const rank = FEASIBILITY_RANK[path.feasibilityLevel];
        if (!best || rank > best.rank) {
          best = { pathKey: path.pathKey, rank };
        }
      }
      return best?.pathKey;
    }, [
      selectedTree.primaryPathKey,
      selectedTree.anchor.strideCategory,
      selectedTree.pathAnalysis,
    ]);

    // ── Dividers ──────────────────────────────────────────────────────────
    const editorSplit = useSplitPercentResize({
      percent: editorWidthPercent,
      onChange: onEditorWidthPercentChange,
      axis: "horizontal",
      min: 20,
      max: 80,
    });

    const threatSplit = useSplitPercentResize({
      percent: 100 - threatPanelPercent,
      onChange: (p) => onThreatPanelPercentChange(100 - p),
      axis: "vertical",
      min: 25,
      max: 85,
    });

    // ── View switch ───────────────────────────────────────────────────────
    const handleViewChange = (next: DetailView | null) => {
      if (!next || next === detailView) return;
      // The parse is debounced by 500 ms; without forcing it the table would
      // render the analysis from before the last keystroke.
      if (next === "table") parseImmediately();
      onDetailViewChange(next);
    };

    // ── Grouped selector options ──────────────────────────────────────────
    const groupedTrees = React.useMemo(() => {
      const groups = new Map<string, AttackTree[]>();
      for (const tree of trees) {
        const label = groupLabelFor(tree);
        const list = groups.get(label) ?? [];
        list.push(tree);
        groups.set(label, list);
      }
      return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
    }, [trees]);

    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          overflow: "hidden",
        }}
      >
        {/* ── Detail header: selector + view switch ───────────────────── */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            px: 2,
            py: 1,
            borderBottom: "1px solid",
            borderColor: "divider",
            flexShrink: 0,
          }}
        >
          <FormControl size="small" sx={{ minWidth: 280 }}>
            <Select
              value={selectedTree.id}
              onChange={(e) => onSelectTree(e.target.value)}
              displayEmpty
            >
              {groupedTrees.flatMap(([label, groupTrees]) => [
                <ListSubheader key={`h-${label}`}>{label}</ListSubheader>,
                ...groupTrees.map((tree) => (
                  <MenuItem key={tree.id} value={tree.id}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <span>{getAnchorTypeIcon(tree.anchor.type)}</span>
                      <span>{tree.name}</span>
                      {tree.validation?.isValid ? (
                        <ValidIcon fontSize="small" color="success" />
                      ) : (
                        <InvalidIcon fontSize="small" color="error" />
                      )}
                    </Box>
                  </MenuItem>
                )),
              ])}
            </Select>
          </FormControl>

          <Box sx={{ flexGrow: 1 }} />

          <ToggleButtonGroup
            size="small"
            exclusive
            value={detailView}
            onChange={(_e, next) => handleViewChange(next as DetailView | null)}
          >
            <ToggleButton value="editor">
              <Tooltip
                title={t("attacktree:tabs.attacktree.detail.editorView", {
                  defaultValue: "Editor",
                })}
              >
                <EditorIcon fontSize="small" />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="table">
              <Tooltip
                title={t("attacktree:tabs.attacktree.detail.tableView", {
                  defaultValue: "Table",
                })}
              >
                <TableIcon fontSize="small" />
              </Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {/* ── Split area: content over threat list ────────────────────
            Its own box, and the one the divider measures against — the header
            must not count towards the percentages.

            The panes use flexBasis rather than height: their bases add up to
            100% but the divider also takes 6px, so the two must be allowed to
            shrink. With `height` they could not, and the browser squeezed
            whichever pane had the smaller min-content — which collapsed the
            content area in table view while looking fine in editor view. */}
        <Box
          ref={threatSplit.containerRef}
          sx={{
            flexGrow: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* ── Content ─────────────────────────────────────────────────── */}
          <Box
            sx={{
              flexBasis: showThreatPanel
                ? `${100 - threatPanelPercent}%`
                : "100%",
              flexGrow: showThreatPanel ? 0 : 1,
              flexShrink: 1,
              minHeight: 0,
              display: "flex",
              overflow: "hidden",
            }}
          >
            {detailView === "editor" ? (
              <Box
                ref={editorSplit.containerRef}
                sx={{ display: "flex", width: "100%", minHeight: 0 }}
              >
                {/* Editor pane */}
                <Box
                  sx={{
                    width: editorCollapsed ? "40px" : `${editorWidthPercent}%`,
                    minWidth: editorCollapsed ? "40px" : MIN_PANEL_WIDTH,
                    height: "100%",
                    transition: editorSplit.isResizing ? "none" : "width 0.2s",
                    borderRight: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  <AttackTreeEditor
                    dsl={localDsl}
                    configuration={selectedTree.configuration}
                    validation={validationErrors}
                    collapsed={editorCollapsed}
                    onDslChange={handleDslChange}
                    onToggleCollapse={toggleEditorCollapsed}
                  />
                </Box>

                {/* Vertical drag handle — hidden while collapsed, since there is
                  nothing to resize then. */}
                {!editorCollapsed && (
                  <Box
                    onMouseDown={editorSplit.handleMouseDown}
                    sx={{
                      width: "6px",
                      flexShrink: 0,
                      cursor: "col-resize",
                      bgcolor: editorSplit.isResizing
                        ? "primary.main"
                        : "divider",
                      "&:hover": { bgcolor: "primary.light" },
                    }}
                  />
                )}

                {/* Preview pane.
                  minWidth: 0 is load-bearing, not tidiness: a flex item
                  defaults to min-width:auto and then refuses to shrink below
                  its content. The preview's own Table View contains the
                  DataTable, which carries a minWidth of ~700px — so without
                  this the pane could not be narrowed and the divider looked
                  dead in that mode while working fine in Tree View. */}
                <Box
                  sx={{
                    flexGrow: 1,
                    minWidth: 0,
                    height: "100%",
                    overflow: "hidden",
                  }}
                >
                  <AttackTreePreview
                    ast={selectedTree.ast}
                    pathAnalysis={selectedTree.pathAnalysis}
                    evaluationMethod={
                      selectedTree.configuration.evaluationMethod
                    }
                    highlightCriticalPath={
                      selectedTree.configuration.highlightCriticalPath
                    }
                    mitigationLookup={mitigationLookup}
                    onNodeSelect={() => {}}
                  />
                </Box>
              </Box>
            ) : selectedTree.pathAnalysis &&
              selectedTree.pathAnalysis.paths.length > 0 ? (
              <Box sx={{ flexGrow: 1, minWidth: 0, minHeight: 0 }}>
                <AttackTreeTableView
                  pathAnalysis={selectedTree.pathAnalysis}
                  evaluationMethod={selectedTree.configuration.evaluationMethod}
                  mitigationLookup={mitigationLookup}
                  likelihoodModel={likelihoodModel}
                  treeId={selectedTree.id}
                  assessments={selectedTree.pathAssessments ?? []}
                  onAssessmentsChange={onAssessmentsChange}
                  anchorStrideCategory={selectedTree.anchor.strideCategory}
                  primaryPathKey={selectedTree.primaryPathKey}
                  onSetPrimaryPath={onSetPrimaryPath}
                  suggestedPrimaryPathKey={suggestedPrimaryPathKey}
                />
              </Box>
            ) : (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "100%",
                }}
              >
                <Typography color="text.secondary">
                  {t("attacktree:tabs.attacktree.tab.noPathAnalysisAvailable")}
                </Typography>
              </Box>
            )}
          </Box>

          {/* ── Threat list — asset-anchored trees only ──────────────────── */}
          {showThreatPanel && (
            <>
              <Box
                onMouseDown={threatSplit.handleMouseDown}
                sx={{
                  height: "6px",
                  flexShrink: 0,
                  cursor: "row-resize",
                  bgcolor: threatSplit.isResizing ? "primary.main" : "divider",
                  "&:hover": { bgcolor: "primary.light" },
                }}
              />
              <Box
                sx={{
                  flexBasis: `${threatPanelPercent}%`,
                  flexGrow: 0,
                  flexShrink: 1,
                  minHeight: 0,
                  overflow: "auto",
                }}
              >
                <AttackTreeThreatTable
                  treeId={selectedTree.id}
                  threats={emittedThreats}
                  assessments={selectedTree.pathAssessments ?? []}
                  onAssessmentsChange={onAssessmentsChange}
                />
              </Box>
            </>
          )}
        </Box>
      </Box>
    );
  },

  // Custom comparison — only re-render on props that change what is displayed.
  (prev, next) => {
    if (prev.selectedTree.id !== next.selectedTree.id) return false;
    if (prev.localDsl !== next.localDsl) return false;
    if (prev.detailView !== next.detailView) return false;
    if (prev.editorCollapsed !== next.editorCollapsed) return false;
    if (prev.editorWidthPercent !== next.editorWidthPercent) return false;
    if (prev.threatPanelPercent !== next.threatPanelPercent) return false;
    if (prev.likelihoodModel !== next.likelihoodModel) return false;
    if (prev.trees !== next.trees) return false;

    // Validation drives the editor's notification panel and its linter; both
    // only update during a render (see the b116292 fix).
    if (
      JSON.stringify(prev.selectedTree.validation?.errors) !==
      JSON.stringify(next.selectedTree.validation?.errors)
    ) {
      return false;
    }

    // Path analysis identity — the preview and the table both read it.
    if (prev.selectedTree.pathAnalysis !== next.selectedTree.pathAnalysis) {
      return false;
    }

    // A recorded relevance decision must reach the toggle groups, or the click
    // persists while the UI stays on its old value.
    if (
      prev.selectedTree.pathAssessments !== next.selectedTree.pathAssessments
    ) {
      return false;
    }

    // Same reasoning for the primary-path star — a click must show up
    // immediately, not just after some unrelated prop happens to change.
    if (prev.selectedTree.primaryPathKey !== next.selectedTree.primaryPathKey) {
      return false;
    }

    return true;
  },
);

AttackTreeDetailView.displayName = "AttackTreeDetailView";
export default AttackTreeDetailView;