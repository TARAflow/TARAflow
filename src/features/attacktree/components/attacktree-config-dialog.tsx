// ==================== ATTACK TREE CONFIG DIALOG ====================
// Configuration dialog for editor settings.
//
// Used to also hold the Risk Evaluation Method (simple/extended) radio group
// and an Auto-Save switch — both removed (2026-07-25, Juergen's call): the
// evaluation method is effectively fixed per tree by how it was created
// (asset/risk-anchored → extended, threat-anchored → simple; see
// attacktree-service.ts's generateFrom* functions) and calculateNodeRiskScore
// now falls back gracefully on a format/method mismatch anyway, so letting
// the analyst flip it after the fact added a confusing "requires
// recalculation" warning for a switch that rarely needs touching. Auto-Save
// likewise — the tree feature always auto-saves through the same debounced
// path as every other tab; the switch controlled nothing else.
//
// highlightCriticalPath was briefly added as a third setting here, then
// dropped again (2026-07-25): the preview already highlights the critical
// path unconditionally, so a toggle for it would have nothing to control.

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
  Slider,
  Switch,
} from "@mui/material";

import { AttackTreeConfiguration } from "../models/attacktree-types";

// ==================== TYPES ====================

interface AttackTreeConfigDialogProps {
  open: boolean;
  configuration: AttackTreeConfiguration;
  onSave: (config: AttackTreeConfiguration) => void;
  onClose: () => void;
}

// ==================== COMPONENT ====================

export const AttackTreeConfigDialog: React.FC<AttackTreeConfigDialogProps> = ({
  open,
  configuration,
  onSave,
  onClose,
}) => {
  const { t } = useTranslation();

  const [showLineNumbers, setShowLineNumbers] = useState(
    configuration.showLineNumbers,
  );
  const [fontSize, setFontSize] = useState(configuration.fontSize);

  const handleSave = () => {
    onSave({
      // Not editable here — carried through unchanged. See the file header
      // for evaluationMethod/autoSave; highlightCriticalPath is left out of
      // this dialog too (2026-07-25, Juergen's call) — it's applied
      // unconditionally already, so a toggle for it would have nothing to do.
      evaluationMethod: configuration.evaluationMethod,
      autoSave: configuration.autoSave,
      showLineNumbers,
      fontSize,
      highlightCriticalPath: configuration.highlightCriticalPath,
    });
  };

  const handleReset = () => {
    setShowLineNumbers(configuration.showLineNumbers);
    setFontSize(configuration.fontSize);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {t("attacktree:tabs.attacktree.config.title", {
          defaultValue: "Attack Tree Configuration",
        })}
      </DialogTitle>

      <DialogContent dividers>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {/* Editor Settings */}
          <Box>
            <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>
              {t("attacktree:tabs.attacktree.config.editorSettings", {
                defaultValue: "Editor Settings",
              })}
            </Typography>

            {/* Line Numbers */}
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                mb: 2,
              }}
            >
              <Box>
                <Typography>
                  {t("attacktree:tabs.attacktree.config.lineNumbers", {
                    defaultValue: "Show Line Numbers",
                  })}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t(
                    "attacktree:tabs.attacktree.configDialog.displayLineNumbersInEditor",
                  )}
                </Typography>
              </Box>
              <Switch
                checked={showLineNumbers}
                onChange={(e) => setShowLineNumbers(e.target.checked)}
              />
            </Box>

            {/* Font Size */}
            <Box>
              <Typography gutterBottom>
                {t("attacktree:tabs.attacktree.config.fontSize", {
                  defaultValue: "Font Size",
                })}{" "}
                ({fontSize}px)
              </Typography>
              <Slider
                value={fontSize}
                onChange={(_, value) => setFontSize(value as number)}
                min={10}
                max={24}
                step={1}
                marks={[
                  { value: 12, label: "12" },
                  { value: 16, label: "16" },
                  { value: 20, label: "20" },
                ]}
                valueLabelDisplay="auto"
              />
            </Box>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleReset} color="secondary">
          {t("common.reset", { defaultValue: "Reset" })}
        </Button>
        <Button onClick={onClose}>
          {t("common.cancel", { defaultValue: "Cancel" })}
        </Button>
        <Button onClick={handleSave} variant="contained">
          {t("common.save", { defaultValue: "Save" })}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AttackTreeConfigDialog;