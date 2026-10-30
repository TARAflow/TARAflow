import React from "react";
import { useTranslation } from "react-i18next";
import { Stack, Chip, Box, LinearProgress, Tooltip } from "@mui/material";
import { Risk } from "../../models/risk-assessment-types";
import {
  calculateProgress,
  getProgressColor,
  getProgressVariant,
} from "../../utils/risk-progress";

interface ProgressChipProps {
  risks: Risk[];
}

export const ProgressChip: React.FC<ProgressChipProps> = ({ risks }) => {
  const { t } = useTranslation();
  const progress = calculateProgress(risks);
  const chipColor = getProgressColor(progress.percent);
  const progressColor = getProgressVariant(progress.percent);

  return (
    <Stack direction="row" spacing={1} alignItems="center">
      {/* What "done" means (user 2026-10-30: "6/17" said nothing) */}
      <Tooltip
        title={t("tabs.risks.progressTooltip", {
          done: progress.done,
          total: progress.total,
          defaultValue:
            "{{done}} of {{total}} risks done: a treatment without implementation of its own (accept, transfer / share, won't) or every selected mitigation implemented, verified or rejected.",
        })}
      >
        <Chip
          label={`${progress.done}/${progress.total}`}
          size="small"
          color={chipColor as "success" | "warning" | "default"}
          variant="outlined"
          data-testid="risk-progress-chip"
        />
      </Tooltip>
      <Box sx={{ width: 60, display: { xs: "none", sm: "block" } }}>
        <LinearProgress
          variant="determinate"
          value={progress.percent}
          color={progressColor as "success" | "warning" | "primary"}
          sx={{ height: 6, borderRadius: 3 }}
        />
      </Box>
    </Stack>
  );
};

export default ProgressChip;