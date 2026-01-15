import React from "react";
import { Stack, Chip, Typography, Box } from "@mui/material";

export type OuterHeaderProps = {
  icon: React.ReactNode;
  code?: string;
  title: string;
  rightSlot?: React.ReactNode;
  backgroundColor?: string;
};

export const OuterHeader: React.FC<OuterHeaderProps> = ({
  icon,
  code,
  title,
  rightSlot,
  backgroundColor = "primary.50",
}) => {
  return (
    <Stack
      direction="row"
      spacing={2}
      alignItems="center"
      sx={{
        width: "100%",
        backgroundColor,
        px: 1,
        py: 0.5,
      }}
    >
      {icon}

      {code && (
        <Chip
          label={code}
          size="small"
          variant="outlined"
          sx={{ fontFamily: "monospace" }}
        />
      )}

      <Typography variant="subtitle1" fontWeight="medium">
        {title}
      </Typography>

      <Box sx={{ flexGrow: 1 }} />

      {rightSlot}
    </Stack>
  );
};

export default OuterHeader;
