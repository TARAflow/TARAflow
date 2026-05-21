import React from "react";
import { Stack, Chip, Box, LinearProgress } from "@mui/material";
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
  const progress = calculateProgress(risks);
  const chipColor = getProgressColor(progress.percent);
  const progressColor = getProgressVariant(progress.percent);

  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Chip
        label={`${progress.done}/${progress.total}`}
        size="small"
        color={chipColor as "success" | "warning" | "default"}
        variant="outlined"
      />
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