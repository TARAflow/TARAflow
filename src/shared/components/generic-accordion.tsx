import { Accordion, AccordionSummary, AccordionDetails } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import React from "react";

export type GenericAccordionProps = {
  id: string;
  title: React.ReactNode;
  expanded: boolean;
  onToggle: (id: string) => void;
  children: React.ReactNode;
  sx?: any;
  level?: "outer" | "inner";
  headerBackgroundColor?: string;
  headerHoverColor?: string;
};

export const GenericAccordion: React.FC<GenericAccordionProps> = ({
  id,
  title,
  expanded,
  onToggle,
  children,
  sx,
  level = "outer",
  headerBackgroundColor,
  headerHoverColor,
}) => {
  const isOuter = level === "outer";

  // Default colors based on level
  const defaultBgColor = isOuter ? "primary.50" : "grey.50";
  const defaultHoverColor = isOuter ? "primary.100" : undefined;

  const backgroundColor = headerBackgroundColor || defaultBgColor;
  const hoverColor = headerHoverColor || defaultHoverColor;

  return (
    <Accordion
      expanded={expanded}
      onChange={() => onToggle(id)}
      sx={{
        "&:before": { display: "none" },
        ...(isOuter
          ? {
              boxShadow: 1,
              mb: 0.5,
            }
          : {
              mb: 0.5,
              boxShadow: "none",
              border: "1px solid",
              borderColor: "divider",
              "&:last-child": { mb: 0 },
            }),
        ...sx,
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        sx={
          isOuter
            ? {
                backgroundColor,
                "&:hover": hoverColor ? { backgroundColor: hoverColor } : {},
              }
            : {
                minHeight: 40,
                "&.Mui-expanded": { minHeight: 40 },
                "& .MuiAccordionSummary-content": { my: 0.5 },
                backgroundColor,
              }
        }
      >
        {title}
      </AccordionSummary>
      <AccordionDetails sx={{ p: isOuter ? 1 : 0 }}>
        {children}
      </AccordionDetails>
    </Accordion>
  );
};