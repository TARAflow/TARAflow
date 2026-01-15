import React from "react";
import { Stack, Chip, Typography, Box } from "@mui/material";

export type InnerHeaderProps = {
  icon: React.ReactNode;
  code: string;
  title: string;
  rightSlot?: React.ReactNode;
  backgroundColor?: string;
};

export const InnerHeader: React.FC<InnerHeaderProps> = ({
  icon,
  code,
  title,
  rightSlot,
  backgroundColor = "grey.50",
}) => {
  return (
    <Stack
      direction="row"
      spacing={1.5}
      alignItems="center"
      sx={{
        width: "100%",
        backgroundColor,
        px: 1,
        py: 0.5,
      }}
    >
      {icon}

      <Chip
        label={code}
        size="small"
        variant="outlined"
        sx={{ fontFamily: "monospace", fontSize: "0.7rem" }}
      />

      <Typography variant="body2" fontWeight="medium">
        {title}
      </Typography>

      <Box sx={{ flexGrow: 1 }} />

      {rightSlot}
    </Stack>
  );
};

export default InnerHeader;
