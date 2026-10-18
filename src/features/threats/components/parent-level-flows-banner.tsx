// ==================== PARENT-LEVEL FLOWS BANNER ====================
// Leveled DFD (leveled-dfd-multi-diagram-design.md §6.5, §7, D4, D10; 5j):
// "N data flows analysed on a parent level". Their threats refer to a
// fallback endpoint — usually a decomposed multiprocess the flow is not
// drawn below — and are provisional, never a confirmed modelling result.
// Information, not an error: analysis runs, nothing is excluded.

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Box, Button, Collapse, Typography } from "@mui/material";
import type { ParentLevelFlowInfo } from "../models/threat-types";

export interface ParentLevelFlowsBannerProps {
  flows: readonly ParentLevelFlowInfo[] | undefined;
}

export const ParentLevelFlowsBanner: React.FC<ParentLevelFlowsBannerProps> = ({ flows }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  if (!flows || flows.length === 0) return null;

  const reason = (r: ParentLevelFlowInfo["reason"]) =>
    r === "ambiguous"
      ? t("tabs.threats.parentLevel.reason.ambiguous", {
          defaultValue: "drawn to different parts — analysed at their common parent",
        })
      : r === "dangling"
        ? t("tabs.threats.parentLevel.reason.dangling", {
            defaultValue: "an endpoint has no definition",
          })
        : t("tabs.threats.parentLevel.reason.unresolved", {
            defaultValue: "not drawn on the child page of the multiprocess",
          });

  return (
    <Box sx={{ px: 2, pt: 1, flexShrink: 0 }} data-testid="parent-level-flows-banner">
      <Alert
        severity="info"
        action={
          <Button color="inherit" size="small" onClick={() => setOpen((o) => !o)}>
            {open
              ? t("tabs.threats.parentLevel.hide", { defaultValue: "Hide" })
              : t("tabs.threats.parentLevel.show", { defaultValue: "Show" })}
          </Button>
        }
      >
        {t("tabs.threats.parentLevel.summary", {
          defaultValue:
            "{{count}} data flow(s) analysed on a parent level — their threats refer to a multiprocess instead of its parts and are provisional. Draw the flows on the child page to refine them.",
          count: flows.length,
        })}
        <Collapse in={open}>
          <Box component="ul" sx={{ m: 0, mt: 1, pl: 2 }} data-testid="parent-level-flows-list">
            {flows.map((f) => (
              <li key={f.tfId}>
                <Typography variant="body2" component="span" sx={{ fontWeight: 500 }}>
                  {f.label}
                </Typography>{" "}
                <Typography variant="body2" component="span">
                  ({f.from} → {f.to})
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  {reason(f.reason)}
                </Typography>
              </li>
            ))}
          </Box>
        </Collapse>
      </Alert>
    </Box>
  );
};

export default ParentLevelFlowsBanner;
