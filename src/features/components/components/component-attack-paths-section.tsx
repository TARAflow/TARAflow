// ==================== COMPONENT ATTACK PATHS SECTION ====================
// Multi-project TARA (design v3 §7.2, patch 17): in an ISO/SAE 21434 machine
// the window of opportunity of an imported component's attack path is the
// machine's rating (context-dependent). Per instance, every path of the
// component's trees with the component's value and the machine's rating;
// feasibility follows. An unrated path makes no risk; the component's value
// is only a suggestion, taken over explicitly (review 2026-11-07). Paths
// without a factor breakdown (quick mode) cannot be rated per path. The
// read-only tree view follows later.

import React from "react";
import { useTranslation } from "react-i18next";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

const NS = "components";
const WINDOWS = ["unlimited", "easy", "moderate", "difficult"] as const;
export type PathWindow = (typeof WINDOWS)[number];

export interface ComponentAttackPathView {
  treeKey: string;
  treeName: string;
  pathKey: string;
  path: string[];
  /** AND combination: the step this row rates (one row per step, own window). */
  leafId?: string;
  stepName?: string;
  componentWindow?: PathWindow;
  machineWindow?: PathWindow;
  feasibility?: string;
  ratable: boolean;
}

export interface ComponentAttackPathsSectionProps {
  groups: readonly { key: string; label: string; paths: readonly ComponentAttackPathView[] }[];
  onSetWindow: (instanceKey: string, treeKey: string, pathKey: string, window: PathWindow | null, leafId?: string) => void;
}

export const ComponentAttackPathsSection: React.FC<ComponentAttackPathsSectionProps> = ({ groups, onSetWindow }) => {
  const { t } = useTranslation(NS);
  if (groups.length === 0) return null;
  const total = groups.reduce((n, g) => n + g.paths.length, 0);
  const open = groups.reduce((n, g) => n + g.paths.filter((p) => p.ratable && !p.machineWindow).length, 0);
  return (
    <Accordion disableGutters sx={{ mx: 2, mt: 1, flexShrink: 0 }} data-testid="component-attack-paths">
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="subtitle2">
          {t("components.paths.title", {
            count: total,
            open,
            defaultValue: "Attack paths from imported components ({{count}}) — window of opportunity to rate: {{open}}",
          })}
        </Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ maxHeight: 360, overflow: "auto", pt: 0 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {t("components.paths.intro", {
            defaultValue:
              "The window of opportunity depends on where the component sits in this machine — rate it per path. An unrated path has no feasibility and makes no risk; the component's value is a suggestion only.",
          })}
        </Typography>
        {groups.map((g) => (
          <Box key={g.key} sx={{ mb: 2 }} data-testid={`component-attack-paths-${g.key}`}>
            <Typography variant="body2" fontWeight="medium" sx={{ mb: 0.5 }}>
              {g.label}
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t("components.paths.tree", { defaultValue: "Tree" })}</TableCell>
                  <TableCell>{t("components.paths.path", { defaultValue: "Path" })}</TableCell>
                  <TableCell>{t("components.paths.component", { defaultValue: "Component" })}</TableCell>
                  <TableCell>{t("components.paths.machine", { defaultValue: "This machine" })}</TableCell>
                  <TableCell>{t("components.paths.feasibility", { defaultValue: "Feasibility" })}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {g.paths.map((p) => (
                  <TableRow
                    key={`${p.treeKey}|${p.pathKey}|${p.leafId ?? ""}`}
                    data-testid={`component-path-${p.pathKey}${p.leafId ? `-${p.leafId}` : ""}`}
                  >
                    <TableCell sx={{ fontSize: "0.8rem" }}>{p.treeName}</TableCell>
                    <TableCell sx={{ fontSize: "0.8rem" }}>
                      {p.path.slice(1).join(" → ")}
                      {p.stepName && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          {t("components.paths.step", { step: p.stepName, defaultValue: "step: {{step}}" })}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ fontSize: "0.8rem" }}>{p.componentWindow ?? "–"}</TableCell>
                    <TableCell>
                      {p.ratable ? (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Select
                          size="small"
                          value={p.machineWindow ?? ""}
                          displayEmpty
                          onChange={(e) => onSetWindow(g.key, p.treeKey, p.pathKey, (e.target.value as PathWindow) || null, p.leafId)}
                          inputProps={{ "data-testid": `component-path-window-${p.pathKey}${p.leafId ? `-${p.leafId}` : ""}` }}
                          sx={{ minWidth: 140 }}
                        >
                          <MenuItem value="">
                            <em>{t("components.paths.notRated", { defaultValue: "not rated — no risk" })}</em>
                          </MenuItem>
                          {WINDOWS.map((w) => (
                            <MenuItem key={w} value={w}>
                              {w}
                            </MenuItem>
                          ))}
                        </Select>
                        {!p.machineWindow && p.componentWindow && (
                          <Button
                            size="small"
                            variant="text"
                            title={t("components.paths.adoptTitle", { defaultValue: "Take the component's value as this machine's rating" })}
                            onClick={() => onSetWindow(g.key, p.treeKey, p.pathKey, p.componentWindow!, p.leafId)}
                            data-testid={`component-path-adopt-${p.pathKey}${p.leafId ? `-${p.leafId}` : ""}`}
                          >
                            {t("components.paths.adopt", { value: p.componentWindow, defaultValue: "Take {{value}}" })}
                          </Button>
                        )}
                        </Box>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          {t("components.paths.notRatable", { defaultValue: "quick mode — cannot be rated here" })}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ fontSize: "0.8rem" }}>{p.feasibility ?? "–"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        ))}
      </AccordionDetails>
    </Accordion>
  );
};
