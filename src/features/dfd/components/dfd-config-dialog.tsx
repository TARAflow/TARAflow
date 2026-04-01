// ==================== DFD CONFIG DIALOG ====================
// Configures auto-numbering sort strategy and tolerance.
// Extendable: add more DFD settings here as needed.

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Slider,
  Stack,
  Alert,
  Divider,
  Paper,
} from "@mui/material";
import { Settings as SettingsIcon } from "@mui/icons-material";

import type {
  DFDAutoNumberingConfig,
  DFDSortStrategy,
} from "../models/dfd-types";
import { DEFAULT_AUTONUMBERING_CONFIG } from "../models/dfd-types";

// ==================== PROPS ====================

interface DFDConfigDialogProps {
  open: boolean;
  config: DFDAutoNumberingConfig;
  onSave: (config: DFDAutoNumberingConfig) => void;
  onClose: () => void;
}

// ==================== STRATEGY DEFINITIONS ====================

interface StrategyDef {
  value: DFDSortStrategy;
  labelKey: string;
  labelDefault: string;
  hintKey: string;
  hintDefault: string;
}

const STRATEGIES: StrategyDef[] = [
  {
    value: "diagonal",
    labelKey: "tabs.dfd.autoNumbering.diagonal",
    labelDefault: "Diagonal  (Top-Left corner wins)",
    hintKey: "tabs.dfd.autoNumbering.diagonalHint",
    hintDefault:
      "Score = weightX·x + weightY·y. The element closest to the top-left corner wins. Configurable weights, IdLabel position as tiebreaker.",
  },
  {
    value: "top-down",
    labelKey: "tabs.dfd.autoNumbering.topDown",
    labelDefault: "Top → Bottom  (then Left → Right)",
    hintKey: "tabs.dfd.autoNumbering.topDownHint",
    hintDefault:
      "Elements higher up get lower numbers. Within the same row (tolerance band), left wins. Best for document-style DFDs.",
  },
  {
    value: "left-right",
    labelKey: "tabs.dfd.autoNumbering.leftRight",
    labelDefault: "Left → Right  (then Top → Bottom)",
    hintKey: "tabs.dfd.autoNumbering.leftRightHint",
    hintDefault:
      "Elements further left get lower numbers. Within the same column (tolerance band), top wins. Best for OT/ICS diagrams with field–control–IT zones.",
  },
];

// ==================== COMPONENT ====================

export const DFDConfigDialog: React.FC<DFDConfigDialogProps> = ({
  open,
  config,
  onSave,
  onClose,
}) => {
  const { t } = useTranslation();

  const [sortStrategy, setSortStrategy] = useState<DFDSortStrategy>(
    config.sortStrategy ?? DEFAULT_AUTONUMBERING_CONFIG.sortStrategy,
  );
  const [tolerance, setTolerance] = useState<number>(
    config.tolerance ?? DEFAULT_AUTONUMBERING_CONFIG.tolerance,
  );
  const [weightX, setWeightX] = useState<number>(
    config.weightX ?? DEFAULT_AUTONUMBERING_CONFIG.weightX ?? 0.8,
  );
  const [weightY, setWeightY] = useState<number>(
    config.weightY ?? DEFAULT_AUTONUMBERING_CONFIG.weightY ?? 1.0,
  );

  React.useEffect(() => {
    if (open) {
      setSortStrategy(config.sortStrategy ?? DEFAULT_AUTONUMBERING_CONFIG.sortStrategy);
      setTolerance(config.tolerance ?? DEFAULT_AUTONUMBERING_CONFIG.tolerance);
      setWeightX(config.weightX ?? DEFAULT_AUTONUMBERING_CONFIG.weightX ?? 0.8);
      setWeightY(config.weightY ?? DEFAULT_AUTONUMBERING_CONFIG.weightY ?? 1.0);
    }
  }, [open, config]);

  const handleSave = () => {
    onSave({ sortStrategy, tolerance, weightX, weightY });
    onClose();
  };

  const isDirty =
    sortStrategy !== config.sortStrategy ||
    tolerance !== config.tolerance ||
    weightX !== (config.weightX ?? 0.8) ||
    weightY !== (config.weightY ?? 1.0);

  const toleranceVisible = sortStrategy !== "diagonal";
  const weightsVisible = sortStrategy === "diagonal";

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" spacing={1} alignItems="center">
          <SettingsIcon fontSize="small" color="action" />
          <span>
            {t("tabs.dfd.config.title", { defaultValue: "DFD Settings" })}
          </span>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={3}>

          {/* Sort Strategy */}
          <Box>
            <FormControl fullWidth>
              <FormLabel sx={{ mb: 1.5, fontWeight: 600, color: "text.primary" }}>
                {t("tabs.dfd.autoNumbering.sortStrategy", {
                  defaultValue: "Auto-Numbering Order",
                })}
              </FormLabel>
              <RadioGroup
                value={sortStrategy}
                onChange={(e) => setSortStrategy(e.target.value as DFDSortStrategy)}
              >
                <Stack spacing={1}>
                  {STRATEGIES.map((s) => {
                    const isSelected = sortStrategy === s.value;
                    return (
                      <Paper
                        key={s.value}
                        variant="outlined"
                        onClick={() => setSortStrategy(s.value)}
                        sx={{
                          p: 1.5,
                          cursor: "pointer",
                          borderColor: isSelected ? "primary.main" : "divider",
                          bgcolor: isSelected ? "primary.50" : undefined,
                          transition: "all 0.15s",
                          "&:hover": { borderColor: "primary.light" },
                        }}
                      >
                        <FormControlLabel
                          value={s.value}
                          control={<Radio size="small" />}
                          label={
                            <Box>
                              <Typography variant="body2" fontWeight={600}>
                                {t(s.labelKey, { defaultValue: s.labelDefault })}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ display: "block", mt: 0.25 }}
                              >
                                {t(s.hintKey, { defaultValue: s.hintDefault })}
                              </Typography>
                            </Box>
                          }
                          sx={{ m: 0, width: "100%", alignItems: "flex-start" }}
                        />
                      </Paper>
                    );
                  })}
                </Stack>
              </RadioGroup>
            </FormControl>
          </Box>

          <Divider />

          {/* Tolerance Slider — hidden in diagonal mode (weights replace it) */}
          {toleranceVisible && <Box>
            <Typography variant="body2" fontWeight={600} gutterBottom>
              {t("tabs.dfd.autoNumbering.tolerance", {
                defaultValue: "Alignment Tolerance",
              })}
              <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                ({tolerance} px)
              </Typography>
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: "block" }}>
              {sortStrategy === "left-right"
                ? t("tabs.dfd.autoNumbering.toleranceHintX", {
                    defaultValue:
                      "Maximum X-distance (px) for two elements to be treated as the same column. Top wins within the band.",
                  })
                : t("tabs.dfd.autoNumbering.toleranceHintY", {
                    defaultValue:
                      "Maximum Y-distance (px) for two elements to be treated as the same row. Left wins within the band.",
                  })
              }
            </Typography>
            <Slider
              value={tolerance}
              onChange={(_, v) => setTolerance(v as number)}
              min={0}
              max={100}
              step={5}
              marks={[
                { value: 0, label: "0" },
                { value: 30, label: "30" },
                { value: 60, label: "60" },
                { value: 100, label: "100" },
              ]}
              valueLabelDisplay="auto"
              sx={{ mt: 1 }}
            />
          </Box>}

          {/* Diagonal Weights — only visible in diagonal mode */}
          {weightsVisible && (
            <Box>
              <Typography variant="body2" fontWeight={600} gutterBottom>
                {t("tabs.dfd.autoNumbering.weights", {
                  defaultValue: "Diagonal Weights",
                })}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: "block" }}>
                {t("tabs.dfd.autoNumbering.weightsHint", {
                  defaultValue:
                    "Score = weightX·x + weightY·y. Higher Y weight → vertical position matters more. Default: 0.8x + 1.0y.",
                })}
              </Typography>
              <Stack spacing={2}>
                <Box>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="caption">
                      {t("tabs.dfd.autoNumbering.weightX", { defaultValue: "X weight (horizontal)" })}
                    </Typography>
                    <Typography variant="caption" fontWeight={600}>{weightX.toFixed(1)}</Typography>
                  </Stack>
                  <Slider
                    value={weightX}
                    onChange={(_, v) => setWeightX(v as number)}
                    min={0} max={1} step={0.1}
                    marks={[
                      { value: 0, label: "0" },
                      { value: 0.5, label: "0.5" },
                      { value: 0.8, label: "0.8" },
                      { value: 1, label: "1" },
                    ]}
                    valueLabelDisplay="auto"
                    sx={{ mt: 1 }}
                  />
                </Box>
                <Box>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="caption">
                      {t("tabs.dfd.autoNumbering.weightY", { defaultValue: "Y weight (vertical)" })}
                    </Typography>
                    <Typography variant="caption" fontWeight={600}>{weightY.toFixed(1)}</Typography>
                  </Stack>
                  <Slider
                    value={weightY}
                    onChange={(_, v) => setWeightY(v as number)}
                    min={0} max={1} step={0.1}
                    marks={[
                      { value: 0, label: "0" },
                      { value: 0.5, label: "0.5" },
                      { value: 1, label: "1" },
                    ]}
                    valueLabelDisplay="auto"
                    sx={{ mt: 1 }}
                  />
                </Box>
              </Stack>
            </Box>
          )}

          <Alert severity="info" sx={{ py: 0.5 }}>
            <Typography variant="caption">
              {t("tabs.dfd.autoNumbering.configHint", {
                defaultValue:
                  "Click Auto-Number after saving to apply. All elements will be renumbered from scratch.",
              })}
            </Typography>
          </Alert>

        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 2, py: 1.5 }}>
        <Button onClick={onClose} size="small">
          {t("common.cancel", { defaultValue: "Cancel" })}
        </Button>
        <Button
          variant="contained"
          size="small"
          onClick={handleSave}
          disabled={!isDirty}
        >
          {t("common.save", { defaultValue: "Save" })}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DFDConfigDialog;