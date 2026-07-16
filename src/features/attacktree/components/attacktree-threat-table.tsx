// src/features/attacktree/components/attacktree-threat-table.tsx
//
// PHASE 5a — attack-path threat relevance workflow (minimal).
//
// A deliberately plain confirm / dismiss / uncertain table over the threats an
// asset-anchored tree emits. It reuses the same relevance vocabulary as the
// STRIDE threat tab (unrated | relevant | not_relevant | uncertain) so the
// analyst's mental model is identical across generators.
//
// SCOPE — this is the workflow anchor, not the final UI. The attack-tree UI is
// being reworked wholesale; this component exists so 5a is a working vertical
// slice (rate a path → it becomes a risk) without pre-empting that overhaul.
// It writes decisions through setPathAssessment and hands the updated
// assessments up via onAssessmentsChange — the parent persists them on the tree
// through the existing updateTree → auto-save path.

import React, { useMemo } from "react";
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
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  Chip,
} from "@mui/material";
import type { ThreatReference, ThreatRelevanceRef } from "shared";
import type { AttackPathAssessment } from "../models/attacktree-types";
import { applyRelevanceDecision } from "../services/attacktree-threat-sync";

// ==================== TYPES ====================

interface AttackTreeThreatTableProps {
  /** Tree id — needed to map a threat back to its (pathKey, stride) tuple. */
  treeId: string;
  /** The overlaid threats this tree emits (from reconcile/extractor). */
  threats: ThreatReference[];
  /** Current persisted decisions (tree.pathAssessments ?? []). */
  assessments: AttackPathAssessment[];
  /** Called with the next assessments array after any change. */
  onAssessmentsChange: (next: AttackPathAssessment[]) => void;
}

// ==================== COMPONENT ====================

const RELEVANCE_OPTIONS: ThreatRelevanceRef[] = [
  "relevant",
  "not_relevant",
  "uncertain",
];

export const AttackTreeThreatTable: React.FC<AttackTreeThreatTableProps> = ({
  treeId,
  threats,
  assessments,
  onAssessmentsChange,
}) => {
  const { i18n } = useTranslation();
  const isGerman = i18n.language === "de";

  const label: Record<ThreatRelevanceRef, string> = useMemo(
    () => ({
      unrated: isGerman ? "Offen" : "Unrated",
      relevant: isGerman ? "Bestätigt" : "Confirmed",
      not_relevant: isGerman ? "Verworfen" : "Dismissed",
      uncertain: isGerman ? "Unklar" : "Uncertain",
    }),
    [isGerman],
  );

  const handleChange = (
    threat: ThreatReference,
    next: ThreatRelevanceRef | null,
  ): void => {
    // null from the toggle group = the analyst clicked the active button →
    // clear back to unrated. All the id→(pathKey,stride) mapping and the
    // write live in the service, so this handler is a pure delegation.
    onAssessmentsChange(
      applyRelevanceDecision(
        treeId,
        assessments,
        threat.id,
        threat.strideCategory,
        next ?? "unrated",
      ),
    );
  };

  if (threats.length === 0) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography color="text.secondary" variant="body2">
          {isGerman
            ? "Dieser Baum erzeugt keine Bedrohungen (nur asset-verankerte Bäume tun das)."
            : "This tree emits no threats (only asset-anchored trees do)."}
        </Typography>
      </Box>
    );
  }

  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>{isGerman ? "Bedrohung" : "Threat"}</TableCell>
            <TableCell>{isGerman ? "Angriffspfad" : "Attack Path"}</TableCell>
            <TableCell align="center">STRIDE</TableCell>
            <TableCell align="center">
              {isGerman ? "Relevanz" : "Relevance"}
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {threats.map((threat) => (
            <TableRow key={threat.id}>
              <TableCell>
                <Typography variant="body2">
                  {threat.threatDescription}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="caption" color="text.secondary">
                  {threat.attackDescription}
                </Typography>
              </TableCell>
              <TableCell align="center">
                <Chip label={threat.strideCategory} size="small" />
              </TableCell>
              <TableCell align="center">
                <ToggleButtonGroup
                  size="small"
                  exclusive
                  value={threat.relevance}
                  onChange={(_e, next) =>
                    handleChange(threat, next as ThreatRelevanceRef | null)
                  }
                  aria-label={isGerman ? "Relevanz" : "Relevance"}
                >
                  {RELEVANCE_OPTIONS.map((opt) => (
                    <ToggleButton key={opt} value={opt} aria-label={label[opt]}>
                      {label[opt]}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default AttackTreeThreatTable;