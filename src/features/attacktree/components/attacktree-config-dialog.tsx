// ==================== ATTACK TREE CONFIG DIALOG ====================
// Configuration dialog for evaluation method and editor settings

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
  Switch,
  Alert,
  Divider,
} from "@mui/material";

import {
  AttackTreeConfiguration,
  EvaluationMethod,
} from "../models/attacktree-types";

// ==================== TYPES ====================

interface AttackTreeConfigDialogProps {
  open: boolean;
  configuration: AttackTreeConfiguration;
  hasExistingTree: boolean;
  onSave: (config: AttackTreeConfiguration) => void;
  onClose: () => void;
}

// ==================== COMPONENT ====================

export const AttackTreeConfigDialog: React.FC<AttackTreeConfigDialogProps> = ({
  open,
  configuration,
  hasExistingTree,
  onSave,
  onClose,
}) => {
  const { t } = useTranslation();

  const [evaluationMethod, setEvaluationMethod] = useState<EvaluationMethod>(
    configuration.evaluationMethod
  );
  const [autoSave, setAutoSave] = useState(configuration.autoSave);
  const [showLineNumbers, setShowLineNumbers] = useState(
    configuration.showLineNumbers
  );
  const [fontSize, setFontSize] = useState(configuration.fontSize);
  const [highlightCriticalPath] = useState(configuration.highlightCriticalPath);

  const handleSave = () => {
    onSave({
      evaluationMethod,
      autoSave,
      showLineNumbers,
      fontSize,
      highlightCriticalPath,
    });
  };

  const handleReset = () => {
    setEvaluationMethod(configuration.evaluationMethod);
    setAutoSave(configuration.autoSave);
    setShowLineNumbers(configuration.showLineNumbers);
    setFontSize(configuration.fontSize);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {t("tabs.attacktree.config.title", {
          defaultValue: "Attack Tree Configuration",
        })}
      </DialogTitle>

      <DialogContent dividers>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {/* Evaluation Method */}
          <Box>
            <FormControl component="fieldset" fullWidth>
              <FormLabel sx={{ mb: 2, fontWeight: "bold" }}>
                {t("tabs.attacktree.config.evaluationMethod", {
                  defaultValue: "Risk Evaluation Method",
                })}
              </FormLabel>

              {hasExistingTree && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  {t(
                    "attacktree:tabs.attacktree.configDialog.changingEvaluationMethodRequires",
                  )}
                </Alert>
              )}

              <RadioGroup
                value={evaluationMethod}
                onChange={(e) =>
                  setEvaluationMethod(e.target.value as EvaluationMethod)
                }
              >
                <FormControlLabel
                  value="simple"
                  control={<Radio />}
                  label={
                    <Box>
                      <Typography fontWeight="medium">
                        {t(
                          "attacktree:tabs.attacktree.configDialog.simple2Factors",
                        )}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {t(
                          "attacktree:tabs.attacktree.configDialog.probabilityImpact025Scale",
                        )}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t(
                          "attacktree:tabs.attacktree.configDialog.syntaxP05I3",
                        )}
                      </Typography>
                    </Box>
                  }
                  sx={{ alignItems: "flex-start", mb: 2 }}
                />

                <FormControlLabel
                  value="extended"
                  control={<Radio />}
                  label={
                    <Box>
                      <Typography fontWeight="medium">
                        {t(
                          "attacktree:tabs.attacktree.configDialog.extended3Factors",
                        )}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {t(
                          "attacktree:tabs.attacktree.configDialog.feasibilityBenefitsImpact0125Sca",
                        )}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t(
                          "attacktree:tabs.attacktree.configDialog.syntax08093FBI",
                        )}
                      </Typography>
                    </Box>
                  }
                  sx={{ alignItems: "flex-start" }}
                />
              </RadioGroup>
            </FormControl>
          </Box>

          <Divider />

          {/* Editor Settings */}
          <Box>
            <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>
              {t("tabs.attacktree.config.editorSettings", {
                defaultValue: "Editor Settings",
              })}
            </Typography>

            {/* Auto-Save */}
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
                  {t("tabs.attacktree.config.autoSave", {
                    defaultValue: "Auto-Save",
                  })}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t(
                    "attacktree:tabs.attacktree.configDialog.automaticallySaveChanges",
                  )}
                </Typography>
              </Box>
              <Switch
                checked={autoSave}
                onChange={(e) => setAutoSave(e.target.checked)}
              />
            </Box>

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
                  {t("tabs.attacktree.config.lineNumbers", {
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
                {t("tabs.attacktree.config.fontSize", {
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

          <Divider />

          {/* Help Text */}
          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              {t("attacktree:tabs.attacktree.configDialog.note")}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t(
                "attacktree:tabs.attacktree.configDialog.changesTakeEffectImmediatelyEval",
              )}
            </Typography>
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