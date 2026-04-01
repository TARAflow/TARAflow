// ==================== ATTACK TREE PREVIEW ====================
// D3.js based tree visualization with zoom, pan, and critical path highlighting

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  IconButton,
  Tooltip,
  ToggleButtonGroup,
  ToggleButton,
  Paper,
  Typography,
  Chip,
  Divider,
} from "@mui/material";
import {
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  CenterFocusStrong as FitIcon,
  Download as ExportIcon,
  TableChart as TableIcon,
  AccountTree as TreeIcon,
  Warning as WarningIcon,
} from "@mui/icons-material";
import * as d3 from "d3";

import {
  AttackTreeNode,
  PathAnalysis,
  EvaluationMethod,
  calculateRiskLevel,
  getNodeTypeColor,
  getRiskScoreEmoji,
  getAttackGoalColor,
  AttackGoalCategory,
} from "../models/attacktree-types";
import { AttackTreeTableView } from "./attacktree-tableview";

// ==================== TYPES ====================

interface AttackTreePreviewProps {
  ast: AttackTreeNode | undefined;
  pathAnalysis: PathAnalysis | undefined;
  evaluationMethod: EvaluationMethod;
  highlightCriticalPath: boolean;
  onNodeSelect?: (node: AttackTreeNode) => void;
}

type ViewMode = "tree" | "table";

interface D3Node extends d3.HierarchyPointNode<AttackTreeNode> {
  _children?: D3Node[];
}

// ==================== COMPONENT ====================

export const AttackTreePreview: React.FC<AttackTreePreviewProps> = ({
  ast,
  pathAnalysis,
  evaluationMethod,
  highlightCriticalPath,
  onNodeSelect,
}) => {
  const { t, i18n } = useTranslation();
  const isGerman = i18n.language === "de";

  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderTreeRef = useRef<(() => void) | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>("tree");
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [currentTransform, setCurrentTransform] = useState<d3.ZoomTransform>(
    d3.zoomIdentity,
  );
  React.useEffect(() => {
    console.log("🔥 AttackTreePreview MOUNT");
    return () => console.log("❌ AttackTreePreview UNMOUNT");
  }, []);
  // ==================== D3 TREE RENDERING ====================

  const renderTree = useCallback(() => {
    if (!svgRef.current || !containerRef.current || !ast) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Clear previous content
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3
      .select(svgRef.current)
      .attr("width", width)
      .attr("height", height);

    // Create container group for zoom/pan
    const g = svg.append("g").attr("class", "tree-container");

    // Create hierarchy
    const root = d3.hierarchy(ast) as D3Node;

    // Calculate tree layout
    const treeLayout = d3
      .tree<AttackTreeNode>()
      .nodeSize([120, 180])
      .separation((a, b) => (a.parent === b.parent ? 1 : 1.5));

    treeLayout(root);

    // Calculate bounds
    let minX = Infinity,
      maxX = -Infinity;
    let minY = Infinity,
      maxY = -Infinity;
    root.descendants().forEach((d) => {
      minX = Math.min(minX, d.x);
      maxX = Math.max(maxX, d.x);
      minY = Math.min(minY, d.y);
      maxY = Math.max(maxY, d.y);
    });

    // Center the tree
    const treeWidth = maxX - minX + 200;
    const treeHeight = maxY - minY + 200;
    const initialX = (width - treeWidth) / 2 - minX + 100;
    const initialY = 50;

    g.attr("transform", `translate(${initialX}, ${initialY})`);

    // Draw links
    const linkGenerator = d3
      .linkVertical<
        d3.HierarchyLink<AttackTreeNode>,
        d3.HierarchyPointNode<AttackTreeNode>
      >()
      .x((d) => d.x)
      .y((d) => d.y);

    g.selectAll(".link")
      .data(root.links())
      .enter()
      .append("path")
      .attr("class", "link")
      .attr("d", (d) => linkGenerator(d as any))
      .attr("fill", "none")
      .attr("stroke", (d) => {
        // Highlight critical path
        if (
          highlightCriticalPath &&
          (d.source.data as AttackTreeNode).criticalPath &&
          (d.target.data as AttackTreeNode).criticalPath
        ) {
          return "#d32f2f";
        }
        return "#999";
      })
      .attr("stroke-width", (d) => {
        if (
          highlightCriticalPath &&
          (d.source.data as AttackTreeNode).criticalPath &&
          (d.target.data as AttackTreeNode).criticalPath
        ) {
          return 3;
        }
        return 1.5;
      })
      .attr("stroke-opacity", 0.6);

    // Draw nodes
    const nodeGroups = g
      .selectAll(".node")
      .data(root.descendants())
      .enter()
      .append("g")
      .attr("class", "node")
      .attr("transform", (d) => `translate(${d.x}, ${d.y})`)
      .style("cursor", "pointer")
      .on("click", (event, d) => {
        event.stopPropagation();
        if (onNodeSelect) {
          onNodeSelect(d.data);
        }
      });

    // Node background
    nodeGroups
      .append("rect")
      .attr("x", -55)
      .attr("y", -25)
      .attr("width", 110)
      .attr("height", 50)
      .attr("rx", 8)
      .attr("ry", 8)
      .attr("fill", (d) => {
        // Critical path highlight
        if (highlightCriticalPath && d.data.criticalPath) {
          return "#ffebee";
        }
        return "#fff";
      })
      .attr("stroke", (d) => getNodeTypeColor(d.data.type))
      .attr("stroke-width", (d) => {
        if (highlightCriticalPath && d.data.criticalPath) {
          return 3;
        }
        return 2;
      });

    // Node type badge
    nodeGroups
      .append("rect")
      .attr("x", -55)
      .attr("y", -25)
      .attr("width", 35)
      .attr("height", 16)
      .attr("rx", 4)
      .attr("fill", (d) => getNodeTypeColor(d.data.type));

    nodeGroups
      .append("text")
      .attr("x", -37)
      .attr("y", -13)
      .attr("text-anchor", "middle")
      .attr("fill", "white")
      .attr("font-size", "10px")
      .attr("font-weight", "bold")
      .text((d) => d.data.type);

    // Attack goal badge (if present)
    nodeGroups
      .filter((d) => Boolean(d.data.attackGoal))
      .append("rect")
      .attr("x", 20)
      .attr("y", -25)
      .attr("width", 35)
      .attr("height", 16)
      .attr("rx", 4)
      .attr("fill", (d) => getAttackGoalColor(d.data.attackGoal!));

    nodeGroups
      .filter((d) => Boolean(d.data.attackGoal))
      .append("text")
      .attr("x", 37)
      .attr("y", -13)
      .attr("text-anchor", "middle")
      .attr("fill", "white")
      .attr("font-size", "8px")
      .attr("font-weight", "bold")
      .text((d) => getGoalAbbreviation(d.data.attackGoal!));

    // Node name
    nodeGroups
      .append("text")
      .attr("x", 0)
      .attr("y", 2)
      .attr("text-anchor", "middle")
      .attr("font-size", "11px")
      .attr("font-weight", "500")
      .text((d) => truncateText(d.data.name, 14));

    // Risk score (for leaf nodes)
    nodeGroups
      .filter((d) => d.data.riskScore !== undefined && d.data.riskScore > 0)
      .append("text")
      .attr("x", 0)
      .attr("y", 18)
      .attr("text-anchor", "middle")
      .attr("font-size", "10px")
      .attr("fill", (d) => {
        const result = calculateRiskLevel(d.data.riskScore!, evaluationMethod);
        return result.color;
      })
      .text((d) => {
        const result = calculateRiskLevel(d.data.riskScore!, evaluationMethod);
        return `${getRiskScoreEmoji(result.level)} ${d.data.riskScore!.toFixed(
          1,
        )}`;
      });

    // Mitigation indicator
    nodeGroups
      .filter((d) => d.data.mitigations.length > 0)
      .append("circle")
      .attr("cx", 50)
      .attr("cy", -20)
      .attr("r", 8)
      .attr("fill", "#4caf50");

    nodeGroups
      .filter((d) => d.data.mitigations.length > 0)
      .append("text")
      .attr("x", 50)
      .attr("y", -16)
      .attr("text-anchor", "middle")
      .attr("font-size", "10px")
      .attr("fill", "white")
      .attr("font-weight", "bold")
      .text((d) => d.data.mitigations.length);

    // Setup zoom
    const zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        // 🔒 Guard: SVG / g kann beim Re-Render kurz weg sein
        if (!g.node()) return;

        g.attr(
          "transform",
          `translate(${event.transform.x + initialX}, ${
            event.transform.y + initialY
          }) scale(${event.transform.k})`,
        );

        setCurrentTransform(event.transform);
      });

    svg.call(zoomBehavior);
    zoomRef.current = zoomBehavior;
  }, [ast, evaluationMethod, highlightCriticalPath, onNodeSelect]);

  // Keep ref in sync with latest renderTree — allows resize handler to always
  // call the current version without re-registering the listener.
  useEffect(() => {
    renderTreeRef.current = renderTree;
  }, [renderTree]);

  // Re-render on changes
  useEffect(() => {
    if (viewMode === "tree") {
      renderTree();
    }
  }, [renderTree, viewMode]);

  // Handle resize — registered exactly once (on mount), never re-runs.
  // Reads renderTreeRef.current so it always has the latest renderTree.
  // This fixes the 242-listener accumulation caused by [renderTree] dependency
  // recreating the effect on every parent render.
  useEffect(() => {
    const handleResize = () => {
      if (renderTreeRef.current) {
        renderTreeRef.current();
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []); // empty — registers exactly once, cleans up on unmount

  useEffect(() => {
    return () => {
      if (svgRef.current) {
        d3.select(svgRef.current).on(".zoom", null);
      }
      zoomRef.current = null;
    };
  }, []);

  // ==================== ZOOM CONTROLS ====================

  const handleZoomIn = () => {
    if (!svgRef.current || !zoomRef.current) return;

    d3.select(svgRef.current)
      .transition()
      .duration(300)
      .call(zoomRef.current.scaleBy, 1.3);
  };

  const handleZoomOut = () => {
    if (!svgRef.current || !zoomRef.current) return;

    d3.select(svgRef.current)
      .transition()
      .duration(300)
      .call(zoomRef.current.scaleBy, 0.7);
  };

  const handleFit = () => {
    if (!svgRef.current || !zoomRef.current) return;

    d3.select(svgRef.current)
      .transition()
      .duration(300)
      .call(zoomRef.current.transform, d3.zoomIdentity);
  };

  // ==================== EXPORT ====================

  const handleExportSVG = () => {
    if (!svgRef.current) return;

    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "attack-tree.svg";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportPNG = () => {
    if (!svgRef.current) return;

    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width * 2;
      canvas.height = img.height * 2;
      ctx!.fillStyle = "white";
      ctx!.fillRect(0, 0, canvas.width, canvas.height);
      ctx!.drawImage(img, 0, 0, canvas.width, canvas.height);

      const pngUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = pngUrl;
      link.download = "attack-tree.png";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    img.src =
      "data:image/svg+xml;base64," +
      btoa(unescape(encodeURIComponent(svgData)));
  };

  // ==================== RENDER ====================

  if (!ast) {
    return (
      <Box
        sx={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 2,
          color: "text.secondary",
        }}
      >
        <WarningIcon sx={{ fontSize: 48 }} />
        <Typography>
          {isGerman
            ? "Kein gültiger Attack Tree vorhanden"
            : "No valid attack tree available"}
        </Typography>
        <Typography variant="body2">
          {isGerman
            ? "Definieren Sie den Attack Tree im Editor"
            : "Define the attack tree in the editor"}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Toolbar */}
      <Paper
        elevation={0}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          p: 1,
          borderBottom: "1px solid",
          borderColor: "divider",
          backgroundColor: "grey.50",
        }}
      >
        {/* View Mode Toggle */}
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={(_, v) => v && setViewMode(v)}
          size="small"
        >
          <ToggleButton value="tree">
            <Tooltip title={isGerman ? "Baumansicht" : "Tree View"}>
              <TreeIcon fontSize="small" />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="table">
            <Tooltip title={isGerman ? "Tabellenansicht" : "Table View"}>
              <TableIcon fontSize="small" />
            </Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>

        <Divider orientation="vertical" flexItem />

        {/* Zoom Controls (only for tree view) */}
        {viewMode === "tree" && (
          <>
            <Tooltip title={isGerman ? "Vergrößern" : "Zoom In"}>
              <IconButton size="small" onClick={handleZoomIn}>
                <ZoomInIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={isGerman ? "Verkleinern" : "Zoom Out"}>
              <IconButton size="small" onClick={handleZoomOut}>
                <ZoomOutIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={isGerman ? "Einpassen" : "Fit to View"}>
              <IconButton size="small" onClick={handleFit}>
                <FitIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            <Divider orientation="vertical" flexItem />

            {/* Export */}
            <Tooltip title={isGerman ? "Als SVG exportieren" : "Export as SVG"}>
              <IconButton size="small" onClick={handleExportSVG}>
                <ExportIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        )}

        {/* Statistics */}
        <Box sx={{ flexGrow: 1 }} />

        {pathAnalysis && (
          <Box sx={{ display: "flex", gap: 1 }}>
            <Chip
              label={`${pathAnalysis.totalPaths} ${
                isGerman ? "Pfade" : "Paths"
              }`}
              size="small"
              variant="outlined"
            />
            <Chip
              label={`${pathAnalysis.criticalPaths.length} ${
                isGerman ? "Kritisch" : "Critical"
              }`}
              size="small"
              color="error"
              variant={
                pathAnalysis.criticalPaths.length > 0 ? "filled" : "outlined"
              }
            />
            <Chip
              label={`${
                isGerman ? "Max" : "Max"
              }: ${pathAnalysis.maxRiskScore.toFixed(1)}`}
              size="small"
              color="warning"
              variant="outlined"
            />
          </Box>
        )}
      </Paper>

      {/* Content */}
      <Box
        ref={containerRef}
        sx={{
          flexGrow: 1,
          overflow: "hidden",
          position: "relative",
        }}
      >
        {viewMode === "tree" ? (
          <svg
            ref={svgRef}
            style={{
              width: "100%",
              height: "100%",
              backgroundColor: "#fafafa",
            }}
          />
        ) : (
          pathAnalysis && (
            <AttackTreeTableView
              pathAnalysis={pathAnalysis}
              evaluationMethod={evaluationMethod}
            />
          )
        )}
      </Box>

      {/* Legend (for tree view) */}
      {viewMode === "tree" && (
        <Paper
          elevation={0}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            p: 1,
            borderTop: "1px solid",
            borderColor: "divider",
            backgroundColor: "grey.50",
            flexWrap: "wrap",
          }}
        >
          <Typography variant="caption" color="text.secondary">
            {isGerman ? "Legende:" : "Legend:"}
          </Typography>

          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Box
              sx={{
                width: 12,
                height: 12,
                borderRadius: 1,
                bgcolor: "#1976d2",
              }}
            />
            <Typography variant="caption">ROOT</Typography>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Box
              sx={{
                width: 12,
                height: 12,
                borderRadius: 1,
                bgcolor: "#ed6c02",
              }}
            />
            <Typography variant="caption">OR</Typography>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Box
              sx={{
                width: 12,
                height: 12,
                borderRadius: 1,
                bgcolor: "#9c27b0",
              }}
            />
            <Typography variant="caption">AND</Typography>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Box
              sx={{
                width: 12,
                height: 12,
                borderRadius: 1,
                bgcolor: "#2e7d32",
              }}
            />
            <Typography variant="caption">LEAF</Typography>
          </Box>

          <Divider orientation="vertical" flexItem />

          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Box
              sx={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                bgcolor: "#4caf50",
              }}
            />
            <Typography variant="caption">
              {isGerman ? "Mit Maßnahmen" : "With Mitigations"}
            </Typography>
          </Box>

          {highlightCriticalPath && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <Box
                sx={{
                  width: 20,
                  height: 3,
                  bgcolor: "#d32f2f",
                  borderRadius: 1,
                }}
              />
              <Typography variant="caption">
                {isGerman ? "Kritischer Pfad" : "Critical Path"}
              </Typography>
            </Box>
          )}
        </Paper>
      )}
    </Box>
  );
};

// ==================== HELPER FUNCTIONS ====================

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 1) + "…";
}

function getGoalAbbreviation(goal: AttackGoalCategory): string {
  switch (goal) {
    case "disclosure":
      return "DIS";
    case "manipulation":
      return "MAN";
    case "service-disruption":
      return "DoS";
    case "privilege-abuse":
      return "PRV";
    case "identity-misuse":
      return "ID";
    case "accountability-evasion":
      return "ACC";
    case "destruction":
      return "DES";
    default:
      return "?";
  }
}