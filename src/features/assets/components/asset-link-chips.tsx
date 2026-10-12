// features/assets/components/asset-link-chips.tsx
//
// Read-only chips for an asset's asset-to-asset links ("Asset Links"),
// direction-marked: → outgoing, ← incoming.

import React from "react";
import { Box, Chip, Stack, Tooltip, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { assetLinkLabel, type AssetLink } from "../utils/asset-links";

interface AssetLinkChipsProps {
  links: readonly AssetLink[];
}

export const AssetLinkChips: React.FC<AssetLinkChipsProps> = ({ links }) => {
  const { t } = useTranslation();
  return (
    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ py: 0.5 }}>
      {links.map((l) => (
        <Tooltip
          key={`${l.direction}-${l.otherId}-${l.relationType}`}
          arrow
          placement="top"
          title={
            <Box sx={{ p: 0.5 }}>
              <Typography variant="caption" fontWeight="bold" display="block">
                {l.direction === "out"
                  ? t("tabs.assets.columns.assetLinksOutgoing", { defaultValue: "Outgoing" })
                  : t("tabs.assets.columns.assetLinksIncoming", { defaultValue: "Incoming" })}
              </Typography>
              <Typography variant="caption" display="block" color="rgba(255,255,255,0.8)">
                {l.otherDisplayId} · {l.otherName}
                {l.otherGroup ? ` [${l.otherGroup}]` : ""}
              </Typography>
            </Box>
          }
        >
          <Chip
            label={assetLinkLabel(l)}
            size="small"
            variant="outlined"
            color={l.direction === "out" ? "primary" : "default"}
            sx={{
              fontSize: "0.65rem",
              height: "auto",
              py: 0.25,
              fontFamily: "monospace",
              "& .MuiChip-label": { whiteSpace: "normal", lineHeight: 1.3 },
            }}
          />
        </Tooltip>
      ))}
    </Stack>
  );
};
