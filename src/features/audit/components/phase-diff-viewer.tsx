// ==================== PHASE DIFF VIEWER ====================
// Detailed phase-by-phase change viewer
// Shows structured changes with expand/collapse

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  Paper,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
} from "@mui/material";
import {
  ExpandMore as ExpandMoreIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  InfoOutlined as InfoIcon,
} from "@mui/icons-material";
import type { PhaseChanges, ChangeItem, ChangeDetail } from "../models/audit-types";

// ==================== PROPS ====================

interface PhaseDiffViewerProps {
  changes: PhaseChanges[];
}

// ==================== COMPONENT ====================

export const PhaseDiffViewer: React.FC<PhaseDiffViewerProps> = ({
  changes,
}) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState<string[]>(
    changes.map((c) => c.phase)
  );

  // ==================== HANDLERS ====================

  const handleToggle = (phase: string) => {
    setExpanded((prev) =>
      prev.includes(phase)
        ? prev.filter((p) => p !== phase)
        : [...prev, phase]
    );
  };

  // ==================== RENDER ====================

  if (changes.length === 0) {
    return (
      <Alert severity="info" icon={<InfoIcon />}>
        {t("audit.diff.noChanges", {
          defaultValue: "No changes to display",
        })}
      </Alert>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Typography variant="h6">
        {t("audit.diff.title", { defaultValue: "Detailed Changes" })}
      </Typography>

      {changes.map((phase) => (
        <Accordion
          key={phase.phase}
          expanded={expanded.includes(phase.phase)}
          onChange={() => handleToggle(phase.phase)}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 2,
                width: "100%",
              }}
            >
              <Typography variant="subtitle1" fontWeight="medium">
                {phase.phaseLabel}
              </Typography>
              <Chip
                label={`${phase.changeCount} ${t("audit.diff.changes", {
                  defaultValue: "changes",
                })}`}
                size="small"
                color="primary"
              />
            </Box>
          </AccordionSummary>

          <AccordionDetails>
            <ChangeItemsTable changes={phase.changes} />
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
};

// ==================== CHANGE ITEMS TABLE ====================

interface ChangeItemsTableProps {
  changes: ChangeItem[];
}

const ChangeItemsTable: React.FC<ChangeItemsTableProps> = ({ changes }) => {
  const { t } = useTranslation();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const toggleItem = (id: string) => {
    setExpandedItems((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const getChangeIcon = (type: "added" | "modified" | "deleted") => {
    switch (type) {
      case "added":
        return <AddIcon fontSize="small" color="success" />;
      case "modified":
        return <EditIcon fontSize="small" color="warning" />;
      case "deleted":
        return <DeleteIcon fontSize="small" color="error" />;
    }
  };

  const getChangeColor = (type: "added" | "modified" | "deleted") => {
    switch (type) {
      case "added":
        return "success.light";
      case "modified":
        return "warning.light";
      case "deleted":
        return "error.light";
    }
  };

  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell width={40}></TableCell>
            <TableCell>
              {t("audit.diff.table.id", { defaultValue: "ID" })}
            </TableCell>
            <TableCell>
              {t("audit.diff.table.name", { defaultValue: "Name" })}
            </TableCell>
            <TableCell>
              {t("audit.diff.table.type", { defaultValue: "Type" })}
            </TableCell>
            <TableCell>
              {t("audit.diff.table.description", {
                defaultValue: "Description",
              })}
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {changes.map((change) => (
            <React.Fragment key={change.id}>
              {/* Main Row */}
              <TableRow
                sx={{
                  backgroundColor: getChangeColor(change.type),
                  cursor: change.details ? "pointer" : "default",
                }}
                onClick={() => change.details && toggleItem(change.id)}
              >
                <TableCell>{getChangeIcon(change.type)}</TableCell>
                <TableCell>
                  <Typography
                    variant="body2"
                    fontFamily="monospace"
                    fontWeight="medium"
                  >
                    {change.id}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{change.name}</Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={change.type}
                    size="small"
                    color={
                      change.type === "added"
                        ? "success"
                        : change.type === "deleted"
                        ? "error"
                        : "warning"
                    }
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary">
                    {change.description}
                  </Typography>
                </TableCell>
              </TableRow>

              {/* Details Row (Expandable) */}
              {change.details &&
                change.details.length > 0 &&
                expandedItems.includes(change.id) && (
                  <TableRow>
                    <TableCell colSpan={5} sx={{ py: 0 }}>
                      <Box sx={{ p: 2, backgroundColor: "action.hover" }}>
                        <Typography variant="subtitle2" gutterBottom>
                          {t("audit.diff.fieldChanges", {
                            defaultValue: "Field Changes:",
                          })}
                        </Typography>
                        <ChangeDetailsTable details={change.details} />
                      </Box>
                    </TableCell>
                  </TableRow>
                )}
            </React.Fragment>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

// ==================== CHANGE DETAILS TABLE ====================

interface ChangeDetailsTableProps {
  details: ChangeDetail[];
}

const ChangeDetailsTable: React.FC<ChangeDetailsTableProps> = ({ details }) => {
  const { t } = useTranslation();

  const formatValue = (value: any, type: string): string => {
    if (value === null || value === undefined) return "-";

    switch (type) {
      case "number":
        return String(value);
      case "boolean":
        return value ? "Yes" : "No";
      case "array":
        return Array.isArray(value) ? `[${value.length} items]` : String(value);
      case "object":
        return typeof value === "object" ? JSON.stringify(value, null, 2) : String(value);
      default:
        return String(value);
    }
  };

  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>
              {t("audit.diff.details.field", { defaultValue: "Field" })}
            </TableCell>
            <TableCell>
              {t("audit.diff.details.oldValue", {
                defaultValue: "Old Value",
              })}
            </TableCell>
            <TableCell>
              {t("audit.diff.details.newValue", {
                defaultValue: "New Value",
              })}
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {details.map((detail, index) => (
            <TableRow key={index}>
              <TableCell>
                <Typography variant="body2" fontWeight="medium">
                  {detail.fieldLabel}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography
                  variant="body2"
                  fontFamily="monospace"
                  color="error.main"
                  sx={{ textDecoration: "line-through" }}
                >
                  {formatValue(detail.oldValue, detail.valueType)}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography
                  variant="body2"
                  fontFamily="monospace"
                  color="success.main"
                  fontWeight="medium"
                >
                  {formatValue(detail.newValue, detail.valueType)}
                </Typography>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default PhaseDiffViewer;
